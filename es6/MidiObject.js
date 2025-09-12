import { Message } from "./Message.js";
import { UNDEFINED_TIMESTAMP, Moment } from "./Moment.js";

// Returns an ordered array of strongly classed Moment objects.
// Each Moment is a strongly classed object containing strongly classed Message objects.
function _getMoments(midiChordElem)
{
	function getMsg(bytes)
	{
		var msg;

		switch(bytes.length)
		{
			case 1:
				msg = new Message(bytes[0]);
				break;
			case 2:
				msg = new Message(bytes[0], bytes[1]);
				break;
			case 3:
				msg = new Message(bytes[0], bytes[1], bytes[2]);
				break;
			default:
				//msg = new SysExMessage(bytes);
				throw "Unknown Message type.\n\n(The AssistantPerformer does not support SysExMessages.";
		}
		return msg;
	}

	function GetUInt8Msgs(msgElems)
	{
		var i, UInt8Msgs = [], UInt8Msg;

		for(i = 0; i < msgElems.length; ++i)
		{
			let msgElem = msgElems[i];
			if(msgElem.nodeName === "msg")
			{
				let msgStr = msgElem.getAttribute("m");
				let byteStrs = msgStr.split(' ');
				let bytes = [], byteStr, byte;
				for(let j = 0; j < byteStrs.length; ++j)
				{
					byteStr = byteStrs[j];
					if(byteStr.indexOf("0x") >= 0)
					{
						byte = parseInt(byteStr, 16);
					}
					else
					{
						byte = parseInt(byteStr, 10);
					}
					bytes.push(byte);
				}
				UInt8Msg = getMsg(bytes);					
				UInt8Msgs.push(UInt8Msg);
			}
		}
		return UInt8Msgs;
	}

	function GetEnvelopeDurations(msgElems)
	{
		var i, envDurations = [], duration;

		for (i = 0; i < msgElems.length; ++i)
		{
			let msgElem = msgElems[i];
			if (msgElem.nodeName === "msg")
			{
				let durStr = msgElem.getAttribute("msDur");
				duration = parseInt(durStr, 10);
				envDurations.push(duration);
			}
		}
		return envDurations;
	}

	// Returns an array of Moments.
	// Each Moment is an array of messages that are sent "synchronously" at their position wrt the chord:
	//     .msPosInChord
	//     .messages 
	function getMoments(initialMessages, envelopeMessages, noteOffMessages, noteOffsMsPos)
	{
		let moments = [];

		if(initialMessages.length > 0)
		{
			let initialMoment = new Moment(0);
			initialMoment.messages = initialMessages;
			moments.push(initialMoment);
		}

		if(envelopeMessages.length > 0)
		{
			let envMoment = new Moment(envelopeMessages[0].msPos);
			moments.push(envMoment);
			for(let i = 0; i < envelopeMessages.length; ++i)
			{
				let envMsg = envelopeMessages[i];
				if(envMsg.msPos === envMoment.msPosInChord)
				{
					envMoment.messages.push(envMsg);
				}
				else
				{
					envMoment = new Moment(envMsg.msPos);
					moments.push(envMoment);
					envMoment.messages.push(envMsg);
				}
			}
		}

		if (noteOffMessages.length > 0)
		{
			let noteOffMoment = new Moment(noteOffsMsPos);
			noteOffMoment.messages = noteOffMessages;
			moments.push(noteOffMoment);
		}

		return moments;
	}

	let scoreMidiChordChildren;

	if(midiChordElem !== undefined)
	{
		scoreMidiChordChildren = midiChordElem.children;
	}
	if(!(midiChordElem && scoreMidiChordChildren))
	{
		throw new Error("Illegal argument");
	}

	let currentMsPos = 0;	
	let initialMessages = [], envelopeMessages = [], noteOffMessages = [];
	for(let i = 0; i < scoreMidiChordChildren.length; ++i)
	{
		let midiChordChildElem = scoreMidiChordChildren[i],
			msgElems = midiChordChildElem.children;

		switch(midiChordChildElem.nodeName)
		{ 				
			case "controls":
			{
				// initialMessages are converted a moment in getMoments() (see below).
				let ctlMessages = GetUInt8Msgs(msgElems);
				initialMessages = initialMessages.concat(ctlMessages);
				break;
			}
			case "noteOns":
			{
				// initialMessages are converted a moment in getMoments() (see below).
				let noteOnMessages = GetUInt8Msgs(msgElems);
				initialMessages = initialMessages.concat(noteOnMessages);
				currentMsPos = parseInt(midiChordChildElem.getAttribute("msDur"));
				break;
			}
			case "envelope":
			{
                // envelopeMessages are converted to moments in getMoments() (see below).
				let envDurations = GetEnvelopeDurations(msgElems);
				envelopeMessages = GetUInt8Msgs(msgElems);
				for (let i = 0; i < envelopeMessages.length; ++i)
				{
					envelopeMessages[i].msPos = currentMsPos;
					currentMsPos += envDurations[i];
				}
				break;
			}
			case "noteOffs":
			{
				// noteOffMessages are converted to a moment in getMoments() (see below).
				noteOffMessages = GetUInt8Msgs(msgElems);
				break;
			}
			default:
				throw("unknown element type");
		}
	}

	let moments = getMoments(initialMessages, envelopeMessages, noteOffMessages, currentMsPos);
	moments.msDurInScore = currentMsPos;

	return moments;
}

class MidiObject
{
	constructor(midiObjectElem)
	{
		let moments = [];

		if (midiObjectElem.nodeName === "midiChord")
		{
			moments = _getMoments(midiObjectElem);
		}
		else if (midiObjectElem.nodeName === "midiRest")
		{
			let moment = new Moment(0); // There are no messages in the moment.messages array.
			moments.push(moment);
			moments.msDurInScore = parseInt(midiObjectElem.getAttribute("msDur"));
		}

     	// Each moments array is an ordered array of Moment objects.
		// A Moment is a list of logically synchronous Messages.
		// The msDurInScore and msPosInScore properties are not changed by the global speed option!
		// These values are used, but not changed, either when moving Markers about or during performances.)
		Object.defineProperty(this, "moments", { value: moments, writable: false });
		Object.defineProperty(this, "msDurInScore", { value: moments.msDurInScore, writable: false });

		// used at runtime
		Object.defineProperty(this, "currentMoment", { value: moments[0], writable: true });
		Object.defineProperty(this, "_currentMomentIndex", { value: -1, writable: true });
	}

	/***** The following functions are defined for both MidiChords and MidiRests *****************/

	// The chord or rest must be at or straddle the start marker.
	// This function sets the chord or rest to the state it should have when a performance starts.
	// this.currentMoment is set to the first moment at or after startMarkerMsPosInScore.
	// this.currentMoment will be undefined if there are no moments at or after startMarkerMsPosInScore. 
	setToStartMarker(startMarkerMsPosInScore)
	{
		var
			nMoments = this.moments.length,
			currentIndex, currentPosition;

		console.assert(
			((this.msPosInScore <= startMarkerMsPosInScore)
				&& (this.msPosInScore + this.msDurInScore > startMarkerMsPosInScore)),
			"This chord or rest must be at or straddle the start marker.");

		for(currentIndex = 0; currentIndex < nMoments; ++currentIndex)
		{
			currentPosition = this.msPosInScore + this.moments[currentIndex].msPosInChord;
			if(currentPosition >= startMarkerMsPosInScore)
			{
				break;
			}
		}
		this._currentMomentIndex = currentIndex;
		this.currentMoment = this.moments[currentIndex];
	}

	advanceCurrentMoment()
	{
		console.assert(this.currentMoment !== null, "CurrentMoment should never be null here!");

		this._currentMomentIndex++;

		if(this._currentMomentIndex < this.moments.length)
		{
			this.currentMoment = this.moments[this._currentMomentIndex];
			return this.currentMoment;
		}
		else
		{
			this._currentMomentIndex = 0;
			this.currentMoment = this.moments[0];
			return null;
		}
	}

	setToStartAtBeginning()
	{
		this._currentMomentIndex = 0;
		this.currentMoment = this.moments[0];
		for(let moment of this.moments)
		{
			moment.timestamp = UNDEFINED_TIMESTAMP;
		}
	}
}

export class MidiChord extends MidiObject
{
	// A MidiChord contains a private array of Moments containing all
	// the midi messages required for playing the chord (including a possible envelope).
	// A Moment is a collection of logically synchronous MIDI Messages.
	constructor(midiChordElem)
	{
		super(midiChordElem);
	}
}

export class MidiRest extends MidiObject
{
	// A MidiRest is functionally identical to a MidiChord.
	// Use instanceof to distinguish between the two.
	// However, MidiRest.moments always contains a single Moment,
	// whose messages array is empty.
	constructor(midiRestElem)
	{
		super(midiRestElem);
	}
}


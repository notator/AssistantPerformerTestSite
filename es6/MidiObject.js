import { Message } from "./Message.js";
import { UNDEFINED_TIMESTAMP, Moment } from "./Moment.js";

// returns strongly classed Moment objects containing strongly classed Message objects
// Each moments array is an ordered array of Moment objects.
// Each Moment is a strongly classed object containing strongly classed Message objects.
function _getMoments(scoreMidiChordElem)
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
	// Each Moment is an array of messages that are sent "synchronously" and their position wrt the chord:
	//     .msPositionInChord
	//     .messages 
	function getMoments(initialMessages, envelopeMessages, noteOffMessages, noteOffsMsPosition)
	{
		let moments = [];

		let initialMoment = new Moment(0);
		initialMoment.messages = initialMessages;
		moments.push(initialMoment);

		for (let i = 0; i < envelopeMessages.length; ++i)
		{
			let envMsg = envelopeMessages[i];
			let envMoment = new Moment(envMsg.msPosition);
			envMoment.messages = envelopeMessages;
			moments.push(envMoment);
		}

		if (noteOffMessages.length > 0)
		{
			let noteOffMoment = new Moment(noteOffsMsPosition);
			noteOffMoment.messages = noteOffMessages;
			moments.push(noteOffMoment);
		}

		return moments;
	}

	let scoreMidiChordChildren;

	if(scoreMidiChordElem !== undefined)
	{
		scoreMidiChordChildren = scoreMidiChordElem.children;
	}
	if(!(scoreMidiChordElem && scoreMidiChordChildren))
	{
		throw new Error("Illegal argument");
	}

	let currentMsPosition = 0;	
	let initialMessages = [], envelopeMessages = [], noteOffMessages = [];
	for(let i = 0; i < scoreMidiChordChildren.length; ++i)
	{
		let midiChordChildElem = scoreMidiChordChildren[i],
			msgElems = midiChordChildElem.children;

		switch(midiChordChildElem.nodeName)
		{ 				
			case "controls":
			{
				let ctlMessages = GetUInt8Msgs(msgElems);
				initialMessages = initialMessages.concat(ctlMessages);
				break;
			}
			case "noteOns":
			{
				let noteOnMessages = GetUInt8Msgs(msgElems);
				initialMessages = initialMessages.concat(noteOnMessages);
				currentMsPosition = parseInt(midiChordChildElem.getAttribute("msDuration"));
				break;
			}
			case "envelope":
			{
				let envDurations = GetEnvelopeDurations(msgElems);
				envelopeMessages = GetUInt8Msgs(msgElems);
				for (let i = 0; i < envelopeMessages.length; ++i)
				{
					envelopeMessages[i].msPosition = currentMsPosition;
					currentMsPosition += envDurations[i];
				}
				break;
			}
			case "noteOffs":
			{
				noteOffMessages = GetUInt8Msgs(msgElems);
				break;
			}
			default:
				throw("unknown element type");
		}
	}

	let moments = getMoments(initialMessages, envelopeMessages, noteOffMessages, currentMsPosition);
	moments.msDurationInScore = currentMsPosition;

	return moments;
}

class MidiObject
{
	constructor(scoreMidiChordElem)
	{
		let moments = _getMoments(scoreMidiChordElem);

     	// Each moments array is an ordered array of Moment objects.
		// A Moment is a list of logically synchronous Messages.
		// The msDurationInScore and msPositionInScore properties are not changed by the global speed option!
		// These values are used, but not changed, either when moving Markers about or during performances.)
		Object.defineProperty(this, "moments", { value: moments, writable: false });
		Object.defineProperty(this, "msDurationInScore", { value: moments.msDurationInScore, writable: false });
		//Object.defineProperty(that, "msPositionInScore", { value: 0, writable: true });

		// used at runtime
		Object.defineProperty(this, "currentMoment", { value: moments[0], writable: true });
		Object.defineProperty(this, "_currentMomentIndex", { value: -1, writable: true });
	}

	/***** The following functions are defined for both MidiChords and MidiRests *****************/

	// The chord must be at or straddle the start marker.
	// This function sets the chord to the state it should have when a performance starts.
	// this.currentMoment is set to the first moment at or after startMarkerMsPositionInScore.
	// this.currentMoment will be undefined if there are no moments at or after startMarkerMsPositionInScore. 
	setToStartMarker(startMarkerMsPositionInScore)
	{
		var
			nMoments = this.moments.length,
			currentIndex, currentPosition;

		console.assert(
			((this.msPositionInScore <= startMarkerMsPositionInScore)
				&& (this.msPositionInScore + this.msDurationInScore > startMarkerMsPositionInScore)),
			"This chord or rest must be at or straddle the start marker.");

		for(currentIndex = 0; currentIndex < nMoments; ++currentIndex)
		{
			currentPosition = this.msPositionInScore + this.moments[currentIndex].msPositionInChord;
			if(currentPosition >= startMarkerMsPositionInScore)
			{
				break;
			}
		}
		this._currentMomentIndex = currentIndex;
		this.currentMoment = this.moments[currentIndex];
	}

	advanceCurrentMoment()
	{
		var returnMoment;

		console.assert(this.currentMoment !== null, "CurrentMoment should never be null here!");

		this._currentMomentIndex++;
		returnMoment = null;
		if(this._currentMomentIndex < this.moments.length)
		{
			this.currentMoment = this.moments[this._currentMomentIndex];
			returnMoment = this.currentMoment;
		}
		return returnMoment;
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
	// the midi messages required for playing an (ornamented) chord.
	// A Moment is a collection of logically synchronous MIDI Messages.
	constructor(scoreMidiChordElem)
	{
		super(scoreMidiChordElem);
	}
}

export class MidiRest extends MidiObject
{
	// A MidiRest is functionally identical to a MidiChord.
	// Use instanceof to distinguish between the two.
	constructor(scoreMidiElem)
	{
		super(scoreMidiElem);
	}
}


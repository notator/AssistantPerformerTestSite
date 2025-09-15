
import { constants } from "./Constants.js";
const UNDEFINED_TIMESTAMP = constants.UNDEFINED_TIMESTAMP;

class Moment
{

	// Moment constructor
	// The moment.msPosInChord is the position of the moment wrt its MidiChord or MidiRest.
	// it is initially set to the value stored in the score, but changes if the performance speed is not 100%.
	// During performances (when the absolute DOMHRT time is known) moment.msPosInChord is used, with
	// the msPos of the containing MidiChord or MidiRest, to set moment.timestamp. 
	constructor(msPosInChord)
	{
		if(msPosInChord === undefined || msPosInChord < 0)
		{
			throw "Error: Moment.msPosInChord must be defined.";
		}

		this.msPosInChord = msPosInChord;

		// The absolute time (DOMHRT) at which this moment is sent to the output device.
		// This value is always set in Performer.nextMoment().
		this.timestamp = UNDEFINED_TIMESTAMP;

		this.messages = []; // an array of Messages (can be replaced)
	}

	// Adds the moment2.messages to the end of the current messages using
	// msPosInPerf attributes to check synchronicity.
	// Throws an exception if moment2.msPosInPerf !== this.msPosInPerf.
	mergeMoment(moment2)
	{
		var msPosInPerf = this.msPosInPerf;

		console.assert(msPosInPerf === moment2.msPosInPerf, "Attempt to merge moments having different msPosInPerf values.");

		this.messages = this.messages.concat(moment2.messages);
	}

	// returns an object having a timestamp and a clone of this.messages[]
	recordingData()
	{
		let rval = { timestamp: this.timestamp, messages: [] },
			rvalMessages = rval.messages;

		for(let message of this.messages)
		{
			rvalMessages.push(message.clone());
		}
		return rval;
	}
}

export { UNDEFINED_TIMESTAMP, Moment };

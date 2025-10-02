
//import { constants } from "./Constants.js";
//const UNDEFINED_TIMESTAMP = constants.UNDEFINED_TIMESTAMP;

export class Moment
{
	// Moment constructor
	// The constructorArg must either be a number (msPosInChord) or a Moment.
	// The moment.msPosInChord is the position of the moment wrt its MidiChord or MidiRest. 
	constructor(constructorArg)
	{
		if(constructorArg instanceof Moment)
		{
			// clone the Moment
			let originalMoment = constructorArg;
			// clone the attributes
			this.msPosInChord = originalMoment.msPosInChord;
			this.msPosInPerf = originalMoment.msPosInPerf;
			this.msPosInScore = originalMoment.msPosInScore;
			this.nextMoment = originalMoment.nextMoment; // null, to be set later
			// the messages are not cloned since they never change.
			this.messages = originalMoment.messages;
		}
		else if(Number.isNaN(constructorArg) === false)
		{
			let msPosInChord = constructorArg;
			if(msPosInChord >= 0)
			{
				this.msPosInChord = msPosInChord;
				this.msPosInPerf = -1; // not known here
				this.msPosInScore = -1; // not known here
				this.nextMoment = null; // not known here
				this.messages = []; // an array of Messages (can be replaced)
			}
			else
			{
				throw "Error: Moment.msPosInChord must be a number >= 0.";
			}			
		}
		else
		{
			throw "Programming error: constructorArg must either be a number (=msPosInChord) or a Moment.";
		}

		// The absolute time (DOMHRT) at which this moment is sent to the output device.
		// This value is always set in Performer.nextMoment().
		// REMARK: I think this timestamp should be added _later_ to save space...
		// this.timestamp = UNDEFINED_TIMESTAMP;
	}

	// Adds the moment2.messages to the end of the current messages using
	// msPosInPerf attributes to check synchronicity.
	// Throws an exception if moment2.msPosInPerf !== this.msPosInPerf.
	mergeMoment(moment2)
	{
		console.assert(this.msPosInPerf === moment2.msPosInPerf, "Attempt to merge moments having different msPosInPerf values.");

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

//export { UNDEFINED_TIMESTAMP, Moment };

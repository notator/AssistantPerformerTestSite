/*
 *  copyright 2012 James Ingram
 *  https://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  ap/Moment.js
 *  The _AP.moment namespace which defines
 *
 *      // A read-only constant (-1), used by Moments
 *      UNDEFINED_TIMESTAMP
 *      
 *      // Moment constructor. Moments contain Messages, and are contained by Tracks.
 *      Moment(msPositionInChord)
 *                                
 *  Public Moment interface:
 *      
 *      // an array of temporally ordered Messages.
 *      messages
 *
 *      // the msPosition of the Moment in the score, relative to the beginning of its MidiChord.
 *      msPositionInChord;
 *      
 *      // The time at which the moment is actually sent. Initially UNDEFINED_TIMESTAMP.
 *      // Is set to absolute DOMHRT time in Sequence.nextMoment().
 *      timestamp;
 *
 *      // functions (defined on the prototype):
 *
 *      // appends the messages from another Moment, having the
 *      // same msPositionInChord, to the end of this Moment.
 *      mergeMoment(moment);
 */

_AP.namespace('_AP.moment');

_AP.moment = (function ()
{
    "use strict";

    var
    UNDEFINED_TIMESTAMP = -1,

    // Moment constructor
    // The moment.msPositionInChord is the position of the moment wrt its MidiChord or MidiRest.
    // it is initially set to the value sored in the score, but changes if the performance speed is not 100%.
    // During performances (when the absolute DOMHRT time is known) moment.msPositionInChord is used, with
    // the msPosition of the containing MidiChord or MidiRest, to set moment.timestamp. 
    Moment = function (msPositionInChord)
    {
        if (!(this instanceof Moment))
        {
            return new Moment(msPositionInChord);
        }

        if(msPositionInChord === undefined || msPositionInChord < 0)
        {
            throw "Error: Moment.msPositionInChord must be defined.";
        }

        Object.defineProperty(this, "msPositionInChord", { value: msPositionInChord, writable: true });

        // The absolute time (DOMHRT) at which this moment is sent to the output device.
        // This value is always set in Sequence.nextMoment().
        this.timestamp = UNDEFINED_TIMESTAMP;

        this.messages = []; // an array of Messages

        return this;
    },

    publicAPI =
    {
        UNDEFINED_TIMESTAMP: UNDEFINED_TIMESTAMP,
        // creates an empty Moment
        Moment: Moment
    };

    // Adds the moment2.messages to the end of the current messages using
    // msPositionInChord attributes to check synchronousness.
    // Throws an exception if moment2.msPositionInChord !== this.msPositionInChord.
    Moment.prototype.mergeMoment = function (moment2)
    {
        var msPositionInChord = this.msPositionInChord;

        console.assert(msPositionInChord === moment2.msPositionInChord, "Attempt to merge moments having different msPositionInChord values.");

        this.messages = this.messages.concat(moment2.messages);
	};

	// returns an object having a timestamp and a clone of this.messages[]
	Moment.prototype.recordingData = function()
	{
		let rval = { timestamp: this.timestamp, messages: [] },
			rvalMessages = rval.messages;

		for(let message of this.messages)
		{
			rvalMessages.push(message.clone());
		}
		return rval;
	};

    return publicAPI;

} ());

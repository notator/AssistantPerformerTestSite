import { Moment } from "./Moment.js";
import { Conductor } from "./Conductor.js";

let moments, // Set in play().
	timer, // performance or conductor (use performance.now() or conductor.now())
	outputDevice, // either outputDevice.send function or conductor.midiThruSend function.

	startOfRegion,
	previousMomtMsPosInScore, // nextMoment()
	currentMoment = null, // nextMoment(), resume(), tick()
	endOfConductedPerformance,

	//startMarkerMsPosInScore,
	endMarkerMsPosInScore,

	// used by setState()
	pausedMoment = null, // set by pause(), used by resume()
	stopped = true, // nextMoment(), stop(), pause(), resume(), isStopped()
	paused = false, // nextMoment(), pause(), isPaused()

	reportEndOfPerformance, // callback. Set in play().
	reportEndOfRegion, // callback	
	reportMsPosInScore,  // callback. Set in play().
	reportUndersizedMomentDuration, // callback. Set in play().

	lastReportedMsPos = -1, // set by tick() used by nextMoment()
	msPosToReport = -1,   // set in nextMoment() and used/reset by tick()
	nUndersizedMomentDurations = 0, // incremented in tick() if different moments are sent at the same time.
	previousTimestamp = 0,
	
	regionSequence, // an array of objects having .startMsPosInScore, .endMsPosInScore and  .startMsPosInPerformance objects (is set in init())
	currentRegionIndex, // the index in the regionSequence
	endRegionIndex,

	// (timer.now() - performanceStartTime) is the real time elapsed since the start of the performance.
	performanceStartTime = -1,  // set in play(), used by stop(), run()
	// (timer.now() - startTimeAdjustedForPauses) is the current performance duration excluding the durations of pauses.
	startTimeAdjustedForPauses = -1, // performanceStartTime minus the durations of pauses. Used in nextMoment()
	pauseStartTime = -1, // the timer.now() time at which the performance was paused.

	speed = 1, // in non-conducted performances, speed can be set at performance time using setSpeed(speed)

	sequenceRecording, // the sequence being recorded. set in play() and resume(), used by tick()

	setState = function(state)
	{
		switch(state)
		{
			case "stopped":
				stopped = true;
				paused = false;
				pauseStartTime = timer.now();
				pausedMoment = currentMoment;
				currentMoment = null;
				break;
			case "paused":
				stopped = false;
				paused = true;
				pauseStartTime = timer.now();
				pausedMoment = currentMoment;
				currentMoment = null;
				break;
			case "running":
				stopped = false;
				paused = false;
				pauseStartTime = -1;
				pausedMoment = null;
				break;
			default:
				throw "Unknown sequence state!";
		}
	},

	scheduleReportEndOfPerformance = function(sequenceRecording, performanceMsDur)
	{
		let performanceData = {sequenceRecording, performanceMsDur};

		requestAnimationFrame(() => reportEndOfPerformance(performanceData));

	},

	// This function uses, but does not change, the global moments variable.
	// The moments' content can change as the result of Tracks being turned on or off, so they are reloaded from
	// the score each time the Go button is clicked (i.e. in performer.play()).
	// The moments are a linked list of Moment:
	//   Each Moment has a nextMoment attribute pointing at the next Moment. The final moment.nextMoment is null.
	// Moments that need to update the cursor in the GUI during performance have a .msPosInScore attribute.
    // Moments that need to update the current region in the GUI during performance have a .regionIndex attribute.
	// This function is called by tick(), resume(), play().
	// It returns the next moment or null.
	// Null is returned if there are no more moments or if the sequence is paused or stopped.
	nextMoment = function()
	{
		let	nextMomtMsPosInScore, nextMomt = null, delay;

		function stopAtEndOfPerformance()
		{			
			var performanceMsDur = Math.ceil(timer.now() - performanceStartTime);
			setState("stopped");
			scheduleReportEndOfPerformance(sequenceRecording, performanceMsDur);
		}

		function scheduleReportEndOfRegion(regionIndex)
		{
			requestAnimationFrame(() => reportEndOfRegion(regionIndex));
		}

		if(document.hidden === true)
		{
			stopAtEndOfPerformance();
		}
		else if(currentMoment.nextMoment === null)
		{
			if(timer instanceof Conductor)
			{
				if(endOfConductedPerformance === false)
				{
					nextMomt = new Moment(0, 0);  // dummy moment
					nextMomtMsPosInScore = endMarkerMsPosInScore;
					endOfConductedPerformance = true;
				}
				else
				{
					stopAtEndOfPerformance();
				}
			}
			else // using performance.now()
			{
				// The returned nextMomt is going to be null, and tick() will stop, while waiting to call stopAfterDelay().
				setState("stopped");
				// Wait for the duration of the final moment before stopping. (An assisted performance (Keyboard1) waits for a noteOff...)
				delay = (endMarkerMsPosInScore - previousMomtMsPosInScore) / speed;
				window.setTimeout(stopAtEndOfPerformance, delay);
			}
		}
		else
		{
			nextMomt = currentMoment.nextMoment;
			if(nextMomt !== null)
			{
				if(nextMomt.regionIndex !== undefined && nextMomt.regionIndex !== currentRegionIndex)
				{
					scheduleReportEndOfRegion(currentRegionIndex);
					startOfRegion = true;
					currentRegionIndex = nextMomt.regionIndex;
					console.assert(nextMomt.msPosInScore === regionSequence[currentRegionIndex].startMsPosInScore);											
				}
				nextMomtMsPosInScore = nextMomt.msPosInScore;
			}
		}

		// TODO: revise the following.
		if(!stopped && !paused)
		{
			if((nextMomtMsPosInScore > lastReportedMsPos) || startOfRegion)
			{
				// the position will be reported by tick() when nextMomt is sent.
				msPosToReport = nextMomtMsPosInScore;
				//console.log("msPosToReport=%i", msPosToReport);
			}

			if(previousTimestamp === null)
			{
				nextMomt.timestamp = startTimeAdjustedForPauses;
			}
			else if(startOfRegion)
			{
				let duration = (regionSequence[currentRegionIndex - 1].endMsPosInScore - previousMomtMsPosInScore) / speed;
				//console.log("start of region moment duration: " + duration.toString());
				nextMomt.timestamp = duration + previousTimestamp;
				startOfRegion = false;
			}
			else
			{
				let duration = (nextMomtMsPosInScore - previousMomtMsPosInScore) / speed;
				//console.log("moment duration: " + duration.toString());
				nextMomt.timestamp = duration + previousTimestamp;
			}

			previousTimestamp = nextMomt.timestamp;
			previousMomtMsPosInScore = nextMomtMsPosInScore;
		}

		return nextMomt; // null stops tick().
	},

	// tick() function -- which ows a lot to Chris Wilson of the Web Audio Group
	// Recursive function. Also used by resume(), play()
	// This function has been tested as far as possible without having "a conformant send() with timestamps".
	// It needs testing again with the conformant send() and a higher value for PREQUEUE. What would the
	// ideal value for PREQUEUE be? 
	// Email correspondence with Chris Wilson (End of Oct. 2012):
	//      James: "...how do I decide how big PREQUEUE should be?"
	//      Chris: "Well, you're trading off two things:
	//          - 'precision' of visual display (though keep in mind that is fundamentally limited to the 16.67ms tick
	//            of the visual refresh rate (for a 60Hz display) - and that also affects how quickly you can respond
	//            to tempo changes (or stopping/pausing playback).
	//          - reliance on how accurate the setTimeout/setInterval clock is (for that reason alone, the lookahead
	//            probably needs to be >5ms).
	//          So, in short, you'll just have to test on your target systems."
	//      James: "Yes, that's more or less what I thought. I'll start testing with PREQUEUE at 16.67ms."
	//
	// 16th Nov. 2012: The cursor can only be updated once per tick, so PREQUEUE needs to be small enough for that not
	// to matter.
	//
	// 20th Dec. 2018: (while programming the TimerConductor)
	// Changed PREQUEUE from 0 to 6.
	// The TimerConductor is now running setInterval at a nominal 3ms, which means
	// "as fast as meaningfully possible, and definitely faster than PREQUEUE".
	// This means that this tick function treats all events that happen within 6ms 
	// as "synchronous", and performs them in a tight loop.
	//
	// 4th October 2025: (while programming AssistantPerformer2025)
	// 1. Removed the local PREQUEUE and delay variables, and the PREQUEUE loop.
	//    This tick() function is called recursively per moment, and each moment's messages are conceptually
	//    synchronous (i.e.have the same timestamp).
	// 2. reportMsPosInScore(msPos) and reportUndersizedMomentDuration() are now called using requestAnimationFrame.
	//    Copilot showed me how to use requestAnimationFrame to minimize the disruption to setTimeout
	//    while updating the GUI.
	// This scheme means that performance is _locally_ accurate (i.e. the individual moment.msDurations
	// are respected as accurately as possible by setTimeOut, and the sound is always synchronised as
	// accurately as possible with the GUI, but the actual overall duration of the performance may not be
	// exactly the sum of (moment.msDurations / speed). The recorded timestamps are set using the actual
	// timings in the performance.
	tick = function()
	{
		// moment.timestamps are always absolute DOMHRT values here.
		function sendMessages(moment)
		{
			var
				messages = moment.messages,
				i, nMessages = messages.length, timestamp = moment.timestamp;

			for(i = 0; i < nMessages; ++i)
			{
				outputDevice.send(messages[i].data, timestamp);
			}
		}

		// Copilot showed me how to use requestAnimationFrame here.
		function scheduleReportMsPosInScore(msPosToReport)
		{
			requestAnimationFrame(() => reportMsPosInScore(msPosToReport));
		}

		function scheduleReportUndersizedMomentDuration()
		{
			requestAnimationFrame(() => reportUndersizedMomentDuration());
		}

		if(currentMoment === null)
		{
			return;
		}

		if(msPosToReport >= 0)
		{
			scheduleReportMsPosInScore(msPosToReport);
			if(nUndersizedMomentDurations > 0)
			{
				scheduleReportUndersizedMomentDuration();
				nUndersizedMomentDurations = 0;
			}
			lastReportedMsPos = msPosToReport;
			msPosToReport = -1;
		}

		if(currentMoment.messages.length > 0) // rest moments can be empty (but should be reported above) 
		{
			currentMoment.timestamp = timer.now();

			sendMessages(currentMoment);

			if(sequenceRecording !== undefined && sequenceRecording !== null)
			{
				sequenceRecording.performedMoments.push(currentMoment); // will be processed later
			}
		}

		if(currentMoment.timestamp - previousTimestamp < 1)
		{
			nUndersizedMomentDurations++;
		}
		previousTimestamp = currentMoment.timestamp;
		
		let delay = currentMoment.msDuration / speed;

		currentMoment = nextMoment();
		if(currentMoment === null)
		{
			// we're pausing, or have hit the end of the sequence.
			return;
		}

		window.setTimeout(tick, delay );  // schedules the next tick.
	},

	// Public function. Should only be called when this sequence is paused (and pausedMoment is set correctly).
	resume = function()
	{
		var pauseMsDur;

		if(pausedMoment === null || pauseStartTime < 0)
		{
			throw "Error: pausedMoment and pauseStartTime must be defined here.";
		}

		currentMoment = pausedMoment; // the moment that is about to be sent.
		pauseMsDur = timer.now() - pauseStartTime;

		setState("running"); // sets pausedMoment to null.

		currentMoment.timestamp += pauseMsDur;
		previousTimestamp += pauseMsDur;
		startTimeAdjustedForPauses += pauseMsDur;

		tick();
	},

	run = function()
	{
		if(pausedMoment !== null)
		{
			resume();
		}
		else
		{
			setState("running");

			currentRegionIndex = 0;
			currentMoment = moments[0];
			previousTimestamp = 0;
			if(currentMoment === null)
			{
				return;
			}
			tick();
		}
	},

	isStopped = function()
	{
		return (stopped === true && paused === false);
	},

	isPaused = function()
	{
		return (stopped === false && paused === true);
	},

	isRunning = function()
	{
		return (stopped === false && paused === false);
	};

export class Performer
{
	// The reportEndOfPerfCallback argument is a callback function which is called when performing sequence ends
	// It is called in this file as:
	//      reportEndOfPerformance(performanceData) // performanceData is {sequenceRecording, performanceMsDur}
	// The reportEndOfRegionCallback argument is a callback function that is called when a new Region is about to start.
	// Only those Moments that are at the beginning of a Region have a .startRegion attribute. The attribute's value is
	// the Region that is about to start.
	// The reportMsPosInScoreCallback argument is a callback function which reports the current
	// msPosInScore back to the GUI while performing.
	// It is called here as:
	//      reportMsPosInScore(msPosToReport);
	// The msPos it passes back is the original number of milliseconds from the start of the score
	// (regardless of the current speed).This value is used to identify chord and rest symbols in the score,
	// and so to synchronize the running cursor.
	// Only those Moments whose msPosInScore is to be reported have a .msPosInScore attribute.
	constructor(outputDeviceArg, reportEndOfPerfCallback, reportEndOfRegionCallback, reportMsPosInScoreCallback, reportUndersizedMomentDurationCallBack, regionSequenceArg)
	{		
		if(outputDeviceArg === undefined || outputDeviceArg === null)
		{
			throw "The midi output device must be defined.";
		}

		if(reportEndOfPerfCallback === undefined || reportEndOfPerfCallback === null
			|| reportEndOfRegionCallback === undefined || reportEndOfRegionCallback === null
			|| reportMsPosInScoreCallback === undefined || reportMsPosInScoreCallback === null
			|| reportUndersizedMomentDurationCallBack === undefined || reportUndersizedMomentDurationCallBack === null)
		{
			throw "Error: all callbacks must be defined.";
		}

		timer = performance; // performance.now() is the default timer

		outputDevice = outputDeviceArg;

		reportEndOfPerformance = reportEndOfPerfCallback;
		reportEndOfRegion = reportEndOfRegionCallback;		
		reportMsPosInScore = reportMsPosInScoreCallback;
		reportUndersizedMomentDuration = reportUndersizedMomentDurationCallBack;
		regionSequence = regionSequenceArg;

		// external interface
		this.resume = resume;
		this.isStopped = isStopped;
		this.isPaused = isPaused;
		this.isRunning = isRunning;

		setState("stopped");
	}

	setTimerAndOutputDevice(objectWithNowFunction, objectWithSendFunction)
	{
		timer = objectWithNowFunction; // use objectWithNowFunction.now() for timings
		outputDevice = objectWithSendFunction; // use objectWithSendFunction.send() to send midi messages
	}

	setSpeed(speedToSet)
	{
		speed = speedToSet;
	}

	// play()
	// In blue, live conducted performances, Performer.speed is always 1. (The speed slider value is used differently.)
	// In normal performances, Performer.speed is the value of the global speed slider (range [0.1..9.99]).
	play(momentsArg, startRegionIndex, startMarkerMsPosInScore, endRegionIndexArg, endMarkerMsPosInScore, recording)
	{
		moments = momentsArg;		
		currentRegionIndex = startRegionIndex;
		previousMomtMsPosInScore = startMarkerMsPosInScore;
		endRegionIndex = endRegionIndexArg;	
		endMarkerMsPosInScore = endMarkerMsPosInScore;
		// The 'recording' argument is an empty SequenceRecording to which timestamped moments will be added as they are performed.
	    // It has the same number of tracks as the trackIsOnArray, but a track will be undefined if it has been turned off for this performance.
		sequenceRecording = recording;
		
		pausedMoment = null;
		pauseStartTime = -1;
		previousTimestamp = null;
		
		msPosToReport = -1;
		lastReportedMsPos = -1;
		endOfConductedPerformance = false;

		performanceStartTime = timer.now();
		startTimeAdjustedForPauses = performanceStartTime;
		startOfRegion = false;	

		run();
	}


	// Should only be called while running a non-assisted performance
	pause()
	{
		if((stopped === false && paused === false))
		{
			setState("paused");
		}
		else
		{
			throw "Attempt to pause a stopped or paused sequence.";
		}
	}

	// does nothing if the sequence is already stopped
	stop()
	{
		var performanceMsDur;

		if(!(stopped === true && paused === false))
		{
			setState("stopped");
			performanceMsDur = Math.ceil(timer.now() - performanceStartTime);
			scheduleReportEndOfPerformance(sequenceRecording, performanceMsDur);
		}
	}
}






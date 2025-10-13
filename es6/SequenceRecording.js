
import { TrackRecording } from "./TrackRecording.js";

export class SequenceRecording 
{
	// An empty sequenceRecording is created.
	// It has an array of empty TrackRecording objects allocated per channel index.
	// Note that the trackRecordings.length will always be maximum channel index + 1, but that the array
	// can contain undefined members (e.g. if the outputTracks argument contains a single track in channel 2).
	constructor(trackIsOnArray)
	{
		let i, nOutputTracks = trackIsOnArray.length;

		// moments are initially stored here during a performance. 
		this.performedMoments = [];
		// the trackRecordings are filled by processPerformedMoments() when the performance has stopped.
		this.trackRecordings = [];
		for(i = 0; i < nOutputTracks; ++i)
		{
			if(trackIsOnArray[i] === true)
			{
				this.trackRecordings.push(new TrackRecording());
			}
		}
	}

	// Sets the separate trackRecordings, each with a normalized timestamp relative to the start of the recording.
	processPerformedMoments()
	{
		function normalizeTimestamps(that)
		{
			let performedMoments = that.performedMoments,
				originTimestamp = performedMoments[0].timestamp;

			for(let moment of performedMoments)
			{
				moment.timestamp -= originTimestamp;
			}
		}

		function getTrackRecordings(that, currentMoment)
		{
			let timeStampedMessages = currentMoment.timestampedMessages(),
				timestamp = timeStampedMessages.timestamp,					
				messages = timeStampedMessages.messages,
				messagesPerTrack = [],
				timestampedMoment = {};

			for(let msg of messages)
			{
				let trIndex = msg.channel();
			
				if(messagesPerTrack[trIndex] === undefined)
				{
					messagesPerTrack[trIndex] = [];
				}
				messagesPerTrack[trIndex].push(msg);											
			}
			timestampedMoment.timestamp = timestamp;
			for(let trackIndex = 0; trackIndex < messagesPerTrack.length; ++trackIndex)
			{
				let trackRecording = that.trackRecordings[trackIndex];

				timestampedMoment.messages = messagesPerTrack[trackIndex];					
				trackRecording.moments.push(timestampedMoment);
			}
		}

		console.assert(this.performedMoments.length > 0);
		normalizeTimestamps(this);
		for(let moment of this.performedMoments)
		{
			getTrackRecordings(this, moment);			
		}
	}

	// Returns true if any of the trackRecordings contain moments, otherwise false.
	// Used to prevent the creation of a 'save' button when there is nothing to save.
	hasData()
	{
		let	has = false,
			trackRecordings = this.trackRecordings,
			nTracks = trackRecordings.length;

		for(let i = 0; i < nTracks; ++i)
		{
			if(trackRecordings[i] !== undefined && trackRecordings[i].moments.length > 0)
			{
				has = true;
				break;
			}
		}
		return has;
	}

	// Returns the processed sequence as a JSON string wrapped in a Blob.
	// The JSON string is in the format that can be read by the ResidentSynthHost.
	toJSON(sequenceMsDur)
	{
		let jsonString = "", // TODO
		jsonBlob = new Blob([jsonString], {type:"application/json"} );

		return jsonBlob;
	}
}




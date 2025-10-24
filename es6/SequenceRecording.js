
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
		this.performedMoments = []; // will be ignored by JSON.stringify when saving the recording.

		this.totalDuration = -1; // will be set at the end of a recording
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
				moment.timestamp = Math.round(moment.timestamp);
			}

			// merge moments having identical timestamps
			for(let momentIndex = performedMoments.length - 1; momentIndex >= 1; momentIndex--)
			{
				let currentMoment = performedMoments[momentIndex],
					previousMoment = performedMoments[momentIndex - 1];

				if(previousMoment.timestamp === currentMoment.timestamp)
				{
					console.assert(false, "Untested code.");
					previousMoment.mergeMoment(currentMoment);
					performedMoments.splice(momentIndex, 1); // remove the current moment
				}
			}
		}

		function getTrackRecordings(that, currentMoment)
		{
			let timeStampedMessages = currentMoment.timestampedMessages(),
				timestamp = timeStampedMessages.timestamp,					
				messages = timeStampedMessages.messages,
				messagesPerTrack = [];

			for(let msg of messages)
			{
				let trIndex = msg.channel();
			
				if(messagesPerTrack[trIndex] === undefined)
				{
					messagesPerTrack[trIndex] = [];
				}
				messagesPerTrack[trIndex].push(msg);											
			}
			
			for(let trackIndex = 0; trackIndex < messagesPerTrack.length; ++trackIndex)
			{
				let trackRecording = that.trackRecordings[trackIndex],
					timestampedMoment = {};

				timestampedMoment.timestamp = timestamp;
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
	toJSON(downloadName, sequenceMsDur)
	{
		function toResidentSynthRecording(downloadName, trackRecordings, sequenceMsDur)
		{
			function getOutMsgString(trackIndex, msgData, timestamp)
			{
				const NOTE_OFF = 0x80,
					  NOTE_ON = 0x90;

				let msgString = "";

				if(msgData[0] - trackIndex === NOTE_OFF)
				{
					msgString += ((NOTE_ON + trackIndex).toString() + ",");
					msgString += (msgData[1].toString() + ",");
					msgString += "0,";
					
				}
				else
				{
					msgString += (msgData[0].toString() + ",");
					msgString += (msgData[1].toString() + ",");
					let data2String = (msgData[2] === undefined) ? "0" : msgData[2];
					msgString += (data2String + ",")
				}
				msgString += timestamp.toString();

				return msgString;
			}

			let recording = {};

			recording.name = downloadName;
			recording.channels = [];

			for(let trackIndex = 0; trackIndex < trackRecordings.length; trackIndex++)
			{
				let channel = {};
				channel.channel = trackIndex;
				channel.messages = [];

				let moments = trackRecordings[trackIndex].moments;
				
				for(let momentIndex = 0; momentIndex < moments.length; momentIndex++)
				{
					let moment = moments[momentIndex],
						timestamp = moment.timestamp,
						messages = moment.messages;

					if(messages !== undefined) // can be undefined if the performance was stopped prematurely
					{
						for(let msg of messages)
						{
							let outMsgString = getOutMsgString(trackIndex, msg.data, timestamp);
							channel.messages.push(outMsgString);
						}
					}
				}
				
				recording.channels.push(channel);
			}

			return recording;
		}

		let recording = toResidentSynthRecording(downloadName, this.trackRecordings, sequenceMsDur);

		let jsonString = JSON.stringify(recording);
		
		let jsonBlob = new Blob([jsonString], {type:"application/json"} );

		return jsonBlob;
	}
}




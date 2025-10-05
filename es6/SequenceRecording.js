
import { TrackRecording } from "./TrackRecording.js";
//import { Message } from "./Message.js";

export class SequenceRecording 
{
	// An empty sequenceRecording is created.
	// It has an array of empty TrackRecording objects allocated per channel index.
	// Note that the trackRecordings.length will always be maximum channel index + 1, but that the array
	// can contain undefined members (e.g. if the outputTracks argument contains a single track in channel 2).
	constructor(trackIsOnArray)
	{
		let i, nOutputTracks = trackIsOnArray.length;

		this.trackRecordings = [];
		for(i = 0; i < nOutputTracks; ++i)
		{
			if(trackIsOnArray[i] === true)
			{
				this.trackRecordings.push(new TrackRecording());
			}
		}
	}

	//// The data argument is a Uint8Array 
	//addMessage(data, timestamp)
	//{
	//	var channelIndex = data[0] & 0xF,
	//		message;
	//
	//	switch(data.length)
	//	{
	//		case 1:
	//			message = new Message(data[0]);
	//			break;
	//		case 2:
	//			message = new Message(data[0], data[1]);
	//			break;
	//		case 3:
	//			message = new Message(data[0], data[1], data[2]);
	//			break;
	//	}
	//	this.trackRecordings[channelIndex].addMessage(message, timestamp);
	//}

	// The trackRecordings are recorded separately, each with the currentMoment's (absolute DOMHRT) timestamp.
	// These values will be adjusted relative to the first moment.timestamp
	// before saving them in a Standard MIDI File.
	// (i.e. the value of the earliest timestamp in the recording will be
	// subtracted from all the timestamps in the recording)
	record(currentMoment)
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
			let trackRecording = this.trackRecordings[trackIndex];

			timestampedMoment.messages = messagesPerTrack[trackIndex];					
			trackRecording.moments.push(timestampedMoment);
		}
	}
}




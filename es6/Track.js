
import { constants } from "./Constants.js";
import { MidiRest, MidiChord } from "./MidiObject.js";
import {RegionControls} from "./RegionControls.js";

class Interpretation
{
	constructor()
	{
		this.currentMoment = null;
		this.midiObjects = [];
		this.isOn = true;
		this.hasEndedRegion = false;
		this._regionLinks = [];
		this._currentMidiObjectIndex = -1;
		this._currentMidiObject = null;
	}

	finalBarlineMsPosition()
	{
		let lastMidiObject, finalBarlineMsPos;
		let midiObjects = this.midiObjects;
		if (midiObjects === undefined)
		{
			throw "Can't get finalBarlineMsPosition!";
		}
		lastMidiObject = midiObjects[midiObjects.length - 1];
		finalBarlineMsPos = lastMidiObject.msPositionInScore + lastMidiObject.msDurationInScore;
		return finalBarlineMsPos;
	}

	setOutputSpan(trackIndex, startMarkerMsPositionInScore, endMarkerMsPositionInScore, regionStartMsPositionsInScore)
	{
		// Sets track._currentMidiObjectIndex, track._currentMidiObject and track.currentMoment.
		// If a MidiChord starts at or straddles the startMarker, it becomes the track._currentMidiObject, and
		// track.currentMoment is set to the its first moment at or after the startMarker.
		// If a MidiRest begins at the startMarker, it becomes the track._currentMidiObject, and
		// track.currentMoment is set to its (only) moment (which may be empty).
		// If a MidiRest straddles the startMarker, track._currentMidiObject is set to the following MidiChord, and
		// track.currentMoment is set to the its first moment.
		// track._currentMidiObjectIndex is the index of the track._currentMidiObject, in track.midiObjects.
		//
		// 17.08.2021: this function now returns an array of Messages that should be sent by player.run(...)
		// at the beginning of a performance to set the CC and preset state of the track.
		function setInitialTrackState(that, startMarkerMsPositionInScore, endMarkerMsPositionInScore)
		{
			let isRegParamIndex, regParamIndex;

			// Adds msg to messages, replacing a similar message, if it exists.
			function addUnique(msg, messages)
			{
				const CMD = WebMIDI.constants.COMMAND,
					CTL = WebMIDI.constants.CONTROL;

				let cmd = msg.command(),
					index;

				isRegParamIndex = false;

				if (cmd === CMD.CONTROL_CHANGE)
				{
					let ctl = msg.data[1];

					if (ctl === CTL.REGISTERED_PARAMETER)
					{
						let regParamValue = msg.data[2];
						index = messages.findIndex(x => {(x.data[0] === cmd) && (x.data[1] === ctl) && (x.data[2] === regParamValue);});
						regParamIndex = index;
						isRegParamIndex = true;
					}
					else if (ctl === CTL.DATA_ENTRY)
					{
						index = regParamIndex + 1; // regParamIndex must have been set by the previous message
						regParamIndex = undefined;
					}
					else
					{
						index = messages.findIndex(x => {(x.data[0] === cmd) && (x.data[1] === ctl);});
					}
				}
				else
				{
					index = messages.findIndex(x => (x.data[0] === cmd));
				}

				if (index === -1)
				{
					messages.push(msg);
					if (isRegParamIndex === true)
					{
						regParamIndex = messages.length - 1;
					}
				}
				else
				{
					messages[index] = msg;
				}
			}

			// returns messages (except noteOns and noteOffs) that represent the state of the controls
			// set by the midiObject before startMarkerMsPositionInScore.
			function getControlMessages(midiObject, startMarkerMsPositionInScore)
			{
				const CMD = WebMIDI.constants.COMMAND;

				let controlMessages = [],
					moments = midiObject.moments,
					objPosInScore = midiObject.msPositionInScore;

				if (objPosInScore < startMarkerMsPositionInScore)
				{
					for (var i = 0; i < moments.length; i++)
					{
						let moment = moments[i];

						if ((objPosInScore + moment.msPositionInChord) < startMarkerMsPositionInScore)
						{
							let messages = moment.messages;
							for (var j = 0; j < messages.length; j++)
							{
								let msg = messages[j];
								let cmd = msg.command();
								if (cmd !== CMD.NOTE_ON && cmd !== CMD.NOTE_OFF)
								{
									addUnique(msg, controlMessages);
								}
							}
						}
						else
						{
							break;
						}
					}
				}

				return controlMessages;
			}

			// Adds messages from moControlMessages to trackInitMessages,
			// replacing messages for the same control, if they exist.
			function collectMessages(moControlMessages, trackInitMessages)
			{
				for (var i = 0; i < moControlMessages.length; i++)
				{
					addUnique(moControlMessages[i], trackInitMessages);
				}
			}

			var i, index = -1, midiObject, nMidiObjects,
				trackInitMessages = [], moControlMessages,
				midiObjects = that.midiObjects;

			if (midiObjects === undefined)
			{
				throw "Can't set OutputSpan!";
			}

			nMidiObjects = midiObjects.length;
			for (i = 0; i < nMidiObjects; ++i)
			{
				let midiObject = midiObjects[i];

				if (midiObject.msPositionInScore <= startMarkerMsPositionInScore)
				{
					// 17.08.2021: This function returns all messages (except noteOns and noteOffs)
					// in the midiObject.moments that _precede_ startMarkerMsPositionInScore. 
					moControlMessages = getControlMessages(midiObject, startMarkerMsPositionInScore);
					collectMessages(moControlMessages, trackInitMessages);

					if (midiObject instanceof MidiChord)
					{
						let midiChord = midiObject;
						// if the MidiChord is at or straddles the startMarkerMsPositionInScore
						// set its moment pointers to startMarkerMsPositionInScore
						// midiChord.currentMoment will be undefined if there are no moments at or after startMarkerMsPositionInScore.
						if (midiChord.msPositionInScore + midiChord.msDurationInScore > startMarkerMsPositionInScore)
						{
							midiChord.setToStartMarker(startMarkerMsPositionInScore);
							if (midiChord.currentMoment !== undefined)
							{
								//midiChord.setToStartAtBeginning();
								index = i;
								break;
							}
						}
					}
				}
				else
				{
					midiObject.setToStartAtBeginning();
					index = i;
					break;
				}
			}

			if (index === -1)
			{
				// Set that._currentMidiObject to null if there are no more moments to play.
				// (The last midiObject in the that has no moments between the start and endMarkers.)
				that._currentMidiObjectIndex = -1;
				that._currentMidiObject = null;
				that.currentMoment = null;
			}
			else
			{
				// that.currentMoment is the first moment that is going to be played in that track.
				// (If the performance is set to start inside a rest, that.currentMoment will be at a
				// position later than the startMarker.)
				// Set all further MidiChords and MidiRests up to the endMarker to start at their beginnings.
				for (i = index + 1; i < nMidiObjects; ++i)
				{
					midiObject = midiObjects[i];
					if (midiObject.msPositionInScore >= endMarkerMsPositionInScore)
					{
						break;
					}
					midiObject.setToStartAtBeginning();
				}
				that._currentMidiObjectIndex = index;
				that._currentMidiObject = that.midiObjects[index];
				that.currentMoment = that._currentMidiObject.currentMoment; // a MidiChord or MidiRest
				that.currentMoment = (that.currentMoment === undefined) ? null : that.currentMoment;
			}

			// These three are used to reset the track to begin at the startMarker.
			that._midiObjectIndexAtStartMarker = that._currentMidiObjectIndex;
			that._midiObjectAtStartMarker = that._currentMidiObject;
			that._momentAtStartMarker = that.currentMoment;

			that.hasEndedRegion = false;

			return trackInitMessages;
		}

		// Adds the current Controller messages to the Moment at or immediately after the beginning of each region.
		// Messages are only added if a corresponding message does not already exist in the moment.
		// Messages are added to the first Moment in the track, even if the first region starts later.
		// TODO! Take account of pitchWheel deviation!
		function setInitialRegionMomentControls(that, trackIndex, startMarkerMsPositionInScore, endMarkerMsPositionInScore, regionStartMsPositionsInScore)
		{
			function getChannelIndexFromNoteOnMessages(midiObjects)
			{
				let channel = -1;
				for (let midiObject of midiObjects)
				{
					for (let moment of midiObject.moments)
					{
						for (let msg of moment.messages)
						{
							if (msg.command() === constants.COMMAND.NOTE_ON)
							{
								channel = msg.channel();
								break;
							}
						}
						if (channel >= 0)
						{
							break;
						}
					}
					if (channel >= 0)
					{
						break;
					}
				}
				return channel;
			}

			if (regionStartMsPositionsInScore.indexOf(0) < 0)
			{
				regionStartMsPositionsInScore.push(0);
			}

			let prevStartMsPos = -1,
				regionIndex = 0,
				regionStartMsPos = regionStartMsPositionsInScore[regionIndex++],
				noteOnsChannel = getChannelIndexFromNoteOnMessages(that.midiObjects);

			if (noteOnsChannel !== -1 && noteOnsChannel !== trackIndex)
			{
				throw new Error(`
Error: The channel index must always be equal to the track
index, even if there are no NoteOn messages in the channel.`
				);
			}

			let regionControls = new RegionControls(trackIndex), // initially contains default values for the controls
				done = false,
				midiObjects = that.midiObjects;

			for (let midiObject of midiObjects)
			{
				let moMsPos = midiObject.msPositionInScore;
				if (moMsPos < startMarkerMsPositionInScore)
				{
					continue;
				}
				if (moMsPos >= endMarkerMsPositionInScore)
				{
					break;
				}
				let moments = midiObject.moments;
				for (let moment of moments)
				{
					// set the corresponding currentControls values to the specific values in the moment controls.
					regionControls.updateFrom(moment);
					if ((moMsPos + moment.msPositionInChord) >= regionStartMsPos)
					{
						// set  moment controls to all the values in currentControls
						regionControls.update(moment);
						if (regionIndex === regionStartMsPositionsInScore.length)
						{
							done = true;
						}
						prevStartMsPos = regionStartMsPos;
						regionStartMsPos = regionStartMsPositionsInScore[regionIndex++];
						if (regionStartMsPos <= prevStartMsPos)
						{
							// N.B. There is only one regionStartMsPos per region here (even if they repeat in the score)
							throw "regionStartMsPos must be in chronological order.";
						}
					}
				}
				if (done)
				{
					break;
				}
			}
		}

		setInitialRegionMomentControls(this, trackIndex, startMarkerMsPositionInScore, endMarkerMsPositionInScore, regionStartMsPositionsInScore);

		let trackInitMessages = setInitialTrackState(this, startMarkerMsPositionInScore, endMarkerMsPositionInScore);

		return trackInitMessages;
	}

	resetToStartMarker()
	{
		this._currentMidiObjectIndex = this._midiObjectIndexAtStartMarker;
		this._currentMidiObject = this._midiObjectAtStartMarker;
		this.currentMoment = this._momentAtStartMarker;
	}

	// Called at the end of a performance to reset the initial state (for further performances).
	setToFirstRegion()
	{
		//let _regionLinks = this._regionLinks,
		//	midiObjects = this.midiObjects;
		//
		//let regionLink = _regionLinks[0],
		//	endMsPosInScore = regionLink.endOfRegionMsPositionInScore;

		for (let midiObject of this.midiObjects)
		{
			//if (midiObject.msPositionInScore < endMsPosInScore)
			//{
				midiObject.setToStartAtBeginning();
			//}
			//else
			//{
			//	break;
			//}
		}
		this._setState(0, 0);
	}
	// Returns Number.MAX_VALUE at end of track.
	currentMsPosition()
	{
		let _currentMidiObject = this._currentMidiObject,
			currentMoment = this.currentMoment;

		let msPos = Number.MAX_VALUE;
		if (_currentMidiObject !== null)
		{
			msPos = _currentMidiObject.msPositionInScore;
			if (currentMoment !== null)
			{
				msPos += currentMoment.msPositionInChord;
			}
		}
		return msPos;
	}

	advanceCurrentMoment()
	{
		if (this._currentMidiObject === null)
		{
			throw "Application error.";
		}
		var currentIndex;
		this.currentMoment = this._currentMidiObject.advanceCurrentMoment();
		// MidiRests, and MidiChords that have ended, return null.
		if (this.currentMoment === null)
		{
			this._currentMidiObjectIndex++;
			currentIndex = this._currentMidiObjectIndex;
			if (currentIndex < this.midiObjects.length)
			{
				this._currentMidiObject = this.midiObjects[currentIndex];
				this.currentMoment = this._currentMidiObject.currentMoment; // is non-null and has zero or more messages
			}
			else
			{
				this._currentMidiObject = null;
				this.currentMoment = null;
			}
		}
	}

	_setState(midiObjectIndex, momentIndexInChord)
	{
		this._currentMidiObjectIndex = midiObjectIndex;
		this._currentMidiObject = this.midiObjects[midiObjectIndex]; // a MidiChord or MidiRest
		this.currentMoment = this._currentMidiObject.moments[momentIndexInChord]; // in a MidiChord or MidiRest
		this.currentMoment = (this.currentMoment === undefined) ? null : this.currentMoment;
		this.hasEndedRegion = false; // is temporarily set to true when the track comes to the end of a region during a performance
	}
}

export class Track
{
	constructor(nInterpretations)
	{
		// Information from the score is going to be loaded into each Interpretation.midiObjects array.
		this.interpretations = [];
		for (let i = 0; i < nInterpretations; ++i)
		{
			this.interpretations.push(new Interpretation());
		}
	}

	setRuntimeInterpretation(trackIsOn, regionSequence, currentRegionIndex)
	{
		function getMidiObjectIndexRangesPerRegion(that, regionSequence)
		{
			let midiObjects = that.interpretations[0].midiObjects,
				midiObjectIndexRangesPerRegion = [];

			for(let i = 0; i < regionSequence.length; i++)
			{
				let region = regionSequence[i],
					regionStartMsPos = region.startMsPosInScore,
					regionEndMsPos = region.endMsPosInScore,
					regionRange = {};

				regionRange.firstMidiObjectIndex = midiObjects.findIndex(x => (x.msPositionInScore >= regionStartMsPos && x.msPositionInScore < regionEndMsPos));
				regionRange.lastMidiObjectIndex = midiObjects.findLastIndex(x => (x.msPositionInScore >= regionStartMsPos && x.msPositionInScore < regionEndMsPos));

				midiObjectIndexRangesPerRegion.push(regionRange);
			}

			return midiObjectIndexRangesPerRegion;
		}

		function getCurrentInterpretation(that, regionSequence, currentRegionIndex, midiObjectIndexRangesPerRegion)
		{
			console.assert(regionSequence[0].isSimpleInterpretation());

			let interpretation = new Interpretation(),
				region = regionSequence[currentRegionIndex],
				indexRange = midiObjectIndexRangesPerRegion[currentRegionIndex],
				firstIndex = indexRange.firstMidiObjectIndex,
				lastIndex = indexRange.lastMidiObjectIndex,
				interpIndex = region.interpIndex,
				midiObjects = that.interpretations[interpIndex].midiObjects,
				msPosInPerf = 0;

			for(let midiObjIndex = firstIndex; midiObjIndex <= lastIndex; midiObjIndex++)
			{
				if(midiObjIndex === firstIndex)
				{
					// This function is called for multiple tracks.
					// The following assertion ensures that all tracks agree with where the regions start in performance.
					console.assert(region.startMsPosInPerf === msPosInPerf);
				}

				let midiObj = midiObjects[midiObjIndex];

				midiObj.msPosInPerf = msPosInPerf;
				midiObj.msDurInPerf = midiObj.msDurationInScore;
				msPosInPerf += midiObj.msDurInPerf;

				interpretation.midiObjects.push(midiObj);

				if(midiObjIndex === lastIndex)
				{
					// This function is called for multiple tracks.
					// The following assertion ensures that all tracks agree with where the regions end in performance.
					console.assert(region.endMsPosInPerf === msPosInPerf);
				}
			}
			return interpretation;
		}

		function getSequentialRegionsInterpretation(that, regionSequence, midiObjectIndexRangesPerRegion)
		{
			let interpretation = new Interpretation(),
				msPosInPerf = 0;

			for(let regionIndex = 0; regionIndex < regionSequence.length; regionIndex++)
			{
				let region = regionSequence[regionIndex],
					indexRange = midiObjectIndexRangesPerRegion[regionIndex],
					firstIndex = indexRange.firstMidiObjectIndex,
					lastIndex = indexRange.lastMidiObjectIndex,
					midiObjects = that.interpretations[region.interpIndex].midiObjects;

				for(let midiObjIndex = firstIndex; midiObjIndex <= lastIndex; midiObjIndex++)
				{
					if(midiObjIndex === firstIndex)
					{
						// This function is called for multiple tracks.
						// The following assertion ensures that all tracks agree with where the regions start in performance.
						console.assert(region.startMsPosInPerf === msPosInPerf);
					}

					let midiObj = midiObjects[midiObjIndex];

					midiObj.msPosInPerf = msPosInPerf;
					midiObj.msDurInPerf = midiObj.msDurationInScore;
					msPosInPerf += midiObj.msDurInPerf;

					interpretation.midiObjects.push(midiObj);

					if(midiObjIndex === lastIndex)
					{
						// This function is called for multiple tracks.
						// The following assertion ensures that all tracks agree with where the regions end in performance.
						console.assert(region.endMsPosInPerf === msPosInPerf);
					}
				}
				if(regionIndex > 0)
				{
					console.assert(region.startMsPosInPerf === regionSequence[regionIndex - 1].endMsPosInPerf);
				}
			}

			return interpretation;
		}			

		if(trackIsOn)
		{
			let midiObjectIndexRangesPerRegion = getMidiObjectIndexRangesPerRegion(this, regionSequence);

			if(regionSequence[0].isSimpleInterpretation())
			{
				this.runtimeInterpretation = getCurrentInterpretation(this, regionSequence, currentRegionIndex, midiObjectIndexRangesPerRegion);
				if(regionSequence[0].endMsPosInPerf === 0)
				{
					for(let region of regionSequence)
					{
						region.endMsPosInPerf = region.endMsPosInScore;
					}
				}
			}
			else if(this.runtimeInterpretation === undefined)
			{
				this.runtimeInterpretation = getSequentialRegionsInterpretation(this, regionSequence, midiObjectIndexRangesPerRegion);
			}
		}
		else
		{
			this.runtimeInterpretation = undefined;
		}
	}
}

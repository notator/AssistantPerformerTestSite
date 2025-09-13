
export class Interpretation
{
	constructor()
	{
		//this.currentMoment = null;
		this.midiObjects = [];
		//this.isOn = true;
		//this.hasEndedRegion = false;
		//this._regionLinks = [];
		//this._currentMidiObjectIndex = -1;
		//this._currentMidiObject = null;
	}

	//	finalBarlineMsPos()
	//	{
	//		let lastMidiObject, finalBarlineMsPos;
	//		let midiObjects = this.midiObjects;
	//		if (midiObjects === undefined)
	//		{
	//			throw "Can't get finalBarlineMsPos!";
	//		}
	//		lastMidiObject = midiObjects[midiObjects.length - 1];
	//		finalBarlineMsPos = lastMidiObject.msPosInScore + lastMidiObject.msDurInScore;
	//		return finalBarlineMsPos;
	//	}

	//	setOutputSpan(trackIndex, startMarkerMsPosInScore, endMarkerMsPosInScore, regionStartMsPositionsInScore)
	//	{
	//		// Sets track._currentMidiObjectIndex, track._currentMidiObject and track.currentMoment.
	//		// If a MidiChord starts at or straddles the startMarker, it becomes the track._currentMidiObject, and
	//		// track.currentMoment is set to the its first moment at or after the startMarker.
	//		// If a MidiRest begins at the startMarker, it becomes the track._currentMidiObject, and
	//		// track.currentMoment is set to its (only) moment (which may be empty).
	//		// If a MidiRest straddles the startMarker, track._currentMidiObject is set to the following MidiChord, and
	//		// track.currentMoment is set to the its first moment.
	//		// track._currentMidiObjectIndex is the index of the track._currentMidiObject, in track.midiObjects.
	//		//
	//		// 17.08.2021: this function now returns an array of Messages that should be sent by player.run(...)
	//		// at the beginning of a performance to set the CC and preset state of the track.
	//		function setInitialTrackState(that, startMarkerMsPosInScore, endMarkerMsPosInScore)
	//		{
	//			let isRegParamIndex, regParamIndex;

	//			// Adds msg to messages, replacing a similar message, if it exists.
	//			function addUnique(msg, messages)
	//			{
	//				const CMD = WebMIDI.constants.COMMAND,
	//					CTL = WebMIDI.constants.CONTROL;

	//				let cmd = msg.command(),
	//					index;

	//				isRegParamIndex = false;

	//				if (cmd === CMD.CONTROL_CHANGE)
	//				{
	//					let ctl = msg.data[1];

	//					if (ctl === CTL.REGISTERED_PARAMETER)
	//					{
	//						let regParamValue = msg.data[2];
	//						index = messages.findIndex(x => {(x.data[0] === cmd) && (x.data[1] === ctl) && (x.data[2] === regParamValue);});
	//						regParamIndex = index;
	//						isRegParamIndex = true;
	//					}
	//					else if (ctl === CTL.DATA_ENTRY)
	//					{
	//						index = regParamIndex + 1; // regParamIndex must have been set by the previous message
	//						regParamIndex = undefined;
	//					}
	//					else
	//					{
	//						index = messages.findIndex(x => {(x.data[0] === cmd) && (x.data[1] === ctl);});
	//					}
	//				}
	//				else
	//				{
	//					index = messages.findIndex(x => (x.data[0] === cmd));
	//				}

	//				if (index === -1)
	//				{
	//					messages.push(msg);
	//					if (isRegParamIndex === true)
	//					{
	//						regParamIndex = messages.length - 1;
	//					}
	//				}
	//				else
	//				{
	//					messages[index] = msg;
	//				}
	//			}

	//			// returns messages (except noteOns and noteOffs) that represent the state of the controls
	//			// set by the midiObject before startMarkerMsPosInScore.
	//			function getControlMessages(midiObject, startMarkerMsPosInScore)
	//			{
	//				const CMD = WebMIDI.constants.COMMAND;

	//				let controlMessages = [],
	//					moments = midiObject.moments,
	//					objPosInScore = midiObject.msPosInScore;

	//				if (objPosInScore < startMarkerMsPosInScore)
	//				{
	//					for (var i = 0; i < moments.length; i++)
	//					{
	//						let moment = moments[i];

	//						if ((objPosInScore + moment.msPosInChord) < startMarkerMsPosInScore)
	//						{
	//							let messages = moment.messages;
	//							for (var j = 0; j < messages.length; j++)
	//							{
	//								let msg = messages[j];
	//								let cmd = msg.command();
	//								if (cmd !== CMD.NOTE_ON && cmd !== CMD.NOTE_OFF)
	//								{
	//									addUnique(msg, controlMessages);
	//								}
	//							}
	//						}
	//						else
	//						{
	//							break;
	//						}
	//					}
	//				}

	//				return controlMessages;
	//			}

	//			// Adds messages from moControlMessages to trackInitMessages,
	//			// replacing messages for the same control, if they exist.
	//			function collectMessages(moControlMessages, trackInitMessages)
	//			{
	//				for (var i = 0; i < moControlMessages.length; i++)
	//				{
	//					addUnique(moControlMessages[i], trackInitMessages);
	//				}
	//			}

	//			var i, index = -1, midiObject, nMidiObjects,
	//				trackInitMessages = [], moControlMessages,
	//				midiObjects = that.midiObjects;

	//			if (midiObjects === undefined)
	//			{
	//				throw "Can't set OutputSpan!";
	//			}

	//			nMidiObjects = midiObjects.length;
	//			for (i = 0; i < nMidiObjects; ++i)
	//			{
	//				let midiObject = midiObjects[i];

	//				if (midiObject.msPosInScore <= startMarkerMsPosInScore)
	//				{
	//					// 17.08.2021: This function returns all messages (except noteOns and noteOffs)
	//					// in the midiObject.moments that _precede_ startMarkerMsPosInScore. 
	//					moControlMessages = getControlMessages(midiObject, startMarkerMsPosInScore);
	//					collectMessages(moControlMessages, trackInitMessages);

	//					if (midiObject instanceof MidiChord)
	//					{
	//						let midiChord = midiObject;
	//						// if the MidiChord is at or straddles the startMarkerMsPosInScore
	//						// set its moment pointers to startMarkerMsPosInScore
	//						// midiChord.currentMoment will be undefined if there are no moments at or after startMarkerMsPosInScore.
	//						if (midiChord.msPosInScore + midiChord.msDurInScore > startMarkerMsPosInScore)
	//						{
	//							midiChord.setToStartMarker(startMarkerMsPosInScore);
	//							if (midiChord.currentMoment !== undefined)
	//							{
	//								//midiChord.setToStartAtBeginning();
	//								index = i;
	//								break;
	//							}
	//						}
	//					}
	//				}
	//				else
	//				{
	//					midiObject.setToStartAtBeginning();
	//					index = i;
	//					break;
	//				}
	//			}

	//			if (index === -1)
	//			{
	//				// Set that._currentMidiObject to null if there are no more moments to play.
	//				// (The last midiObject in the that has no moments between the start and endMarkers.)
	//				that._currentMidiObjectIndex = -1;
	//				that._currentMidiObject = null;
	//				that.currentMoment = null;
	//			}
	//			else
	//			{
	//				// that.currentMoment is the first moment that is going to be played in that track.
	//				// (If the performance is set to start inside a rest, that.currentMoment will be at a
	//				// position later than the startMarker.)
	//				// Set all further MidiChords and MidiRests up to the endMarker to start at their beginnings.
	//				for (i = index + 1; i < nMidiObjects; ++i)
	//				{
	//					midiObject = midiObjects[i];
	//					if (midiObject.msPosInScore >= endMarkerMsPosInScore)
	//					{
	//						break;
	//					}
	//					midiObject.setToStartAtBeginning();
	//				}
	//				that._currentMidiObjectIndex = index;
	//				that._currentMidiObject = that.midiObjects[index];
	//				that.currentMoment = that._currentMidiObject.currentMoment; // a MidiChord or MidiRest
	//				that.currentMoment = (that.currentMoment === undefined) ? null : that.currentMoment;
	//			}

	//			// These three are used to reset the track to begin at the startMarker.
	//			that._midiObjectIndexAtStartMarker = that._currentMidiObjectIndex;
	//			that._midiObjectAtStartMarker = that._currentMidiObject;
	//			that._momentAtStartMarker = that.currentMoment;

	//			that.hasEndedRegion = false;

	//			return trackInitMessages;
	//		}

	//		// Adds the current Controller messages to the Moment at or immediately after the beginning of each region.
	//		// Messages are only added if a corresponding message does not already exist in the moment.
	//		// Messages are added to the first Moment in the track, even if the first region starts later.
	//		// TODO! Take account of pitchWheel deviation!
	//		function setInitialRegionMomentControls(that, trackIndex, startMarkerMsPosInScore, endMarkerMsPosInScore, regionStartMsPositionsInScore)
	//		{
	//			function getChannelIndexFromNoteOnMessages(midiObjects)
	//			{
	//				let channel = -1;
	//				for (let midiObject of midiObjects)
	//				{
	//					for (let moment of midiObject.moments)
	//					{
	//						for (let msg of moment.messages)
	//						{
	//							if (msg.command() === constants.COMMAND.NOTE_ON)
	//							{
	//								channel = msg.channel();
	//								break;
	//							}
	//						}
	//						if (channel >= 0)
	//						{
	//							break;
	//						}
	//					}
	//					if (channel >= 0)
	//					{
	//						break;
	//					}
	//				}
	//				return channel;
	//			}

	//			if (regionStartMsPositionsInScore.indexOf(0) < 0)
	//			{
	//				regionStartMsPositionsInScore.push(0);
	//			}

	//			let prevStartMsPos = -1,
	//				regionIndex = 0,
	//				regionStartMsPos = regionStartMsPositionsInScore[regionIndex++],
	//				noteOnsChannel = getChannelIndexFromNoteOnMessages(that.midiObjects);

	//			if (noteOnsChannel !== -1 && noteOnsChannel !== trackIndex)
	//			{
	//				throw new Error(`
	//Error: The channel index must always be equal to the track
	//index, even if there are no NoteOn messages in the channel.`
	//				);
	//			}

	//			let regionControls = new RegionControls(trackIndex), // initially contains default values for the controls
	//				done = false,
	//				midiObjects = that.midiObjects;

	//			for (let midiObject of midiObjects)
	//			{
	//				let moMsPos = midiObject.msPosInScore;
	//				if (moMsPos < startMarkerMsPosInScore)
	//				{
	//					continue;
	//				}
	//				if (moMsPos >= endMarkerMsPosInScore)
	//				{
	//					break;
	//				}
	//				let moments = midiObject.moments;
	//				for (let moment of moments)
	//				{
	//					// set the corresponding currentControls values to the specific values in the moment controls.
	//					regionControls.updateFrom(moment);
	//					if ((moMsPos + moment.msPosInChord) >= regionStartMsPos)
	//					{
	//						// set  moment controls to all the values in currentControls
	//						regionControls.update(moment);
	//						if (regionIndex === regionStartMsPositionsInScore.length)
	//						{
	//							done = true;
	//						}
	//						prevStartMsPos = regionStartMsPos;
	//						regionStartMsPos = regionStartMsPositionsInScore[regionIndex++];
	//						if (regionStartMsPos <= prevStartMsPos)
	//						{
	//							// N.B. There is only one regionStartMsPos per region here (even if they repeat in the score)
	//							throw "regionStartMsPos must be in chronological order.";
	//						}
	//					}
	//				}
	//				if (done)
	//				{
	//					break;
	//				}
	//			}
	//		}

	//		setInitialRegionMomentControls(this, trackIndex, startMarkerMsPosInScore, endMarkerMsPosInScore, regionStartMsPositionsInScore);

	//		let trackInitMessages = setInitialTrackState(this, startMarkerMsPosInScore, endMarkerMsPosInScore);

	//		return trackInitMessages;
	//	}

	//	resetToStartMarker()
	//	{
	//		this._currentMidiObjectIndex = this._midiObjectIndexAtStartMarker;
	//		this._currentMidiObject = this._midiObjectAtStartMarker;
	//		this.currentMoment = this._momentAtStartMarker;
	//	}

	//	// Called at the end of a performance to reset the initial state (for further performances).
	//	setToFirstRegion()
	//	{
	//		//let _regionLinks = this._regionLinks,
	//		//	midiObjects = this.midiObjects;
	//		//
	//		//let regionLink = _regionLinks[0],
	//		//	endMsPosInScore = regionLink.endOfRegionMsPosInScore;

	//		for (let midiObject of this.midiObjects)
	//		{
	//			//if (midiObject.msPosInScore < endMsPosInScore)
	//			//{
	//				midiObject.setToStartAtBeginning();
	//			//}
	//			//else
	//			//{
	//			//	break;
	//			//}
	//		}
	//		this._setState(0, 0);
	//	}
	//	// Returns Number.MAX_VALUE at end of track.
	//	currentMsPos()
	//	{
	//		let _currentMidiObject = this._currentMidiObject,
	//			currentMoment = this.currentMoment;

	//		let msPos = Number.MAX_VALUE;
	//		if (_currentMidiObject !== null)
	//		{
	//			msPos = _currentMidiObject.msPosInScore;
	//			if (currentMoment !== null)
	//			{
	//				msPos += currentMoment.msPosInChord;
	//			}
	//		}
	//		return msPos;
	//	}

	//	advanceCurrentMoment()
	//	{
	//		if (this._currentMidiObject === null)
	//		{
	//			throw "Application error.";
	//		}
	//		var currentIndex;
	//		this.currentMoment = this._currentMidiObject.advanceCurrentMoment();
	//		// MidiRests, and MidiChords that have ended, return null.
	//		if (this.currentMoment === null)
	//		{
	//			this._currentMidiObjectIndex++;
	//			currentIndex = this._currentMidiObjectIndex;
	//			if (currentIndex < this.midiObjects.length)
	//			{
	//				this._currentMidiObject = this.midiObjects[currentIndex];
	//				this.currentMoment = this._currentMidiObject.currentMoment; // is non-null and has zero or more messages
	//			}
	//			else
	//			{
	//				this._currentMidiObject = null;
	//				this.currentMoment = null;
	//			}
	//		}
	//	}

	//	_setState(midiObjectIndex, momentIndexInChord)
	//	{
	//		this._currentMidiObjectIndex = midiObjectIndex;
	//		this._currentMidiObject = this.midiObjects[midiObjectIndex]; // a MidiChord or MidiRest
	//		this.currentMoment = this._currentMidiObject.moments[momentIndexInChord]; // in a MidiChord or MidiRest
	//		this.currentMoment = (this.currentMoment === undefined) ? null : this.currentMoment;
	//		this.hasEndedRegion = false; // is temporarily set to true when the track comes to the end of a region during a performance
	//	}
}
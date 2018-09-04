/// <reference path="Constants.ts" />
/// <reference path="Interface.ts" />
/// <reference path="RegionLink.ts" />

namespace _AP
{
	export class Track
	{
		constructor()
		{
		}

		public finalBarlineMsPosition()
		{
			let lastMidiObject, finalBarlineMsPos;

			if(this.midiObjects === undefined)
			{
				throw "Can't get finalBarlineMsPosition!";
			}

			lastMidiObject = this.midiObjects[this.midiObjects.length - 1];
			finalBarlineMsPos = lastMidiObject.msPositionInScore + lastMidiObject.msDurationInScore;

			return finalBarlineMsPos;
		}

		// Add the current ContinuousController state commands to the the first moment in each region.
		public setRegionLinks(regionDefs: RegionDef[], regionNameSequence: string): void
		{
			let prevRegionLink: RegionLink | undefined = undefined;

			for(let i = 0; i < regionNameSequence.length; ++i)
			{
				let regionName = regionNameSequence[i];
				let regionDef = this.getRegionDef(regionDefs, regionName);
				let regionLink: RegionLink = new RegionLink(this, regionDef, prevRegionLink);
				prevRegionLink = regionLink;
				this._regionLinks.push(regionLink);
			}
		}

		private getRegionDef(regionDefs: RegionDef[], name: string): RegionDef
		{
			let regionDef: RegionDef = { name: "", startMsPositionInScore: -1, endMsPositionInScore: -1 };
			for(let j = 0; j < regionDefs.length; ++j)
			{
				if(name.localeCompare(regionDefs[j].name) === 0)
				{
					regionDef = regionDefs[j];
					break;
				}
			}
			if(regionDef.name.length === 0)
			{
				throw "regionDef is not defined";
			}
			return regionDef;
		}

		//// Sets the this.startStateMessages array containing messages that have been shunted from the start of the score.
		//// The array will be empty when the performance starts at the beginning of the score.
		//public setStartStateMessages(startMarkerMsPositionInScore: number)
		//{
		//	var
		//		i, midiObjects = this.midiObjects, nMidiObjects = midiObjects.length, midiObject,
		//		j, moment, moments, nMoments, midiObjectMsPositionInScore, msPositionInScore,
		//		k, msgs, nMsgs,
		//		msg, command, stateMsgs: Message[] = [], msgIndex: number = -1,
		//		COMMAND = _AP.constants.COMMAND,
		//		NOTE_OFF = COMMAND.NOTE_OFF,
		//		NOTE_ON = COMMAND.NOTE_ON,
		//		AFTERTOUCH = COMMAND.AFTERTOUCH,
		//		CONTROL_CHANGE = COMMAND.CONTROL_CHANGE,
		//		PROGRAM_CHANGE = COMMAND.PROGRAM_CHANGE,
		//		CHANNEL_PRESSURE = COMMAND.CHANNEL_PRESSURE,
		//		PITCH_WHEEL = COMMAND.PITCH_WHEEL;

		//	function findMessage(stateMsgs: Message[], commandType: number)
		//	{
		//		var returnIndex = -1, i, nStateMsgs = stateMsgs.length;

		//		for(i = 0; i < nStateMsgs; ++i)
		//		{
		//			if(stateMsgs[i].command() === commandType)
		//			{
		//				returnIndex = i;
		//				break;
		//			}
		//		}
		//		return returnIndex;
		//	}

		//	function findControlMessage(stateMsgs: Message[], controlType: number)
		//	{
		//		var returnIndex = -1, i, nStateMsgs = stateMsgs.length;

		//		for(i = 0; i < nStateMsgs; ++i)
		//		{
		//			if(stateMsgs[i].data[1] === controlType)
		//			{
		//				returnIndex = i;
		//				break;
		//			}
		//		}
		//		return returnIndex;
		//	}

		//	msPositionInScore = -1;
		//	for(i = 0; i < nMidiObjects; ++i)
		//	{
		//		midiObject = midiObjects[i];
		//		midiObjectMsPositionInScore = midiObject.msPositionInScore;
		//		if(midiObjectMsPositionInScore >= startMarkerMsPositionInScore)
		//		{
		//			break;
		//		}
		//		moments = midiObject.moments;
		//		if(moments !== undefined)
		//		{
		//			nMoments = moments.length;
		//			for(j = 0; j < nMoments; ++j)
		//			{
		//				moment = moments[j];
		//				msPositionInScore = moment.msPositionInChord + midiObjectMsPositionInScore;
		//				if(msPositionInScore > startMarkerMsPositionInScore)
		//				{
		//					break;
		//				}
		//				msgs = moment.messages;
		//				nMsgs = msgs.length;
		//				for(k = 0; k < nMsgs; ++k)
		//				{
		//					msg = msgs[k];
		//					command = msg.command();
		//					switch(command)
		//					{
		//						case NOTE_OFF:
		//							msgIndex = -2; // ignore
		//							break;
		//						case NOTE_ON:
		//							msgIndex = -2; // ignore
		//							break;
		//						case AFTERTOUCH:
		//							msgIndex = -2; // ignore
		//							break;
		//						case CONTROL_CHANGE:
		//							msgIndex = findControlMessage(stateMsgs, msg.data[1]);
		//							break;
		//						case PROGRAM_CHANGE:
		//							msgIndex = findMessage(stateMsgs, PROGRAM_CHANGE);
		//							break;
		//						case CHANNEL_PRESSURE:
		//							msgIndex = -2; // ignore
		//							break;
		//						case PITCH_WHEEL:
		//							msgIndex = findMessage(stateMsgs, PITCH_WHEEL);
		//							break;

		//					}
		//					if(msgIndex > -2)
		//					{
		//						if(msgIndex === -1)
		//						{
		//							stateMsgs.push(msg);
		//						}
		//						else
		//						{
		//							stateMsgs[msgIndex] = msg;
		//						}
		//					}
		//				}
		//			}
		//		}
		//	}

		//	this.startStateMessages = stateMsgs;
		//}

		public setOutputSpan(startMarkerMsPositionInScore: number, endMarkerMsPositionInScore: number, regionStartMsPositionsInScore:number[])
		{
			// Sets track._currentMidiObjectIndex, track._currentMidiObject and track.currentMoment.
			// If a MidiChord starts at or straddles the startMarker, it becomes the track._currentMidiObject, and
			// track.currentMoment is set to the its first moment at or after the startMarker.
			// If a MidiRest begins at the startMarker, it becomes the track._currentMidiObject, and
			// track.currentMoment is set to its (only) moment (which may be empty).
			// If a MidiRest straddles the startMarker, track._currentMidiObject is set to the following MidiChord, and
			// track.currentMoment is set to the its first moment.
			// track._currentMidiObjectIndex is the index of the track._currentMidiObject, in track.midiObjects. 
			function setInitialTrackState(that:Track, startMarkerMsPositionInScore: number, endMarkerMsPositionInScore: number) : void
			{
				var i: number, index: number = 0,
					midiObject: MidiObject,
					midiChord: MidiObject, midiRest: MidiObject,
					nMidiObjects: number;

				if(that.midiObjects === undefined)
				{
					throw "Can't set OutputSpan!";
				}

				nMidiObjects = that.midiObjects.length;

				for(i = 0; i < nMidiObjects; ++i)
				{
					index = i;
					// find the index of the MidiChord straddling or at the startMarkerMsPositionInScore,
					// or the index of the MidiChord that starts after the startMarkerMsPositionInScore
					// or the index of a MidiRest that starts at the startMarkerMsPositionInScore.
					if(that.midiObjects[i].isMidiChord())
					{
						midiChord = that.midiObjects[i];
						if((midiChord.msPositionInScore <= startMarkerMsPositionInScore)
							&& (midiChord.msPositionInScore + midiChord.msDurationInScore > startMarkerMsPositionInScore))
						{
							// if the MidiChord is at or straddles the startMarkerMsPositionInScore
							// set its moment pointers to startMarkerMsPositionInScore
							// midiChord.currentMoment will be undefined if there are no moments at or after startMarkerMsPositionInScore.
							midiChord.setToStartMarker(startMarkerMsPositionInScore);
							if(midiChord.currentMoment !== undefined)
							{
								break;
							}
						}

						if(midiChord.msPositionInScore > startMarkerMsPositionInScore)
						{
							// a MidiRest straddles the startMarker. 
							midiChord.setToStartAtBeginning();
							break;
						}
					}
					else if(that.midiObjects[i].msPositionInScore === startMarkerMsPositionInScore)
					{
						midiRest = that.midiObjects[i];
						midiRest.setToStartAtBeginning();
						break;
					}
				}

				// Set all further MidiChords and MidiRests up to the endMarker to start at their beginnings.
				for(i = index + 1; i < nMidiObjects; ++i)
				{
					midiObject = that.midiObjects[i];

					if(midiObject.msPositionInScore >= endMarkerMsPositionInScore)
					{
						break;
					}

					midiObject.setToStartAtBeginning();
				}

				that._currentMidiObjectIndex = index;
				that._currentMidiObject = that.midiObjects[index];
				that.currentMoment = that._currentMidiObject.currentMoment;// a MidiChord or MidiRest
				that.currentMoment = (that.currentMoment === undefined) ? null : that.currentMoment;
				// that.currentMoment is the first moment that is going to be played in that track.
				// (If the performance is set to start inside a rest, that.currentMoment will be at a
				// position later than the startMarker.)
				// that.currentMoment will be null if there are no more moments to play in the track.
				// (i.e. if last midiObject in the track is a rest, and the performance is set to start
				// after its beginning.  
				that.hasEndedRegion = false;
			}

			// Adds the current Controller messages to the Moment at or immediately after the beginning of each region.
			// Messages are only added if a corresponding message does not already exist in the moment.
			// Messages are added to the first Moment in the track, even if the first region starts later.
			// TODO! Take account of pitchWheel deviation!
			function setInitialRegionMomentControls(that:Track, startMarkerMsPositionInScore: number, endMarkerMsPositionInScore: number, regionStartMsPositionsInScore: number[])
			{
				function getChannel(midiObjects: MidiObject[]):number
				{
					let channel = -1;
					for(let midiObject of midiObjects)
					{
						for(let moment of midiObject.moments)
						{
							for(let msg of moment.messages)
							{
								if(msg.command() === _AP.constants.COMMAND.NOTE_ON)
								{
									channel = msg.channel();
									break;
								}
							}
							if(channel >= 0)
							{
								break;
							}
						}
						if(channel >= 0)
						{
							break;
						}
					}
					return channel;
				}

				if(regionStartMsPositionsInScore.indexOf(0) < 0)
				{
					regionStartMsPositionsInScore.push(0);
				}

				let prevStartMsPos = -1,
					regionIndex = 0,
					regionStartMsPos = regionStartMsPositionsInScore[regionIndex++],
					channel = getChannel(that.midiObjects),
					currentControls = new MidiControls(channel); // initially contains default values for the controls

				for(let midiObject of that.midiObjects)
				{
					let moMsPos = midiObject.msPositionInScore;
					
					if(moMsPos < startMarkerMsPositionInScore)
					{
						continue;
					}
					if(moMsPos >= endMarkerMsPositionInScore)
					{
						break;
					}
					
					let	moments = midiObject.moments;
					for(let moment of moments)
					{
						// set the corresponding currentControls values to the specific values in the moment controls.
						currentControls.updateFrom(moment);
						if((moMsPos + moment.msPositionInChord) >= regionStartMsPos)
						{
							// set  moment controls to all the values in currentControls
							currentControls.update(moment); 

							if(regionIndex === (regionStartMsPositionsInScore.length - 1))
							{
								break;
							}
							prevStartMsPos = regionStartMsPos;
							regionStartMsPos = regionStartMsPositionsInScore[regionIndex++]
							if(regionStartMsPos <= prevStartMsPos)
							{
								// N.B. There is only one regionStartMsPos per region here (even if they repeat in the score)
								throw "regionStartMsPos must be in chronological order."
							}
						}
					}
				}
			}

			setInitialTrackState(this, startMarkerMsPositionInScore, endMarkerMsPositionInScore);
			setInitialRegionMomentControls(this, startMarkerMsPositionInScore, endMarkerMsPositionInScore, regionStartMsPositionsInScore);
		}

		// ** Compare this code with setInitialTrackState() inside setOutputSpan() above. **
		// When this function returns:
		// this.currentMoment is the first moment that is going to be played in this track.
		// (If the performance is set to start inside a rest, this.currentMoment will be in
		// a midiChord that starts after the beginning of the region.)
		// this.currentMoment will be null if there are no more moments to play in the track
		// (i.e. if last midiObject in the track is a rest, and the performance is set to start
		// after its beginning).
		private _setNextRegion(regionLink: RegionLink)
		{
			let i, startMidiObjectIndex = -1, momentIndex = -1,
				nMidiObjectsInRegion = -1, moIndex = -1;

			if(regionLink.nextRegionMidiObjectIndex === undefined
				|| regionLink.nextRegionMomentIndex === undefined
				|| regionLink.nextRegionMidiObjectsCount === undefined)
			{
				throw "Can't set next region.";
			}

			startMidiObjectIndex = regionLink.nextRegionMidiObjectIndex;
			momentIndex = regionLink.nextRegionMomentIndex;
			nMidiObjectsInRegion = regionLink.nextRegionMidiObjectsCount;

			// set all midiObjects in the region except the first (which is set by setting the 'current' values below)
			moIndex = startMidiObjectIndex + 1;
			for(i = 1; i < nMidiObjectsInRegion; ++i)
			{
				this.midiObjects[moIndex++].setToStartAtBeginning();
			}

			this._setState(startMidiObjectIndex, momentIndex);

			// The current ContinuousController state commands must be added
			// to the the first moment in each region before the performance begins.
		}

		public moveToNextRegion(regionIndexInPerformance: number): void
		{
			/* track.regionLinks is an array of regionLink objects that have the following attributes:
			 *     .endOfRegionMsPositionInScore
			 *     .nextRegionMidiObjectIndex // the index of the midiObject containing the first moment at or after the startMsPositionInScore of the toRegion.
			 *     .nextRegionMomentIndex // the index (in midiObject.moments) of the first moment at or after the startMsPositionInScore of the toRegion
			 *     .nextRegionMidiObjectsCount // includes midiObjects that straddle the region boundaries. 
			 * each Track has its own regionLinks array, and maintains its own regionIndex for the current region
			 * 
			 * The current ContinuousController state commands are added to the the first moment in each region before the performance begins.
			 */
			let currentRegionLink = this._regionLinks[regionIndexInPerformance];
			this._setNextRegion(currentRegionLink);
		}

		// Called at the end of a performance to reset the initial state (for further performances).
		public setToFirstRegion(): void
		{
			let regionLink = this._regionLinks[0],
				endMsPos = regionLink.endOfRegionMsPositionInScore;

			for(let midiObject of this.midiObjects)
			{
				if(midiObject.msPositionInScore < endMsPos)
				{
					midiObject.setToStartAtBeginning();
				}
				else
				{
					break;
				}
			}

			this._setState(0, 0);
		}

		// Returns Number.MAX_VALUE at end of track.
		public currentMsPosition(): number
		{
			let msPos = Number.MAX_VALUE;

			if(this._currentMidiObject !== null)
			{
				msPos = this._currentMidiObject.msPositionInScore;
				if(this.currentMoment !== null)
				{
					msPos += this.currentMoment.msPositionInChord;
				}
			}

			return msPos;
		}

		public advanceCurrentMoment(): void
		{
			if(this._currentMidiObject === null)
			{
				throw "Application error.";
			}
			var currentIndex;

			this.currentMoment = this._currentMidiObject.advanceCurrentMoment();

			// MidiRests, and MidiChords that have ended, return null.
			if(this.currentMoment === null)
			{
				this._currentMidiObjectIndex++;

				currentIndex = this._currentMidiObjectIndex;
				if(currentIndex < this.midiObjects.length)
				{
					this._currentMidiObject = this.midiObjects[currentIndex];
					this.currentMoment = this._currentMidiObject.currentMoment;  // is non-null and has zero or more messages
				}
				else
				{
					this._currentMidiObject = null;
					this.currentMoment = null;
				}
			}
		};

		private _setState(midiObjectIndex: number, momentIndexInChord: number)
		{
			this._currentMidiObjectIndex = midiObjectIndex;
			this._currentMidiObject = this.midiObjects[midiObjectIndex]; // a MidiChord or MidiRest
			this.currentMoment = this._currentMidiObject.moments[momentIndexInChord]; // in a MidiChord or MidiRest
			this.currentMoment = (this.currentMoment === undefined) ? null : this.currentMoment;
			this.hasEndedRegion = false; // is temporarily set to true when the track comes to the end of a region during a performance
		}

		public currentMoment: Moment | null = null;
		public midiObjects: MidiObject[] = [];
		public isOn: boolean = true;
		public hasEndedRegion: boolean = false;

		private _regionLinks: RegionLink[] = [];

		private _currentMidiObjectIndex: number = -1;
		private _currentMidiObject: MidiObject | null = null;
	}
}
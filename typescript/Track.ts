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

		// Sets the this.startStateMessages array containing messages that have been shunted from the start of the score.
		// The array will be empty when the performance starts at the beginning of the score.
		public setStartStateMessages(startMarkerMsPositionInScore: number)
		{
			var
				i, midiObjects = this.midiObjects, nMidiObjects = midiObjects.length, midiObject,
				j, moment, moments, nMoments, midiObjectMsPositionInScore, msPositionInScore,
				k, msgs, nMsgs,
				msg, command, stateMsgs: Message[] = [], msgIndex: number = -1,
				COMMAND = _AP.constants.COMMAND,
				NOTE_OFF = COMMAND.NOTE_OFF,
				NOTE_ON = COMMAND.NOTE_ON,
				AFTERTOUCH = COMMAND.AFTERTOUCH,
				CONTROL_CHANGE = COMMAND.CONTROL_CHANGE,
				PROGRAM_CHANGE = COMMAND.PROGRAM_CHANGE,
				CHANNEL_PRESSURE = COMMAND.CHANNEL_PRESSURE,
				PITCH_WHEEL = COMMAND.PITCH_WHEEL;

			function findMessage(stateMsgs: Message[], commandType:number)
			{
				var returnIndex = -1, i, nStateMsgs = stateMsgs.length;

				for(i = 0; i < nStateMsgs; ++i)
				{
					if(stateMsgs[i].command() === commandType)
					{
						returnIndex = i;
						break;
					}
				}
				return returnIndex;
			}

			function findControlMessage(stateMsgs: Message[], controlType:number)
			{
				var returnIndex = -1, i, nStateMsgs = stateMsgs.length;

				for(i = 0; i < nStateMsgs; ++i)
				{
					if(stateMsgs[i].data[1] === controlType)
					{
						returnIndex = i;
						break;
					}
				}
				return returnIndex;
			}

			msPositionInScore = -1;
			for(i = 0; i < nMidiObjects; ++i)
			{
				midiObject = midiObjects[i];
				midiObjectMsPositionInScore = midiObject.msPositionInScore;
				if(midiObjectMsPositionInScore >= startMarkerMsPositionInScore)
				{
					break;
				}
				moments = midiObject.moments;
				if(moments !== undefined)
				{
					nMoments = moments.length;
					for(j = 0; j < nMoments; ++j)
					{
						moment = moments[j];
						msPositionInScore = moment.msPositionInChord + midiObjectMsPositionInScore;
						if(msPositionInScore > startMarkerMsPositionInScore)
						{
							break;
						}
						msgs = moment.messages;
						nMsgs = msgs.length;
						for(k = 0; k < nMsgs; ++k)
						{
							msg = msgs[k];
							command = msg.command();
							switch(command)
							{
								case NOTE_OFF:
									msgIndex = -2; // ignore
									break;
								case NOTE_ON:
									msgIndex = -2; // ignore
									break;
								case AFTERTOUCH:
									msgIndex = -2; // ignore
									break;
								case CONTROL_CHANGE:
									msgIndex = findControlMessage(stateMsgs, msg.data[1]);
									break;
								case PROGRAM_CHANGE:
									msgIndex = findMessage(stateMsgs, PROGRAM_CHANGE);
									break;
								case CHANNEL_PRESSURE:
									msgIndex = -2; // ignore
									break;
								case PITCH_WHEEL:
									msgIndex = findMessage(stateMsgs, PITCH_WHEEL);
									break;

							}
							if(msgIndex > -2)
							{
								if(msgIndex === -1)
								{
									stateMsgs.push(msg);
								}
								else
								{
									stateMsgs[msgIndex] = msg;
								}
							}
						}
					}
				}
			}

			this.startStateMessages = stateMsgs;
		}

		// Sets track._currentMidiObjectIndex, track._currentMidiObject and track.currentMoment.
		// If a MidiChord starts at or straddles the startMarker, it becomes the track._currentMidiObject, and
		// track.currentMoment is set to the its first moment at or after the startMarker.
		// If a MidiRest begins at the startMarker, it becomes the track._currentMidiObject, and
		// track.currentMoment is set to its (only) moment (which may be empty).
		// If a MidiRest straddles the startMarker, track._currentMidiObject is set to the following MidiChord, and
		// track.currentMoment is set to the its first moment.
		// track._currentMidiObjectIndex is the index of the track._currentMidiObject, in track.midiObjects. 
		public setForOutputSpan(startMarkerMsPositionInScore: number, endMarkerMsPositionInScore:number)
		{
			var i: number, index: number = 0,
				midiObject: MidiObject, midiObjects: MidiObject[],
				midiChord: MidiObject, midiRest: MidiObject,
				nMidiObjects: number;

			if(this.midiObjects === undefined)
			{
				throw "Can't set OutputSpan!";
			}

			midiObjects = this.midiObjects;
			nMidiObjects = midiObjects.length;

			for(i = 0; i < nMidiObjects; ++i)
			{
				index = i;
				// find the index of the MidiChord straddling or at the startMarkerMsPositionInScore,
				// or the index of the MidiChord that starts after the startMarkerMsPositionInScore
				// or the index of a MidiRest that starts at the startMarkerMsPositionInScore.
				if(midiObjects[i].isMidiChord())
				{
					midiChord = midiObjects[i];
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
				else if(midiObjects[i].msPositionInScore === startMarkerMsPositionInScore)
				{
					midiRest = midiObjects[i];
					midiRest.setToStartAtBeginning();
					break;
				}
			}

			// Set all further MidiChords and MidiRests up to the endMarker to start at their beginnings.
			for(i = index + 1; i < nMidiObjects; ++i)
			{
				midiObject = midiObjects[i];

				if(midiObject.msPositionInScore >= endMarkerMsPositionInScore)
				{
					break;
				}

				midiObject.setToStartAtBeginning();
			}

			this._currentMidiObjectIndex = index;
			this._currentMidiObject = midiObjects[index];
			this.currentMoment = this._currentMidiObject.currentMoment;// a MidiChord or MidiRest
			this.currentMoment = (this.currentMoment === undefined) ? null : this.currentMoment;
			// this.currentMoment is the first moment that is going to be played in this track.
			// (If the performance is set to start inside a rest, this.currentMoment will be at a
			// position later than the startMarker.)
			// this.currentMoment will be null if there are no more moments to play in the track.
			// (i.e. if last midiObject in the track is a rest, and the performance is set to start
			// after its beginning.  
			if(this.currentMoment !== null)
			{
				// this.startStateMessages will be an empty array when the performance starts at the beginning of the score.
				this.setStartStateMessages(startMarkerMsPositionInScore);
			}
		}

		// ** Compare this code with setForOutputSpan() above. **
		// When this function returns:
		// this.currentMoment is the first moment that is going to be played in this track.
		// (If the performance is set to start inside a rest, this.currentMoment will be in
		// a midiChord that starts after the beginning of the region.)
		// this.currentMoment will be null if there are no more moments to play in the track
		// (i.e. if last midiObject in the track is a rest, and the performance is set to start
		// after its beginning).
		public setNextRegion(regionLink:RegionLink)
		{
			let i, midiObjects = this.midiObjects,
				startMidiObjectIndex = -1, momentIndex = -1,
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
			for(i = 1; i < nMidiObjectsInRegion; ++i)
			{
				midiObjects[moIndex++].setToStartAtBeginning();
			}

			this._currentMidiObjectIndex = startMidiObjectIndex;
			this._currentMidiObject = midiObjects[startMidiObjectIndex]; // a MidiChord or MidiRest
			this.currentMoment = this._currentMidiObject.moments[momentIndex];// in a MidiChord or MidiRest
			this.currentMoment = (this.currentMoment === undefined) ? null : this.currentMoment;

			// The current ContinuousController state commands must be added
			// to the the first moment in each region before the performance begins.
		}

		// Returns Number.MAX_VALUE at end of track.
		public currentMsPosition():number
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

		advanceCurrentMoment()
		{
			if(this._currentMidiObject === null)
			{
				throw "Application error.";
			}
			var currentIndex;

			this.currentMoment = this._currentMidiObject.advanceCurrentMoment();

			/* track.regionLinks is an array of regionLink objects that have the following attributes:
			 *     .endOfRegionMsPositionInScore
			 *     .nextRegionMidiObjectIndex // the index of the midiObject containing the first moment at or after the startMsPositionInScore of the toRegion.
			 *     .nextRegionMomentIndex // the index (in midiObject.moments) of the first moment at or after the startMsPositionInScore of the toRegion
			 *     .nextRegionMidiObjectsCount // includes midiObjects that straddle the region boundaries. 
			 * each Track has its own regionLinks array, and maintains its own regionIndex for the current region
			 * 
			 * The current ContinuousController state commands are added to the the first moment in each region before the performance begins.
			 */

			// let regionLink = this.regionLinks[this.regionIndex];
			// if(this.currentMsPosition() >= regionLink.endOfRegionMsPositionInScore)
			// {
			//     this.setNextRegion(regionLink);
			//     this.regionIndex++
			// }

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

		public currentMoment: Moment | null = null;		
		public startStateMessages: Message[] = [];
		public midiObjects: MidiObject[] = [];
		public isOn: boolean = true;

		private _regionLinks: RegionLink[] = [];

		private _currentMidiObjectIndex: number = -1;
		private _currentMidiObject: MidiObject | null = null;
	}
}
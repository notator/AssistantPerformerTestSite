
/// <reference path="Interface.ts" />
/// <reference path="Sim.ts" />

namespace _AP
{
	export class Cursor
	{

		constructor(
			systems: SvgSystem[],
			markersLayer: SVGGElement,
			startMarkerMsPosInScore: number,
			endMarkerMsPosInScore: number,
			nOutputTracks: number,
			regionDefs: RegionDef[],
			regionSequence: string)
		{
			this.systems = systems;
			this.startMarkerMsPosInScore = startMarkerMsPosInScore;
			this.endMarkerMsPosInScore = endMarkerMsPosInScore;
			this.nOutputTracks = nOutputTracks;
			this.regionDefs = regionDefs;
			this.regionSequence = regionSequence;

			this.line = this.newCursorLine();
			markersLayer.appendChild(this.line);

			this.outputTrackIsOnArray = this.allTracksOnArray(nOutputTracks);

			this.scoreSims = this.getScoreSims(systems);	// includes the Sim for the final barline.

			this.scoreSimIndexTrajectory = this.setScoreSimIndexTrajectory(regionDefs, regionSequence);

			this.yCoordinates = this.scoreSims[0].yCoordinates;
		}

		private allTracksOnArray(nOutputTracks: number): boolean[]
		{
			let array: boolean[] = [];
			for(let i = 0; i < nOutputTracks; ++i)
			{
				array.push(true);
			}
			return array;
		}

		// scoreSims are constructed, between the start- and endMarkers, at msPositions where
		// at least one track is performing. More precisely:
		// 1. startMarker.msPos <= scoreSim.msPos <= endMarker.msPos
		// 2. if(scoreSim.msPos < endMarker.msPos)
		//        scoreSim.trackIndices[] is not empty, and contains the indices of performing tracks
		//    if(scoreSim.msPos === endMarker.msPos) scoreSim.trackIndices[] is empty and the scoreSim's alignment and yCoordinates are invalid).
		private getScoreSims(systems: SvgSystem[]): Sim[]
		{
			let scoreSims: Sim[] = [];
			for(let system of systems)
			{
				let systemSims = this.getSystemSims(system);

				for(let scoreSim of systemSims)
				{
					scoreSims.push(scoreSim);
				}
			}

			// The (-1) alignment and the yCoordinates are dummy values that should never need to be accessed.
			// The (-1) trackIndex argument means that sim.tracks will be empty.
			let endMarkerSim = new Sim(this.endMarkerMsPosInScore, -1, this.yCoordinates, -1);

			scoreSims.push(endMarkerSim);

			return scoreSims;
		}

		private getSystemSims(system: SvgSystem): Sim[]
		{
			let systemSims: Sim[] = [],
				yCoordinates = new YCoordinates(system.startMarker),
				nStaves = system.staves.length, 
				outputTrackIndex = 0,
				isFirstPlayingTrack = true,
				systemOutOfRange = false, // depends on start- and endMarker msPositions
				outputTrackIsOnArray = this.outputTrackIsOnArray;

			for(let staffIndex = 0; staffIndex < nStaves; ++staffIndex)
			{
				let staff = system.staves[staffIndex],
					nVoices = staff.voices.length;

				for(let voiceIndex = 0; voiceIndex < nVoices; ++voiceIndex)
				{
					if(outputTrackIsOnArray[outputTrackIndex])
					{
						if(staff.voices[voiceIndex].timeObjects === undefined)
						{
							// this can happen if the voice is an InputVoice, and the input device is not selected.
							break
						}

						let timeObjects = staff.voices[voiceIndex].timeObjects,
							nTimeObjects = timeObjects.length - 1; // timeObjects includes the final barline in the voice (=system) (don't use it here)

						if(isFirstPlayingTrack)
						{
							let firstTimeObjectMsPos = timeObjects[0].msPositionInScore,
								lastTimeObjectMsPos = timeObjects[timeObjects.length - 1].msPositionInScore;

							if(firstTimeObjectMsPos > this.endMarkerMsPosInScore || lastTimeObjectMsPos < this.startMarkerMsPosInScore)
							{
								systemOutOfRange = true;
								break;
							}
							for(let ti = 0; ti < nTimeObjects; ++ti)
							{
								let tObj = timeObjects[ti],
									msPos = tObj.msPositionInScore;
								if(msPos >= this.startMarkerMsPosInScore && msPos < this.endMarkerMsPosInScore)
								{
									let scoreSim = new Sim(msPos, tObj.alignment, yCoordinates, outputTrackIndex);
									systemSims.push(scoreSim);
								}
							}
							isFirstPlayingTrack = false;
						}
						else
						{
							let simIndex = systemSims.length - 1;
							for(let ti = nTimeObjects - 1; ti >= 0; --ti)
							{
								let tObj = timeObjects[ti],
									tObjPos = tObj.msPositionInScore;
								if(tObjPos >= this.startMarkerMsPosInScore && tObjPos < this.endMarkerMsPosInScore)
								{
									let scoreSim = systemSims[simIndex],
										simPos = scoreSim.msPositionInScore;

									while(simPos > tObjPos && simIndex > 0)
									{
										simIndex--;
										scoreSim = systemSims[simIndex];
										simPos = scoreSim.msPositionInScore;
									}
									// simPos <= tObjPos
									if(simPos === tObjPos)
									{
										scoreSim.pushOutputTrackIndex(outputTrackIndex);
									}
									else // simPos < tObjPos
									{
										let scoreSim = new Sim(tObjPos, tObj.alignment, yCoordinates, outputTrackIndex);
										systemSims.splice(simIndex + 1, 0, scoreSim);
									}
								}
							}
						}
					}

					outputTrackIndex++;
				}

				if(outputTrackIndex === this.nOutputTracks || systemOutOfRange)
				{
					break;
				}
			}

			return systemSims;
		}

		private newCursorLine(): SVGLineElement
		{
			var cursorLine = document.createElementNS("http://www.w3.org/2000/svg", 'line');

			cursorLine.setAttribute("class", "cursorLine");
			cursorLine.setAttribute("x1", "0");
			cursorLine.setAttribute("y1", "0");
			cursorLine.setAttribute("x2", "0");
			cursorLine.setAttribute("y2", "0");
			cursorLine.setAttribute("style", "stroke:#0000FF; stroke-width:1px; visibility:hidden");

			return cursorLine;
		}

		// The trajectory is in performed order of the scoreSims. The indices are not unique in this array.
		// These values are calculated using the current this.scoreSims, so all the values
		// have performing tracks.
		// Trajectories have no terminating value. When the final sim has been completely performed,
		// the player simply calls endOfPerformance().
		private setScoreSimIndexTrajectory(regionDefs: RegionDef[], regionSequence: string): number[]
		{
			let scoreSimIndexTrajectory: number[] = [];

			for(let i = 0; i < regionSequence.length; ++i)
			{
				let regionDef = this.getRegionDef(regionDefs, regionSequence[i]);
				let startScoreSimIndex = this.getStartScoreSimIndex(regionDef.startMsPositionInScore);
				let endScoreSimIndex = this.getEndScoreSimIndex(regionDef.endMsPositionInScore);
				for(let simIndex = startScoreSimIndex; simIndex < endScoreSimIndex; ++simIndex)
				{
					scoreSimIndexTrajectory.push(simIndex);					
				}
			}

			return scoreSimIndexTrajectory;
		}

		// returns the simIndex of the earliest scoreSim whose msPosition is >= msPosInScore
		// msPosInScore may not be in the scoreSims if tracks have been turned off
		private getStartScoreSimIndex(msPosInScore: number): number
		{
			let simIndex = -1;
			for(let i = 0; i < this.scoreSims.length; ++i)
			{
				let scoreSim = this.scoreSims[i];
				if(scoreSim.msPositionInScore >= msPosInScore)
				{
					simIndex = i;
					break;
				}
			}
			return simIndex;
		}

		// returns the simIndex of the latest scoreSim whose msPosition is <= msPosInScore
		// msPosInScore may not be in the scoreSims if tracks have been turned off
		private getEndScoreSimIndex(msPosInScore: number): number
		{
			let simIndex = -1;
			for(let i = this.scoreSims.length - 1 ; i >= 0; --i)
			{
				let scoreSim = this.scoreSims[i];
				if(scoreSim.msPositionInScore <= msPosInScore)
				{
					simIndex = i;
					break;
				}
			}
			return simIndex;
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

		/*--- end of constructor --------------------*/
		/*--- begin setup ---------------------------*/

		public updateStartMarkerMsPos(startMarkerMsPositionInScore: number): void
		{
			this.startMarkerMsPosInScore = startMarkerMsPositionInScore;
			this.updateScoreSimsAndScoreSimIndexTrajectory(this.outputTrackIsOnArray);
		}

		public updateEndMarkerMsPos(endMarkerMsPositionInScore: number): void
		{
			this.endMarkerMsPosInScore = endMarkerMsPositionInScore;
			this.updateScoreSimsAndScoreSimIndexTrajectory(this.outputTrackIsOnArray);
		}

		public setVisible(setToVisible: boolean): void
		{
			if(setToVisible)
			{
				this.line.style.visibility = 'visible';
			}
			else
			{
				this.line.style.visibility = 'hidden';
			}
		}

		public moveToStartMarker(startMarker: StartMarker): void
		{
			let sLine = startMarker.line,
				x = sLine.x1.baseVal.valueAsString,
				y1 = sLine.y1.baseVal.valueAsString,
				y2 = sLine.y2.baseVal.valueAsString;

			this.line.setAttribute("x1", x);
			this.line.setAttribute("y1", y1);
			this.line.setAttribute("x2", x);
			this.line.setAttribute("y2", y2);

			this.yCoordinates = startMarker.yCoordinates;
		}

		// called when a track is toggled on or off or when the startMarker or endMarker is moved
		public updateScoreSimsAndScoreSimIndexTrajectory(trackIsOnArray: boolean[]): void
		{
			if(trackIsOnArray !== undefined)
			{
				this.outputTrackIsOnArray = trackIsOnArray;
				this.scoreSims = this.getScoreSims(this.systems);
				this.setScoreSimIndexTrajectory(this.regionDefs, this.regionSequence);
			}
		}

		// If the track is set to perform (in the trackIsOnArray -- the trackControl settings),
        // sets track._currentMidiObjectIndex, track.currentMidiObject and track.currentMoment.
        // all subsequent midiChords before endMarkerMsPosInScore are set to start at their beginnings.
		public setOutputTracksForOutputSpan(outputTracks: Track[])
		{
			for(let i = 0; i < this.nOutputTracks; ++i)
			{
				let track = outputTracks[i];
				track.isOn = this.outputTrackIsOnArray[i]; 
				if(track.isOn)
				{
					track.setForOutputSpan(this.startMarkerMsPosInScore, this.endMarkerMsPosInScore);
				}
			}
		}

		/*--- end setup ------------------------*/
		/*--- begin runtime --------------------*/

		// The returned numbers should not be changed by the caller.
		// I should have returned this.scoreSimIndexTrajectory.slice() (a copy)
		// but decided to save some memory by not doing so.
		public getScoreSimIndexTrajectory() : number[]
		{
			return this.scoreSimIndexTrajectory;
		}

		public updateCursorLine(indexInScoreSims: number): void
		{
			let scoreSim = this.scoreSims[indexInScoreSims];

			if(scoreSim.yCoordinates !== this.yCoordinates)
			{
				this.line.setAttribute("y1", scoreSim.yCoordinates.top.toString(10));
				this.line.setAttribute("y2", scoreSim.yCoordinates.bottom.toString(10));
			}

			this.line.setAttribute("x1", scoreSim.alignment.toString(10));
			this.line.setAttribute("x2", scoreSim.alignment.toString(10));
		}

		public yCoordinates: YCoordinates;

		private readonly systems: SvgSystem[];
		private readonly regionDefs: RegionDef[];
		private readonly regionSequence: string;
		private readonly line: SVGLineElement;
		private readonly nOutputTracks: number;

		private startMarkerMsPosInScore: number;
		private endMarkerMsPosInScore: number;
		private outputTrackIsOnArray: boolean[];

		private scoreSims: Sim[];
		private scoreSimIndexTrajectory!: number[]; // the ! prevents Typescript from signalling an error.
	}
}
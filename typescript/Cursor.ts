
/// <reference path="Interface.ts" />
/// <reference path="Sim.ts" />

namespace _AP
{
	export class Cursor
	{
		outputTrackIsOnArray: boolean[];
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

			this.outputTrackIsOnArray = this.allTracksOnArray(nOutputTracks);

			this.sims = this.getScoreSims(systems);	// includes the Sim for the final barline.
			this.line = this.newCursorLine();
			markersLayer.appendChild(this.line);


			this.yCoordinates = this.sims[0].yCoordinates;

			// This sequence goes backwards if regions are repeated in the region sequence.
			// In other words, the msPosInScore values are in performed sequence, but they are not unique.
			this.msPosInScoreSequence = this.getMsPosInScoreSequence(regionDefs, regionSequence);
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

		private getScoreSims(systems: SvgSystem[]): Sim[]
		{
			let scoreSims: Sim[] = [];
			for(let system of systems)
			{
				let systemSims = this.getSystemSims(system);

				for(let sim of systemSims)
				{
					scoreSims.push(sim);
				}
			}
			let finalBarlineSim: Sim = this.getFinalBarlineSim(systems);
			scoreSims.push(finalBarlineSim);

			return scoreSims;
		}

		private getSystemSims(system: SvgSystem): Sim[]
		{
			let systemSims: Sim[] = [],
				yCoordinates = new YCoordinates(system.startMarker),
				nStaves = system.staves.length, 
				outputTrackIndex = 0,
				isFirstPlayingTrack = true,
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
							nTimeObjects = timeObjects.length - 1; // timeObjects includes the final barline (don't use it here)

						if(isFirstPlayingTrack)
						{
							for(let ti = 0; ti < nTimeObjects; ++ti)
							{
								let tObj = timeObjects[ti],
									msPos = tObj.msPositionInScore;
								if(msPos >= this.startMarkerMsPosInScore && msPos <= this.endMarkerMsPosInScore)
								{
									let sim = new Sim(tObj.msPositionInScore, tObj.alignment, yCoordinates, outputTrackIndex);
									systemSims.push(sim);
								}
							}
							isFirstPlayingTrack = false;
						}
						else
						{
							let maxPos = Number.MAX_VALUE,
								simIndex = systemSims.length - 1;
							for(let ti = nTimeObjects - 1; ti >= 0; --ti)
							{
								let tObj = timeObjects[ti],
									tObjPos = tObj.msPositionInScore,
									sim = systemSims[simIndex],
									simPos = sim.msPositionInScore;

								while(simPos >= tObjPos && simIndex > 0)
								{
									maxPos = simPos;
									simIndex--;
									sim = systemSims[simIndex];
									simPos = sim.msPositionInScore;
								}

								if(simPos >= this.startMarkerMsPosInScore && simPos <= this.endMarkerMsPosInScore)
								{
									if(maxPos > tObjPos)
									{
										maxPos = tObjPos;
										if(simPos === tObjPos)
										{
											sim.pushOutputTrackIndex(outputTrackIndex);
										}
										else if(simPos < tObjPos)
										{
											let sim = new Sim(tObjPos, tObj.alignment, yCoordinates, outputTrackIndex);
											systemSims.splice(simIndex + 1, 0, sim);
										}
										else if(simPos > tObjPos)
										{
											let sim = new Sim(tObjPos, tObj.alignment, yCoordinates, outputTrackIndex);
											systemSims.splice(0, 0, sim);
										}
									}
								}
							}
						}
					}

					outputTrackIndex++;
				}

				if(outputTrackIndex === this.nOutputTracks)
				{
					break;
				}
			}

			return systemSims;
		}

		private getFinalBarlineSim(systems: SvgSystem[]): Sim
		{
			let system = systems[systems.length - 1],
				yCoordinates = new YCoordinates(system.startMarker),
				timeObjects = system.staves[0].voices[0].timeObjects,
				finalBarlineTimeObject = timeObjects[timeObjects.length - 1],
				msPos = finalBarlineTimeObject.msPositionInScore,
				alignment = finalBarlineTimeObject.alignment,
				finalBarlineSim = new Sim(msPos, alignment, yCoordinates, -1);

			return finalBarlineSim;
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

		private getMsPosInScoreSequence(regionDefs: RegionDef[], regionSequence: string): number[]
		{
			let msPosInScoreSequence: number[] = [];

			for(let i = 0; i < regionSequence.length; ++i)
			{
				let regionDef = this.getRegionDef(regionDefs, regionSequence[i]);
				let startSimIndex = this.getStartSimIndex(regionDef.startMsPositionInScore);
				let endSimIndex = this.getEndSimIndex(regionDef.endMsPositionInScore);
				for(let simIndex = startSimIndex; simIndex < endSimIndex; ++simIndex)
				{
					msPosInScoreSequence.push(this.sims[simIndex].msPositionInScore);
				}
			}

			return msPosInScoreSequence;
		}

		// returns the simIndex of the earliest sim whose msPosition is >= msPosInScore
		// msPosInScore may not be in the sims if tracks have been turned off
		private getStartSimIndex(msPosInScore: number): number
		{
			let simIndex = -1;
			for(let i = 0; i < this.sims.length; ++i)
			{
				let sim = this.sims[i];
				if(sim.msPositionInScore >= msPosInScore)
				{
					simIndex = i;
					break;
				}
			}
			return simIndex;
		}

		// returns the simIndex of the latest sim whose msPosition is <= msPosInScore
		// msPosInScore may not be in the sims if tracks have been turned off
		private getEndSimIndex(msPosInScore: number): number
		{
			let simIndex = -1;
			for(let i = this.sims.length - 1 ; i >= 0; --i)
			{
				let sim = this.sims[i];
				if(sim.msPositionInScore <= msPosInScore)
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
			this.updateMsPosInScoreSequence(this.outputTrackIsOnArray);
		}

		public updateEndMarkerMsPos(endMarkerMsPositionInScore: number): void
		{
			this.startMarkerMsPosInScore = endMarkerMsPositionInScore;
			this.updateMsPosInScoreSequence(this.outputTrackIsOnArray);
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
		public updateMsPosInScoreSequence(trackIsOnArray: boolean[]): void
		{
			this.outputTrackIsOnArray = trackIsOnArray;
			if(trackIsOnArray !== undefined)
			{
				this.sims = this.getScoreSims(this.systems);
				this.msPosInScoreSequence = this.getMsPosInScoreSequence(this.regionDefs, this.regionSequence);
			}
		}

		// If the track is set to perform (in the trackIsOnArray -- the trackControl settings),
        // sets track._currentMidiObjectIndex, track.currentMidiObject and track.currentMoment.
        // all subsequent midiChords before endMarkerMsPosInScore are set to start at their beginnings.
		private setForOutputSpan(outputTracks: Track[], trackIsOnArray: boolean[])
		{
			for(let i = 0; i < outputTracks.length; ++i)
			{
				let track = outputTracks[i];
				track.isOn = trackIsOnArray[i]; 
				if(track.isOn)
				{
					track.setForOutputSpan(this.startMarkerMsPosInScore, this.endMarkerMsPosInScore);
				}
			}
		}

		//private setSimIsOnAttributes(trackIsOnArray: boolean[])
		//{
			//for(let sim of this.sims)
			//{
			//	let inputTrackIndex = 0;
			//	for(let trackIndex = 0; trackIndex < trackIsOnArray.length; ++trackIndex)
			//	{
			//		let bool = trackIsOnArray[trackIndex]; // both input and output tracks
			//		if(trackIndex < this.nOutputTracks)
			//		{
			//			let midiObject = sim.midiObjects[trackIndex];
			//			if(midiObject !== undefined)
			//			{
			//				midiObject.isOn = bool;
			//			}
			//		}
			//		else
			//		{
			//			let inputObject = sim.inputObjects[inputTrackIndex];
			//			if(inputObject !== undefined)
			//			{
			//				inputObject.isOn = bool;
			//			}
			//		}
			//		if(trackIndex >= this.nOutputTracks)
			//		{
			//			inputTrackIndex++;
			//		}
			//	}
			//}
		//}

		/*--- end setup ------------------------*/
		/*--- begin runtime --------------------*/

		public incrementPosition()
		{
			let sims = this.sims;

			this.positionIndex++;

			if(this.sims[this.positionIndex].msPositionInScore < this.endMarkerMsPosInScore)
			{
				this.moveLineToSim(sims[this.positionIndex]);
			}
			else
			{
				throw "Temp exception: (end of performance)"
			}
		}

		moveLineToSim(sim: Sim)
		{
			if(sim.yCoordinates !== this.yCoordinates)
			{
				this.line.setAttribute("y1", sim.yCoordinates.top.toString(10));
				this.line.setAttribute("y2", sim.yCoordinates.bottom.toString(10));
			}

			this.line.setAttribute("x1", sim.alignment.toString(10));
			this.line.setAttribute("x2", sim.alignment.toString(10));
		}

		public yCoordinates: YCoordinates;

		private readonly systems: SvgSystem[];
		private readonly regionDefs: RegionDef[];
		private readonly regionSequence: string;
		private readonly line: SVGLineElement;
		private readonly nOutputTracks: number;

		private sims: Sim[];
		private msPosInScoreSequence: number[];
		private startMarkerMsPosInScore: number;
		private endMarkerMsPosInScore: number;

		private positionIndex: number = 0;
		private nextMsPosition: number = 0;

	}
}
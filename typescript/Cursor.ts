
/// <reference path="Context.ts" />
/// <reference path="Sims.ts" />

namespace _AP
{
	export class Cursor
	{
		//constructor(markersLayer: SVGGElement, yCoordinates: YCoordinates)
		constructor(systems: SvgSystem[], markersLayer: SVGGElement)
		{
			let o: ScoreSims = new ScoreSims(systems);
			this.sims = o.scoreSims;
			this.nOutputTracks = o.nOutputTracks;
			this.yCoordinates = this.sims[0].yCoordinates;

			this.sims[0].isOn = false;

			this.line = this.newCursorLine();
			markersLayer.appendChild(this.line);
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

		/*--- end of constructor --------------------*/
		/*--- begin setup ---------------------------*/

		private setVisible(setToVisible: boolean): void
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

		private moveToStartMarker(startMarker: StartMarker): void
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

		// sets the cursor's internal startMarkerMsPosition and endMarkerMsPosition fields
		// sets the isOn attribute of each timeObject in the cursor's sims
		// sets the outputTracks to their playing state
		// moves the cursor's line to the startMarker and makes it visible
		public setPlayingState(startMarker: StartMarker, outputTracks: Track[], endMarkerMsPositionInScore: number, trackIsOnArray: boolean[]): void
		{
			this.startMarkerMsPosInScore = startMarker.msPositionInScore;
			this.endMarkerMsPosInScore = endMarkerMsPositionInScore;

			this.setTimeObjectIsOnAttributes(trackIsOnArray);

			this.setForOutputSpan(outputTracks, trackIsOnArray);

			this.moveToStartMarker(startMarker);
			this.setVisible(true);
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

		private setTimeObjectIsOnAttributes(trackIsOnArray: boolean[])
		{
			for(let sim of this.sims)
			{
				let inputTrackIndex = 0;
				for(let trackIndex = 0; trackIndex < trackIsOnArray.length; ++trackIndex)
				{
					let bool = trackIsOnArray[trackIndex]; // both input and output tracks
					if(trackIndex < this.nOutputTracks)
					{
						let midiObject = sim.midiObjects[trackIndex];
						if(midiObject !== undefined)
						{
							midiObject.isOn = bool;
						}
					}
					else
					{
						let inputObject = sim.inputObjects[inputTrackIndex];
						if(inputObject !== undefined)
						{
							inputObject.isOn = bool;
						}
					}
					if(trackIndex >= this.nOutputTracks)
					{
						inputTrackIndex++;
					}
				}
			}
		}

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

		private readonly line: SVGLineElement;
		private readonly sims: Sim[];
		private readonly nOutputTracks: number;
		positionIndex: number = 0;
		nextMsPosition: number = 0;
		private startMarkerMsPosInScore: number = 0;
		private endMarkerMsPosInScore: number = 0;
	}
}
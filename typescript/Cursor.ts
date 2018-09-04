
/// <reference path="Interface.ts" />
/// <reference path="CursorCoordinates.ts" />
/// <reference path="RegionLink.ts" />

namespace _AP
{
	export class Cursor
	{
		constructor(
			markersLayer: SVGGElement,
			endMarkerMsPosInScore: number,
			systems: SvgSystem[],
			viewBoxScale: number,
			systemChanged: Function
		)
		{
			this.endMarkerMsPosInScore = endMarkerMsPosInScore;

			this.setScoreCursorCoordinates(systems, viewBoxScale); // does not include the endMarkerMsPosInScore.

			let firstCursorCoordinates = this.scoreCursorCoordinatesMap.get(0);
			if(firstCursorCoordinates !== undefined)
			{
				this.yCoordinates = firstCursorCoordinates.yCoordinates;
				this.line = this.newCursorLine(firstCursorCoordinates, viewBoxScale);
				markersLayer.appendChild(this.line);
			}

			this.viewBoxScale = viewBoxScale;
			this.systemChanged = systemChanged;
		}

		// returns a Map that relates every msPositionInScore to a CursorCoordinates object.
		// the map does not contain an entry for the final barline
		private setScoreCursorCoordinates(systems: SvgSystem[], viewBoxScale:number): void
		{
			let scoreCCs = this.scoreCursorCoordinatesMap; // currently empty

			for(let system of systems)
			{
				let systemSims = this.getSystemCursorCoordinates(system, viewBoxScale);

				for(let entry of systemSims.entries())
				{
					scoreCCs.set(entry[0], entry[1]);
				}
			}
		}

		private getSystemCursorCoordinates(system: SvgSystem, viewBoxScale: number): Map<number, CursorCoordinates>
		{
			let systemCCMap = new Map<number, CursorCoordinates>(),
				nStaves = system.staves.length,
				yCoordinates = new YCoordinates(system.startMarker);

			for(let staffIndex = 0; staffIndex < nStaves; ++staffIndex)
			{
				let staff = system.staves[staffIndex],
					nVoices = staff.voices.length;

				for(let voiceIndex = 0; voiceIndex < nVoices; ++voiceIndex)
				{
					if(staff.voices[voiceIndex].timeObjects === undefined)
					{
						// this can happen if the voice is an InputVoice, and the input device is not selected.
						continue;
					}

					let timeObjects = staff.voices[voiceIndex].timeObjects,
						nTimeObjects = timeObjects.length - 1; // timeObjects includes the final barline in the voice (=system) (don't use it here)

					if(staffIndex === 0 && voiceIndex === 0)
					{
						for(let ti = 0; ti < nTimeObjects; ++ti)
						{
							let tObj = timeObjects[ti],	msPos = tObj.msPositionInScore;
							if(msPos < this.endMarkerMsPosInScore)
							{
								let cursorCoordinates = new CursorCoordinates(yCoordinates, tObj.alignment * viewBoxScale);
								systemCCMap.set(msPos, cursorCoordinates);
							}
						}
					}
					else
					{
						for(let ti = nTimeObjects - 1; ti >= 0; --ti)
						{
							let tObj = timeObjects[ti],
								tObjPos = tObj.msPositionInScore;

							if(systemCCMap.get(tObjPos) === undefined)
							{
								let cursorCoordinates = new CursorCoordinates(yCoordinates, tObj.alignment * viewBoxScale);
								systemCCMap.set(tObjPos, cursorCoordinates);
							}
						}
					}
				}
			}

			return systemCCMap;
		}

		private newCursorLine(firstCursorCoordinates: CursorCoordinates, viewBoxScale:number): SVGLineElement
		{
			var cursorLine = document.createElementNS("http://www.w3.org/2000/svg", 'line'),
				yCoordinates = firstCursorCoordinates.yCoordinates,
				alignment = firstCursorCoordinates.alignment;

			cursorLine.setAttribute("class", "cursorLine");
			cursorLine.setAttribute("x1", alignment.toString(10));
			cursorLine.setAttribute("y1", yCoordinates.top.toString(10));
			cursorLine.setAttribute("x2", alignment.toString(10));
			cursorLine.setAttribute("y2", yCoordinates.bottom.toString(10));
			cursorLine.setAttribute("style", "stroke:#999999; stroke-width:" + viewBoxScale.toString(10) + "px; visibility:hidden");

			return cursorLine;
		}

		/*--- end of constructor --------------------*/
		/*--- begin setup ---------------------------*/

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

		/*--- end setup ------------------------*/
		/*--- begin runtime --------------------*/

		public moveCursorLineTo(msPositionInScore: number): void
		{
			if(msPositionInScore === this.endMarkerMsPosInScore)
			{
				this.setVisible(false);
			}
			else
			{
				let cursorCoordinates = this.scoreCursorCoordinatesMap.get(msPositionInScore);
				if(cursorCoordinates !== undefined)
				{
					if(cursorCoordinates.yCoordinates !== this.yCoordinates)
					{
						this.yCoordinates = cursorCoordinates.yCoordinates;
						this.line.setAttribute("y1", this.yCoordinates.top.toString(10));
						this.line.setAttribute("y2", this.yCoordinates.bottom.toString(10));
						let yCoordinates = { top: this.yCoordinates.top / this.viewBoxScale, bottom: this.yCoordinates.bottom / this.viewBoxScale };
						this.systemChanged(yCoordinates);
					}

					this.line.setAttribute("x1", cursorCoordinates.alignment.toString(10));
					this.line.setAttribute("x2", cursorCoordinates.alignment.toString(10));
				}
			}
		}

		private scoreCursorCoordinatesMap = new Map<number, CursorCoordinates>(); // msPositionInScore, cursorCoordinates
		private yCoordinates: YCoordinates = {top: 0, bottom: 0};
		private endMarkerMsPosInScore: number;

		private readonly viewBoxScale: number;
		private readonly line!: SVGLineElement;
		private readonly systemChanged: Function;
	}
}
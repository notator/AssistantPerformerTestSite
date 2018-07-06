
/// <reference path="Interface.ts" />
/// <reference path="CursorCoordinates.ts" />

namespace _AP
{
	export class Cursor
	{
		constructor(
			markersLayer: SVGGElement,
			regionDefs: RegionDef[],
			regionSequence: string,
			endMarkerMsPosInScore: number,
			systems: SvgSystem[])
		{
			this.line = this.newCursorLine();
			markersLayer.appendChild(this.line);

			this.setMsPosMap(regionDefs, regionSequence);

			this.endMarkerMsPosInScore = endMarkerMsPosInScore;

			this.setScoreCursorCoordinates(systems);	// does not include the endMarkerMsPosInScore.

			let firstCursorCoordinates = this.scoreCursorCoordinatesMap.get(0);
			if(firstCursorCoordinates !== undefined)
			{
				this.yCoordinates = firstCursorCoordinates.yCoordinates;
			}
		}

		// returns a Map that relates every msPositionInScore to a CursorCoordinates object.
		// the map does not contain an entry for the final barline
		private setScoreCursorCoordinates(systems: SvgSystem[]): void
		{
			let scoreCCs = this.scoreCursorCoordinatesMap; // currently empty

			for(let system of systems)
			{
				let systemSims = this.getSystemCursorCoordinates(system);

				for(let entry of systemSims.entries())
				{
					scoreCCs.set(entry[0], entry[1]);
				}
			}
		}

		private getSystemCursorCoordinates(system: SvgSystem): Map<number, CursorCoordinates>
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
								let cursorCoordinates = new CursorCoordinates(yCoordinates, tObj.alignment);
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
								let cursorCoordinates = new CursorCoordinates(yCoordinates, tObj.alignment);
								systemCCMap.set(tObjPos, cursorCoordinates);
							}
						}
					}
				}
			}

			return systemCCMap;
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

		private setMsPosMap(regionDefs: RegionDef[], regionSequence: string): void
		{
			let performanceTime: number = 0;

			for(let i = 0; i < regionSequence.length; ++i)
			{
				let name = regionSequence[i];
				let regionDef = this.getRegionDef(regionDefs, name);
				let scoreTime = regionDef.startMsPositionInScore;
				let timeDelta = scoreTime + performanceTime;

				// at runTime: timeDelta - perfomanceTime = scoreTime
				this.msPosMap.set(performanceTime, timeDelta);

				// when this region has completed:
				performanceTime += (regionDef.endMsPositionInScore - regionDef.startMsPositionInScore);
			}

			this.logMsPosMap();
		}

		private logMsPosMap()
		{
			for(let entry of this.msPosMap.entries())
			{
				console.log(entry[0].toString() + " - " + entry[1].toString());
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

		public moveCursorLine(msPositionInScore: number): void
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
					}

					this.line.setAttribute("x1", cursorCoordinates.alignment.toString(10));
					this.line.setAttribute("x2", cursorCoordinates.alignment.toString(10));
				}
			}
		}

		public msPosMap: Map<number, number> = new Map<number, number>();

		private scoreCursorCoordinatesMap = new Map<number, CursorCoordinates>(); // msPositionInScore, cursorCoordinates
		private yCoordinates: YCoordinates = {top: 0, bottom: 0};
		private endMarkerMsPosInScore: number;
		

		private readonly line: SVGLineElement;
	}
}
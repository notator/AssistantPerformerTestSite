
/// <reference path="Context.ts" />
/// <reference path="Sims.ts" />

namespace _AP
{
	export class Cursor
	{
		checkTrackIsOnArray(trackIsOnArray: any[]): void
		{
			for(let bool of trackIsOnArray)
			{
				if(typeof(bool) !== "boolean")
				{
					throw "not an array of boolean.";
				}
			}
		}
		checkStartMarker(startMarker: StartMarker): void
		{
			if(startMarker.alignment === undefined
				|| startMarker.msPositionInScore === undefined
				|| startMarker.systemIndexInScore === undefined
				|| startMarker.viewBoxScale === undefined
				|| startMarker.yCoordinates === undefined
				|| startMarker.yCoordinates.top === undefined
				|| startMarker.yCoordinates.bottom === undefined
				|| startMarker.line === undefined
				|| startMarker.circle === undefined)
			{
				throw "not a startMarker";
			}
		}

		readonly line: SVGLineElement;

		/* Includes SimData for the final barline. */
		readonly scoreSimDatas: SimData[];

		// foreach system, system.runningMarker.setTimeObjects
		private setTimeObjects(systems: SvgSystem[], isLivePerformance: boolean, trackIsOnArray: boolean[]): void
		{
			throw new Error("Method not implemented.");
		}

		// score.hideRunningMarkers()
		private hide(): void
		{
			this.line.style.visibility = 'hidden';
		}

		//runningMarker = systems[startMarker.systemIndexInScore].runningMarker;
		//runningMarker.setVisible(true);
		private setVisibleAtStartMarker(startMarker: StartMarker): void
		{
			let sLine = startMarker.line,
				x = sLine.x1.baseVal.valueAsString,
				y1 = sLine.y1.baseVal.valueAsString,
				y2 = sLine.y2.baseVal.valueAsString;			

			this.line.setAttribute("x1", x);
			this.line.setAttribute("y1", y1);
			this.line.setAttribute("x2", x);
			this.line.setAttribute("y2", y2);

			this.line.style.visibility = 'visible';
		}



		constructor(scoreSimDatas: SimData[],
			systems: SvgSystem[],
			markersLayer: SVGGElement,
			isLivePerformance: boolean,
			trackIsOnArray: boolean[],
			startMarker: StartMarker)
		{
			// scoreSimDatas is type-checked by typescript
			// systems have been checked when constructing scoreSimDatas
			// isLivePerformance is type-checked by typescript
			this.checkTrackIsOnArray(trackIsOnArray);
			this.checkStartMarker(startMarker);

			this.scoreSimDatas = scoreSimDatas;

			this.line = markersLayer.getElementsByClassName("cursorLine")[0] as SVGLineElement;

			this.setVisibleAtStartMarker(startMarker);
		}

	}
}
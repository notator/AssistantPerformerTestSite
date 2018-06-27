
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
		checkStartMarker(startMarker: any): void
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
		/* Includes SimData for the final barline. */
		readonly scoreSimDatas: SimData[];

		// foreach system, system.runningMarker.setTimeObjects
		private setTimeObjects(systems: any[], isLivePerformance: boolean, trackIsOnArray: boolean[]): void
		{
			throw new Error("Method not implemented.");
		}

		// score.hideRunningMarkers()
		private hide(): void
		{
			throw new Error("Method not implemented.");
		}

		// score.moveRunningMarkersToStartMarkers();
		private moveRunningMarkersToStartMarkers(): void
		{
			throw new Error("Method not implemented.");
		}

		//runningMarker = systems[startMarker.systemIndexInScore].runningMarker;
		//runningMarker.setVisible(true);
		private setVisibleAtStartMarker(startMarker: any): void
		{
			throw new Error("Method not implemented.");
		}

		constructor(scoreSimDatas: SimData[], systems:any[], isLivePerformance:boolean, trackIsOnArray:boolean[], startMarker: any) // an array of systems
		{
			// scoreSimDatas is type-checked by typescript
			// systems have been checked when constructing scoreSimDatas
			// isLivePerformance is type-checked by typescript
			this.checkTrackIsOnArray(trackIsOnArray);
			this.checkStartMarker(startMarker);

			this.scoreSimDatas = scoreSimDatas;
			this.setTimeObjects(systems, isLivePerformance, trackIsOnArray);
			this.hide();
			this.moveRunningMarkersToStartMarkers();
			this.setVisibleAtStartMarker(startMarker);
		}

	}
}
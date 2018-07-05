
/// <reference path="Interface.ts" />

namespace _AP
{
	export class YCoordinates
	{
		readonly top: number;
		readonly bottom: number;
		constructor(startMarker: StartMarker)
		{
			let line = startMarker.line;

			this.top = line.y1.baseVal.value;
			this.bottom = line.y2.baseVal.value;
		}
	}

	// all sims except the final barline have at least one performing output track
	export class Sim
	{
		constructor(msPosInScore: number, alignment: number|undefined, yCoordinates: YCoordinates|undefined, outputTrackIndex:number|undefined)
		{
			this.msPositionInScore = msPosInScore;
			this.alignment = alignment;
			this.yCoordinates = yCoordinates;
			if(outputTrackIndex !== undefined)
			{
				this.outputTrackIndices.push(outputTrackIndex);
			}
		}

		public pushOutputTrackIndex(outputTrackIndex: number): void
		{
			let index = this.outputTrackIndices.indexOf(outputTrackIndex); 
			if(index >= 0)
			{
				throw "duplicate trackIndex.";
			}
			this.outputTrackIndices.push(outputTrackIndex);
		}

		public getOutputTrackIndices(): number[]
		{
			return this.outputTrackIndices.slice();
		}

		public readonly msPositionInScore: number;
		public alignment: number|undefined;
		public readonly yCoordinates: YCoordinates|undefined;
		private outputTrackIndices: number[] = [];
	}
}
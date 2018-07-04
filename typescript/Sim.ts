
/// <reference path="Context.ts" />

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

	export class Sim
	{
		constructor(msPosInScore: number, alignment: number, yCoordinates: YCoordinates)
		{
			this.msPositionInScore = msPosInScore;
			this.alignment = alignment;
			this.yCoordinates = yCoordinates;
		}

		public readonly msPositionInScore: number;
		public alignment: number;
		public readonly yCoordinates: YCoordinates;
		public isOn: boolean = true; // will be set to false, if the sim has no performing midiObjects
	}
}
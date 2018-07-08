
/// <reference path="Interface.ts" />

namespace _AP
{
	export class YCoordinates
	{
		constructor(startMarker: StartMarker)
		{
			let line = startMarker.line;

			this.top = line.y1.baseVal.value;
			this.bottom = line.y2.baseVal.value;
		}
		readonly top: number;
		readonly bottom: number;
	}
}
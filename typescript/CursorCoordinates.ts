
/// <reference path="Interface.ts" />
/// <reference path="YCoordinates.ts" />

namespace _AP
{
	export class CursorCoordinates
	{
		constructor(yCoordinates:YCoordinates, alignment: number)
		{
			this.yCoordinates = yCoordinates;
			this.alignment = alignment;
		}

		readonly yCoordinates: YCoordinates;
		readonly alignment: number;
	}
}
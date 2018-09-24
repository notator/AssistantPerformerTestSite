
import { YCoordinates } from "./YCoordinates.js";

export class CursorCoordinates
{
	/**
	 * A cursor's x, top and bottom coordinates.
	 * @param {number} alignment the x-coordinate (a float)
	 * @param {YCoordinates} yCoordinates the top and bottom coordinates
	 */
	constructor(alignment, yCoordinates)
	{
		console.assert(yCoordinates instanceof YCoordinates);

		this.alignment = alignment;
		this.yCoordinates = yCoordinates;		
	}
}


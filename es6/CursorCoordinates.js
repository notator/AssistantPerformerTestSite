


export class CursorCoordinates
{
	/**
	 * A cursor's x and two y coordinates.
	 * @param {number} alignment the x-coordinate (a float)
	 * @param {YCoordinates} yCoordinates the top and bottom coordinates
	 */
	constructor(alignment, yCoordinates)
	{
		this.alignment = alignment;
		this.yCoordinates = yCoordinates;		
	}
}


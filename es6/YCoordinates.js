
export class YCoordinates
{
	constructor(startMarker)
	{
		let line = startMarker.line;
		this.top = line.y1.baseVal.value;
		this.bottom = line.y2.baseVal.value;
	}
}


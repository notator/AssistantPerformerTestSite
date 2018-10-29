export class Conductor
{
	constructor(startPlayingFunction)
	{
		// These are all "private" attributes, they should only be changed using the functons provided.
		Object.defineProperty(this, "_startPlaying", { value: startPlayingFunction, writable: false });
		Object.defineProperty(this, "_timeMarker", { value: undefined, writable: true });
		Object.defineProperty(this, "_prevX", { value: -1, writable: true });
		Object.defineProperty(this, "_prevY", { value: -1, writable: true });
		 // continuously increasing value wrt start of performance. Returned by now()
		Object.defineProperty(this, "_msPositionInPerformance", { value: 0, writable: true });
		// The _speed is the value of the speed control when the set conducting button is clicked.
		// It is currently the ratio between the distance travelled by the conductor's cursor and the elapsed time.
		// However, note that any function could be used to describe this relation.
		// Example 1: as here, but with the speed factor depending on e.clientY.
		// Example 2: use performance.now(), but with the speed factor depending on e.clientY.
		Object.defineProperty(this, "_speed", { value: -1, writable: true });
	}

	setTimeMarker(timeMarker)
	{
		this._timeMarker = timeMarker;
	}

	init(startMarker, startRegionIndex, endRegionIndex, speed)
	{
		this._timeMarker.init(startMarker, startRegionIndex, endRegionIndex);
		this._prevX = -1;
		this._prevY = -1;
		this._msPositionInPerformance = 0;
		this._speed = speed;
	}

	timeMarkerElement()
	{
		let element = undefined;
		if(this._timeMarker !== undefined && this._timeMarker.element !== undefined)
		{
			element = this._timeMarker.element; 
		}
		return element;
	}

	// mousemove handler
	conduct(e)
	{
		var
			pixelDistance, milliseconds,
			dx, dy;

		if(this._prevX < 0)
		{
			this._prevX = e.clientX;
			this._prevY = e.clientY;
			this._startPlaying(false);
		}
		else
		{
			dx = this._prevX - e.clientX;
			dy = this._prevY - e.clientY;

			this._prevX = e.clientX;
			this._prevY = e.clientY;

			pixelDistance = Math.sqrt((dx * dx) + (dy * dy));
			milliseconds = (pixelDistance / this._timeMarker.msPosData.pixelsPerMs) * this._speed;

			// this._msPositionInPerformance is the current msPosition wrt the start of the performance (returned by this.now()).
			this._msPositionInPerformance += milliseconds;
			this._timeMarker.advance(milliseconds);
		}
	}

	now()
	{
		return this._msPositionInPerformance;
	}
}


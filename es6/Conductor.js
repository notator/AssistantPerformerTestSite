export class Conductor
{
	constructor(startPlayingFunction)
	{
		Object.defineProperty(this, "_startPlaying", { value: startPlayingFunction, writable: false });
		// The _speed is the value of the speed control when the set conducting button is clicked.
		// It is the ratio between the distance travelled by the conductor's cursor and the elapsed time.
		Object.defineProperty(this, "_speed", { value: -1, writable: true });
		Object.defineProperty(this, "timeMarker", { value: undefined, writable: true });
		Object.defineProperty(this, "_prevX", { value: -1, writable: true });
		Object.defineProperty(this, "_prevY", { value: -1, writable: true });

		 // continuously increasing value wrt start of performance returned by now()
		Object.defineProperty(this, "msPositionInPerformance", { value: 0, writable: true });
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

			// Note that any function could be used to describe the relation
			// between the conductor's spatial input and its meaning in time.
			// Example 1: as here, but with the speed factor depending on e.clientY.
			// Example 2: use performance.now(), but with the speed factor depending on e.clientY.
			pixelDistance = Math.sqrt((dx * dx) + (dy * dy));
			milliseconds = (pixelDistance / this.timeMarker.msPosData.pixelsPerMs) * this._speed;

			// this.msPositionInPerformance is the current msPosition wrt the start of the performance (returned by this.now()).
			this.msPositionInPerformance += milliseconds;
			this.timeMarker.advance(milliseconds);
		}
	}

	setSpeed(speed)
	{
		this._speed = speed;
	}

	setTimeMarker(timeMarker)
	{
		this.timeMarker = timeMarker;
		this._prevX = -1;
	}

	now()
	{
		return this.msPositionInPerformance;
	}
}


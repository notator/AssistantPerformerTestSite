export class Conductor
{
	constructor(startPlayingFunction)
	{
		Object.defineProperty(this, "_startPlaying", { value: startPlayingFunction, writable: false });
		// The _speed is the value of the speed control when the set conducting button is clicked.
		// It is the ratio between the total distance travelled by the conductor's cursor and the elapsed time
		// (according to msPositionInScore) since the beginning of the performance.
		Object.defineProperty(this, "_speed", { value: -1, writable: true });
		Object.defineProperty(this, "_timePointer", { value: undefined, writable: true });
		Object.defineProperty(this, "_prevX", { value: -1, writable: true });
		Object.defineProperty(this, "_prevY", { value: -1, writable: true });
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

			milliseconds = pixelDistance * this._timePointer.msPerPx() * this._speed;

			this._timePointer.advance(milliseconds);
		}
	}

	setSpeed(speed)
	{
		this._speed = speed;
	}

	setTimePointer(timePointer)
	{
		if(this._timePointer !== undefined)
		{
			this._timePointer.setVisible(false);
		}

		this._timePointer = timePointer;
		if(timePointer !== undefined)
		{
			this._timePointer.setVisible(true);
			this._prevX = -1;
		}
	}

	now()
	{
		return this._timePointer.now();
	}
}


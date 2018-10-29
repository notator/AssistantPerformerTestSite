import { TimeMarker } from "./TimeMarker.js";

export class Conductor
{
	constructor(startPlayingFunction, systems, cursor, regionSequence)
	{
		let timeMarker = new TimeMarker(systems, cursor, regionSequence);

		// These are all "private" attributes, they should only be changed using the functions provided.
		Object.defineProperty(this, "_startPlaying", { value: startPlayingFunction, writable: false });
		Object.defineProperty(this, "_timeMarker", { value: timeMarker, writable: true });
		Object.defineProperty(this, "_prevX", { value: -1, writable: true });
		Object.defineProperty(this, "_prevY", { value: -1, writable: true });
		 // Continuously increasing value wrt start of performance. Returned by now()
		Object.defineProperty(this, "_msPositionInPerformance", { value: 0, writable: true });
		// The _speed is the value of the speed control when the set conducting button is clicked.
		Object.defineProperty(this, "_speed", { value: -1, writable: true });
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
		return this._timeMarker.element; 
	}

	// mousemove handler
	// Currently, performance time is simply proportional to the distance travelled by the conductor's cursor.
	// However, note that _any_ function could be used to describe this relation.
	// Example 1: as here, but with the speed factor depending on e.clientY (in the conduct(e) function).
	// Example 2: use performance.now(), but with the speed factor depending on e.clientY.
	// The information inside the TimeMarker could also be used in such a function, so that, for example,
	// the conductor's space/time relation could depend on the currentRegionIndex.
	// Functions that change the performance of repeated regions (CC values etc.) could also be implemented
	// using the TimeMarker's attributes.
	conduct(e)
	{
		if(this._prevX < 0)
		{
			this._prevX = e.clientX;
			this._prevY = e.clientY;
			this._startPlaying(false);
		}
		else
		{
			let dx = this._prevX - e.clientX,
				dy = this._prevY - e.clientY;

			this._prevX = e.clientX;
			this._prevY = e.clientY;

			let pixelDistance = Math.sqrt((dx * dx) + (dy * dy)),
				milliseconds = (pixelDistance / this._timeMarker.msPosData.pixelsPerMs) * this._speed;

			this._msPositionInPerformance += milliseconds;
			this._timeMarker.advance(milliseconds);
		}
	}

	now()
	{
		return this._msPositionInPerformance;
	}
}


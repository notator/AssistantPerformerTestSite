import { TimeMarker } from "./TimeMarker.js";

export class Conductor
{
	constructor(systems, cursor, regionSequence)
	{
		let timeMarker = new TimeMarker(systems, cursor, regionSequence);

		Object.defineProperty(this, "_conductingLayer", { value: document.getElementById("conductingLayer"), writable: false });
		// The rate at which setInterval calls doConducting(...)
		Object.defineProperty(this, "_intervalRate", { value: 10, writable: false });

		// These are all "private" attributes, they should only be changed using the functions provided.
		Object.defineProperty(this, "_startPlaying", { value: undefined, writable: true });
		Object.defineProperty(this, "_timeMarker", { value: timeMarker, writable: true });
		Object.defineProperty(this, "_prevX", { value: -1, writable: true });
		//Object.defineProperty(this, "_prevY", { value: -1, writable: true });
		// Continuously increasing value wrt start of performance (and recording). Returned by now().
		Object.defineProperty(this, "_msPositionInPerformance", { value: 0, writable: true });
		// The _speed is the value of the speed control when the set conducting button is clicked.
		Object.defineProperty(this, "_speed", { value: -1, writable: true });
		Object.defineProperty(this, "_setIntervalHandle", { value: undefined, writable: true });
	}

	init(startMarker, startPlayingCallback, startRegionIndex, endRegionIndex, speed)
	{
		this._startPlaying = startPlayingCallback;
		this._timeMarker.init(startMarker, startRegionIndex, endRegionIndex);
		this._prevX = -1;
		//this._prevY = -1;
		this._msPositionInPerformance = 0;
		this._speed = speed;
		this._setIntervalHandle = undefined;
	}

	timeMarkerElement()
	{
		return this._timeMarker.element;
	}

	//// mousemove handler #1
	//// This handler sets performance time proportional to the distance travelled by the conductor's cursor.
	//// However, note that _any_ function could be used to describe this relation.
	//// Example 1: as here, but with the speed factor depending on e.clientY (in the conduct(e) function).
	//// Example 2: use performance.now(), but with the speed factor depending on e.clientY.
	//// The information inside the TimeMarker could also be used in such a function, so that, for example,
	//// the conductor's space/time relation could depend on the currentRegionIndex.
	//// Functions that change the performance of repeated regions (CC values etc.) could also be implemented
	//// using the TimeMarker's attributes.
	//conduct(e)
	//{
	//	if(this._prevX < 0)
	//	{
	//		this._prevX = e.clientX;
	//		this._prevY = e.clientY;
	//		this._startPlaying(false);
	//	}
	//	else
	//	{
	//		let dx = this._prevX - e.clientX,
	//			dy = this._prevY - e.clientY;

	//		this._prevX = e.clientX;
	//		this._prevY = e.clientY;

	//		console.log("e.clientX=" + e.clientX);

	//		let pixelDistance = Math.sqrt((dx * dx) + (dy * dy)),
	//			msDurationInScore = (pixelDistance / this._timeMarker.msPosData.pixelsPerMs) * this._speed;

	//		this._msPositionInPerformance += msDurationInScore;
	//		this._timeMarker.advance(msDurationInScore);
	//	}
	//}

	/* mousemove handler #2 */
	conduct(e)
	{
		function doConducting(that, e)
		{
			// See: http://stackoverflow.com/questions/846221/logarithmic-slider and Controls.js speedSliderValue().
			// the returned factor is the value returned by a logarithmic slider having the width of the screen (e.target.clientWidth)
			// maxVal = 10 when e.clientX = e.target.clientWidth
			// midVal = 1 when e.clientX = e.target.clientWidth / 2 -- My screen has width 1920px, so the middle value (1) is at 960px.
			// minVal = 0.1 when e.clientX = e.target.clientLeft
			function getXFactor(e)
			{
				let	minp = e.target.clientLeft,
					maxp = e.target.clientWidth, // The width of the screen in pixels
					// The result will be between 0.1 and 10, the middle value is 1.
					minv = Math.log(0.1), maxv = Math.log(10),
					// the adjustment factor
					scale = (maxv - minv) / (maxp - minp);

				return Math.exp(minv + scale * (e.clientX - minp));
			}

			let xFactor = getXFactor(e),
				speedFactor = xFactor * that._speed,
				now = performance.now(), 
				timeInterval = now - that._prevPerfNow,
				msDuration = timeInterval * speedFactor;

			that._msPositionInPerformance += msDuration; // _msPositionInPerformance includes durations of repeated regions.
			that._timeMarker.advance(msDuration); // timeMarker positions are relative to msPositionInScore.
			that._prevPerfNow = now;
		}

		if(this._msPositionInPerformance === 0)
		{
			this._startPlaying(false);
			this._prevX = e.clientX;
			this._prevPerfNow = performance.now();

			this._setIntervalHandle = setInterval(doConducting, this._intervalRate, this, e);
		}
		else if(this._prevX !== e.clientX)
		{
			if(this._setIntervalHandle !== undefined)
			{
				clearInterval(this._setIntervalHandle);
			}

			this._setIntervalHandle = setInterval(doConducting, this._intervalRate, this, e);

			this._prevX = e.clientX;
		}
	}

	now()
	{
		return this._msPositionInPerformance;
	}

	stop()
	{
		if(this._setIntervalHandle !== undefined)
		{
			clearInterval(this._setIntervalHandle);
			this._setIntervalHandle = undefined;
		}
	}
}


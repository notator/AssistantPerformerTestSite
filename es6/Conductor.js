import { TimeMarker } from "./TimeMarker.js";

let
	// See: http://stackoverflow.com/questions/846221/logarithmic-slider and Controls.js speedSliderValue().
	// the returned factor is the value returned by a logarithmic slider having the width of the screen (e.target.clientWidth)
	// maxVal = 10 when e.clientX = e.target.clientWidth
	// midVal = 1 when e.clientX = e.target.clientWidth / 2 -- My screen has width 1920px, so the middle value (1) is at 960px.
	// minVal = 0.1 when e.clientX = e.target.clientLeft
	_getXFactor = function(e)
	{
		let minp = e.target.clientLeft,
			maxp = e.target.clientWidth, // The width of the screen in pixels
			// The result will be between 0.1 and 10, the middle value is 1.
			minv = Math.log(0.1), maxv = Math.log(10),
			// the adjustment factor
			scale = (maxv - minv) / (maxp - minp);

		return Math.exp(minv + scale * (e.clientX - minp));
	};

export class Conductor
{
	constructor(score, startPlayingCallback, speed)
	{
		// The rate at which setInterval calls doConducting(...)
		Object.defineProperty(this, "_INTERVAL_RATE", { value: 10, writable: false });
		// The _speed is the value of the speed control when this constructor is called.
		Object.defineProperty(this, "_speed", { value: speed, writable: false });
		Object.defineProperty(this, "_conductingLayer", { value: document.getElementById("conductingLayer"), writable: false });
		Object.defineProperty(this, "_startPlaying", { value: startPlayingCallback, writable: false });

		// variables that can change while performing
		Object.defineProperty(this, "_prevX", { value: -1, writable: true });
		// Continuously increasing value wrt start of performance (and recording). Returned by now().
		Object.defineProperty(this, "_msPositionInPerformance", { value: 0, writable: true });
		Object.defineProperty(this, "_prevPerfNow", { value: 0, writable: true });
	}

	initConducting()
	{
		this._prevX = -1;
	}

	addTimeMarkerToMarkersLayer(markersLayer)
	{
		markersLayer.appendChild(this._timeMarker.getElement());
	}

	removeTimeMarkerFromMarkersLayer(markersLayer)
	{
		markersLayer.removeChild(this._timeMarker.getElement());
	}

	getPixelsPerMs()
	{
		return this._timeMarker.getPixelsPerMs();
	}

	now()
	{
		return this._msPositionInPerformance;
	}
}

export class TimerConductor extends Conductor
{
	constructor(score, startPlayingCallback, speed)
	{
		super(score, startPlayingCallback, speed);

		let timeMarker = new TimeMarker(score, true);

		Object.defineProperty(this, "_timeMarker", { value: timeMarker, writable: false });
		Object.defineProperty(this, "_setIntervalHandles", { value: [], writable: false });
	}

	// This mousemove handler uses e.clientX values to control the rate at which conductor.now() changes
	// with respect to performance.now(), also taking the value of the global speed control into account.
	// When the cursor is in the centreX of the screen, conductor.now() speed is speedControlValue times performance.now() speed.
	// When the cursor is on the left of the screen, conductor.now() speed (= TimeMarker speed) is slower.
	// When the cursor is on the left of the screen, conductor.now() speed (= TimeMarker speed) is faster.
	conductTimer(e)
	{
		function doConducting(that, e)
		{
			let xFactor = _getXFactor(e),
				speedFactor = xFactor * that._speed,
				now = performance.now(),
				timeInterval = now - that._prevPerfNow,
				msDuration = timeInterval * speedFactor;

			that._msPositionInPerformance += msDuration; // _msPositionInPerformance includes durations of repeated regions.
			that._timeMarker.advance(msDuration); // timeMarker positions are relative to msPositionInScore.
			that._prevPerfNow = now;
		}

		if(this._prevX < 0)
		{
			this._startPlaying(false);
			this._prevX = e.clientX;
			this._prevPerfNow = performance.now();

			let handle = setInterval(doConducting, this._INTERVAL_RATE, this, e);
			this._setIntervalHandles.push(handle);
		}
		else if(this._prevX !== e.clientX)
		{
			this.stopTimer();

			let handle = setInterval(doConducting, this._INTERVAL_RATE, this, e);
			this._setIntervalHandles.push(handle);

			this._prevX = e.clientX;
		}
	}

	stopTimer()
	{
		for(let handle of this._setIntervalHandles)
		{
			clearInterval(handle);
		}
		this._setIntervalHandles.length = 0;
	}
}

export class CreepConductor extends Conductor
{
	constructor(score, startPlayingCallback, speed)
	{
		super(score, startPlayingCallback, speed);

		let timeMarker = new TimeMarker(score, false);

		Object.defineProperty(this, "_timeMarker", { value: timeMarker, writable: false });
	}

	// This mousemove handler sets performance time proportional to the distance travelled by the conductor's cursor,
	// also taking the value of the global speed control into account.
	// Note that _any_ function could be used to describe the relation between the mouse and conductor.now().
	// See conductTimer() below.
	// The information inside the TimeMarker could also be used in such a function, so that, for example,
	// the conductor's space/time relation could depend on the currentRegionIndex. It would, however, be better not to
	// make the conductor's job too complicated, but instead write such changing relations into the score itself somehow.
	conductCreep(e)
	{
		let xFactor = _getXFactor(e),
			dx = e.movementX,
			dy = e.movementY;

		if(this._prevX < 0)
		{
			this._startPlaying(false);
			this._prevX = e.clientX;
		}

		let pixelDistance = Math.sqrt((dx * dx) + (dy * dy)),
			msDurationInScore = xFactor * (pixelDistance / this.getPixelsPerMs()) * this._speed;

		this._msPositionInPerformance += msDurationInScore;
		this._timeMarker.advance(msDurationInScore);
	}
}


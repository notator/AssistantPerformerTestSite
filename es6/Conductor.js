import { TimeMarker } from "./TimeMarker.js";

export class Conductor
{
	constructor(score, startPlayingCallback, speed)
	{
		// See: http://stackoverflow.com/questions/846221/logarithmic-slider and Controls.js speedSliderValue().
		// the returned factor is the value returned by a logarithmic slider having the width of the screen (e.target.clientWidth)
		// maxVal = 10 when e.clientX = e.target.clientWidth
		// midVal = 1 when e.clientX = e.target.clientWidth / 2 -- My screen has width 1920px, so the middle value (1) is at 960px.
		// minVal = 0.1 when e.clientX = e.target.clientLeft
		function getXFactor(e)
		{
			let minp = e.target.clientLeft,
				maxp = e.target.clientWidth, // The width of the screen in pixels
				// The result will be between 0.1 and 10, the middle value is 1.
				minv = Math.log(0.1), maxv = Math.log(10),
				// the adjustment factor
				scale = (maxv - minv) / (maxp - minp);

			return Math.exp(minv + scale * (e.clientX - minp));
		}

		let startMarker = score.getStartMarker(),
			cursor = score.getCursor(),
			regionSequence = score.getRegionSequence(),
			startRegionIndex = score.getStartRegionIndex(),
			endRegionIndex = score.getEndRegionIndex(),
			timeMarker = new TimeMarker(cursor, startMarker, regionSequence, startRegionIndex, endRegionIndex);

		// The rate at which setInterval calls doConducting(...)
		Object.defineProperty(this, "_INTERVAL_RATE", { value: 10, writable: false });
		Object.defineProperty(this, "_getXFactor", { value: getXFactor, writable: false });
		// The _speed is the value of the speed control when this constructor is called.
		Object.defineProperty(this, "_speed", { value: speed, writable: false });
		Object.defineProperty(this, "_conductingLayer", { value: document.getElementById("conductingLayer"), writable: false });
		Object.defineProperty(this, "_setIntervalHandles", { value: [], writable: false });
		Object.defineProperty(this, "_startPlaying", { value: startPlayingCallback, writable: false });
		Object.defineProperty(this, "_timeMarker", { value: timeMarker, writable: false });

		// variables that can change while performing
		Object.defineProperty(this, "_prevX", { value: -1, writable: true });
		// Continuously increasing value wrt start of performance (and recording). Returned by now().
		Object.defineProperty(this, "_msPositionInPerformance", { value: 0, writable: true });
		Object.defineProperty(this, "_prevPerfNow", { value: 0, writable: true });
		Object.defineProperty(this, "_isCreeping", { value: false, writable: true });
	}

	switchToConductTimer(e)
	{
		this._isCreeping = false;
		this._timeMarker.switchToConductTimer();
		this._prevX = -1;
		this.conductTimer(e, true);
	}

	switchToConductCreep(e)
	{
		this._isCreeping = true;
		this._timeMarker.switchToConductCreep();
		this.conductCreep(e);
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

	// This mousemove handler sets performance time proportional to the distance travelled by the conductor's cursor,
	// also taking the value of the global speed control into account.
	// Note that _any_ function could be used to describe the relation between the mouse and conductor.now().
	// See conductTimer() below.
	// The information inside the TimeMarker could also be used in such a function, so that, for example,
	// the conductor's space/time relation could depend on the currentRegionIndex. It would, however, be better not to
	// make the conductor's job too complicated, but instead write such changing relations into the score itself somehow.
	conductCreep(e)
	{
		let xFactor = this._getXFactor(e),
			dx = e.movementX,
			dy = e.movementY;

		let pixelDistance = Math.sqrt((dx * dx) + (dy * dy)),
			msDurationInScore = xFactor * (pixelDistance / this.getPixelsPerMs()) * this._speed;

		this._msPositionInPerformance += msDurationInScore;
		this._timeMarker.advance(msDurationInScore);
	}

	// This mousemove handler uses e.clientX values to control the rate at which conductor.now() changes
	// with respect to performance.now(), also taking the value of the global speed control into account.
	// When the cursor is in the centreX of the screen, conductor.now() speed is speedControlValue times performance.now() speed.
	// When the cursor is on the left of the screen, conductor.now() speed (= TimeMarker speed) is slower.
	// When the cursor is on the left of the screen, conductor.now() speed (= TimeMarker speed) is faster.
	conductTimer(e, restartTimer)
	{
		function doConducting(that, e)
		{
			if(that._isCreeping)
			{
				that.stop();
			}
			else
			{
				let xFactor = that._getXFactor(e),
					speedFactor = xFactor * that._speed,
					now = performance.now(),
					timeInterval = now - that._prevPerfNow,
					msDuration = timeInterval * speedFactor;

				that._msPositionInPerformance += msDuration; // _msPositionInPerformance includes durations of repeated regions.
				that._timeMarker.advance(msDuration); // timeMarker positions are relative to msPositionInScore.
				that._prevPerfNow = now;
			}
		}

		if(this._prevX < 0 && restartTimer === undefined)
		{
			this._startPlaying(false);
		}

		if(this._prevX < 0)
		{
			this._prevX = e.clientX;
			this._prevPerfNow = performance.now();

			let handle = setInterval(doConducting, this._INTERVAL_RATE, this, e);
			this._setIntervalHandles.push(handle);
		}
		else if(this._prevX !== e.clientX)
		{
			this.stop();

			let handle = setInterval(doConducting, this._INTERVAL_RATE, this, e); 
			this._setIntervalHandles.push(handle);

			this._prevX = e.clientX;
		}
	}

	now()
	{
		return this._msPositionInPerformance;
	}

	stop()
	{
		for(let handle of this._setIntervalHandles)
		{
			clearInterval(handle);
		}
		this._setIntervalHandles.length = 0;
	}
}


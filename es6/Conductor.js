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
		Object.defineProperty(this, "_prevPerfNow", { value: 0, writable: true });
		// The _speed is the value of the speed control when the set conducting button is clicked.
		Object.defineProperty(this, "_speed", { value: -1, writable: true });
		Object.defineProperty(this, "_isCreeping", { value: false, writable: true });
		Object.defineProperty(this, "_setIntervalHandle", { value: undefined, writable: true });
	}

	init(startMarker, startPlayingCallback, startRegionIndex, endRegionIndex, speed)
	{
		this._startPlaying = startPlayingCallback;
		this._timeMarker.init(startMarker, startRegionIndex, endRegionIndex);
		this._prevX = -1;
		//this._prevY = -1;
		this._msPositionInPerformance = 0;
		this._prevPerfNow = 0;
		this._speed = speed;
		this._isCreeping = false;
		this.stopTimer(); //_setIntervalHandle = undefined;
	}

	startConductTimer()
	{
		let conductingLayer = document.getElementById("conductingLayer"),
			dummyEvent = { clientX: this._prevX, clientY: this._prevY, target: conductingLayer, jiDummy: true };

		this._isCreeping = false;
		this.conductTimer(dummyEvent);
	}

	startConductCreep()
	{
		let conductingLayer = document.getElementById("conductingLayer"),
			dummyEvent = { clientX: this._prevX, clientY: this._prevY, target: conductingLayer, jiDummy: true };

		this._isCreeping = true;
		this.conductCreep(dummyEvent);
	}

	timeMarkerElement()
	{
		return this._timeMarker.element;
	}

	// This mousemove handler sets performance time proportional to the distance travelled by the conductor's cursor,
	// also taking the value of the global speed control into account.
	// However, note that _any_ function could be used to describe the relation between the mouse and conductor.now().
	// See conductTimer() below.
	// The information inside the TimeMarker could also be used in such a function, so that, for example,
	// the conductor's space/time relation could depend on the currentRegionIndex. It would, however, be better not to
	// make the conductor's job too complicated, but instead write such changing relations into the score itself somehow.
	conductCreep(e)
	{
		if(this._prevX < 0 || e.jiDummy !== undefined)
		{
			this._startPlaying(false);
			this._prevX = e.clientX;
			this._prevY = e.clientY;
		}
		else
		{
			let dx = this._prevX - e.clientX,
				dy = this._prevY - e.clientY;

			this._prevX = e.clientX;
			this._prevY = e.clientY;

			let pixelDistance = Math.sqrt((dx * dx) + (dy * dy)),
				msDurationInScore = (pixelDistance / this._timeMarker.msPosData.pixelsPerMs) * this._speed;

			this._msPositionInPerformance += msDurationInScore;
			this._timeMarker.advance(msDurationInScore);
		}
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

			if(that._isCreeping)
			{
				that.stopTimer();
			}
			else
			{
				let xFactor = getXFactor(e),
					speedFactor = xFactor * that._speed,
					now = performance.now(),
					timeInterval = now - that._prevPerfNow,
					msDuration = timeInterval * speedFactor;

				that._msPositionInPerformance += msDuration; // _msPositionInPerformance includes durations of repeated regions.
				that._timeMarker.advance(msDuration); // timeMarker positions are relative to msPositionInScore.
				that._prevPerfNow = now;
			}
		}

		if(this._prevX < 0 || e.jiDummy !== undefined)
		{
			this._startPlaying(false);
			this._prevX = e.clientX;
			this._prevY = e.clientY;  // maintain state for conductCreep() event handler.
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
			this._prevY = e.clientY;  // maintain state for conductCreep() event handler.
		}

	}

	now()
	{
		return this._msPositionInPerformance;
	}

	stopTimer()
	{
		if(this._setIntervalHandle !== undefined)
		{
			clearInterval(this._setIntervalHandle);
			this._setIntervalHandle = undefined;
		}
	}

	reportTickOverload(nAsynchMomentsSentAtOnce)
	{
		this._timeMarker.reportTickOverload(nAsynchMomentsSentAtOnce);
	}
}


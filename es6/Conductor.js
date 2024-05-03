import { constants } from "./Constants.js";
import { TimeMarker } from "./TimeMarker.js";
import { Message } from "./Message.js";

let
	_outputDevice,

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
	},

	// The returned object is either an empty object or a Message (having a .data attribute but no timestamp).
	// This handler only returns message types having 2 or 3 data bytes. It throws an exception if the argument
	// is illegal for some reason, but simply ignores both realTime and SysEx messages.
	_getInputMessage = function(uint8Array)
	{
		var	inputMessage = {};

		if(uint8Array instanceof Uint8Array && uint8Array.length <= 3)
		{
			if(uint8Array.length === 2)
			{
				inputMessage = new Message(uint8Array[0], uint8Array[1], 0);
			}
			else if(uint8Array.length === 3)
			{
				inputMessage = new Message(uint8Array[0], uint8Array[1], uint8Array[2]);
			}
		}
		else
		{
			throw "Error: illegal argument.";
		}

		return inputMessage;
	},

	// This handler sends COMMAND messages defined in the score to the _outputDevice.
	// The timestamp is the msPositionInScore of the message definition in the score.
    // (The msPositionInScore is calculated from the msDuration attributes of the Moments.)
	//
	// May 2024 note about SYSEX, CHANNEL_PRESSURE and AFTERTOUCH messages:
	// Neither the AssistantPerformer nor the ResidentSynth currently support these messages,
	// and they are not used in any of the current SVG-MIDI scores. If any of them are sent
	// to the ResidentSynth, it will throw an exception and print a diagnostic message to the console.
	_handleConductedEvent = function(uint8Array, timestamp)
	{
		let inputMessage = _getInputMessage(uint8Array);

		if(inputMessage.data !== undefined)
		{
			let command = inputMessage.command(),
				CMD = constants.COMMAND;

			switch(command)
			{
				case CMD.NOTE_OFF:
				case CMD.NOTE_ON:
				case CMD.AFTERTOUCH:
				case CMD.CONTROL_CHANGE:
				case CMD.PROGRAM_CHANGE:
				case CMD.CHANNEL_PRESSURE:				
				case CMD.PITCH_WHEEL:			
					_outputDevice.send(uint8Array, timestamp);
					break;
				default:
					console.warn("Unknown MIDI command in score.");
					break;
			}
		}
	};

export class Conductor
{
	constructor(startPlayingCallback, midiOutputDevice, globalSpeed)
	{
		_outputDevice = midiOutputDevice;

		// The rate at which setInterval calls doConducting(...).
		// After looking around the web, I think the setInterval clock is only accurate above about 5ms.
		// (See also Chris Wilson's October 2012 comment in Sequence.js.)
		// Since I'm not relying on complete accuracy here, I've set _INTERVAL_RATE to 3.
		// This means that setInterval should run faster than Sequence.PREQUEUE (which I've set to 6).
		Object.defineProperty(this, "_INTERVAL_RATE", { value: 3, writable: false });
		// The _globalSpeed is the value of the speed control when this constructor is called.
		Object.defineProperty(this, "_globalSpeed", { value: globalSpeed, writable: false });
		Object.defineProperty(this, "_conductingLayer", { value: document.getElementById("conductingLayer"), writable: false });
		Object.defineProperty(this, "_setIntervalHandles", { value: [], writable: false });
		Object.defineProperty(this, "_startPlaying", { value: startPlayingCallback, writable: false });

		// variables that can change while performing
		Object.defineProperty(this, "_prevX", { value: -1, writable: true });
		// Continuously increasing value wrt start of performance (and recording). Returned by now().
		Object.defineProperty(this, "_smoothMsPositionInScore", { value: 0, writable: true });
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

	timeMarkerElement()
	{
		return this._timeMarker.getElement();
	}

	getPixelsPerMs()
	{
		return this._timeMarker.getPixelsPerMs();
	}

	now()
	{
		return this._smoothMsPositionInScore;
	}

	// called by Sequence. Is MIDI Thru...
	send(msg, timestamp)
	{
		_handleConductedEvent(msg, timestamp);
	}

	stopConducting()
	{
		for(let handle of this._setIntervalHandles)
		{
			clearInterval(handle);
		}
		this._setIntervalHandles.length = 0;
	}
}

export class TimerConductor extends Conductor
{
	constructor(score, startPlayingCallback, midiOutputDevice, globalSpeed)
	{
		super(startPlayingCallback, midiOutputDevice, globalSpeed);

		let timeMarker = new TimeMarker(score, true);

		Object.defineProperty(this, "_timeMarker", { value: timeMarker, writable: false });
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
				speedFactor = xFactor * that._globalSpeed,
				now = performance.now(),
				timeInterval = now - that._prevPerfNow,
				smoothMsDurationInScore = timeInterval * speedFactor;

			that._smoothMsPositionInScore += smoothMsDurationInScore; // _smoothMsPositionInScore includes durations of repeated regions.
			that._timeMarker.advance(smoothMsDurationInScore);
			that._prevPerfNow = now;
		}

		function stopTimer(that)
		{
			for(let handle of that._setIntervalHandles)
			{
				clearInterval(handle);
			}
			that._setIntervalHandles.length = 0;
		}

		if(this._prevX < 0)
		{
			this._startPlaying();
			this._prevX = e.clientX;
			this._prevPerfNow = performance.now();

			let handle = setInterval(doConducting, this._INTERVAL_RATE, this, e);
			this._setIntervalHandles.push(handle);
		}
		else if(this._prevX !== e.clientX)
		{
			stopTimer(this);

			let handle = setInterval(doConducting, this._INTERVAL_RATE, this, e);
			this._setIntervalHandles.push(handle);

			this._prevX = e.clientX;
		}
	}
}

export class CreepConductor extends Conductor
{
	constructor(score, startPlayingCallback, midiOutputDevice, globalSpeed)
	{
		super(startPlayingCallback, midiOutputDevice, globalSpeed);

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
			this._startPlaying();
			this._prevX = e.clientX;
		}

		let pixelDistance = Math.sqrt((dx * dx) + (dy * dy)),
			smoothMsDurationInScore = xFactor * (pixelDistance / this.getPixelsPerMs()) * this._globalSpeed;

		this._smoothMsPositionInScore += smoothMsDurationInScore;
		this._timeMarker.advance(smoothMsDurationInScore);
	}
}


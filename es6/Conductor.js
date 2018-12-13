﻿import { constants } from "./Constants.js";
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
			// If uint8Array.length === 0, an exception is thrown on the next line. This should never happen.
			if(uint8Array[0] === constants.SYSTEM_EXCLUSIVE.START)
			{
				if(!(uint8Array.length > 2 && uint8Array[uint8Array.length - 1] === constants.SYSTEM_EXCLUSIVE.END))
				{
					throw "Error in System Exclusive inputEvent.";
				}
				// SysExMessages are ignored by the assistant, so do nothing here and return an empty object.
				// Note that SysExMessages may contain realTime messages at this point (they
				// would have to be removed somehow before creating a sysEx event), but since
				// we are ignoring both realTime and sysEx, nothing needs doing here.
			}
			else if((uint8Array[0] & 0xF0) === 0xF0)
			{
				if(!(constants.isRealTimeStatus.isRealTimeStatus(uint8Array[0])))
				{
					throw "Error: illegal data.";
				}
				// RealTime messages are ignored by the assistant, so do nothing here and return an empty object.
			}
			else if(uint8Array.length === 2)
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

	// This handler changes the state of various performance filters...
	_handleMIDIInputDeviceEvent = function(midiEvent)
	{
		// This function is called either by a real performed NoteOff or by a performed NoteOn having zero velocity.
		function handleNoteOff(key)
		{

		}

		// performedVelocity is always greater than 0 (otherwise handleNoteOff() is called)
		function handleNoteOn(key, performedVelocity)
		{

		}

		// Currently used by handleChannelPressure(...) and handleModWheel(...).
		// React to controller input here.
		// Possibly simply replace this switch by separate functions.
		function doController(control, value)
		{
			switch(control)
			{
				case 'aftertouch':
					break;
				case 'channelPressure':
					break;
				case 'modWheel':
					break;
				case 'volume':
					break;
				case 'expression':
					break;
				case 'timbre':
					break;
				case 'brightness':
					break;
				case 'effects':
					break;
				case 'tremolo':
					break;
				case 'chorus':
					break;
				case 'celeste':
					break;
				case 'phaser':
					break;
			}
		}

		// called when channel pressure changes
		// Achtung: value is data[1]
		function handleChannelPressure(data)
		{
			doController("channelPressure", data[1]); // Achtung: value is data[1]
		}

		// called when modulation wheel changes
		// Achtung: value is data[2]
		function handleModWheel(data)
		{
			doController("modWheel", data[2]); // Achtung: value is data[2]
		}

		// called when the pitchWheel changes
		function handlePitchWheel(data)
		{
			function doOption(option)
			{
				switch(option)
				{
					case "pitch":
						break;
					case "pan":
						break;
					case "speed":
						break;
				}
			}

			doOption("pitch");
		}

		let inputMessage = _getInputMessage(midiEvent.data);

		if(inputMessage.data !== undefined)
		{
			let command = inputMessage.command(),
				CMD = constants.COMMAND;

			switch(command)
			{
				case CMD.NOTE_ON:
					if(inputMessage.data[2] !== 0)
					{
						handleNoteOn(inputMessage.data[1], inputMessage.data[2]);
					}
					else
					{
						handleNoteOff(inputMessage.data[1]);
					}
					break;
				case CMD.NOTE_OFF:
					handleNoteOff(inputMessage.data[1]);
					break;
				case CMD.CHANNEL_PRESSURE: // produced by both R2M and E-MU XBoard49 when using "aftertouch"
					// CHANNEL_PRESSURE.data[1] is the amount of pressure 0..127.
					handleChannelPressure(inputMessage.data);
					break;
				case CMD.AFTERTOUCH: // produced by the EWI breath controller
					// AFTERTOUCH.data[1] is the MIDIpitch to which to apply the aftertouch
					// AFTERTOUCH.data[2] is the amount of pressure 0..127.
					// not supported
					break;
				case CMD.PITCH_WHEEL: // EWI pitch bend up/down controllers, EMU pitch wheel
					handlePitchWheel(inputMessage.data);
					break;
				case CMD.CONTROL_CHANGE: // received when the EMU ModWheel changes.
					handleModWheel(inputMessage.data);
					break;
				default:
					break;
			}
		}
	},

	// This handler sends possibly altered messages to the _outputDevice.
	// The received messages may be
	// a) simply sent on without change,
	// b) altered before being sent on,
	// c) suppressed completely (i.e. not sent on),
	// d) sent on (modified or not) together with new midi messages.    
	_handleMIDIScoreEvent = function(uint8Array, timestamp)
	{
		let inputMessage = _getInputMessage(uint8Array);

		if(inputMessage.data !== undefined)
		{
			let command = inputMessage.command(),
				CMD = constants.COMMAND;

			switch(command)
			{
				case CMD.NOTE_ON:
					_outputDevice.send(uint8Array, timestamp);
					break;
				case CMD.NOTE_OFF:
					_outputDevice.send(uint8Array, timestamp);
					break;
				case CMD.CHANNEL_PRESSURE: // produced by both R2M and E-MU XBoard49 when using "aftertouch"
					// CHANNEL_PRESSURE.data[1] is the amount of pressure 0..127.
					_outputDevice.send(uint8Array, timestamp);
					break;
				case CMD.AFTERTOUCH: // produced by the EWI breath controller
					_outputDevice.send(uint8Array, timestamp);
					break;
				case CMD.PITCH_WHEEL: // EWI pitch bend up/down controllers, EMU pitch wheel
					_outputDevice.send(uint8Array, timestamp);
					// handlePitchWheel(inputEvent.data, timestamp);
					break;
				case CMD.CONTROL_CHANGE: // sent when the EMU ModWheel changes.
					_outputDevice.send(uint8Array, timestamp);
					// handleModWheel(inputEvent.data, timestamp);
					break;
				default:
					break;
			}
		}
	};

export class Conductor
{
	constructor(score, startPlayingCallback, midiInputDevice, midiOutputDevice, speed)
	{
		if(midiInputDevice === null || midiInputDevice === undefined)
		{
			alert(
`No input device has been selected in the Input Device Selector.
(The conductor can be used anyway.)`);
		}

		_outputDevice = midiOutputDevice;

		// The rate at which setInterval calls doConducting(...)
		Object.defineProperty(this, "_INTERVAL_RATE", { value: 10, writable: false });
		// The _speed is the value of the speed control when this constructor is called.
		Object.defineProperty(this, "_speed", { value: speed, writable: false });
		Object.defineProperty(this, "_conductingLayer", { value: document.getElementById("conductingLayer"), writable: false });
		Object.defineProperty(this, "_setIntervalHandles", { value: [], writable: false });
		Object.defineProperty(this, "_startPlaying", { value: startPlayingCallback, writable: false });
		Object.defineProperty(this, "_midiInputDevice", { value: midiInputDevice, writable: false });

		// variables that can change while performing
		Object.defineProperty(this, "_prevX", { value: -1, writable: true });
		// Continuously increasing value wrt start of performance (and recording). Returned by now().
		Object.defineProperty(this, "_msPositionInPerformance", { value: 0, writable: true });
		Object.defineProperty(this, "_prevPerfNow", { value: 0, writable: true });
	}

	initConducting()
	{
		this._prevX = -1;
		if(this._midiInputDevice !== null && this._midiInputDevice !== undefined)
		{
			this._midiInputDevice.addEventListener("midimessage", _handleMIDIInputDeviceEvent, false);
		}
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
		return this._msPositionInPerformance;
	}

	// called by Sequence. Is MIDI Thru...
	send(msg, timestamp)
	{
		_handleMIDIScoreEvent(msg, timestamp);
	}

	stopConducting()
	{
		for(let handle of this._setIntervalHandles)
		{
			clearInterval(handle);
		}
		this._setIntervalHandles.length = 0;

		if(this._midiInputDevice !== null && this._midiInputDevice !== undefined)
		{
			this._midiInputDevice.removeEventListener("midimessage", _handleMIDIInputDeviceEvent, false);
		}
	}
}

export class TimerConductor extends Conductor
{
	constructor(score, startPlayingCallback, midiInputDevice, midiOutputDevice, speed)
	{
		super(score, startPlayingCallback, midiInputDevice, midiOutputDevice, speed);

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
				speedFactor = xFactor * that._speed,
				now = performance.now(),
				timeInterval = now - that._prevPerfNow,
				msDuration = timeInterval * speedFactor;

			that._msPositionInPerformance += msDuration; // _msPositionInPerformance includes durations of repeated regions.
			that._timeMarker.advance(msDuration); // timeMarker positions are relative to msPositionInScore.
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
	constructor(score, startPlayingCallback, midiInputDevice, midiOutputDevice, speed)
	{
		super(score, startPlayingCallback, midiInputDevice, midiOutputDevice, speed);

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
			msDurationInScore = xFactor * (pixelDistance / this.getPixelsPerMs()) * this._speed;

		this._msPositionInPerformance += msDurationInScore;
		this._timeMarker.advance(msDurationInScore);
	}
}


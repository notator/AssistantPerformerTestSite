import { constants } from "./Constants.js";
import { TimeMarker } from "./TimeMarker.js";
import { Message } from "./Message.js";

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
	},

	// This handler
	// a) ignores both RealTime and SysEx messages in its input, and
	// b) assumes that RealTime messages will not interrupt the messages being received.    
	_handleMIDIInputEvent = function(msg)
	{
		var inputEvent, command,
			CMD = constants.COMMAND;

		// The returned object is either empty, or has .data and .receivedTime attributes,
		// and so constitutes a timestamped Message. (Web MIDI API simply calls this an Event)
		// This handler only returns message types having 2 or 3 data bytes. It ignores both
		// realTime and SysEx messages since these are not used by the AssistantPerformer.
		// If the input data is undefined, an empty object is returned, otherwise data must
		// be an array of numbers in range 0..0xF0. An exception is thrown if the data is illegal.
		function getInputEvent(data, now)
		{
			var
				SYSTEM_EXCLUSIVE = constants.SYSTEM_EXCLUSIVE,
				isRealTimeStatus = constants.isRealTimeStatus,
				inputEvent = {};

			if(data !== undefined)
			{
				if(data[0] === SYSTEM_EXCLUSIVE.START)
				{
					if(!(data.length > 2 && data[data.length - 1] === SYSTEM_EXCLUSIVE.END))
					{
						throw "Error in System Exclusive inputEvent.";
					}
					// SysExMessages are ignored by the assistant, so do nothing here.
					// Note that SysExMessages may contain realTime messages at this point (they
					// would have to be removed somehow before creating a sysEx event), but since
					// we are ignoring both realTime and sysEx, nothing needs doing here.
				}
				else if((data[0] & 0xF0) === 0xF0)
				{
					if(!(isRealTimeStatus(data[0])))
					{
						throw "Error: illegal data.";
					}
					// RealTime messages are ignored by the assistant, so do nothing here.
				}
				else if(data.length === 2)
				{
					inputEvent = new Message(data[0], data[1], 0);
				}
				else if(data.length === 3)
				{
					inputEvent = new Message(data[0], data[1], data[2]);
				}

				// other data is simply ignored

				if(inputEvent.data !== undefined)
				{
					inputEvent.receivedTime = now;
				}
			}

			return inputEvent;
		}

		// This function is called either by a real performed NoteOff or by a performed NoteOn having zero velocity.
		function handleNoteOff(key)
		{
			//var keyIndex = key - keyRange.bottomKey, thisKeyInstantIndices, keyOffIndices,
			//	instant, instantIndex, tempInstantIndex;

			//if(key >= keyRange.bottomKey && key <= keyRange.topKey)
			//{
			//	thisKeyInstantIndices = keyInstantIndices[keyIndex];
			//	if(thisKeyInstantIndices)
			//	{
			//		keyOffIndices = thisKeyInstantIndices.keyOffIndices;
			//		if(keyOffIndices.length > thisKeyInstantIndices.index)
			//		{
			//			// thisKeyInstantIndices.index is incremented by advanceKeyInstantIndicesTo(keyInstantIndices, currentInstantIndex)
			//			instantIndex = keyOffIndices[thisKeyInstantIndices.index];
			//			if(instantIndex === currentInstantIndex || ((instantIndex === currentInstantIndex + 1) && indexPlayed === currentInstantIndex))
			//			{
			//				// This is the usual case
			//				instant = instants[instantIndex];
			//				playKeyNoteOnOrOff(instant.noteOffs, key, 0); // the key's noteOff is removed after being played

			//				currentInstantIndex = instantIndex;
			//				indexPlayed = instantIndex;

			//				if(instant.noteOns === undefined)
			//				{
			//					currentInstantIndex++;
			//					if(currentInstantIndex < instants.length)
			//					{
			//						report(instants[currentInstantIndex].msPosition);
			//					}
			//				}
			//				advanceKeyInstantIndicesTo(keyInstantIndices, currentInstantIndex); // see above
			//			}
			//			else if(instantIndex > currentInstantIndex)
			//			{
			//				// The key has been released too early.
			//				// Advance silently to instantIndex.
			//				// Controller options are shunted. Seqs are stopped but not started. 
			//				tempInstantIndex = currentInstantIndex;
			//				while(tempInstantIndex < instantIndex)
			//				{
			//					instant = instants[tempInstantIndex];
			//					report(instants[currentInstantIndex].msPosition);
			//					sendAllTrkOffsAtInstant(instant);
			//					currentInstantIndex = tempInstantIndex++;
			//				}
			//				indexPlayed = currentInstantIndex;
			//				advanceKeyInstantIndicesTo(keyInstantIndices, currentInstantIndex); // see above
			//				handleNoteOff(key);
			//			}
			//		}
			//	}
			//}
		}

		// performedVelocity is always greater than 0 (otherwise handleNoteOff() is called)
		function handleNoteOn(key, performedVelocity)
		{
			//var keyIndex = key - keyRange.bottomKey, thisKeyInstantIndices, keyOnIndices,
			//	instant, instantIndex;

			//if(key >= keyRange.bottomKey && key <= keyRange.topKey)
			//{
			//	thisKeyInstantIndices = keyInstantIndices[keyIndex];
			//	if(thisKeyInstantIndices)
			//	{
			//		keyOnIndices = thisKeyInstantIndices.keyOnIndices;
			//		if(keyOnIndices.length > thisKeyInstantIndices.index)
			//		{
			//			// thisKeyInstantIndices.index is incremented by advanceKeyInstantIndicesTo(keyInstantIndices, currentInstantIndex)
			//			instantIndex = keyOnIndices[thisKeyInstantIndices.index];
			//			if(instantIndex === currentInstantIndex || ((instantIndex === currentInstantIndex + 1) && indexPlayed === currentInstantIndex))
			//			{
			//				instant = instants[instantIndex];

			//				playKeyNoteOnOrOff(instant.noteOffs, key, 0); // the key's noteOff is removed after being played
			//				if(instant.ccSettings)
			//				{
			//					setContinuousControllerOptions(instant.ccSettings);
			//				}
			//				playKeyNoteOnOrOff(instant.noteOns, key, performedVelocity);  // the key's noteOn is removed after being played

			//				currentInstantIndex = instantIndex;
			//				indexPlayed = instantIndex;

			//				if(instant.noteOns.length === 0)
			//				{
			//					currentInstantIndex++;
			//					report(instants[currentInstantIndex].msPosition);
			//				}

			//				console.log("performedVelocity=" + performedVelocity.toString(10));
			//			}
			//		}
			//	}
			//}
		}

		// Used by handleChannelPressure(...) and handleModWheel(...).
		function doController(trackIndex, control, value)
		{
			var volumeValue, options, message,
				CMD = constants.COMMAND,
				CTL = constants.CONTROL;

			// argument is in range 0..127
			// returned value is in range currentTrk.options.minVolume.currentTrk.options.maxVolume.
			function getVolumeValue(value, minVolume, maxVolume)
			{
				var range = maxVolume - minVolume,
					factor = range / 127,
					volumeValue = minVolume + (value * factor);
				return volumeValue;
			}

			//options = (control === "modWheel") ? trackModWheelOptions[trackIndex] : trackPressureOptions[trackIndex];
			//console.assert(options.control !== 'disabled', "Error: option.control cannot be disabled here.");

			switch(options.control)
			{
				case 'aftertouch':	// Note that this option results in channelPressure messages!
					message = new Message(CMD.CHANNEL_PRESSURE + trackIndex, value);
					break;
				case 'channelPressure':
					message = new Message(CMD.CHANNEL_PRESSURE + trackIndex, value);
					break;
				case 'modulation':
					message = new Message(CMD.CONTROL_CHANGE + trackIndex, CTL.MODWHEEL, value);
					break;
				case 'volume':
					volumeValue = getVolumeValue(value, options.minVolume, options.maxVolume);
					message = new Message(CMD.CONTROL_CHANGE + trackIndex, CTL.VOLUME, volumeValue);
					break;
				case 'expression':
					message = new Message(CMD.CONTROL_CHANGE + trackIndex, CTL.EXPRESSION, value);
					break;
				case 'timbre':
					message = new Message(CMD.CONTROL_CHANGE + trackIndex, CTL.TIMBRE, value);
					break;
				case 'brightness':
					message = new Message(CMD.CONTROL_CHANGE + trackIndex, CTL.BRIGHTNESS, value);
					break;
				case 'effects':
					message = new Message(CMD.CONTROL_CHANGE + trackIndex, CTL.EFFECTS, value);
					break;
				case 'tremolo':
					message = new Message(CMD.CONTROL_CHANGE + trackIndex, CTL.TREMOLO, value);
					break;
				case 'chorus':
					message = new Message(CMD.CONTROL_CHANGE + trackIndex, CTL.CHORUS, value);
					break;
				case 'celeste':
					message = new Message(CMD.CONTROL_CHANGE + trackIndex, CTL.CELESTE, value);
					break;
				case 'phaser':
					message = new Message(CMD.CONTROL_CHANGE + trackIndex, CTL.PHASER, value);
					break;
			}

			if(message)
			{
				//sendMIDIMessage(message.data);
			}
		}

		// called when channel pressure changes
		// Achtung: value is data[1]
		function handleChannelPressure(data)
		{
			//var i, nTracks = trackWorkers.length;

			//for(i = 0; i < nTracks; ++i)
			//{
			//	if(trackWorkers[i] !== null && trackPressureOptions[i].control !== 'disabled')
			//	{
			//		doController(i, "pressure", data[1]); // Achtung: value is data[1]
			//	}
			//}
		}

		// called when modulation wheel changes
		// Achtung: value is data[2]
		function handleModWheel(data)
		{
			//var i, nTracks = trackWorkers.length;

			//for(i = 0; i < nTracks; ++i)
			//{
			//	if(trackWorkers[i] !== null && trackModWheelOptions[i].control !== 'disabled')
			//	{
			//		doController(i, "modWheel", data[2]); // Achtung: value is data[2]
			//	}
			//}
		}

		// called when the pitchWheel changes
		function handlePitchWheel(data)
		{
			//var i,
			//	nTracks = trackWorkers.length;

			function doPitchOption(trackIndex, data1, data2)
			{
				var msg = new Message(constants.COMMAND.PITCH_WHEEL + trackIndex, data1, data2);
				//sendMIDIMessage(msg.data);
			}

			function doPanOption(trackIndex, value, panOrigin)  // value is in range 0..127
			{
				var factor, newValue,
					CMD = constants.COMMAND,
					CTL = constants.CONTROL;

				if(value < 0x80)
				{
					factor = panOrigin / 0x80;
					newValue = value * factor;
				}
				else
				{
					factor = (0xFF - panOrigin) / 0x7F;
					newValue = panOrigin + ((value - 0x80) * factor);
				}

				msg = new Message(CMD.CONTROL_CHANGE + trackIndex, CTL.PAN, newValue);

				//sendMIDIMessage(msg.data);
			}

			function doSpeedOption(trackIndex, value, speedDeviation) // value is in range 0..127
			{
				var speedFactor, factor = Math.pow(speedDeviation, 1 / 64);

				// e.g. if speedDeviation is 2
				// factor = 2^(1/64) = 1.01088...
				// value is in range 0..127.
				// if original value is 0, speedFactor = 1.01088^(-64) = 0.5
				// if original value is 64, speedfactor = 1.01088^(0) = 1.0
				// if original value is 127, speedFactor = 1.01088^(64) = 2.0 = maxSpeedFactor

				value -= 64; // if value was 64, speedfactor is 1.
				speedFactor = Math.pow(factor, value);
				// nothing more to do! speedFactor is used in tick() to calculate delays.
				//trackWorkers[trackIndex].postMessage({ "action": "setRelativeSpeed", "speedFactor": speedFactor });
			}

			function doOption(trackIndex, pitchWheelOption)
			{
				switch(pitchWheelOption.control)
				{
					case "pitch":
						doPitchOption(trackIndex, data[1], data[2]);
						break;
					case "pan":
						//doPanOption(trackIndex, data[1], trackPitchWheelOptions[trackIndex].panOrigin);  // data1, the hi byte, is in range 0..127
						break;
					case "speed":
						//doSpeedOption(trackIndex, data[1], trackPitchWheelOptions[trackIndex].speedDeviation); // data1, the hi byte, is in range 0..127
						break;
				}
			}

			//for(i = 0; i < nTracks; ++i)
			//{
			//	if(trackWorkers[i] !== null && trackPitchWheelOptions[i].control !== 'disabled')
			//	{
			//		doOption(i, trackPitchWheelOptions[i]);
			//	}
			//}
		}

		inputEvent = getInputEvent(msg.data, performance.now());

		if(inputEvent.data !== undefined)
		{
			command = inputEvent.command();

			switch(command)
			{
				case CMD.NOTE_ON:
					if(inputEvent.data[2] !== 0)
					{
						handleNoteOn(inputEvent.data[1], inputEvent.data[2]);
					}
					else
					{
						handleNoteOff(inputEvent.data[1]);
					}
					break;
				case CMD.NOTE_OFF:
					handleNoteOff(inputEvent.data[1]);
					break;
				case CMD.CHANNEL_PRESSURE: // produced by both R2M and E-MU XBoard49 when using "aftertouch"
					// CHANNEL_PRESSURE.data[1] is the amount of pressure 0..127.
					handleChannelPressure(inputEvent.data);
					break;
				case CMD.AFTERTOUCH: // produced by the EWI breath controller
					// AFTERTOUCH.data[1] is the MIDIpitch to which to apply the aftertouch
					// AFTERTOUCH.data[2] is the amount of pressure 0..127.
					// not supported
					break;
				case CMD.PITCH_WHEEL: // EWI pitch bend up/down controllers, EMU pitch wheel
					handlePitchWheel(inputEvent.data);
					break;
				case CMD.CONTROL_CHANGE: // sent when the EMU ModWheel changes.
					handleModWheel(inputEvent.data);
					break;
				default:
					break;
			}
		}
	};

export class Conductor
{
	constructor(score, startPlayingCallback, midiInputDevice, speed)
	{
		if(midiInputDevice === null || midiInputDevice === undefined)
		{
			alert(
`No input device has been selected in the Input Device Selector.
(The conductor can be used anyway.)`);
		}

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
			this._midiInputDevice.addEventListener("midimessage", _handleMIDIInputEvent, false);
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

	stopConducting()
	{
		for(let handle of this._setIntervalHandles)
		{
			clearInterval(handle);
		}
		this._setIntervalHandles.length = 0;

		if(this._midiInputDevice !== null && this._midiInputDevice !== undefined)
		{
			this._midiInputDevice.removeEventListener("midimessage", _handleMIDIInputEvent, false);
		}
	}
}

export class TimerConductor extends Conductor
{
	constructor(score, startPlayingCallback, midiInputDevice, speed)
	{
		super(score, startPlayingCallback, midiInputDevice, speed);

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
	constructor(score, startPlayingCallback, midiInputDevice, speed)
	{
		super(score, startPlayingCallback, midiInputDevice, speed);

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


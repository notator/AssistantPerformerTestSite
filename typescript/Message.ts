
/// <reference path="Interface.ts" />

namespace _AP
{
	export class Message
	{
		// This is the constructor to use for non-SysExMessages having 1, 2 or 3 data bytes.
		// A 1-byte "realTime" message will be constructed if data.length is 1, and data[0]
		// matches one of the appropriate REAL_TIME values. 
		// The data1Arg and data2Arg arguments are optional and default to 0.
		constructor(status:number, data1Arg:number = 0, data2Arg:number = 0)
		{
			let dataValues = this._getDataValues(arguments.length, data1Arg, data2Arg);

			let data1 = dataValues.data1,
				data2 = dataValues.data2;

			this._checkArgSizes(status, data1, data2);

			length = this._getLength(status);

			this.data = new Uint8Array(length);

			switch(length)
			{
				case 1:
					this.data[0] = status; // runtime messages
					break;
				case 2:
					this.data[0] = status;
					this.data[1] = data1;
					break;
				case 3:
					this.data[0] = status;
					this.data[1] = data1;
					this.data[2] = data2;
					break;
			}
		}

		public command() : number
		{
			return this.data[0] & 0xF0;
		};

		public channel()
		{
			return this.data[0] & 0xF;
		};

		public data1()
		{
			return this.data[1];
		};

		public clone() :Message
		{
			var clone;
			switch(this.data.length)
			{
				case 1:
					clone = new Message(this.data[0]); // runtime messages
					break;
				case 2:
					clone = new Message(this.data[0], this.data[1]);
					break;
				case 3:
					clone = new Message(this.data[0], this.data[1], this.data[2]);
					break;
				default:
					throw "Error: cannot clone messages with more than 3 data bytes.";
			}
			return clone;
		}

		toString(): string
		{
			let	returnString = "Unknown Message Type.",
				channel,
				COMMAND = _AP.constants.COMMAND,
				REAL_TIME = _AP.constants.REAL_TIME;

			if(this.data.length === 1)
			{
				switch(this.data[0])
				{
					case REAL_TIME.TUNE_REQUEST:
						returnString = "REAL_TIME.TUNE_REQUEST ( " + REAL_TIME.TUNE_REQUEST.toString(16) + " )";
						break;
					case REAL_TIME.MIDI_CLOCK:
						returnString = "REAL_TIME.MIDI_CLOCK ( " + REAL_TIME.MIDI_CLOCK.toString(16) + " )";
						break;
					case REAL_TIME.MIDI_TICK:
						returnString = "REAL_TIME.MIDI_TICK ( " + REAL_TIME.MIDI_TICK.toString(16) + " )";
						break;
					case REAL_TIME.MIDI_START:
						returnString = "REAL_TIME.MIDI_START ( " + REAL_TIME.MIDI_START.toString(16) + " )";
						break;
					case REAL_TIME.MIDI_CONTINUE:
						returnString = "REAL_TIME.MIDI_CONTINUE ( " + REAL_TIME.MIDI_CONTINUE.toString(16) + " )";
						break;
					case REAL_TIME.MIDI_STOP:
						returnString = "REAL_TIME.MIDI_STOP ( " + REAL_TIME.MIDI_STOP.toString(16) + " )";
						break;
					case REAL_TIME.ACTIVE_SENSE:
						returnString = "REAL_TIME.ACTIVE_SENSE ( " + REAL_TIME.ACTIVE_SENSE.toString(16) + " )";
						break;
					case REAL_TIME.RESET:
						returnString = "REAL_TIME.RESET ( " + REAL_TIME.RESET.toString(16) + " )";
						break;
				}
			}
			else if(this.data.length === 2)
			{
				channel = (this.data[0] & 0xF).toString();
				switch(this.data[0] & 0xF0)
				{
					case 0xF0:
						switch(this.data[0])
						{
							case REAL_TIME.MTC_QUARTER_FRAME:
								returnString = 'realtime: MTC_QUARTER_FRAME';
								break;
							case REAL_TIME.SONG_SELECT:
								returnString = 'realtime: SONG_SELECT';
								break;
						}
						break;
					case COMMAND.CHANNEL_PRESSURE:
						returnString = 'command: CHANNEL_PRESSURE, channel:' + channel;
						break;
					case COMMAND.PROGRAM_CHANGE:
						returnString = 'command: PROGRAM_CHANGE, channel:' + channel;
						break;
				}
				returnString.concat(' data1:' + this.data[1].toString(16) + " (" + this.data[1].toString() + ")");
			}
			else if(this.data.length === 3)
			{
				channel = (this.data[0] & 0xF).toString();
				switch(this.data[0] & 0xF0)
				{
					case 0xF0:
						returnString = 'realtime: SONG_POSITION_POINTER';
						break;
					case COMMAND.NOTE_OFF:
						returnString = 'command: NOTE_OFF, channel:' + channel;
						break;
					case COMMAND.NOTE_ON:
						returnString = 'command: NOTE_ON, channel:' + channel;
						break;
					case COMMAND.AFTERTOUCH:
						returnString = 'command: AFTERTOUCH, channel:' + channel;
						break;
					case COMMAND.CONTROL_CHANGE:
						returnString = 'command: CONTROL_CHANGE, channel:' + channel;
						break;
					case COMMAND.PITCH_WHEEL:
						returnString = 'command: PITCH_WHEEL, channel:' + channel;
						break;
				}
				returnString.concat(' data1:' + this.data[1].toString(16) + " (" + this.data[1].toString() + ")" +
					' data2:' + this.data[2].toString(16) + " (" + this.data[2].toString() + ")");
			}
			return returnString;
		};

		private _getDataValues(argsLength: number, data1Arg: number, data2Arg: number): { data1: number, data2: number, data3: number }
		{
			var values: { data1: number, data2: number, data3: number } =
				{ data1: 0, data2: 0, data3: 0 };

			if(argsLength === 1)
			{
				values.data1 = 0;
				values.data2 = 0;
			}
			else if(argsLength === 2)
			{
				values.data1 = data1Arg;
				values.data2 = 0;
			}
			else if(argsLength === 3 || argsLength === 4)
			{
				values.data1 = data1Arg;
				values.data2 = data2Arg;
			}
			else
			{
				throw "Error: Too many arguments!";
			}

			return values;
		}

		private _checkArgSizes(status: number, data1: number, data2: number):void
		{
			if(status < 0 || status > 0xFF)
			{
				throw "Error: status out of range.";
			}
			if(data1 < 0 || data1 > 0x7F)
			{
				throw "Error: data1 out of range.";
			}
			if(data2 < 0 || data2 > 0x7F)
			{
				throw "Error: data2 out of range.";
			}
		}

		private _getLength = function(status:number):number
		{
			var length = -1, command = status & 0xF0,
				COMMAND = _AP.constants.COMMAND,
				SYSTEM_EXCLUSIVE = _AP.constants.SYSTEM_EXCLUSIVE,
				REAL_TIME = _AP.constants.REAL_TIME;
				;

			switch(command)
			{
				case COMMAND.NOTE_OFF:
				case COMMAND.NOTE_ON:
				case COMMAND.AFTERTOUCH:
				case COMMAND.CONTROL_CHANGE:
				case COMMAND.PITCH_WHEEL:
					length = 3;
					break;
				case COMMAND.PROGRAM_CHANGE:
				case COMMAND.CHANNEL_PRESSURE:
					length = 2;
					break;
			}
			if(length === -1)
			{
				switch(status)
				{
					case SYSTEM_EXCLUSIVE.START:
						throw "Error: Use the special SysExMessage constructor to construct variable length messages.";
					case REAL_TIME.TUNE_REQUEST:
					case REAL_TIME.MIDI_CLOCK:
					case REAL_TIME.MIDI_TICK:
					case REAL_TIME.MIDI_START:
					case REAL_TIME.MIDI_CONTINUE:
					case REAL_TIME.MIDI_STOP:
					case REAL_TIME.ACTIVE_SENSE:
					case REAL_TIME.RESET:
						length = 1;
						break;
					case REAL_TIME.MTC_QUARTER_FRAME:
					case REAL_TIME.SONG_SELECT:
						length = 2;
						break;
					case REAL_TIME.SONG_POSITION_POINTER:
						length = 3;
						break;
				}
			}

			if(length === -1)
			{
				throw "Error: Unknown message type.";
			}

			return length;
		}

		private data: Uint8Array;
	}
}
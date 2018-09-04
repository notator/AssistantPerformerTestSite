
namespace _AP
{
	export class COMMAND
	{
		constructor()
		{ }

		public readonly NOTE_OFF = 0x80;
		public readonly NOTE_ON = 0x90;
		public readonly AFTERTOUCH = 0xA0;
		public readonly CONTROL_CHANGE = 0xB0;
		public readonly PROGRAM_CHANGE = 0xC0;
		public readonly CHANNEL_PRESSURE = 0xD0;
		public readonly PITCH_WHEEL = 0xE0;
	}

	// These constants can be received or sent live during performances.
	// They are not stored in files.
	// The MIDI standard does not define 0xF4, 0xF5 or 0xFD.
	export class REAL_TIME
	{
		// 0xF0 is SYSTEM_EXCLUSIVE.START (used in Standard MIDI Files)
		public readonly MTC_QUARTER_FRAME = 0xF1;
		public readonly SONG_POSITION_POINTER = 0xF2;
		public readonly SONG_SELECT = 0xF3;
		// 0xF4 is not defined by the MIDI standard
		// 0xF5 is not defined by the MIDI standard
		public readonly TUNE_REQUEST = 0xF6;
		// 0xF7 is SYSTEM_EXCLUSIVE.END (used in Standard MIDI Files) 
		public readonly MIDI_CLOCK = 0xF8;
		public readonly MIDI_TICK = 0xF9;
		public readonly MIDI_START = 0xFA;
		public readonly MIDI_CONTINUE = 0xFB;
		public readonly MIDI_STOP = 0xFC;
		// 0xFD is not defined by the MIDI standard
		public readonly ACTIVE_SENSE = 0xFE;
		public readonly RESET = 0xFF;
	}

	// These are all the CONTROLS I use for the moment (Feb. 2013).
	// This list could be easily be extended/completed.
	// Note that I am currently only using the "coarse" versions of these controls
	export class CONTROL
	{
		public readonly MODWHEEL = 1;
		public readonly DATA_ENTRY_COARSE = 6;
		public readonly DATA_ENTRY_FINE = 38;
		public readonly VOLUME = 7;
		public readonly PAN = 10;
		public readonly EXPRESSION = 11;
		public readonly TIMBRE = 71;
		public readonly BRIGHTNESS = 74;
		public readonly EFFECTS = 91;
		public readonly TREMOLO = 92;
		public readonly CHORUS = 93;
		public readonly CELESTE = 94;
		public readonly PHASER = 95;
		public readonly REGISTERED_PARAMETER_FINE = 100;
		public readonly REGISTERED_PARAMETER_COARSE = 101;
		public readonly ALL_SOUND_OFF = 120;
		public readonly ALL_CONTROLLERS_OFF = 121;
		public readonly ALL_NOTES_OFF = 123;
	}

	export class SYSTEM_EXCLUSIVE
	{
		public readonly START = 0xF0;
		public readonly END = 0xF7;
	}

	export class Constants
	{
		constructor()
		{ }

		// True if constant is one of the REAL_TIME status bytes, otherwise false
		isRealTimeStatus(constant:number)
		{
			var result = false;

			if((constant === this.REAL_TIME.MTC_QUARTER_FRAME)
				|| (constant === this.REAL_TIME.SONG_POSITION_POINTER)
				|| (constant === this.REAL_TIME.SONG_SELECT)
				|| (constant === this.REAL_TIME.TUNE_REQUEST)
				|| (constant === this.REAL_TIME.MIDI_CLOCK)
				|| (constant === this.REAL_TIME.MIDI_TICK)
				|| (constant === this.REAL_TIME.MIDI_START)
				|| (constant === this.REAL_TIME.MIDI_CONTINUE)
				|| (constant === this.REAL_TIME.MIDI_STOP)
				|| (constant === this.REAL_TIME.ACTIVE_SENSE)
				|| (constant === this.REAL_TIME.RESET))
			{
				result = true;
			}
			return result;
		}

		public readonly COMMAND = new COMMAND();
		public readonly REAL_TIME = new REAL_TIME();
		public readonly CONTROL = new CONTROL();
		public readonly SYSTEM_EXCLUSIVE = new SYSTEM_EXCLUSIVE();
		public readonly INPUT_ERROR_COLOR = "#FFDCDC"; // the colour to which an input's background is set when there is an error.
	}

	export const constants = new _AP.Constants();
}


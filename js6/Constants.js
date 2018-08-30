const COMMAND =
	{
		NOTE_OFF: 0x80,
		NOTE_ON : 0x90,
		AFTERTOUCH : 0xA0,
		CONTROL_CHANGE : 0xB0,
		PROGRAM_CHANGE : 0xC0,
		CHANNEL_PRESSURE : 0xD0,
		PITCH_WHEEL : 0xE0
	};

// These constants can be received or sent live during performances.
// They are not stored in files.
// The MIDI standard does not define 0xF4, 0xF5 or 0xFD.
const REAL_TIME =
	{
		// 0xF0 is SYSTEM_EXCLUSIVE.START (used in Standard MIDI Files)
		MTC_QUARTER_FRAME : 0xF1,
		SONG_POSITION_POINTER : 0xF2,
		SONG_SELECT : 0xF3,
		// 0xF4 is not defined by the MIDI standard
		// 0xF5 is not defined by the MIDI standard
		TUNE_REQUEST : 0xF6,
		// 0xF7 is SYSTEM_EXCLUSIVE.END (used in Standard MIDI Files) 
		MIDI_CLOCK : 0xF8,
		MIDI_TICK : 0xF9,
		MIDI_START : 0xFA,
		MIDI_CONTINUE : 0xFB,
		MIDI_STOP : 0xFC,
		// 0xFD is not defined by the MIDI standard
		ACTIVE_SENSE : 0xFE,
		RESET : 0xFF
		};

// These are all the MIDI CONTROLS I use for the moment (Feb. 2013).
// This list could be easily be extended/completed.
// Note that I am currently only using the "coarse" versions of these controls
const CONTROL	=
	{
		MODWHEEL : 1,
		DATA_ENTRY_COARSE : 6,
		DATA_ENTRY_FINE : 38,
		VOLUME : 7,
		PAN : 10,
		EXPRESSION : 11,
		TIMBRE : 71,
		BRIGHTNESS : 74,
		EFFECTS : 91,
		TREMOLO : 92,
		CHORUS : 93,
		CELESTE : 94,
		PHASER : 95,
		REGISTERED_PARAMETER_FINE : 100,
		REGISTERED_PARAMETER_COARSE : 101,
		ALL_SOUND_OFF : 120,
		ALL_CONTROLLERS_OFF : 121,
		ALL_NOTES_OFF : 123
		};

const SYSTEM_EXCLUSIVE =
	{
		START : 0xF0,
		END : 0xF7
	};

class Constants {
	constructor() {
		this.COMMAND = COMMAND;
		this.REAL_TIME = REAL_TIME;
		this.CONTROL = CONTROL;
		this.SYSTEM_EXCLUSIVE = SYSTEM_EXCLUSIVE;
		this.INPUT_ERROR_COLOR = "#FFDCDC"; // the colour to which an input's background is set when there is an error.
	}
	// True if constant is one of the REAL_TIME status bytes, otherwise false
	isRealTimeStatus(constant) {
		var result = false;
		if ((constant === this.REAL_TIME.MTC_QUARTER_FRAME)
			|| (constant === this.REAL_TIME.SONG_POSITION_POINTER)
			|| (constant === this.REAL_TIME.SONG_SELECT)
			|| (constant === this.REAL_TIME.TUNE_REQUEST)
			|| (constant === this.REAL_TIME.MIDI_CLOCK)
			|| (constant === this.REAL_TIME.MIDI_TICK)
			|| (constant === this.REAL_TIME.MIDI_START)
			|| (constant === this.REAL_TIME.MIDI_CONTINUE)
			|| (constant === this.REAL_TIME.MIDI_STOP)
			|| (constant === this.REAL_TIME.ACTIVE_SENSE)
			|| (constant === this.REAL_TIME.RESET)) {
			result = true;
		}
		return result;
	}
}

let constants = new Constants();

export { constants };


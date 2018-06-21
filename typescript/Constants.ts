
namespace AP
{
	export class Constants
	{
		constructor()
		{
		}

		readonly COMMAND: object = {
			NOTE_OFF: 0x80,
			NOTE_ON: 0x90,
			AFTERTOUCH: 0xA0,
			CONTROL_CHANGE: 0xB0,
			PROGRAM_CHANGE: 0xC0,
			CHANNEL_PRESSURE: 0xD0,
			PITCH_WHEEL: 0xE0
		}
	}
}


import { constants } from "./Constants.js";
import { Message } from "./Message.js";

// This class is used when setting the inital control commands for each region.
// These commands are sent whenever a performance of the region begins. 
export class MidiControls
{
	constructor(channelIndex)
	{
		this.CmdPROGRAM_CHANGE = constants.COMMAND.PROGRAM_CHANGE;
		this.CmdPITCH_WHEEL = constants.COMMAND.PITCH_WHEEL;
		this.CmdCONTROL_CHANGE = constants.COMMAND.CONTROL_CHANGE;
		this.controlMessages = [];
		this.programChangeMessage = this.defaultProgramChangeMessage(channelIndex);
		this.pitchWheelMessage = this.defaultPitchWheelMessage(channelIndex);
		this.controlMessages = this.defaultControlMessages(channelIndex);
	}
	defaultProgramChangeMessage(channelIndex)
	{
		let status = constants.COMMAND.PROGRAM_CHANGE + channelIndex, data1 = 0, // grand piano
			msg = new Message(status, data1);
		return msg;
	}
	defaultPitchWheelMessage(channelIndex)
	{
		let status = constants.COMMAND.PITCH_WHEEL + channelIndex, data1 = 64, data2 = 64, msg = new Message(status, data1, data2);
		return msg;
	}
	defaultControlMessages(channelIndex)
	{
		// public readonly MODWHEEL = 1;
		// public readonly DATA_ENTRY_COARSE = 6;
		// public readonly DATA_ENTRY_FINE = 38;
		// public readonly VOLUME = 7;
		// public readonly PAN = 10;
		// public readonly EXPRESSION = 11;
		// public readonly TIMBRE = 71;
		// public readonly BRIGHTNESS = 74;
		// public readonly EFFECTS = 91;
		// public readonly TREMOLO = 92;
		// public readonly CHORUS = 93;
		// public readonly CELESTE = 94;
		// public readonly PHASER = 95;
		// public readonly REGISTERED_PARAMETER_FINE = 100;
		// public readonly REGISTERED_PARAMETER_COARSE = 101;
		// public readonly ALL_SOUND_OFF = 120;
		// public readonly ALL_CONTROLLERS_OFF = 121;
		// public readonly ALL_NOTES_OFF = 123;
		//The synths react to REGISTERED_PARAMETER_COARSE and
		//DATA_ENTRY_COARSE, but no longer to the custom utility
		//function setPitchBendSensitivity().
		//REGISTERED_PARAMETER_COARSE must always be set to
		//0, otherwise the DATA_ENTRY_COARSE value(the semitones
		//deviation) wont be retrieved.
		let defaultMessages = [], status = constants.COMMAND.CONTROL_CHANGE + channelIndex;
		let message = new Message(status, constants.CONTROL.MODWHEEL, 0);
		defaultMessages.push(message);
		message = new Message(status, constants.CONTROL.VOLUME, 100);
		defaultMessages.push(message);
		message = new Message(status, constants.CONTROL.PAN, 64);
		defaultMessages.push(message);
		message = new Message(status, constants.CONTROL.EXPRESSION, 127);
		defaultMessages.push(message);
		//pitchWheelDeviation
		message = new Message(status, constants.CONTROL.REGISTERED_PARAMETER_COARSE, 101);
		defaultMessages.push(message);
		message = new Message(status, constants.CONTROL.REGISTERED_PARAMETER_FINE, 100);
		defaultMessages.push(message);
		message = new Message(status, constants.CONTROL.DATA_ENTRY_COARSE, 1);
		defaultMessages.push(message);
		message = new Message(status, constants.CONTROL.DATA_ENTRY_FINE, 0);
		defaultMessages.push(message);
		return defaultMessages;
	}
	// Set the corresponding currentControls values to the specific values in the moment messages.
	// (Leave the other values as they are.)
	updateFrom(moment)
	{
		for(let msg of moment.messages)
		{
			let cmd = msg.command();
			switch(cmd)
			{
				case this.CmdPROGRAM_CHANGE:
					this.programChangeMessage = msg;
					break;
				case this.CmdPITCH_WHEEL:
					this.pitchWheelMessage = msg;
					break;
				case this.CmdCONTROL_CHANGE:
					let index = this.findControlMessage(msg.data1());
					if(index >= 0 && index < this.controlMessages.length)
					{
						this.controlMessages[index] = msg;
					}
					break;
				default:
					break;
			}
		}
	}
	// Set moment controls to all the values in currentControls
	// deleting any existing corresponding values, and
	// maintaining the control sequence.
	update(moment)
	{
		let messages = moment.messages;
		for(let i = messages.length - 1; i >= 0; --i)
		{
			let cmd = messages[i].command();
			if(cmd === this.CmdPROGRAM_CHANGE || cmd === this.CmdPITCH_WHEEL || cmd === this.CmdCONTROL_CHANGE)
			{
				messages.splice(i, 1); // remove the message
			}
		}
		// Insert the messages in reverse order, to maintain the sequence.
		for(let i = this.controlMessages.length - 1; i >= 0; --i)
		{
			messages.splice(0, 0, this.controlMessages[i]);
		}
		messages.splice(0, 0, this.pitchWheelMessage);
		messages.splice(0, 0, this.programChangeMessage);
	}
	// returns the index of the particular control type in the controlMessages array or -1.
	findControlMessage(controlType)
	{
		let returnIndex = -1, i, nMsgs = this.controlMessages.length;
		for(i = 0; i < nMsgs; ++i)
		{
			if(this.controlMessages[i].data1() === controlType)
			{
				returnIndex = i;
				break;
			}
		}
		return returnIndex;
	}
}


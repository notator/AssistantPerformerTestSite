
/// <reference path="YCoordinates.ts" />
/// <reference path="Message.ts" />

namespace _AP
{
	export interface SvgSystem
	{
		readonly staves: Staff[];
		readonly startMarker: StartMarker;
		readonly endMarker: EndMarker;
		readonly markersTop: number; // used when constructing StartMarker and EndMarker
		readonly markersBottom: number; // used when constructing StartMarker and EndMarker
	}

	export interface Staff
	{
		readonly voices: Voice[];
		readonly topLineY: number;
	}

	export interface Voice
	{
		readonly isOutput: boolean;
		readonly timeObjects: TimeObject[];
	}

	export interface TimeObject
	{
		readonly msPositionInScore: number;
		readonly msDurationInScore: number;
		readonly alignment: number;
		isOn: boolean;
	}

	export interface RegionDef
	{
		readonly name: string; // a single character
		readonly startMsPositionInScore: number;
		readonly endMsPositionInScore: number; // as usual, non-inclusive
	}

	/*******************************************************/

	export interface StartMarker
	{
		alignment: number;
		msPositionInScore: number;
		readonly systemIndexInScore: number;
		readonly viewBoxScale: number;
		readonly yCoordinates: YCoordinates;
		readonly line: SVGLineElement;
		readonly circle: SVGCircleElement;
	}

	export interface EndMarker
	{
		alignment: number;
		msPositioninScore: number;
		readonly systemIndexInScore: number;
		readonly viewBoxScale: number;
		readonly yCoordinates: YCoordinates;
		readonly line: SVGLineElement;
		readonly rect: SVGRectElement;
	}

	/*******************************************************/

	//export interface Message
	//{
	//	readonly data: number[];
	//	command(): number;
	//	channel(): number;
	//	clone(): Message;
	//	toString(): string;
	//	_getDataValues(argsLength: number, data1Arg: number, data2Arg: number): { data1: number, data2: number }
	//	_checkArgSizes(status: number, data1: number, data2: number): void;
	//	_getLength(status: number): number;
	//}

	export interface Moment
	{
		readonly msPositionInChord: number;
		readonly messages: Message[];
		timestamp: number | undefined;
	}

	export interface TimeObject
	{
		readonly msPositionInScore: number;
		readonly moments: Moment[] | undefined;
	}

	// implemented by both MidiChordDef and MidiRestDef
	export interface MidiObject extends TimeObject
	{
		readonly moments: Moment[];
		setToStartAtBeginning(): void;
		setToStartMarker(startMarkerMsPositionInScore: number): void;
		advanceCurrentMoment(): Moment;
		isMidiChord(): boolean;
		currentMoment: Moment;
	}

	/****************************************************/

	/*
	 * ji 12.07.2018
	 * The following definitions of the Input interfaces have not yet been checked or tested.
	 * The authoritative version can be found in (the comments to) the corresponding javascript files.
	 */

	export interface CCSettings
	{
		trackIndex: number;

		// "disabled", "aftertouch", "channelPressure", "modulation", "volume", "expression",
		// "timbre","brightness", "effects", "tremolo", "chorus", "celeste", "phaser"
		pressure?: string;

		// "disabled", "pitch", "speed" or "pan"
		pitchWheel?: string;

		// possible values: same as pressure
		modWheel?: string;  // see also maxVolume and minVolume

		minVolume?: number; // an integer in range [1..127]. Is set if either pressure, or modulation messages are set to control volume
		maxVolume?: number; // an integer in range [1..127]. Is set if either pressure, or modulation messages are set to control volume
		pitchWheelDeviation?: number; // the number of semitones deviation when pitchWheel="pitch"
		speedDeviation?: number; // the speed factor when pitchWheel="speed"
		panOrigin?: number; // if defined, is in range [0..127] (centre is 64)
	}

	// class defined in TrkOptions.js
	export interface TrkOptions
	{
		pedal?: string; // "holdAll" or "holdLast" or undefined
		velocity: string; // "scaled" or "shared" or "overridden" or undefined
		minVelocity: number; // an integer value in range[1..127]. Defined if velocity is defined.
		speed: number; // undefined or a float value greater than 0. Higher values mean higher speed. This is the value by which to divide output durations in the trk.  
		trkOff: string; // "stopChord", "stopNow", "fade" or undefined 
	}

	export interface Trk
	{
		trkOptions: TrkOptions;
		trackIndex: number;
		midiObjectIndex: number;
		midiObjects: MidiObject[];
	}

	export interface SeqDef
	{
		trkOptions?: TrkOptions; // if defined is onSeq.trkOptions
		trks: Trk[];
	}

	export interface NoteOnOrOff
	{
		seqDef: SeqDef;
		trkOffs: number[];
	}

	export interface InputNote 
	{
		trkOptions: TrkOptions;
		noteOn: NoteOnOrOff;
		noteOff: NoteOnOrOff;
	}

	// implemented by both InputChordDef and InputRestDef
	export interface InputObjectDef extends TimeObject
	{
		getOutputTrackPerMidiChannel(midiChannelPerOutputTrack: number[]): number[];
		getCCSettings(ccSettingsNode: SVGElement, outputTrackPerMidiChannel: number[], nOutputTracks: number): CCSettings[];
		getInputNotes(inputNotesNode: SVGElement, outputTrackPerMidiChannel: number[]): SVGElement[];
		referencedOutputTrackIndices(): number[];

		// The SVG file is read into the following fields using the above functions.
		msDurationInScore: number;
		ccSettings: CCSettings[]; // one value per output track
		trkOptions?: TrkOptions[]; // undefined or an array of TrkOptions object (some of which can be undefined?)
		inputNotes: InputNote[]; // an array of inputNote.
	}

	export interface InputChord
	{
		InputChord(inputChordDef: InputObjectDef, outputTrks: MidiObject[][], systemIndex:number): void
		readonly msPositionInScore: number;
		readonly msDurationInScore: number;
		readonly alignment: number;
		readonly systemIndex: number;
		readonly ccSettings: number;
		readonly trkOptions: TrkOptions;
		readonly inputNotes: InputNote[];
	}
}


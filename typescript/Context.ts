
namespace _AP
{
	export interface SvgSystem
	{
		staves: Staff[];
		startMarker: StartMarker;
		endMarker: EndMarker;
		markersTop: number; // used when constructing StartMarker and EndMarker
		markersBottom: number; // used when constructing StartMarker and EndMarker
	}

	export interface Staff
	{
		isVisible: boolean;
		voices: Voice[];
		topLineY: number;
	}

	export interface Voice
	{
		isOutput: boolean;
		timeObjects: TimeObject[];
	}

	export interface TimeObject
	{
		msPositionInScore: number;
		msDurationInScore: number;
		isOn: boolean;
	}

	/*******************************************************/

	//export interface YCoordinates
	//{
	//	top: number;
	//	bottom: number;
	//}

	export interface StartMarker
	{
		alignment: number;
		msPositionInScore: number;
		systemIndexInScore: number;
		viewBoxScale: number;
		yCoordinates: YCoordinates;
		line: SVGLineElement;
		circle: SVGCircleElement;
	}

	export interface EndMarker
	{
		alignment: number;
		msPositioninScore: number;
		systemIndexInScore: number;
		viewBoxScale: number;
		yCoordinates: YCoordinates;
		line: SVGLineElement;
		circle: SVGCircleElement;
	}

	/*******************************************************/

	export class MidiChord
	{
		constructor()
		{ }
	}

	export class MidiRest
	{
		constructor()
		{ }
	}

	export class midiObject
	{
		static MidiChord: any = MidiChord.constructor;
		static MidiRest: any = MidiRest.constructor;
		constructor()
		{

		}
	}

	/*******************************************************/

	export class InputChordDef
	{
		constructor()
		{ }
	}

	export class InputRestDef
	{
		constructor()
		{ }
	}

	export class inputObjectDef
	{
		static InputChordDef: any = InputChordDef.constructor;
		static InputRestDef: any = InputRestDef.constructor;
		constructor()
		{

		}
	}


 }


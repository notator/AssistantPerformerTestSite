
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

	// the following can be deleted when the running marker is deleted!
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


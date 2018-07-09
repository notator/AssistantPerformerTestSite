
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

	export interface Message
	{
		readonly data: number[];
		command():number;
		channel(): number;
		clone(): Message;
		toString(): string;
		_getDataValues(argsLength: number, data1Arg:number, data2Arg:number): {data1:number, data2:number}
		_checkArgSizes(status: number, data1: number, data2: number): void;
		_getLength(status: number): number;
	}
	export interface Moment
	{
		readonly msPositionInChord: number;
		readonly messages: Message[];
	}
	export interface TimeObject
	{
		readonly msPositionInScore: number;
		readonly moments: Moment[] | undefined;
	}
	export interface MidiObject extends TimeObject
	{
		readonly moments: Moment[];
		setToStartAtBeginning(): void;
		setToStartMarker(startMarkerMsPositionInScore: number): void;
		advanceCurrentMoment(): Moment;
		isMidiChord(): boolean;
		currentMoment: Moment;
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


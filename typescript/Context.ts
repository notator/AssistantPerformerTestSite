
namespace _AP
{
	export class LineStyle
	{
		public visibility: "visible" | "hidden" = "hidden";
		public stroke: string = "none";
		public strokeWidth: number = 0;

		constructor()
		{ }
	}

	export class SVGLine implements INode
	{
		readonly nodeName: string = "line";

		x1: string = "0";
		x2: string = "0";
		y1: string = "0";
		y2: string = "0";

		style: LineStyle = new LineStyle();
		setAttribute(coordinate: "x1" | "x2" | "y1" | "y2", value: string): void
		{
			switch(coordinate)
			{
				case "x1":
					this.x1 = value;
					break;
				case "x2":
					this.x2 = value;
					break;
				case "y1":
					this.y1 = value;
					break;
				case "y2":
					this.y2 = value;
					break;
			}
		}

		constructor() { }
	}

	export interface INode
	{
		nodeName: string;
	}

	export class CursorGroupElem
	{
		childNodes: INode[] = [];
		
		constructor()
		{
			this.childNodes.push(new _AP.SVGLine);
		}
	}

	/*******************************************************/

	export class SvgSystem
	{
		staves: Staff[] = [];
		constructor(public markersTop: number, public markersBottom: number)
		{
		}
	}

	export class Staff
	{
		isVisible: boolean = true;
		voices: Voice[] = [];
		topLineY: number = 0;
		constructor()
		{
		}
	}

	export class Voice
	{
		isOutput: boolean = true;
		timeObjects: TimeObject[] = [];
		constructor()
		{
		}
	}

	export class TimeObject
	{
		msPositionInScore: number = 0;
		constructor()
		{
		}
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

	/*******************************************************/

	export class YCoordinates
	{
		constructor(public top: number, public bottom: number)
		{
		}
	}

	/*******************************************************/
 }


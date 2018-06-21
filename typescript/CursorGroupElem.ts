
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

	export interface ICursorGroupElem
	{
		childNodes: INode[];
	}

	export interface INode
	{
		nodeName: string;
	}

	export class CursorGroupElem implements ICursorGroupElem
	{
		childNodes: INode[] = [];
		
		constructor()
		{
			this.childNodes.push(new _AP.SVGLine);
		}
	}
}


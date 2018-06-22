
/// <reference path="CursorContext.ts" />

namespace _AP
{
	export class YCoordinates
	{
		constructor(public top: number, public bottom: number)
		{
		}
	}

	export class Cursor
	{
		constructor(
			system: SvgSystem,
			systemIndexInScore: number,
			svgRunningMarkerGroup: CursorGroupElem,
			vbScale: number)
		{
			const EXTRA_TOP_AND_BOTTOM = 45; // user html pixels
			let top:string = (system.markersTop - EXTRA_TOP_AND_BOTTOM).toString();
			let bottom:string = (system.markersBottom + EXTRA_TOP_AND_BOTTOM).toString();

			this.systemIndexInScore = systemIndexInScore;

			this.line = this._getLine(svgRunningMarkerGroup, top, bottom);
			this.viewboxScale = vbScale;
			this.yCoordinates = this._getYCoordinates(top, bottom, vbScale);
			this.timeObjects = [];

			this.setVisible(false);
		}

		private _getLine(svgRunningMarkerGroup: CursorGroupElem, top:string, bottom:string): SVGLine
		{
			function setLine(line: SVGLine, top:string, bottom:string): void
			{
				const strokeWidth = 8, // 1 pixel
					  color = '#999999';

				line.setAttribute('x1', '0');
				line.setAttribute('y1', top);
				line.setAttribute('x2', '0');
				line.setAttribute('y2', bottom);

				line.style.strokeWidth = strokeWidth;
				line.style.stroke = color;

			}

			let i: number,
				groupChildren: any[] = svgRunningMarkerGroup.childNodes;

			for(i = 0; i < groupChildren.length; ++i)
			{
				if(groupChildren[i].nodeName === 'line')
				{
					break;
				}
			}
			let line = groupChildren[i] as SVGLine;
			setLine(line, top, bottom);
			return line;
		}

		private _getYCoordinates(top: string, bottom:string, vbScale:number): YCoordinates
		{
			return { top: Math.round(parseFloat(top) / vbScale), bottom: Math.round(parseFloat(bottom) / vbScale) };
		}

		readonly systemIndexInScore: number;
		readonly line: SVGLine;
		readonly viewboxScale: number;
		readonly yCoordinates: YCoordinates;
		readonly timeObjects: any[];
		positionIndex: number = 0;
		nextMsPosition: number = 0;

		public setVisible(setToVisible: boolean): void
		{
			if(setToVisible)
			{
				this.line.style.visibility = 'visible';
			}
			else
			{
				this.line.style.visibility = 'hidden';
			}
		}
	}
}
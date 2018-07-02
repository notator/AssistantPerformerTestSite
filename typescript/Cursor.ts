﻿
/// <reference path="Context.ts" />
/// <reference path="Sims.ts" />

namespace _AP
{
	export class Cursor
	{
		constructor(markersLayer: SVGGElement, cursorYAttributes: CursorYAttributes)
		{
			this.line = this.newCursorLine();
			markersLayer.appendChild(this.line);
			this.cursorYAttributes = cursorYAttributes;
		}

		private newCursorLine(): SVGLineElement
		{
			var cursorLine = document.createElementNS("http://www.w3.org/2000/svg", 'line');

			cursorLine.setAttribute("class", "cursorLine");
			cursorLine.setAttribute("x1", "0");
			cursorLine.setAttribute("y1", "0");
			cursorLine.setAttribute("x2", "0");
			cursorLine.setAttribute("y2", "0");
			cursorLine.setAttribute("style", "stroke:#0000FF; stroke-width:1px; visibility:hidden");

			return cursorLine;
		}

		//// foreach system, system.runningMarker.setTimeObjects
		//private setTimeObjects(systems: SvgSystem[], isLivePerformance: boolean, trackIsOnArray: boolean[]): void
		//{
		//	throw new Error("Method not implemented.");
		//}

		public setSims(simsInScore: Sim[])
		{
			this.sims = simsInScore;
			this.cursorYAttributes = simsInScore[0].cursorYAttributes;
		}

		public setVisible(setToVisible:boolean): void
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

		//runningMarker = systems[startMarker.systemIndexInScore].runningMarker;
		//runningMarker.setVisible(true);
		public moveToStartMarker(startMarker: StartMarker): void
		{
			let sLine = startMarker.line,
				x = sLine.x1.baseVal.valueAsString,
				y1 = sLine.y1.baseVal.valueAsString,
				y2 = sLine.y2.baseVal.valueAsString;			

			this.line.setAttribute("x1", x);
			this.line.setAttribute("y1", y1);
			this.line.setAttribute("x2", x);
			this.line.setAttribute("y2", y2);
		}

		readonly line: SVGLineElement;
		cursorYAttributes: CursorYAttributes;
		sims: Sim[] = [];
		positionIndex: number = 0;
		nextMsPosition: number = 0;
	}
}
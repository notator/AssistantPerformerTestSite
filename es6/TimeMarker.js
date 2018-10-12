import { CursorBase } from "./Cursor.js";

export class TimeMarker extends CursorBase
{
	constructor(cursor)
	{
		function graphicElement(height, viewBoxScale)
		{
			var graphicElement = document.createElementNS("http://www.w3.org/2000/svg", "g"),
				hLine = document.createElementNS("http://www.w3.org/2000/svg", "line"),
				topDiagLine = document.createElementNS("http://www.w3.org/2000/svg", "line"),
				bottomDiagLine = document.createElementNS("http://www.w3.org/2000/svg", "line"),
				vLine = document.createElementNS("http://www.w3.org/2000/svg", "line");

			hLine.setAttribute("x1", (-13.9 * viewBoxScale).toString(10));
			hLine.setAttribute("y1", (10 * viewBoxScale).toString(10));
			hLine.setAttribute("x2", (-1.7 * viewBoxScale).toString(10));
			hLine.setAttribute("y2", (10 * viewBoxScale).toString(10));
			hLine.setAttribute("stroke", "#5555FF");
			hLine.setAttribute("stroke-width", (1.5 * viewBoxScale).toString(10));

			topDiagLine.setAttribute("x1", (-1.6 * viewBoxScale).toString(10));
			topDiagLine.setAttribute("y1", (10 * viewBoxScale).toString(10));
			topDiagLine.setAttribute("x2", (-5.4 * viewBoxScale).toString(10));
			topDiagLine.setAttribute("y2", (6 * viewBoxScale).toString(10));
			topDiagLine.setAttribute("stroke", "#5555FF");
			topDiagLine.setAttribute("stroke-width", (1.5 * viewBoxScale).toString(10));
			topDiagLine.setAttribute("stroke-linecap", "square");

			bottomDiagLine.setAttribute("x1", (-1.6 * viewBoxScale).toString(10));
			bottomDiagLine.setAttribute("y1", (10 * viewBoxScale).toString(10));
			bottomDiagLine.setAttribute("x2", (-5.4 * viewBoxScale).toString(10));
			bottomDiagLine.setAttribute("y2", (14 * viewBoxScale).toString(10));
			bottomDiagLine.setAttribute("stroke", "#5555FF");
			bottomDiagLine.setAttribute("stroke-width", (1.5 * viewBoxScale).toString(10));
			bottomDiagLine.setAttribute("stroke-linecap", "square");

			vLine.setAttribute("x1", "0");
			vLine.setAttribute("y1", "0");
			vLine.setAttribute("x2", "0");
			vLine.setAttribute("y2", (height * viewBoxScale).toString(10));
			vLine.setAttribute("stroke", "#5555FF");
			vLine.setAttribute("stroke-width", (1 * viewBoxScale).toString(10));

			graphicElement.appendChild(hLine);
			graphicElement.appendChild(topDiagLine);
			graphicElement.appendChild(bottomDiagLine);
			graphicElement.appendChild(vLine);

			return graphicElement;
		}

		function getMsPositionsArray(theMap)
		{
			let rval = [];

			for(let key of theMap.keys())
			{
				rval.push(key);
			}
			return rval;
		}

		let height = cursor.yCoordinates.bottom - cursor.yCoordinates.top;
		let element = graphicElement(height, cursor.viewBoxScale);
		super(element, cursor.scoreCursorCoordinatesMap, cursor.endMarkerMsPosInScore, cursor.viewBoxScale);

		let msPositionsArray = getMsPositionsArray(cursor.scoreCursorCoordinatesMap);

		Object.defineProperty(this, "startMarker", { value: null, writable: true });
		Object.defineProperty(this, "msPositionInScore", { value: -1, writable: true });

		Object.defineProperty(this, "msPositions", { value: msPositionsArray, writable: false });
		Object.defineProperty(this, "currentMsPositionIndex", { value: -1, writable: true });
	}

	_moveElementTo(msPositionInScore)
	{
		function moveElementToCoordinates(element, coordinates)
		{

		}

		if(msPositionInScore >= this.endMarkerMsPosInScore)
		{
			this.setVisible(false);
		}
		else if(this.scoreCursorCoordinatesMap.has(msPositionInScore)
		&& (msPositionInScore > this.msPositions[this.currentMsPositionIndex]))
		{
			let coordinates = this.scoreCursorCoordinatesMap.get(msPositionInScore);
			this.msPositionInScore = msPositionInScore;
			this.currentMsPositionIndex++;
			moveElementToCoordinates(this.element, coordinates);
		}
	}

	setStartMarker(startMarker)
	{
		function getCurrentIndex(msPositions, msPositionInScore)
		{
			let msPosIndex = -1;

			for(let i = 0; i < msPositions.length; ++i)
			{
				if(msPositions[i] === msPositionInScore)
				{
					msPosIndex = i;
					break;
				}
			}
			return msPosIndex;
		}

		this.startMarker = startMarker;
		this.msPositionInScore = startMarker.msPositionInScore;
		this.currentMsPositionIndex = getCurrentIndex(this.msPositions, this.msPositionInScore);
		this._moveElementTo(this.msPositionInScore);
	}

	msPerPx()
	{
		var
			ms, px,
			leftMsPos = this.msPositions[this.currentMsPositionIndex],
			leftAlignment = this.scoreCursorCoordinatesMap.get(leftMsPos).alignment,
			rightMsPos = this.endMarkerMsPosInScore,
			rightAlignment;

		if((this.currentMsPositionIndex + 1) < this.msPositions.length)
		{
			rightMsPos = this.msPositions[this.currentMsPositionIndex + 1];
			rightAlignment = this.scoreCursorCoordinatesMap.get(rightMsPos).alignment;
		}

		ms = rightMsPos - leftMsPos;
		px = rightAlignment - leftAlignment;

		return (ms / px);
	}

	now()
	{
		return this.msPositionInScore;
	}

	advance(msIncrement)
	{
		let leftMsPos = this.msPositions[this.currentMsPositionIndex],
			leftAlignment = this.scoreCursorCoordinatesMap.get(leftMsPos).alignment,
			rightMsPos = this.endMarkerMsPosInScore,
			rightAlignment;

		if((this.currentMsPositionIndex + 1) < this.msPositions.length)
		{
			rightMsPos = this.msPositions[this.currentMsPositionIndex + 1];
			rightAlignment = this.scoreCursorCoordinatesMap.get(rightMsPos).alignment;
		}

		this.msPositionInScore += msIncrement;

		if(rightMsPos < this.msPositionInScore)
		{
			this._moveElementTo(rightMsPos);
		}
	}
}


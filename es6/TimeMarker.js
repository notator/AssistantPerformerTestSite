import { CursorBase } from "./Cursor.js";

export class TimeMarker extends CursorBase
{
	constructor(systems, cursor, regionSequence)
	{
		function newElement(viewBoxScale)
		{
			let element = document.createElementNS("http://www.w3.org/2000/svg", "g"),
				hLine = document.createElementNS("http://www.w3.org/2000/svg", "line"),
				topDiagLine = document.createElementNS("http://www.w3.org/2000/svg", "line"),
				bottomDiagLine = document.createElementNS("http://www.w3.org/2000/svg", "line"),
				vLine = document.createElementNS("http://www.w3.org/2000/svg", "line"),
				strokeColor, hStyle, dStyle, vStyle;

			strokeColor = "stroke:#5555FF";
			hStyle = strokeColor + "; stroke-width:" + (1.5 * viewBoxScale).toString(10);
			dStyle = hStyle + "; stroke-linecap:'square'";
			vStyle = strokeColor + "; stroke-width:" + (1 * viewBoxScale).toString(10);

			hLine.setAttribute("style", hStyle);
			topDiagLine.setAttribute("style", dStyle);
			bottomDiagLine.setAttribute("style", dStyle);
			vLine.setAttribute("style", vStyle);

			//hLine.setAttribute("stroke", "#5555FF");
			//hLine.setAttribute("stroke-width", (1.5 * viewBoxScale).toString(10));

			//topDiagLine.setAttribute("stroke", "#5555FF");
			//topDiagLine.setAttribute("stroke-width", (1.5 * viewBoxScale).toString(10));
			//topDiagLine.setAttribute("stroke-linecap", "square");

			//bottomDiagLine.setAttribute("stroke", "#5555FF");
			//bottomDiagLine.setAttribute("stroke-width", (1.5 * viewBoxScale).toString(10));
			//bottomDiagLine.setAttribute("stroke-linecap", "square");

			//vLine.setAttribute("stroke", "#5555FF");
			//vLine.setAttribute("stroke-width", (1 * viewBoxScale).toString(10));

			element.appendChild(hLine);
			element.appendChild(topDiagLine);
			element.appendChild(bottomDiagLine);
			element.appendChild(vLine);

			element.setAttribute("visibility", "hidden");

			return { element, hLine, topDiagLine, bottomDiagLine, vLine };
		}

		function getMsPositionsArray(theMap)
		{
			let rval = [];

			for(let key of theMap.keys())
			{
				rval.push(key);
			}

			rval.sort((a, b) => a - b);

			return rval;
		}

		function getSystemEndMsPositions(systems)
		{
			let msPositions = [];

			for(let system of systems)
			{
				let voiceTimeObjects = system.staves[0].voices[0].timeObjects,
					timeObject = voiceTimeObjects[voiceTimeObjects.length - 1];

				msPositions.push(timeObject.msPositionInScore);
			}

			return msPositions;
		}

		function getSystemRightAlignment(system)
		{
			let voiceTimeObjects = system.staves[0].voices[0].timeObjects,
				timeObject = voiceTimeObjects[voiceTimeObjects.length - 1],
				rightAlignment = timeObject.alignment;

			return rightAlignment;
		}

		super(cursor.systemChanged, cursor.cursorCoordinatesMap, cursor.endMarkerMsPosInScore, cursor.viewBoxScale);

		let elem = newElement(cursor.viewBoxScale);
		Object.defineProperty(this, "element", { value: elem.element, writable: false });
		Object.defineProperty(this, "hLine", { value: elem.hLine, writable: false });
		Object.defineProperty(this, "topDiagLine", { value: elem.topDiagLine, writable: false });
		Object.defineProperty(this, "bottomDiagLine", { value: elem.bottomDiagLine, writable: false });
		Object.defineProperty(this, "vLine", { value: elem.vLine, writable: false });

		Object.defineProperty(this, "regionSequence", { value: regionSequence, writable: false });
		Object.defineProperty(this, "startRegionIndex", { value: 0, writable: true });
		Object.defineProperty(this, "endRegionIndex", { value: 0, writable: true });
		Object.defineProperty(this, "currentRegionIndex", { value: 0, writable: true });

		// An array containing the (sorted) cursorCoordinatesMap keys.
		let msPositionsArray = getMsPositionsArray(cursor.cursorCoordinatesMap);
		Object.defineProperty(this, "msPositions", { value: msPositionsArray, writable: false });
		Object.defineProperty(this, "currentMsPositionIndex", { value: 0, writable: true });

		let systemRightAlignment = getSystemRightAlignment(systems[0]);
		Object.defineProperty(this, "systemRightAlignment", { value: systemRightAlignment, writable: false });
		let systemEndMsPositions = getSystemEndMsPositions(systems);
		Object.defineProperty(this, "systemEndMsPositions", { value: systemEndMsPositions, writable: false });
		Object.defineProperty(this, "currentSystemIndex", { value: 0, writable: true });

		Object.defineProperty(this, "startMarker", { value: null, writable: true }); // set in init()
		Object.defineProperty(this, "msPositionInScore", { value: -1, writable: true }); // value returned by now()		
	}

	_setCoordinates(alignment, top, bottom)
	{
		let viewBoxScale = this.viewBoxScale,
			hLine = this.hLine,
			topDiagLine = this.topDiagLine,
			bottomDiagLine = this.bottomDiagLine,
			vLine = this.vLine;

		hLine.setAttribute("x1", (alignment - (13.9 * viewBoxScale)).toString(10));
		hLine.setAttribute("y1", (top + (10 * viewBoxScale)).toString(10));
		hLine.setAttribute("x2", (alignment - (1.7 * viewBoxScale)).toString(10));
		hLine.setAttribute("y2", (top + (10 * viewBoxScale)).toString(10));

		topDiagLine.setAttribute("x1", (alignment - (1.6 * viewBoxScale)).toString(10));
		topDiagLine.setAttribute("y1", (top + (10 * viewBoxScale)).toString(10));
		topDiagLine.setAttribute("x2", (alignment - (5.4 * viewBoxScale)).toString(10));
		topDiagLine.setAttribute("y2", (top + (6 * viewBoxScale)).toString(10));

		bottomDiagLine.setAttribute("x1", (alignment - (1.6 * viewBoxScale)).toString(10));
		bottomDiagLine.setAttribute("y1", (top + (10 * viewBoxScale)).toString(10));
		bottomDiagLine.setAttribute("x2", (alignment - (5.4 * viewBoxScale)).toString(10));
		bottomDiagLine.setAttribute("y2", (top + (14 * viewBoxScale)).toString(10));

		vLine.setAttribute("x1", alignment.toString(10));
		vLine.setAttribute("y1", top.toString(10));
		vLine.setAttribute("x2", alignment.toString(10));
		vLine.setAttribute("y2", bottom.toString(10));
	}

	_setAlignment(alignment)
	{
		let viewBoxScale = this.viewBoxScale,
			hLine = this.hLine,
			topDiagLine = this.topDiagLine,
			bottomDiagLine = this.bottomDiagLine,
			vLine = this.vLine;

		hLine.setAttribute("x1", (alignment - (13.9 * viewBoxScale)).toString(10));
		hLine.setAttribute("x2", (alignment - (1.7 * viewBoxScale)).toString(10));

		topDiagLine.setAttribute("x1", (alignment - (1.6 * viewBoxScale)).toString(10));
		topDiagLine.setAttribute("x2", (alignment - (5.4 * viewBoxScale)).toString(10));

		bottomDiagLine.setAttribute("x1", (alignment - (1.6 * viewBoxScale)).toString(10));
		bottomDiagLine.setAttribute("x2", (alignment - (5.4 * viewBoxScale)).toString(10));

		vLine.setAttribute("x1", alignment.toString(10));
		vLine.setAttribute("x2", alignment.toString(10));
	}

	_moveElementTo(msPositionInScore)
	{
		function moveElementToCoordinates(that, coordinates)
		{
			if(that.yCoordinates === coordinates.yCoordinates)
			{
				that._setAlignment(coordinates.alignment);
			}
			else
			{
				let alignment = coordinates.alignment,
					top = coordinates.yCoordinates.top,
					bottom = coordinates.yCoordinates.bottom;

				that._setCoordinates(alignment, top, bottom);
				that.yCoordinates = coordinates.yCoordinates;
			}
		}

		if(msPositionInScore >= this.endMarkerMsPosInScore)
		{
			this.setVisible(false);
		}
		else if(this.cursorCoordinatesMap.has(msPositionInScore))
		{
			let coordinates = this.cursorCoordinatesMap.get(msPositionInScore);

			this.msPositionInScore = msPositionInScore;
			this.currentMsPositionIndex = this.msPositions.findIndex((a) => a === msPositionInScore);

			moveElementToCoordinates(this, coordinates);
		}
	}

	init(startMarker, startRegionIndex, endRegionIndex)
	{
		this.startMarker = startMarker;
		this.msPositionInScore = startMarker.msPositionInScore;

		this.startRegionIndex = startRegionIndex;
		this.endRegionIndex = endRegionIndex;
		this.currentRegionIndex = startRegionIndex;
		this.currentMsPositionIndex = this.msPositions.findIndex((a) => a === startMarker.msPositionInScore);
		this.currentSystemIndex = this.systemEndMsPositions.findIndex((a) => a > startMarker.msPositionInScore);

		let coordinates = this.cursorCoordinatesMap.get(this.msPositionInScore),
			alignment = coordinates.alignment,
			top = coordinates.yCoordinates.top,
			bottom = coordinates.yCoordinates.bottom;

		this._setCoordinates(alignment, top, bottom);
		this.yCoordinates = coordinates.yCoordinates; // maybe I can delete this.yCoordinates? Use currentSystemIndex instead...

		this.setVisible(true);
	}

	msPerPx()
	{
		var
			ms, px,
			leftMsPos = this.msPositions[this.currentMsPositionIndex],
			leftAlignment = this.cursorCoordinatesMap.get(leftMsPos).alignment,
			rightMsPos = this.endMarkerMsPosInScore,
			rightAlignment;

		if((this.currentMsPositionIndex + 1) < this.msPositions.length)
		{
			rightMsPos = this.msPositions[this.currentMsPositionIndex + 1];
			rightAlignment = this.cursorCoordinatesMap.get(rightMsPos).alignment;
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
			leftAlignment = this.cursorCoordinatesMap.get(leftMsPos).alignment,
			rightMsPos = this.endMarkerMsPosInScore,
			rightAlignment;

		// error! the timeMarker should advance smoothly, not just to noteObject positions!
		if((this.currentMsPositionIndex + 1) < this.msPositions.length)
		{
			rightMsPos = this.msPositions[this.currentMsPositionIndex + 1];
			rightAlignment = this.cursorCoordinatesMap.get(rightMsPos).alignment;
		}

		this.msPositionInScore += msIncrement;

		if(rightMsPos < this.msPositionInScore)
		{
			this._moveElementTo(rightMsPos);
		}
	}
}


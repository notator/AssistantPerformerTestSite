import { CursorBase } from "./Cursor.js";

export class TimeMarker extends CursorBase
{
	constructor(systems, cursor, regionSequence)
	{
		function newElement(that, viewBoxScale)
		{
			let element = document.createElementNS("http://www.w3.org/2000/svg", "g"),
				hLine = document.createElementNS("http://www.w3.org/2000/svg", "line"),
				topDiagLine = document.createElementNS("http://www.w3.org/2000/svg", "line"),
				bottomDiagLine = document.createElementNS("http://www.w3.org/2000/svg", "line"),
				vLine = document.createElementNS("http://www.w3.org/2000/svg", "line"),
				strokeColor, hStyle, dStyle, vStyle;

			strokeColor = "stroke:" + that.BLUE;
			hStyle = strokeColor + "; stroke-width:" + (1.5 * viewBoxScale).toString(10);
			dStyle = hStyle + "; stroke-linecap:'square'";
			vStyle = strokeColor + "; stroke-width:" + (1 * viewBoxScale).toString(10);

			hLine.setAttribute("style", hStyle);
			topDiagLine.setAttribute("style", dStyle);
			bottomDiagLine.setAttribute("style", dStyle);
			vLine.setAttribute("style", vStyle);

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

		super(cursor.systemChanged, cursor.msPosDataMap, cursor.viewBoxScale);

		let elem = newElement(this, cursor.viewBoxScale);
		Object.defineProperty(this, "element", { value: elem.element, writable: false });
		Object.defineProperty(this, "hLine", { value: elem.hLine, writable: false });
		Object.defineProperty(this, "topDiagLine", { value: elem.topDiagLine, writable: false });
		Object.defineProperty(this, "bottomDiagLine", { value: elem.bottomDiagLine, writable: false });
		Object.defineProperty(this, "vLine", { value: elem.vLine, writable: false });

		Object.defineProperty(this, "regionSequence", { value: regionSequence, writable: false });
		Object.defineProperty(this, "startRegionIndex", { value: 0, writable: true }); // set in init()
		Object.defineProperty(this, "endRegionIndex", { value: 0, writable: true }); // set in init()
		Object.defineProperty(this, "currentRegionIndex", { value: 0, writable: true }); // set in init()

		// An array containing the (sorted) msPosDataMap keys.
		let msPositionsArray = getMsPositionsArray(cursor.msPosDataMap);
		Object.defineProperty(this, "msPositions", { value: msPositionsArray, writable: false });
		Object.defineProperty(this, "currentMsPositionIndex", { value: 0, writable: true });

		let systemRightAlignment = getSystemRightAlignment(systems[0]);
		Object.defineProperty(this, "systemRightAlignment", { value: systemRightAlignment, writable: false });
		let systemEndMsPositions = getSystemEndMsPositions(systems);
		Object.defineProperty(this, "systemEndMsPositions", { value: systemEndMsPositions, writable: false });
		Object.defineProperty(this, "currentSystemIndex", { value: 0, writable: true });

		Object.defineProperty(this, "startMarker", { value: null, writable: true }); // set in init()
		Object.defineProperty(this, "msPositionInScore", { value: -1, writable: true }); // set in init() - value wrt start of score	
		Object.defineProperty(this, "msPosData", { value: null, writable: true }); // set in  init()
		Object.defineProperty(this, "currentAlignment", { value: 0, writable: true }); // set in  init()
		Object.defineProperty(this, "_totalPxIncrement", { value: 0, writable: true }); // updated at runtime
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

	init(startMarker, startRegionIndex, endRegionIndex)
	{
		this.startMarker = startMarker;
		this.msPositionInScore = startMarker.msPositionInScore;

		this.startRegionIndex = startRegionIndex;
		this.endRegionIndex = endRegionIndex;
		this.currentRegionIndex = startRegionIndex;
		this.currentMsPositionIndex = this.msPositions.findIndex((a) => a === startMarker.msPositionInScore);
		this.currentSystemIndex = this.systemEndMsPositions.findIndex((a) => a > startMarker.msPositionInScore);

		let coordinates = this.msPosDataMap.get(this.msPositionInScore),
			alignment = coordinates.alignment,
			top = coordinates.yCoordinates.top,
			bottom = coordinates.yCoordinates.bottom;

		this._setCoordinates(alignment, top, bottom);
		this.yCoordinates = coordinates.yCoordinates; // maybe I can delete this.yCoordinates? Use currentSystemIndex instead...

		this.msPosData = this.msPosDataMap.get(this.msPositionInScore);
		this.currentAlignment = this.msPosData.alignment;
		this._totalPxIncrement = 0;

		this.setVisible(true);
	}

	_moveElementTo(currentAlignment, msPosData, msIncrement)
	{
		this._totalPxIncrement += (msIncrement * msPosData.pixelsPerMs);
		
		// This 0.5 limit helps to improve the audio output by reducing the number of
		// times the display is updated, but it also means that the grey cursor jumps
		// 0.5 pixels ahead of the TimeMarker on reaching chords and rests, in both
		// conductTimer and conductCreep modes.
		if(this._totalPxIncrement > 0.5)
		{
			let alignment = currentAlignment + this._totalPxIncrement;

			if(this.yCoordinates !== msPosData.yCoordinates)
			{
				this.yCoordinates = msPosData.yCoordinates;
				this._setCoordinates(alignment, this.yCoordinates.top, this.yCoordinates.bottom);
				let yCoordinates = { top: this.yCoordinates.top / this.viewBoxScale, bottom: this.yCoordinates.bottom / this.viewBoxScale };
				this.systemChanged(yCoordinates);
			}
			else
			{
				this._setAlignment(alignment);
			}

			this.currentAlignment = alignment;
			this._totalPxIncrement = 0;
		}
		//else
		//{
		//	console.log("Skipped a display update.");
		//}
	}

	advance(msIncrement)
	{
		let currentRorC_MsPos = this.msPositions[this.currentMsPositionIndex],
			rightMsPos = this.endMarkerMsPosInScore;

		if((this.currentMsPositionIndex + 1) < this.msPositions.length)
		{
			// assumes that this.msPositions contains the position of the final barline.
			rightMsPos = this.msPositions[this.currentMsPositionIndex + 1];
		}

		// The above local variables are for the chords, rests and the final barline in the score.
		// this.msPositionInScore is the accurate current msPosition wrt the start of the score (also between chords and rests).
		this.msPositionInScore += msIncrement;

		if(this.msPositionInScore >= rightMsPos || this.msPositionInScore >= this.regionSequence[this.currentRegionIndex].endMsPosInScore)
		{
			if(this.regionSequence[this.currentRegionIndex].endMsPosInScore <= rightMsPos)
			{
				if(this.currentRegionIndex < this.endRegionIndex)
				{
					// move to the next region
					this.currentRegionIndex++;
					this.msPositionInScore = this.regionSequence[this.currentRegionIndex].startMsPosInScore;
					this.msPosData = this.msPosDataMap.get(this.msPositionInScore);
					this.currentMsPositionIndex = this.msPositions.findIndex((a) => a === this.msPositionInScore);
					this.currentAlignment = this.msPosData.alignment;
					currentRorC_MsPos = this.msPositionInScore;
					msIncrement = 0;
				}
			}
			else if((this.currentMsPositionIndex + 1) < this.msPositions.length)
			{
				this.currentMsPositionIndex++;
				currentRorC_MsPos = this.msPositions[this.currentMsPositionIndex];
				this.msPosData = this.msPosDataMap.get(currentRorC_MsPos);
				this.currentAlignment = this.msPosData.alignment;
				msIncrement = 0;
			}
		}

		this._moveElementTo(this.currentAlignment, this.msPosData, msIncrement);
	}
}


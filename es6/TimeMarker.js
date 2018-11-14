import { CursorBase } from "./Cursor.js";

export class TimeMarker extends CursorBase
{
	constructor(cursor, startMarker, regionSequence, startRegionIndex, endRegionIndex)
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

		super(cursor.systemChangedCallback, cursor.msPosDataArray, cursor.viewBoxScale);

		let elem = newElement(this, cursor.viewBoxScale),
			msPosDataArray = cursor.msPosDataArray,
			currentMsPositionIndex = msPosDataArray.findIndex((a) => a.msPositionInScore === startMarker.msPositionInScore),
			msPosData = msPosDataArray[currentMsPositionIndex],
			currentAlignment = msPosData.alignment,
			nextMsPosInScore = msPosDataArray[currentMsPositionIndex + 1].msPositionInScore, // index + 1 should always work, because final barline is in this.msPosDataArray, but regions can't start there.
			yCoordinates = msPosData.yCoordinates;

		// element and element components
		Object.defineProperty(this, "element", { value: elem.element, writable: false });
		Object.defineProperty(this, "hLine", { value: elem.hLine, writable: false });
		Object.defineProperty(this, "topDiagLine", { value: elem.topDiagLine, writable: false });
		Object.defineProperty(this, "bottomDiagLine", { value: elem.bottomDiagLine, writable: false });
		Object.defineProperty(this, "vLine", { value: elem.vLine, writable: false });

		// constants
		Object.defineProperty(this, "startMarker", { value: startMarker, writable: false });
		Object.defineProperty(this, "regionSequence", { value: regionSequence, writable: false });
		Object.defineProperty(this, "startRegionIndex", { value: startRegionIndex, writable: false });
		Object.defineProperty(this, "endRegionIndex", { value: endRegionIndex, writable: false });

		 // updated at runtime
		Object.defineProperty(this, "msPositionInScore", { value: startMarker.msPositionInScore, writable: true });	
		Object.defineProperty(this, "msPosData", { value: msPosData, writable: true });
		Object.defineProperty(this, "currentRegionIndex", { value: startRegionIndex, writable: true });
		Object.defineProperty(this, "currentAlignment", { value: currentAlignment, writable: true });
		Object.defineProperty(this, "currentMsPositionIndex", { value: currentMsPositionIndex, writable: true });
		Object.defineProperty(this, "nextMsPosInScore", { value: nextMsPosInScore, writable: true });
		Object.defineProperty(this, "yCoordinates", { value: yCoordinates, writable: true });
		Object.defineProperty(this, "_totalPxIncrement", { value: 0, writable: true });
		Object.defineProperty(this, "_isCreeping", { value: false, writable: true });

		this._setCoordinates(this.msPosData.alignment, this.msPosData.yCoordinates.top, this.msPosData.yCoordinates.bottom);
		this.setVisible(true);
	}

	// private function ( called from ctor and advance() )
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

	switchToConductTimer()
	{
		this._isCreeping = false;
	}

	switchToConductCreep()
	{
		this._isCreeping = true;
	}

	advance(msIncrement)
	{
		function moveElementTo(that, msPosData, currentAlignment, nextAlignment, msIncrement)
		{
			function setAlignment(that, alignment)
			{
				let viewBoxScale = that.viewBoxScale,
					hLine = that.hLine,
					topDiagLine = that.topDiagLine,
					bottomDiagLine = that.bottomDiagLine,
					vLine = that.vLine;

				hLine.setAttribute("x1", (alignment - (13.9 * viewBoxScale)).toString(10));
				hLine.setAttribute("x2", (alignment - (1.7 * viewBoxScale)).toString(10));

				topDiagLine.setAttribute("x1", (alignment - (1.6 * viewBoxScale)).toString(10));
				topDiagLine.setAttribute("x2", (alignment - (5.4 * viewBoxScale)).toString(10));

				bottomDiagLine.setAttribute("x1", (alignment - (1.6 * viewBoxScale)).toString(10));
				bottomDiagLine.setAttribute("x2", (alignment - (5.4 * viewBoxScale)).toString(10));

				vLine.setAttribute("x1", alignment.toString(10));
				vLine.setAttribute("x2", alignment.toString(10));
			}

			that._totalPxIncrement += (msIncrement * msPosData.pixelsPerMs);

			let pxDeltaToCome = nextAlignment - currentAlignment;
			// This 0.5 limit helps to improve the audio output by reducing the number of
			// times the display is updated, but it also means that the grey cursor jumps
			// 0.5 pixels ahead of the TimeMarker on reaching chords and rests, in both
			// conductTimer and conductCreep modes. The use of pxDeltaToCome ensures that
			// this problem is avoided in the final pixels before a chord or rest symbol
			// while creeping.
			if((that._isCreeping && pxDeltaToCome < 3) || (that._totalPxIncrement > 0.5))
			{
				let alignment = currentAlignment + that._totalPxIncrement;

				if(that.yCoordinates !== msPosData.yCoordinates)
				{
					that.yCoordinates = msPosData.yCoordinates;
					that._setCoordinates(alignment, that.yCoordinates.top, that.yCoordinates.bottom);
					let yCoordinates = { top: that.yCoordinates.top / that.viewBoxScale, bottom: that.yCoordinates.bottom / that.viewBoxScale };
					that.systemChangedCallback(yCoordinates);
				}
				else
				{
					setAlignment(that, alignment);
				}

				that.currentAlignment = alignment;
				that._totalPxIncrement = 0;
			}
			//else
			//{
			//	console.log("Skipped a display update.");
			//}
		}

		// this.msPositionInScore is the accurate current msPosition wrt the start of the score (also between chords and rests).
		this.msPositionInScore += msIncrement;

		if(this.msPositionInScore >= this.nextMsPosInScore)
		{
			if(this.regionSequence[this.currentRegionIndex].endMsPosInScore <= this.nextMsPosInScore)
			{
				if(this.currentRegionIndex < this.endRegionIndex)
				{
					// move to the next region
					this.currentRegionIndex++;
					this.msPositionInScore = this.regionSequence[this.currentRegionIndex].startMsPosInScore;
					this.msPosData = this.msPosDataArray.find((a) => a.msPositionInScore === this.msPositionInScore);
					this.currentMsPositionIndex = this.msPosDataArray.findIndex((e) => e === this.msPosData);
					this.currentAlignment = this.msPosData.alignment;

					// index + 1 should always work, because the final barline is in this.msPosDataArray, but regions can't start there.
					this.nextMsPosInScore = this.msPosDataArray[this.currentMsPositionIndex + 1].msPositionInScore;
					msIncrement = 0;
				}
			}
			else
			{
				// move to the next chord or rest in the region
				this.currentMsPositionIndex++;				
				this.msPosData = this.msPosDataArray[this.currentMsPositionIndex];
				this.currentAlignment = this.msPosData.alignment;

				// index + 1 should always work, because the final barline is in this.msPosDataArray, but regions end before that.
				this.nextMsPosInScore = this.msPosDataArray[this.currentMsPositionIndex + 1].msPositionInScore;
				msIncrement = 0;
			}
		}

		moveElementTo(this, this.msPosData, this.currentAlignment, this.nextMsPosInScore, msIncrement);
	}
}


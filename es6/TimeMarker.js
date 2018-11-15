import { CursorBase } from "./Cursor.js";

let
	_viewBoxScale,
	_hLine,
	_topDiagLine,
	_bottomDiagLine,
	_vLine,
	_setAlignment = function(alignment)
	{
		_hLine.setAttribute("x1", (alignment - (13.9 * _viewBoxScale)).toString(10));
		_hLine.setAttribute("x2", (alignment - (1.7 * _viewBoxScale)).toString(10));

		_topDiagLine.setAttribute("x1", (alignment - (1.6 * _viewBoxScale)).toString(10));
		_topDiagLine.setAttribute("x2", (alignment - (5.4 * _viewBoxScale)).toString(10));

		_bottomDiagLine.setAttribute("x1", (alignment - (1.6 * _viewBoxScale)).toString(10));
		_bottomDiagLine.setAttribute("x2", (alignment - (5.4 * _viewBoxScale)).toString(10));

		_vLine.setAttribute("x1", alignment.toString(10));
		_vLine.setAttribute("x2", alignment.toString(10));
	},

	_setCoordinates = function(alignment, top, bottom)
	{
		_hLine.setAttribute("x1", (alignment - (13.9 * _viewBoxScale)).toString(10));
		_hLine.setAttribute("y1", (top + (10 * _viewBoxScale)).toString(10));
		_hLine.setAttribute("x2", (alignment - (1.7 * _viewBoxScale)).toString(10));
		_hLine.setAttribute("y2", (top + (10 * _viewBoxScale)).toString(10));

		_topDiagLine.setAttribute("x1", (alignment - (1.6 * _viewBoxScale)).toString(10));
		_topDiagLine.setAttribute("y1", (top + (10 * _viewBoxScale)).toString(10));
		_topDiagLine.setAttribute("x2", (alignment - (5.4 * _viewBoxScale)).toString(10));
		_topDiagLine.setAttribute("y2", (top + (6 * _viewBoxScale)).toString(10));

		_bottomDiagLine.setAttribute("x1", (alignment - (1.6 * _viewBoxScale)).toString(10));
		_bottomDiagLine.setAttribute("y1", (top + (10 * _viewBoxScale)).toString(10));
		_bottomDiagLine.setAttribute("x2", (alignment - (5.4 * _viewBoxScale)).toString(10));
		_bottomDiagLine.setAttribute("y2", (top + (14 * _viewBoxScale)).toString(10));

		_vLine.setAttribute("x1", alignment.toString(10));
		_vLine.setAttribute("y1", top.toString(10));
		_vLine.setAttribute("x2", alignment.toString(10));
		_vLine.setAttribute("y2", bottom.toString(10));
	},

	_newElement = function(that, viewBoxScaleArg)
	{
		const BLUE = "#5555FF";

		let element = document.createElementNS("http://www.w3.org/2000/svg", "g"),
			strokeColor = "stroke:" + BLUE,
			hStyle = strokeColor + "; stroke-width:" + (1.5 * viewBoxScaleArg).toString(10),
			dStyle = hStyle + "; stroke-linecap:'square'",
			vStyle = strokeColor + "; stroke-width:" + (1 * viewBoxScaleArg).toString(10);

		_viewBoxScale = viewBoxScaleArg;
		_hLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
		_topDiagLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
		_bottomDiagLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
		_vLine = document.createElementNS("http://www.w3.org/2000/svg", "line");

		_hLine.setAttribute("style", hStyle);
		_topDiagLine.setAttribute("style", dStyle);
		_bottomDiagLine.setAttribute("style", dStyle);
		_vLine.setAttribute("style", vStyle);

		element.appendChild(_hLine);
		element.appendChild(_topDiagLine);
		element.appendChild(_bottomDiagLine);
		element.appendChild(_vLine);

		return element;
	};

export class TimeMarker extends CursorBase
{
	constructor(cursor, startMarker, regionSequence, startRegionIndex, endRegionIndex)
	{
		super(cursor.systemChangedCallback, cursor.msPosDataArray, cursor.viewBoxScale);

		let element = _newElement(this, cursor.viewBoxScale),
			msPosDataArray = cursor.msPosDataArray,
			currentMsPositionIndex = msPosDataArray.findIndex((a) => a.msPositionInScore === startMarker.msPositionInScore),
			msPosData = msPosDataArray[currentMsPositionIndex],
			currentAlignment = msPosData.alignment,
			nextMsPosData = msPosDataArray[currentMsPositionIndex + 1], // index + 1 should always work, because final barline is in this.msPosDataArray, but regions can't start there.
			yCoordinates = msPosData.yCoordinates;

		// element
		Object.defineProperty(this, "element", { value: element, writable: false });

		// constants
		Object.defineProperty(this, "startMarker", { value: startMarker, writable: false });
		Object.defineProperty(this, "regionSequence", { value: regionSequence, writable: false });
		Object.defineProperty(this, "startRegionIndex", { value: startRegionIndex, writable: false });
		Object.defineProperty(this, "endRegionIndex", { value: endRegionIndex, writable: false });

		 // updated at runtime
		Object.defineProperty(this, "msPositionInScore", { value: startMarker.msPositionInScore, writable: true });	
		Object.defineProperty(this, "msPosData", { value: msPosData, writable: true });
		Object.defineProperty(this, "nextMsPosData", { value: nextMsPosData, writable: true });
		Object.defineProperty(this, "currentRegionIndex", { value: startRegionIndex, writable: true });
		Object.defineProperty(this, "currentAlignment", { value: currentAlignment, writable: true });
		Object.defineProperty(this, "currentMsPositionIndex", { value: currentMsPositionIndex, writable: true });

		Object.defineProperty(this, "yCoordinates", { value: yCoordinates, writable: true });
		Object.defineProperty(this, "_totalPxIncrement", { value: 0, writable: true });
		Object.defineProperty(this, "_isCreeping", { value: false, writable: true });

		_setCoordinates(msPosData.alignment, msPosData.yCoordinates.top, msPosData.yCoordinates.bottom);
	}

	switchToConductTimer()
	{
		this._isCreeping = false;
	}

	switchToConductCreep()
	{
		this._isCreeping = true;
	}

	getElement()
	{
		return this.element;
	}

	getPixelsPerMs()
	{
		return this.msPosData.pixelsPerMs;
	}

	advance(msIncrement)
	{
		function moveElementTo(that, msPosData, currentAlignment, nextAlignment, msIncrement)
		{
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
					_setCoordinates(alignment, that.yCoordinates.top, that.yCoordinates.bottom);
					let yCoordinates = { top: that.yCoordinates.top / _viewBoxScale, bottom: that.yCoordinates.bottom / _viewBoxScale };
					that.systemChangedCallback(yCoordinates);
				}
				else
				{
					_setAlignment(alignment);
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

		if(this.msPositionInScore >= this.nextMsPosData.msPositionInScore)
		{
			if(this.regionSequence[this.currentRegionIndex].endMsPosInScore <= this.nextMsPosData.msPositionInScore)
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
					this.nextMsPosData = this.msPosDataArray[this.currentMsPositionIndex + 1];
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
				this.nextMsPosData = this.msPosDataArray[this.currentMsPositionIndex + 1];
				msIncrement = 0;
			}
		}

		moveElementTo(this, this.msPosData, this.currentAlignment, this.nextMsPosData.alignment, msIncrement);
	}
}


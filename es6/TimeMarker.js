import { CursorBase } from "./Cursor.js";

let
	_viewBoxScale,

	// SVG line elements
	_vertical,
	_topHoriz,
	_bottomHoriz,
	_arrowHoriz,
	_topDiag,
	_bottomDiag,

	// numbers
	_serifLength,
	_arrowHorizX1,
	_arrowX2,
	_arrowDiagX1,
	_arrowHorizY,
	_arrowTopDiagY1,
	_arrowBottomDiagY1,

	_setAlignment = function(alignment)
	{
		_vertical.setAttribute("x1", alignment.toString(10));
		_vertical.setAttribute("x2", alignment.toString(10));

		_topHoriz.setAttribute("x1", (alignment - _serifLength).toString(10));
		_topHoriz.setAttribute("x2", (alignment + _serifLength).toString(10));

		_bottomHoriz.setAttribute("x1", (alignment - _serifLength).toString(10));
		_bottomHoriz.setAttribute("x2", (alignment + _serifLength).toString(10));

		_arrowHoriz.setAttribute("x1", (alignment - _arrowHorizX1).toString(10));
		_arrowHoriz.setAttribute("x2", (alignment - _arrowX2).toString(10));

		_topDiag.setAttribute("x1", (alignment - _arrowDiagX1).toString(10));
		_topDiag.setAttribute("x2", (alignment - _arrowX2).toString(10));

		_bottomDiag.setAttribute("x1", (alignment - _arrowDiagX1).toString(10));
		_bottomDiag.setAttribute("x2", (alignment - _arrowX2).toString(10));
	},

	_setCoordinates = function(alignment, top, bottom)
	{
		_setAlignment(alignment);

		_vertical.setAttribute("y1", top.toString(10));
		_vertical.setAttribute("y2", bottom.toString(10));

		_topHoriz.setAttribute("y1", (top.toString(10)));
		_topHoriz.setAttribute("y2", (top.toString(10)));

		_bottomHoriz.setAttribute("y1", (bottom.toString(10)));
		_bottomHoriz.setAttribute("y2", (bottom.toString(10)));

		_arrowHoriz.setAttribute("y1", (top + _arrowHorizY).toString(10));
		_arrowHoriz.setAttribute("y2", (top + _arrowHorizY).toString(10));

		_topDiag.setAttribute("y1", (top + _arrowTopDiagY1).toString(10));
		_topDiag.setAttribute("y2", (top + _arrowHorizY).toString(10));

		_bottomDiag.setAttribute("y1", (top + _arrowBottomDiagY1).toString(10));
		_bottomDiag.setAttribute("y2", (top + _arrowHorizY).toString(10));
	},

	_setCreepStyle = function(toCreep)
	{
		if(toCreep === true)
		{
			_arrowHoriz.style.visibility = "visible";
			_topDiag.style.visibility = "visible";
			_bottomDiag.style.visibility = "visible";
		}
		else
		{
			_arrowHoriz.style.visibility = "hidden";
			_topDiag.style.visibility = "hidden";
			_bottomDiag.style.visibility = "hidden";
		}
		return toCreep;
	},

	_newElement = function(viewBoxScaleArg)
	{
		function setBasicCoordinates(viewBoxScale)
		{
			let arrowDiagWidthAndHeight = 4 * viewBoxScale;

			_viewBoxScale = viewBoxScale;
			_serifLength = 4 * viewBoxScale;
			_arrowHorizX1 = 13.9 * viewBoxScale; // left end of arrow horizontal line
			_arrowX2 = 1.7 * viewBoxScale; // right end of arrow horizontal line 
			_arrowDiagX1 = arrowDiagWidthAndHeight + _arrowX2;
			_arrowHorizY = 10 * viewBoxScale; // height of arrow horizontal line
			_arrowTopDiagY1 = _arrowHorizY - arrowDiagWidthAndHeight;
			_arrowBottomDiagY1 = _arrowHorizY + arrowDiagWidthAndHeight;
		}

		setBasicCoordinates(viewBoxScaleArg);

		const BLUE = "#5555FF";

		let element = document.createElementNS("http://www.w3.org/2000/svg", "g"), 
			strokeColor = "stroke:" + BLUE,
			arrowStrokeWidth = 1.5 * viewBoxScaleArg,
			hStyle = strokeColor + "; stroke-width:" + arrowStrokeWidth.toString(10),
			dStyle = hStyle + "; stroke-linecap:square",
			verticalStrokeWidth = 1 * viewBoxScaleArg,
			vStyle = strokeColor + "; stroke-width:" + verticalStrokeWidth.toString(10);

		_vertical = document.createElementNS("http://www.w3.org/2000/svg", "line");
		_topHoriz = document.createElementNS("http://www.w3.org/2000/svg", "line");
		_bottomHoriz = document.createElementNS("http://www.w3.org/2000/svg", "line");
		_arrowHoriz = document.createElementNS("http://www.w3.org/2000/svg", "line");
		_topDiag = document.createElementNS("http://www.w3.org/2000/svg", "line");
		_bottomDiag = document.createElementNS("http://www.w3.org/2000/svg", "line");

		_vertical.setAttribute("style", vStyle);
		_topHoriz.setAttribute("style", vStyle);
		_bottomHoriz.setAttribute("style", vStyle);
		_arrowHoriz.setAttribute("style", hStyle);
		_topDiag.setAttribute("style", dStyle);
		_bottomDiag.setAttribute("style", dStyle);

		element.appendChild(_vertical);
		element.appendChild(_topHoriz);
		element.appendChild(_bottomHoriz);
		element.appendChild(_arrowHoriz);
		element.appendChild(_topDiag);
		element.appendChild(_bottomDiag);

		return element;
	};

export class TimeMarker extends CursorBase
{
	constructor(cursor, startMarker, regionSequence, startRegionIndex, endRegionIndex)
	{
		super(cursor.systemChangedCallback, cursor.msPosDataArray, cursor.viewBoxScale);

		let msPosDataArray = cursor.msPosDataArray,
			currentMsPosDataIndex = msPosDataArray.findIndex((a) => a.msPositionInScore === startMarker.msPositionInScore),
			msPosData = msPosDataArray[currentMsPosDataIndex],
			nextMsPosData = msPosDataArray[currentMsPosDataIndex + 1], // index + 1 should always work, because final barline is in this.msPosDataArray, but regions can't start there.
			yCoordinates = msPosData.yCoordinates;

		// constants
		Object.defineProperty(this, "_element", { value: _newElement(cursor.viewBoxScale), writable: false });
		Object.defineProperty(this, "_regionSequence", { value: regionSequence, writable: false });
		Object.defineProperty(this, "_endRegionIndex", { value: endRegionIndex, writable: false });

		 // updated while running
		Object.defineProperty(this, "_msPositionInScore", { value: startMarker.msPositionInScore, writable: true });	
		Object.defineProperty(this, "_msPosData", { value: msPosData, writable: true });
		Object.defineProperty(this, "_nextMsPosData", { value: nextMsPosData, writable: true });
		Object.defineProperty(this, "_regionIndex", { value: startRegionIndex, writable: true });
		Object.defineProperty(this, "_msPosDataIndex", { value: currentMsPosDataIndex, writable: true });
		Object.defineProperty(this, "_yCoordinates", { value: yCoordinates, writable: true });
		Object.defineProperty(this, "_alignment", { value: msPosData.alignment, writable: true });
		Object.defineProperty(this, "_totalPxIncrement", { value: 0, writable: true });
		Object.defineProperty(this, "_isCreeping", { value: false, writable: true });

		_setCoordinates(msPosData.alignment, msPosData.yCoordinates.top, msPosData.yCoordinates.bottom);
		_setCreepStyle(false);
	}

	switchToConductTimer()
	{
		this._isCreeping = _setCreepStyle(false);
	}

	switchToConductCreep()
	{
		this._isCreeping = _setCreepStyle(true);
	}

	getElement()
	{
		return this._element;
	}

	getPixelsPerMs()
	{
		return this._msPosData.pixelsPerMs;
	}

	advance(msIncrement)
	{
		function moveElementTo(that, currentMsPosData, currentPreciseAlignment, nextAlignment, msIncrement)
		{
			that._totalPxIncrement += (msIncrement * currentMsPosData.pixelsPerMs);

			let pxDeltaToCome = nextAlignment - currentPreciseAlignment;
			// This 0.5 limit helps to improve the audio output by reducing the number of
			// times the display is updated, but it also means that the grey cursor jumps
			// 0.5 pixels ahead of the TimeMarker on reaching chords and rests, in both
			// conductTimer and conductCreep modes. The use of pxDeltaToCome ensures that
			// this problem is avoided in the final pixels before a chord or rest symbol
			// while creeping.
			if((that._isCreeping && pxDeltaToCome < 3) || (that._totalPxIncrement > 0.5))
			{
				let alignment = currentPreciseAlignment + that._totalPxIncrement;

				if(that._yCoordinates !== currentMsPosData.yCoordinates)
				{
					that._yCoordinates = currentMsPosData.yCoordinates;
					_setCoordinates(alignment, that._yCoordinates.top, that._yCoordinates.bottom);
					let yCoordinates = { top: that._yCoordinates.top / _viewBoxScale, bottom: that._yCoordinates.bottom / _viewBoxScale };
					that.systemChangedCallback(yCoordinates);
				}
				else
				{
					_setAlignment(alignment);
				}

				that._alignment = alignment;
				that._totalPxIncrement = 0;
			}
			//else
			//{
			//	console.log("Skipped a display update.");
			//}
		}

		// this._msPositionInScore is the accurate current msPosition wrt the start of the score (also between chords and rests).
		this._msPositionInScore += msIncrement;

		if(this._msPositionInScore >= this._nextMsPosData.msPositionInScore)
		{
			if(this._regionSequence[this._regionIndex].endMsPosInScore <= this._nextMsPosData.msPositionInScore)
			{
				if(this._regionIndex < this._endRegionIndex)
				{
					// move to the next region
					this._regionIndex++;
					this._msPositionInScore = this._regionSequence[this._regionIndex].startMsPosInScore;
					this._msPosData = this.msPosDataArray.find((a) => a.msPositionInScore === this._msPositionInScore);
					this._msPosDataIndex = this.msPosDataArray.findIndex((e) => e === this._msPosData);
					this._alignment = this._msPosData.alignment;

					// index + 1 should always work, because the final barline is in this.msPosDataArray, but regions can't start there.
					this._nextMsPosData = this.msPosDataArray[this._msPosDataIndex + 1];
					msIncrement = 0;
				}
			}
			else
			{
				// move to the next chord or rest in the region
				this._msPosDataIndex++;				
				this._msPosData = this.msPosDataArray[this._msPosDataIndex];
				this._alignment = this._msPosData.alignment;
				// index + 1 should always work, because the final barline is in this.msPosDataArray, but regions end before that.
				this._nextMsPosData = this.msPosDataArray[this._msPosDataIndex + 1];
				msIncrement = 0;
			}
		}

		moveElementTo(this, this._msPosData, this._alignment, this._nextMsPosData.alignment, msIncrement);
	}
}


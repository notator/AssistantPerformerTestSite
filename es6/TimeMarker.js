import { CursorBase } from "./Cursor.js";

let
	_viewBoxScale,
	_arrowHorizLine,
	_topHorizLine,
	_bottomHorizLine,
	_topDiagLine,
	_bottomDiagLine,
	_vLine,

	_setAlignment = function(alignment)
	{
		_vLine.setAttribute("x1", alignment.toString(10));
		_vLine.setAttribute("x2", alignment.toString(10));

		_topHorizLine.setAttribute("x1", (alignment - (4 * _viewBoxScale)).toString(10));
		_topHorizLine.setAttribute("x2", (alignment + (4 * _viewBoxScale)).toString(10));

		_bottomHorizLine.setAttribute("x1", (alignment - (4 * _viewBoxScale)).toString(10));
		_bottomHorizLine.setAttribute("x2", (alignment + (4 * _viewBoxScale)).toString(10));

		_arrowHorizLine.setAttribute("x1", (alignment - (13.9 * _viewBoxScale)).toString(10));
		_arrowHorizLine.setAttribute("x2", (alignment - (1.7 * _viewBoxScale)).toString(10));

		_topDiagLine.setAttribute("x1", (alignment - (1.6 * _viewBoxScale)).toString(10));
		_topDiagLine.setAttribute("x2", (alignment - (5.4 * _viewBoxScale)).toString(10));

		_bottomDiagLine.setAttribute("x1", (alignment - (1.6 * _viewBoxScale)).toString(10));
		_bottomDiagLine.setAttribute("x2", (alignment - (5.4 * _viewBoxScale)).toString(10));
	},

	_setCoordinates = function(alignment, top, bottom)
	{

		_vLine.setAttribute("x1", alignment.toString(10));
		_vLine.setAttribute("y1", top.toString(10));
		_vLine.setAttribute("x2", alignment.toString(10));
		_vLine.setAttribute("y2", bottom.toString(10));

		_topHorizLine.setAttribute("x1", (alignment - (4 * _viewBoxScale)).toString(10));
		_topHorizLine.setAttribute("y1", (top.toString(10)));
		_topHorizLine.setAttribute("x2", (alignment + (4 * _viewBoxScale)).toString(10));
		_topHorizLine.setAttribute("y2", (top.toString(10)));

		_bottomHorizLine.setAttribute("x1", (alignment - (4 * _viewBoxScale)).toString(10));
		_bottomHorizLine.setAttribute("y1", (bottom.toString(10)));
		_bottomHorizLine.setAttribute("x2", (alignment + (4 * _viewBoxScale)).toString(10));
		_bottomHorizLine.setAttribute("y2", (bottom.toString(10)));

		_arrowHorizLine.setAttribute("x1", (alignment - (13.9 * _viewBoxScale)).toString(10));
		_arrowHorizLine.setAttribute("y1", (top + (10 * _viewBoxScale)).toString(10));
		_arrowHorizLine.setAttribute("x2", (alignment - (1.7 * _viewBoxScale)).toString(10));
		_arrowHorizLine.setAttribute("y2", (top + (10 * _viewBoxScale)).toString(10));

		_topDiagLine.setAttribute("x1", (alignment - (1.6 * _viewBoxScale)).toString(10));
		_topDiagLine.setAttribute("y1", (top + (10 * _viewBoxScale)).toString(10));
		_topDiagLine.setAttribute("x2", (alignment - (5.4 * _viewBoxScale)).toString(10));
		_topDiagLine.setAttribute("y2", (top + (6 * _viewBoxScale)).toString(10));

		_bottomDiagLine.setAttribute("x1", (alignment - (1.6 * _viewBoxScale)).toString(10));
		_bottomDiagLine.setAttribute("y1", (top + (10 * _viewBoxScale)).toString(10));
		_bottomDiagLine.setAttribute("x2", (alignment - (5.4 * _viewBoxScale)).toString(10));
		_bottomDiagLine.setAttribute("y2", (top + (14 * _viewBoxScale)).toString(10));

	},

	_setCreepStyle = function(toCreep)
	{
		if(toCreep === true)
		{
			_arrowHorizLine.style.visibility = "visible";
			_topDiagLine.style.visibility = "visible";
			_bottomDiagLine.style.visibility = "visible";
		}
		else
		{
			_arrowHorizLine.style.visibility = "hidden";
			_topDiagLine.style.visibility = "hidden";
			_bottomDiagLine.style.visibility = "hidden";
		}
		return toCreep;
	},

	_newElement = function(viewBoxScaleArg)
	{
		const BLUE = "#5555FF";

		let element = document.createElementNS("http://www.w3.org/2000/svg", "g"), 
			strokeColor = "stroke:" + BLUE,
			hStyle = strokeColor + "; stroke-width:" + (1.5 * viewBoxScaleArg).toString(10),
			dStyle = hStyle + "; stroke-linecap:square",
			vStyle = strokeColor + "; stroke-width:" + (1 * viewBoxScaleArg).toString(10);

		_viewBoxScale = viewBoxScaleArg;

		_vLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
		_topHorizLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
		_bottomHorizLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
		_arrowHorizLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
		_topDiagLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
		_bottomDiagLine = document.createElementNS("http://www.w3.org/2000/svg", "line");

		_vLine.setAttribute("style", vStyle);
		_topHorizLine.setAttribute("style", vStyle);
		_bottomHorizLine.setAttribute("style", vStyle);
		_arrowHorizLine.setAttribute("style", hStyle);
		_topDiagLine.setAttribute("style", dStyle);
		_bottomDiagLine.setAttribute("style", dStyle);

		element.appendChild(_vLine);
		element.appendChild(_topHorizLine);
		element.appendChild(_bottomHorizLine);
		element.appendChild(_arrowHorizLine);
		element.appendChild(_topDiagLine);
		element.appendChild(_bottomDiagLine);

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


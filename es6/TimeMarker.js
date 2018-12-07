import { CursorBase } from "./Cursor.js";

let
	_viewBoxScale,
	_conductingMode,
	_iMarker,
	_iVertical,
	_iBottomHoriz,
	_creepArrow,
	_element,
	_topAsString,

	_setAlignment = function(alignment)
	{
		_element.setAttribute("transform", "translate(" + alignment.toString(10) + " " + _topAsString + ")");
	},

	// these arguments are in viewBox units, not pixels.
	_setCoordinates = function(alignment, top, bottom)
	{
		_topAsString = top.toString(10);

		let bottomReTop = (bottom - top).toString(10);

		_iVertical.setAttribute("y2", bottomReTop);
		_iBottomHoriz.setAttribute("y1", bottomReTop);
		_iBottomHoriz.setAttribute("y2", bottomReTop);

		_setAlignment(alignment);
	},

	_get_Element = function()
	{
		function getCoordinateVectors(viewBoxScale)
		{
			let x = [-13.9, -9.7, -5.7, -1.5, 0],
				y = [6, 10, 14],
				accH = (y[1] - y[0]) * (x[3] - x[1]) / (x[3] - x[0]);

			y.push(0); // top of I-beam
			y.push(y[1] - accH);
			y.push(y[1] + accH);
			y.sort((a, b) => a - b);

			x.push(-4); // I-beam left
			x.push(4); // I-beam right
			x.sort((a, b) => a - b);

			let rx = [], ry = [];
			x.forEach(a => rx.push(a *= viewBoxScale));
			y.forEach(a => ry.push(a *= viewBoxScale));

			return ({ x:rx, y:ry });
		}

		function getStyles(viewBoxScale)
		{
			const BLUE = "#5555FF";

			let strokeAndFillColor = "stroke:" + BLUE + ";fill:none",
				thickWidth = 1.5 * viewBoxScale,
				thickStyle = strokeAndFillColor + ";stroke-width:" + thickWidth.toString(10),
				thinWidth = 1 * viewBoxScale,
				thinStyle = strokeAndFillColor + ";stroke-width:" + thinWidth.toString(10);

			return ({ thin: thinStyle, thick: thickStyle });
		}

		function get_IMarker(x, y, styles)
		{
			let iMarker = document.createElementNS("http://www.w3.org/2000/svg", "g"),
				iVertical = document.createElementNS("http://www.w3.org/2000/svg", "line"),
				iTopHoriz = document.createElementNS("http://www.w3.org/2000/svg", "line"),
				iBottomHoriz = document.createElementNS("http://www.w3.org/2000/svg", "line");

			iVertical.setAttribute("x1", x[5].toString(10));
			iVertical.setAttribute("x2", x[5].toString(10));
			iVertical.setAttribute("y1", y[0].toString(10));
			iVertical.setAttribute("y2", y[5].toString(10)); // is set again in _setCoordinates
			iVertical.setAttribute("style", styles.thin);

			iTopHoriz.setAttribute("x1", x[3].toString(10));
			iTopHoriz.setAttribute("x2", x[6].toString(10));
			iTopHoriz.setAttribute("y1", y[0].toString(10));
			iTopHoriz.setAttribute("y2", y[0].toString(10));
			iTopHoriz.setAttribute("style", styles.thin);

			iBottomHoriz.setAttribute("x1", x[3].toString(10));
			iBottomHoriz.setAttribute("x2", x[6].toString(10));
			iBottomHoriz.setAttribute("y1", y[5].toString(10)); // is set again in _setCoordinates
			iBottomHoriz.setAttribute("y2", y[5].toString(10)); // is set again in _setCoordinates
			iBottomHoriz.setAttribute("style", styles.thin);

			iMarker.appendChild(iVertical);
			iMarker.appendChild(iTopHoriz);
			iMarker.appendChild(iBottomHoriz);

			_iMarker = iMarker;
			_iVertical = iVertical;
			_iBottomHoriz = iBottomHoriz;
		}
		function get_CreepArrow(x, y, styles)
		{
			let creepArrow = document.createElementNS("http://www.w3.org/2000/svg", "g"),
				creepHoriz = document.createElementNS("http://www.w3.org/2000/svg", "path"),
				creepTip = document.createElementNS("http://www.w3.org/2000/svg", "path");

			creepHoriz.setAttribute("d", "M" + x[0] + " " + y[3] + " " + x[4] + " " + y[3]);
			creepHoriz.setAttribute("style", styles.thick);

			creepTip.setAttribute("d", "M" + x[2] + " " + y[1] + " " + x[4] + " " + y[3] + " " + x[2] + " " + y[5]);
			creepTip.setAttribute("style", styles.thin);

			creepArrow.appendChild(creepHoriz);
			creepArrow.appendChild(creepTip);

			_creepArrow = creepArrow;
		}

		let cv = getCoordinateVectors(_viewBoxScale),
			styles = getStyles(_viewBoxScale),
			element = document.createElementNS("http://www.w3.org/2000/svg", "g"),
			x = cv.x,
			y = cv.y;

		get_IMarker(x, y, styles);
		get_CreepArrow(x, y, styles);

		element.appendChild(_creepArrow);
		element.appendChild(_iMarker);

		_element = element;
	};

export class TimeMarker extends CursorBase
{
	constructor(cursor, startMarker, regionSequence, startRegionIndex, endRegionIndex, conductingMode, initialConductingMode)
	{
		super(cursor.systemChangedCallback, cursor.msPosDataArray, cursor.viewBoxScale);

		let msPosDataArray = cursor.msPosDataArray,
			currentMsPosDataIndex = msPosDataArray.findIndex((a) => a.msPositionInScore === startMarker.msPositionInScore),
			msPosData = msPosDataArray[currentMsPosDataIndex],
			nextMsPosData = msPosDataArray[currentMsPosDataIndex + 1], // index + 1 should always work, because final barline is in this.msPosDataArray, but regions can't start there.
			yCoordinates = msPosData.yCoordinates;

		_viewBoxScale = cursor.viewBoxScale;
		_conductingMode = conductingMode;
		_get_Element();

		// constants
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

		_setCoordinates(msPosData.alignment, msPosData.yCoordinates.top, msPosData.yCoordinates.bottom);
		this.setStyle(initialConductingMode);
	}

	mode()
	{
		let mode = _conductingMode.timer;

		if(_creepArrow.style.visibility.localeCompare("visible"))
		{
			mode = _conductingMode.creep;
		}

		return mode;
	}

	setStyle(conductingMode)
	{
		switch(conductingMode)
		{
			case _conductingMode.timer:
				_iMarker.style.visibility = "visible";
				_creepArrow.style.visibility = "hidden";
				break;
			case _conductingMode.creep:
				_iMarker.style.visibility = "visible";
				_creepArrow.style.visibility = "visible";
				break;
			case _conductingMode.off:
				_iMarker.style.visibility = "hidden";
				_creepArrow.style.visibility = "hidden";
				break;
			default:
				throw "unknown or illegal conductingMode";
		}
	}

	getElement()
	{
		return _element;
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


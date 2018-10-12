
export class CursorBase
{
	constructor(systemChanged, cursorCoordinatesMap, endMarkerMsPosInScore, viewBoxScale)
	{
		Object.defineProperty(this, "systemChanged", { value: systemChanged, writable: false });
		Object.defineProperty(this, "cursorCoordinatesMap", { value: cursorCoordinatesMap, writable: false });
		Object.defineProperty(this, "endMarkerMsPosInScore", { value: endMarkerMsPosInScore, writable: false });
		Object.defineProperty(this, "viewBoxScale", { value: viewBoxScale, writable: false });

		Object.defineProperty(this, "yCoordinates", { value: cursorCoordinatesMap.get(0).yCoordinates, writable: true });
	}

	setVisible(setToVisible)
	{
		if(setToVisible)
		{
			this.element.style.visibility = 'visible';
		}
		else
		{
			this.element.style.visibility = 'hidden';
		}
	}
}

export class Cursor extends CursorBase
{
	constructor(endMarkerMsPosInScore, systems, viewBoxScale, systemChanged)
	{
		function newElement(firstCursorCoordinates, viewBoxScale)
		{
			let element = document.createElementNS("http://www.w3.org/2000/svg", 'line'),
				yCoordinates = firstCursorCoordinates.yCoordinates, alignment = firstCursorCoordinates.alignment;

			element.setAttribute("class", "cursorLine");
			element.setAttribute("x1", alignment.toString(10));
			element.setAttribute("y1", yCoordinates.top.toString(10));
			element.setAttribute("x2", alignment.toString(10));
			element.setAttribute("y2", yCoordinates.bottom.toString(10));
			element.setAttribute("style", "stroke:#999999; stroke-width:" + viewBoxScale.toString(10) + "px; visibility:hidden");

			return element;
		}

		// returns a Map that relates every msPositionInScore to a CursorCoordinates object.
		// the map does not contain an entry for the final barline
		function getScoreCursorCoordinatesMap(systems, viewBoxScale)
		{
			function getSystemCursorCoordinatesMap(system, viewBoxScale)
			{
				let systemCCMap = new Map(),
					nStaves = system.staves.length,
					line = system.startMarker.line,
					yCoordinates = {};

				yCoordinates.top = line.y1.baseVal.value;
				yCoordinates.bottom = line.y2.baseVal.value;

				for(let staffIndex = 0; staffIndex < nStaves; ++staffIndex)
				{
					let staff = system.staves[staffIndex], nVoices = staff.voices.length;
					for(let voiceIndex = 0; voiceIndex < nVoices; ++voiceIndex)
					{
						if(staff.voices[voiceIndex].timeObjects === undefined)
						{
							// this can happen if the voice is an InputVoice, and the input device is not selected.
							continue;
						}
						let timeObjects = staff.voices[voiceIndex].timeObjects, nTimeObjects = timeObjects.length - 1; // timeObjects includes the final barline in the voice (=system) (don't use it here)
						if(staffIndex === 0 && voiceIndex === 0)
						{
							for(let ti = 0; ti < nTimeObjects; ++ti)
							{
								let tObj = timeObjects[ti], msPos = tObj.msPositionInScore;
								if(msPos < endMarkerMsPosInScore)
								{
									let cursorCoordinates = { alignment: tObj.alignment * viewBoxScale, yCoordinates: yCoordinates };
									systemCCMap.set(msPos, cursorCoordinates);
								}
							}
						}
						else
						{
							for(let ti = nTimeObjects - 1; ti >= 0; --ti)
							{
								let tObj = timeObjects[ti], tObjPos = tObj.msPositionInScore;
								if(systemCCMap.get(tObjPos) === undefined)
								{
									let cursorCoordinates = { alignment: tObj.alignment * viewBoxScale, yCoordinates: yCoordinates };
									systemCCMap.set(tObjPos, cursorCoordinates);
								}
							}
						}
					}
				}
				return systemCCMap;
			}

			let cursorCoordinatesMap = new Map();
			for(let system of systems)
			{
				let systemSims = getSystemCursorCoordinatesMap(system, viewBoxScale);
				for(let entry of systemSims.entries())
				{
					cursorCoordinatesMap.set(entry[0], entry[1]);
				}
			}
			return cursorCoordinatesMap;
		}

		let cursorCoordinatesMap = getScoreCursorCoordinatesMap(systems, viewBoxScale); // does not include the endMarkerMsPosInScore.
		super(systemChanged, cursorCoordinatesMap, endMarkerMsPosInScore, viewBoxScale);

		let element = newElement(cursorCoordinatesMap.get(0), viewBoxScale);
		Object.defineProperty(this, "element", { value: element, writable: false });
	}

	moveElementTo(msPositionInScore)
	{
		if(msPositionInScore === this.endMarkerMsPosInScore)
		{
			this.setVisible(false);
		}
		else
		{
			let cursorCoordinates = this.cursorCoordinatesMap.get(msPositionInScore);
			if(cursorCoordinates !== undefined)
			{
				if(cursorCoordinates.yCoordinates !== this.yCoordinates)
				{
					this.yCoordinates = cursorCoordinates.yCoordinates;
					this.element.setAttribute("y1", this.yCoordinates.top.toString(10));
					this.element.setAttribute("y2", this.yCoordinates.bottom.toString(10));
					let yCoordinates = { top: this.yCoordinates.top / this.viewBoxScale, bottom: this.yCoordinates.bottom / this.viewBoxScale };
					this.systemChanged(yCoordinates);
				}
				this.element.setAttribute("x1", cursorCoordinates.alignment.toString(10));
				this.element.setAttribute("x2", cursorCoordinates.alignment.toString(10));
			}
		}
	}
}



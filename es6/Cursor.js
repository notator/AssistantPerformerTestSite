
export class Cursor
{
	constructor(markersLayer, endMarkerMsPosInScore, systems, viewBoxScale, systemChanged)
	{
		this.scoreCursorCoordinatesMap = new Map(); // msPositionInScore, cursorCoordinates
		this.yCoordinates = { top: 0, bottom: 0 };
		this.endMarkerMsPosInScore = endMarkerMsPosInScore;
		this.setScoreCursorCoordinates(systems, viewBoxScale); // does not include the endMarkerMsPosInScore.
		let firstCursorCoordinates = this.scoreCursorCoordinatesMap.get(0);
		if(firstCursorCoordinates !== undefined)
		{
			this.yCoordinates = firstCursorCoordinates.yCoordinates;
			this.line = this.newCursorLine(firstCursorCoordinates, viewBoxScale);
			markersLayer.appendChild(this.line);
		}
		this.viewBoxScale = viewBoxScale;
		this.systemChanged = systemChanged;
	}

	// returns a Map that relates every msPositionInScore to a CursorCoordinates object.
	// the map does not contain an entry for the final barline
	setScoreCursorCoordinates(systems, viewBoxScale)
	{
		let scoreCCs = this.scoreCursorCoordinatesMap; // currently empty
		for(let system of systems)
		{
			let systemSims = this.getSystemCursorCoordinates(system, viewBoxScale);
			for(let entry of systemSims.entries())
			{
				scoreCCs.set(entry[0], entry[1]);
			}
		}
	}

	getSystemCursorCoordinates(system, viewBoxScale)
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
						if(msPos < this.endMarkerMsPosInScore)
						{
							let cursorCoordinates = { alignment: tObj.alignment * viewBoxScale, yCoordinates: yCoordinates};
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

	newCursorLine(firstCursorCoordinates, viewBoxScale)
	{
		var cursorLine = document.createElementNS("http://www.w3.org/2000/svg", 'line'), yCoordinates = firstCursorCoordinates.yCoordinates, alignment = firstCursorCoordinates.alignment;
		cursorLine.setAttribute("class", "cursorLine");
		cursorLine.setAttribute("x1", alignment.toString(10));
		cursorLine.setAttribute("y1", yCoordinates.top.toString(10));
		cursorLine.setAttribute("x2", alignment.toString(10));
		cursorLine.setAttribute("y2", yCoordinates.bottom.toString(10));
		cursorLine.setAttribute("style", "stroke:#999999; stroke-width:" + viewBoxScale.toString(10) + "px; visibility:hidden");
		return cursorLine;
	}
	/*--- end of constructor --------------------*/

	/*--- begin setup ---------------------------*/
	setVisible(setToVisible)
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
	/*--- end setup ------------------------*/
	/*--- begin runtime --------------------*/
	moveCursorLineTo(msPositionInScore)
	{
		if(msPositionInScore === this.endMarkerMsPosInScore)
		{
			this.setVisible(false);
		}
		else
		{
			let cursorCoordinates = this.scoreCursorCoordinatesMap.get(msPositionInScore);
			if(cursorCoordinates !== undefined)
			{
				if(cursorCoordinates.yCoordinates !== this.yCoordinates)
				{
					this.yCoordinates = cursorCoordinates.yCoordinates;
					this.line.setAttribute("y1", this.yCoordinates.top.toString(10));
					this.line.setAttribute("y2", this.yCoordinates.bottom.toString(10));
					let yCoordinates = { top: this.yCoordinates.top / this.viewBoxScale, bottom: this.yCoordinates.bottom / this.viewBoxScale };
					this.systemChanged(yCoordinates);
				}
				this.line.setAttribute("x1", cursorCoordinates.alignment.toString(10));
				this.line.setAttribute("x2", cursorCoordinates.alignment.toString(10));
			}
		}
	}
}


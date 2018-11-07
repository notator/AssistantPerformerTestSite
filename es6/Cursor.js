
export class CursorBase
{
	constructor(systemChanged, msPosDataMap, viewBoxScale)
	{
		Object.defineProperty(this, "GREY", { value: "#999999", writable: false });
		Object.defineProperty(this, "BLUE", { value: "#5555FF", writable: false });

		Object.defineProperty(this, "systemChanged", { value: systemChanged, writable: false });
		Object.defineProperty(this, "msPosDataMap", { value: msPosDataMap, writable: false });
		Object.defineProperty(this, "viewBoxScale", { value: viewBoxScale, writable: false });

		Object.defineProperty(this, "startMarkerMsPosInScore", { value: -1, writable: true }); // set in init()
		Object.defineProperty(this, "endMarkerMsPosInScore", { value: -1, writable: true }); // set in init()
		Object.defineProperty(this, "yCoordinates", { value: msPosDataMap.get(0).yCoordinates, writable: true }); // set in init()
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
	constructor(systems, viewBoxScale, systemChanged)
	{
		function newElement(that, firstMsPosData, viewBoxScale)
		{
			let element = document.createElementNS("http://www.w3.org/2000/svg", 'line'),
				yCoordinates = firstMsPosData.yCoordinates, alignment = firstMsPosData.alignment;

			element.setAttribute("class", "cursorLine");
			element.setAttribute("x1", alignment.toString(10));
			element.setAttribute("y1", yCoordinates.top.toString(10));
			element.setAttribute("x2", alignment.toString(10));
			element.setAttribute("y2", yCoordinates.bottom.toString(10));
			element.setAttribute("style", "stroke:" + that.GREY + ";stroke-width:" + viewBoxScale.toString(10) + "px; visibility:hidden");

			return element;
		}

		// returns a Map that relates every msPositionInScore to a MsPosData object.
		// the map does not contain an entry for the final barline
		function getScoreMsPosDataMap(systems, viewBoxScale)
		{
			function getSystemMsPosDataMap(system, viewBoxScale)
			{
				function setPixelsPerMs(systemMsPosDataMap, msPositions)
				{
					let nMsPositions = msPositions.length - 1; // msPositions include final barline
					for(let i = 0; i < nMsPositions; ++i)
					{
						let pos = msPositions[i],
							nextPos = msPositions[i + 1]; // can be final barline
						
						let msPosData = systemMsPosDataMap.get(pos);
						let nextMsPosData = systemMsPosDataMap.get(nextPos);

						msPosData.pixelsPerMs = (nextMsPosData.alignment - msPosData.alignment) / (nextPos - pos);
					}
				}

				let systemMsPosDataMap = new Map(),
					nStaves = system.staves.length,
					line = system.startMarker.line,
					yCoordinates = {},
					msPositions = [];

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
						let timeObjects = staff.voices[voiceIndex].timeObjects,
							nTimeObjects = timeObjects.length; // timeObjects includes the final barline in the voice
						
						if(staffIndex === 0 && voiceIndex === 0)
						{
							for(let ti = 0; ti < nTimeObjects; ++ti)
							{
								let tObj = timeObjects[ti], msPos = tObj.msPositionInScore,
									// pixelsPerMs is set properly later in this functon
									msPosData = { alignment: tObj.alignment * viewBoxScale, pixelsPerMs: 0, yCoordinates: yCoordinates };

								systemMsPosDataMap.set(msPos, msPosData);
								msPositions.push(msPos);
							}
						}
						else
						{
							for(let ti = nTimeObjects - 1; ti >= 0; --ti)
							{
								let tObj = timeObjects[ti], msPos = tObj.msPositionInScore;
								if(systemMsPosDataMap.get(msPos) === undefined)
								{
									// pixelsPerMs is set properly later in this functon
									let msPosData = { alignment: tObj.alignment * viewBoxScale, pixelsPerMs: 0, yCoordinates: yCoordinates };
									systemMsPosDataMap.set(msPos, msPosData);
									msPositions.push(msPos);
								}
							}
						}
					}
				}

				msPositions.sort((a, b) => a - b);
				setPixelsPerMs(systemMsPosDataMap, msPositions);

				let finalBarlineMsPos = msPositions[msPositions.length - 1];
				systemMsPosDataMap.delete(finalBarlineMsPos);

				return systemMsPosDataMap;
			}

			let msPosDataMap = new Map();
			for(let system of systems)
			{
				let systemMsPosDataMap = getSystemMsPosDataMap(system, viewBoxScale);
				for(let entry of systemMsPosDataMap.entries())
				{
					msPosDataMap.set(entry[0], entry[1]);
				}
			}
			return msPosDataMap;
		}

		let msPosDataMap = getScoreMsPosDataMap(systems, viewBoxScale); // does not include the endMarkerMsPosInScore.

		super(systemChanged, msPosDataMap, viewBoxScale);

		let element = newElement(this, msPosDataMap.get(0), viewBoxScale);
		Object.defineProperty(this, "element", { value: element, writable: false });
	}

	init(startMarkerMsPositionInScore, endMarkerMsPositionInScore)
	{
		this.startMarkerMsPosInScore = startMarkerMsPositionInScore;
		this.endMarkerMsPosInScore = endMarkerMsPositionInScore;

		this.moveElementTo(startMarkerMsPositionInScore); // sets yCoordinates if necessary

		this.setVisible(true);
	}

	moveElementTo(msPositionInScore)
	{
		if(msPositionInScore === this.endMarkerMsPosInScore)
		{
			this.setVisible(false);
		}
		else
		{
			let msPosData = this.msPosDataMap.get(msPositionInScore);
			if(msPosData !== undefined)
			{
				if(msPosData.yCoordinates !== this.yCoordinates)
				{
					this.yCoordinates = msPosData.yCoordinates;
					this.element.setAttribute("y1", this.yCoordinates.top.toString(10));
					this.element.setAttribute("y2", this.yCoordinates.bottom.toString(10));
					let yCoordinates = { top: this.yCoordinates.top / this.viewBoxScale, bottom: this.yCoordinates.bottom / this.viewBoxScale };
					this.systemChanged(yCoordinates);
				}
				this.element.setAttribute("x1", msPosData.alignment.toString(10));
				this.element.setAttribute("x2", msPosData.alignment.toString(10));
			}
		}
	}
}



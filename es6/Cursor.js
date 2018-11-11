
export class CursorBase
{
	constructor(systemChangedCallback, msPosDataArray, viewBoxScale)
	{
		Object.defineProperty(this, "GREY", { value: "#999999", writable: false });
		Object.defineProperty(this, "BLUE", { value: "#5555FF", writable: false });

		Object.defineProperty(this, "systemChangedCallback", { value: systemChangedCallback, writable: false });
		Object.defineProperty(this, "msPosDataArray", { value: msPosDataArray, writable: false });
		Object.defineProperty(this, "viewBoxScale", { value: viewBoxScale, writable: false });

		Object.defineProperty(this, "startMarkerMsPosInScore", { value: -1, writable: true }); // set in init()
		Object.defineProperty(this, "endMarkerMsPosInScore", { value: -1, writable: true }); // set in init()
		Object.defineProperty(this, "yCoordinates", { value: msPosDataArray[0].yCoordinates, writable: true }); // set in init()
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
	constructor(systemChangedCallback, systems, viewBoxScale)
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

		// Returns an array containing an msPosData object for every distinct msPositionInScore.
		// An msPosData object contains the following fields:
		//	.msPositionInScore
		//	.alignmentX
		//	.yCoordinates
		//	.pixelsPerMs
		// The msPosData objects are sorted in order of .msPositionInscore.
		// The last entry is an msPosData object for the final barline.
		function getScoreMsPosDataArray(systems, viewBoxScale)
		{
			function getSystemMsPosDataArray(system, viewBoxScale)
			{
				function setPixelsPerMs(systemMsPosDataArray)
				{
					let nMsPositions = systemMsPosDataArray.length - 1; // systemMsPosDataArray contains an entry for the final barline
					for(let i = 0; i < nMsPositions; ++i)
					{
						let msPosData = systemMsPosDataArray[i],
							nextMsPosData = systemMsPosDataArray[i + 1];

						msPosData.pixelsPerMs = (nextMsPosData.alignment - msPosData.alignment) / (nextMsPosData.msPositionInScore - msPosData.msPositionInScore);
					}
				}

				let systemMsPosDataArray = [],
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
						let timeObjects = staff.voices[voiceIndex].timeObjects,
							nTimeObjects = timeObjects.length; // timeObjects includes the final barline in the voice
						
						if(staffIndex === 0 && voiceIndex === 0)
						{
							for(let ti = 0; ti < nTimeObjects; ++ti)
							{
								let tObj = timeObjects[ti], msPos = tObj.msPositionInScore,
									// pixelsPerMs is set properly later in this functon
									msPosData = { msPositionInScore: msPos, alignment: tObj.alignment * viewBoxScale, pixelsPerMs: 0, yCoordinates: yCoordinates };

								systemMsPosDataArray.push(msPosData);
							}
						}
						else
						{
							for(let ti = nTimeObjects - 1; ti >= 0; --ti)
							{
								let tObj = timeObjects[ti], msPos = tObj.msPositionInScore;
								if(systemMsPosDataArray.find((e) => e.msPositionInScore === msPos) === undefined)
								{
									// pixelsPerMs is set properly later in this functon
									let msPosData = { msPositionInScore: msPos, alignment: tObj.alignment * viewBoxScale, pixelsPerMs: 0, yCoordinates: yCoordinates };
									systemMsPosDataArray.push(msPosData);
								}
							}
						}
					}
				}

				systemMsPosDataArray.sort((a, b) => a.msPositionInScore - b.msPositionInScore);
				setPixelsPerMs(systemMsPosDataArray);

				return systemMsPosDataArray;
			}

			let msPosDataArray = [];
			let nSystems = systems.length;
			for(let i = 0; i < nSystems; ++i)
			{
				let system = systems[i];
				// The last entry is an msPosData object for the final barline.
				let systemMsPosDataArray = getSystemMsPosDataArray(system, viewBoxScale);
				if(i < nSystems - 1)
				{
					systemMsPosDataArray.length = systemMsPosDataArray.length - 1;
				}
				msPosDataArray = msPosDataArray.concat(systemMsPosDataArray);
			}
			return msPosDataArray;
		}

		// The last entry is an msPosData object for the final barline.
		let msPosDataArray = getScoreMsPosDataArray(systems, viewBoxScale);

		super(systemChangedCallback, msPosDataArray, viewBoxScale);

		let element = newElement(this, msPosDataArray[0], viewBoxScale);
		Object.defineProperty(this, "element", { value: element, writable: false });
	}

	init(startMarkerMsPositionInScore, endMarkerMsPositionInScore)
	{
		this.startMarkerMsPosInScore = startMarkerMsPositionInScore;
		this.endMarkerMsPosInScore = endMarkerMsPositionInScore;

		this.moveElementTo(startMarkerMsPositionInScore); // sets yCoordinates if necessary

		this.setVisible(true);
	}

	// use running index here if possible...
	moveElementTo(msPositionInScore)
	{
		if(msPositionInScore === this.endMarkerMsPosInScore)
		{
			this.setVisible(false);
		}
		else
		{
			let msPosData = this.msPosDataArray.find((e) => e.msPositionInScore === msPositionInScore);
			if(msPosData !== undefined)
			{
				if(msPosData.yCoordinates !== this.yCoordinates)
				{
					this.yCoordinates = msPosData.yCoordinates;
					this.element.setAttribute("y1", this.yCoordinates.top.toString(10));
					this.element.setAttribute("y2", this.yCoordinates.bottom.toString(10));
					let yCoordinates = { top: this.yCoordinates.top / this.viewBoxScale, bottom: this.yCoordinates.bottom / this.viewBoxScale };
					this.systemChangedCallback(yCoordinates);
				}
				this.element.setAttribute("x1", msPosData.alignment.toString(10));
				this.element.setAttribute("x2", msPosData.alignment.toString(10));
			}
		}
	}
}



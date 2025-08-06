
export class Cursor
{
	constructor(systemChangedCallback, viewBoxScale)
	{
		function newElement(viewBoxScale)
		{
			const GREY = "#999999";

			let element = document.createElementNS("http://www.w3.org/2000/svg", 'line');

			element.setAttribute("class", "cursorLine");
			
			element.style.stroke = GREY;
			element.style.strokeWidth = viewBoxScale.toString(10) + "px";
			element.style.visibility = "hidden";

			// the following attributes are set properly in moveElementTo(...) (inside init(...))
			element.setAttribute("x1", "0");
			element.setAttribute("y1", "0");
			element.setAttribute("x2", "0");
			element.setAttribute("y2", "0");

			return element;
		}

		Object.defineProperty(this, "systemChangedCallback", { value: systemChangedCallback, writable: false });
		Object.defineProperty(this, "viewBoxScale", { value: viewBoxScale, writable: false });
		Object.defineProperty(this, "element", { value: newElement(viewBoxScale), writable: false });

		Object.defineProperty(this, "msPosDataArray", { value: undefined, writable: true }); // set in init()
		Object.defineProperty(this, "startMarkerMsPosInScore", { value: -1, writable: true }); // set in init()
		Object.defineProperty(this, "endMarkerMsPosInScore", { value: -1, writable: true }); // set in init()
		Object.defineProperty(this, "yCoordinates", { value: { top: -1, bottom: -1 }, writable: true }); // set in moveElementTo() in init()		
	}

	set(systems, startMarkerMsPositionInScore, endMarkerMsPositionInScore, trackIsOnArray, interpIndex)
	{
		// Returns an array containing an msPosData object for every distinct msPositionInScore.
		// An msPosData object contains the following fields:
		//	.msPositionInScore
		//	.alignmentX
		//	.yCoordinates
		//  .pixelsPerMs -- used by CreepConductor
		// The msPosData objects are sorted in order of .msPositionInScore.
		// The last entry is an msPosData object for the final barline.
		function getScoreMsPosDataArray(systems, viewBoxScale, trackIsOnArray, interpIndex)
		{
			// This array, containing one msPosData object per system, is needed
			// for the case that when tracks are disabled, there are no midiObjects
			// at the beginning of the system.
			function getDefaultSystemStartMsPosDataArray(systems, viewBoxScale, interpIndex)
			{
				let msPosDataPerSystem = [];

				for(let system of systems)
				{
					let line = system.startMarker.line,
						yCoordinates = {},
						leftmostMidiObject = system.staves[0].voices[0].timeObjects[0][interpIndex],
						// pixelsPerMs is set properly later for CreepConductor
						msPosData = { msPositionInScore: leftmostMidiObject.msPositionInScore, alignment: leftmostMidiObject.alignment * viewBoxScale, pixelsPerMs: 0, yCoordinates: yCoordinates };

					yCoordinates.top = line.y1.baseVal.value;
					yCoordinates.bottom = line.y2.baseVal.value;

					for(let staff of system.staves)
					{
						for(let voice of staff.voices)
						{
							if(voice.timeObjects[0][interpIndex].alignment < leftmostMidiObject.alignment)
							{
								leftmostMidiObject = voice.timeObjects[0][interpIndex];
								// pixelsPerMs is set properly later for CreepConductor
								msPosData = { msPositionInScore: leftmostMidiObject.msPositionInScore, alignment: leftmostMidiObject.alignment * viewBoxScale, pixelsPerMs: 0, yCoordinates: yCoordinates };
							}
						}
					}
					msPosDataPerSystem.push(msPosData);
				}

				return msPosDataPerSystem;
			}

			function getSystemMsPosDataArray(system, viewBoxScale, trackIsOnArray, interpIndex)
			{
				function setPixelsPerMs(systemMsPosDataArray)
				{
					let nMsPositions = systemMsPosDataArray.length; // systemMsPosDataArray contains an entry for the final barline

					for(let i = 0; i < nMsPositions - 1; ++i)
					{
						let msPosData = systemMsPosDataArray[i],
							nextMsPosData = systemMsPosDataArray[i + 1];

						msPosData.pixelsPerMs = (nextMsPosData.alignment - msPosData.alignment) / (nextMsPosData.msPositionInScore - msPosData.msPositionInScore);
					}
					// last barline pixelsPerMs remains 0
				}

				let systemMsPosDataArray = [],
					nStaves = system.staves.length,
					line = system.startMarker.line,
					yCoordinates = {};

				yCoordinates.top = line.y1.baseVal.value;
				yCoordinates.bottom = line.y2.baseVal.value;

				let trackIndex = 0;
				for(let staffIndex = 0; staffIndex < nStaves; ++staffIndex)
				{
					let staff = system.staves[staffIndex], nVoices = staff.voices.length;
					for(let voiceIndex = 0; voiceIndex < nVoices; ++voiceIndex)
					{
						if(trackIsOnArray[trackIndex++] === true)
						{
							let midiObjects = staff.voices[voiceIndex].timeObjects, // timeObjects does not include the final barline in the voice
								nMidiObjects = midiObjects.length; 

							let msPos, msPosData;
							for(let ti = 0; ti < nMidiObjects; ++ti)
							{
								let midiObject = midiObjects[ti][interpIndex];
								msPos = midiObject.msPositionInScore;								
								if(systemMsPosDataArray.find((e) => e.msPositionInScore === msPos) === undefined)
								{
									// pixelsPerMs is set properly later for CreepConductor
									msPosData = {msPositionInScore: msPos, alignment: midiObject.alignment * viewBoxScale, pixelsPerMs: 0, yCoordinates: yCoordinates};
									systemMsPosDataArray.push(msPosData);
								}
							}
							// push the final barline
							if(systemMsPosDataArray.find((e) => e.alignment === system.right) === undefined)
							{
								let lastMidiObject = midiObjects[midiObjects.length - 1][interpIndex];
								msPos = lastMidiObject.msPositionInScore + lastMidiObject.msDurationInScore;
								// pixelsPerMs is set properly later for CreepConductor
								msPosData = {msPositionInScore: msPos, alignment: system.right * viewBoxScale, pixelsPerMs: 0, yCoordinates: yCoordinates};
								systemMsPosDataArray.push(msPosData);
							}
						}
					}
				}

				systemMsPosDataArray.sort((a, b) => a.msPositionInScore - b.msPositionInScore);
				setPixelsPerMs(systemMsPosDataArray);

				return systemMsPosDataArray;
			}

			let defaultSystemStartMsPosData = getDefaultSystemStartMsPosDataArray(systems, viewBoxScale, interpIndex); 
			let msPosDataArray = [];
			let nSystems = systems.length;
			for(let i = 0; i < nSystems; ++i)
			{
				let system = systems[i];
				// The last entry in systemMsPosDataArray is an msPosData object for the final barline.
				let systemMsPosDataArray = getSystemMsPosDataArray(system, viewBoxScale, trackIsOnArray, interpIndex);
				// If there was no msPosData object at the start of the system, insert the default value.
				if(systemMsPosDataArray[0].alignment > defaultSystemStartMsPosData[i].alignment)
				{
					systemMsPosDataArray.splice(0, 0, defaultSystemStartMsPosData[i]);
				}
				// if this is not the last system, delete the msPosData object of the right barline.
				if(i < nSystems - 1)
				{
					systemMsPosDataArray.length = systemMsPosDataArray.length - 1;
				}
				msPosDataArray = msPosDataArray.concat(systemMsPosDataArray);
			}
			return msPosDataArray;
		}

		// The last entry is an msPosData object for the final barline.
		this.msPosDataArray = getScoreMsPosDataArray(systems, this.viewBoxScale, trackIsOnArray, interpIndex);

		this.startMarkerMsPosInScore = startMarkerMsPositionInScore;
		this.endMarkerMsPosInScore = endMarkerMsPositionInScore;

		this.moveElementTo(startMarkerMsPositionInScore); // sets yCoordinates if necessary

		this.setVisible(true);
	}

	// use running index here if possible...
	moveElementTo(msPositionInScore)
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



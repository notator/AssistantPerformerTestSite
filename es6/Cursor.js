
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
		Object.defineProperty(this, "yCoordinates", { value: { top: -1, bottom: -1 }, writable: true }); // set in moveElementTo() in init()		
	}

	set(systems, startMarkerMsPosInScore, tracks, trackIsOnArray, interpIndex, displayRunningCursor)
	{
		// Returns an array containing an msPosData object for every distinct msPosInScore.
		// An msPosData object contains the following fields:
		//	.msPosInScore
		//	.alignmentX
		//	.yCoordinates
		//  .pixelsPerMs -- used by CreepConductor
		// The msPosData objects are sorted in order of .msPosInScore.
		// The last entry is an msPosData object for the final barline.
		function getScoreMsPosDataArray(systems, viewBoxScale, tracks, trackIsOnArray, interpIndex)
		{
			/*

			// Delete the following function completely when tested
			// Test: Try setting the startMarker to the start of a system when the only track that has
			// a midiObject at the start of that system has been disabled.
			// In this case, the startMarker should set itself to the first performable midiObject.
			// This array, containing one msPosData object per system, is needed
			// for the case that when tracks are disabled, there are no midiObjects
			// at the beginning of the system.
			function getDefaultSystemStartMsPosDataArray(systems, viewBoxScale, tracks, trackIsOnArray, interpIndex)
			{
				let msPosDataPerSystem = [];

				function getLeftmostMidiObjectInSystem(system, tracks, trackIsOnArray, interpIndex)
				{
					// system.firstMidiObjectIndexPerTrack[trackIndex] is the index of a midiObject in an interpretation.
					// whereby the interpretation (midiObjectSequence) can be found using the global tracks variable:
					// Each tracks[trackIndex].interpretations[interpIndex][index] contains a particular interpretation of the midiObject at that index.

					let leftmostMidiObjectInSystem;

					for(let trackIndex = 0; trackIndex < trackIsOnArray.length; ++trackIndex)
					{
						if(trackIsOnArray[trackIndex] === true)
						{
							let firstMidiObjectIndex = system.firstMidiObjectIndexPerTrack[trackIndex],
								firstMidiObjectInTrackOnSystem = tracks[trackIndex].interpretations[interpIndex][firstMidiObjectIndex];

							if(leftmostMidiObjectInSystem === undefined || firstMidiObjectInTrackOnSystem.alignment < leftmostMidiObjectInSystem.alignment)
							{
                                leftmostMidiObjectInSystem = firstMidiObjectInTrackOnSystem;
							}
						}
					}

					return leftmostMidiObjectInSystem;
				}

				for(let system of systems)
				{
					let line = system.startMarker.line,
						yCoordinates = {},
						leftmostMidiObject = getLeftmostMidiObjectInSystem(system, tracks, trackIsOnArray, interpIndex),
						// pixelsPerMs is set properly later for CreepConductor
						msPosData = { msPosInScore: leftmostMidiObject.msPosInScore, alignment: leftmostMidiObject.alignment * viewBoxScale, pixelsPerMs: 0, yCoordinates: yCoordinates };

					yCoordinates.top = line.y1.baseVal.value;
					yCoordinates.bottom = line.y2.baseVal.value;

					msPosDataPerSystem.push(msPosData);
				}

				return msPosDataPerSystem;
			}
			*/

			function getSystemMsPosDataArray(system, viewBoxScale, tracks, trackIsOnArray, interpIndex)
			{
				function setPixelsPerMs(systemMsPosDataArray)
				{
					let nMsPositions = systemMsPosDataArray.length; // systemMsPosDataArray contains an entry for the final barline

					for(let i = 0; i < nMsPositions - 1; ++i)
					{
						let msPosData = systemMsPosDataArray[i],
							nextMsPosData = systemMsPosDataArray[i + 1];

						msPosData.pixelsPerMs = (nextMsPosData.alignment - msPosData.alignment) / (nextMsPosData.msPosInScore - msPosData.msPosInScore);
					}
					// last barline pixelsPerMs remains 0
				}

				let systemMsPosDataArray = [],
					line = system.startMarker.line,
					yCoordinates = {};

				yCoordinates.top = line.y1.baseVal.value;
				yCoordinates.bottom = line.y2.baseVal.value;

				// system.firstMidiObjectIndexPerTrack[trackIndex] is the index of a midiObject in an interpretation.
				// whereby the interpretation (midiObjectSequence) can be found using the global tracks variable:
				// Each tracks[trackIndex].interpretations[interpIndex][index] contains a particular interpretation of the midiObject at that index.

				let finalBarlineOnSystemMsPosInScore = system.barlines[system.barlines.length - 1].msPosInScore;
				for(let trackIndex = 0; trackIndex < trackIsOnArray.length; ++trackIndex)
				{
					if(trackIsOnArray[trackIndex] === true)
					{
						let firstMidiObjectIndex = system.firstMidiObjectIndexPerTrack[trackIndex],
							interpretation = tracks[trackIndex].interpretations[interpIndex];

						for(let moIndex = firstMidiObjectIndex; moIndex < interpretation.length; ++moIndex)
						{
							let midiObject = interpretation[moIndex];			

							if(midiObject.msPosInScore >= finalBarlineOnSystemMsPosInScore)
							{
								break;
							}

							let msPos = midiObject.msPosInScore;
							if(systemMsPosDataArray.find((e) => e.msPosInScore === msPos) === undefined)
							{
								// pixelsPerMs is set properly later for CreepConductor
								let msPosData = {msPosInScore: msPos, alignment: midiObject.alignment * viewBoxScale, pixelsPerMs: 0, yCoordinates: yCoordinates};
								systemMsPosDataArray.push(msPosData);
							}
						}
					}
				}

				systemMsPosDataArray.sort((a, b) => a.msPosInScore - b.msPosInScore);
				setPixelsPerMs(systemMsPosDataArray);

				return systemMsPosDataArray;
			}

			// Delete the following completely when tested:
			// let defaultSystemStartMsPosData = getDefaultSystemStartMsPosDataArray(systems, viewBoxScale, tracks, trackIsOnArray, interpIndex); 
			let msPosDataArray = [];
			let nSystems = systems.length;
			for(let systemIndex = 0; systemIndex < nSystems; ++systemIndex)
			{
				let system = systems[systemIndex];
				let systemMsPosDataArray = getSystemMsPosDataArray(system, viewBoxScale, tracks, trackIsOnArray, interpIndex);
				// Delete the following completely when tested:
				//// If there was no msPosData object at the start of the system, insert the default value.
				//if(systemMsPosDataArray[0].alignment > defaultSystemStartMsPosData[systemIndex].alignment)
				//{
				//	systemMsPosDataArray.splice(0, 0, defaultSystemStartMsPosData[systemIndex]);
				//}

				if(systemIndex === nSystems - 1)
				{	// Append an msPosData object for the final barline.
					let finalBarline = system.barlines[system.barlines.length - 1],
						msPosInScore = finalBarline.msPosInScore,
						alignment = finalBarline.alignment,
						yCoordinates = {top: system.topLineY * viewBoxScale, bottom: system.bottomLineY * viewBoxScale},
						msPosData = {msPosInScore: msPosInScore, alignment: alignment * viewBoxScale, pixelsPerMs: 0, yCoordinates: yCoordinates};

					systemMsPosDataArray.push(msPosData);
				}

				msPosDataArray = msPosDataArray.concat(systemMsPosDataArray);
			}
			return msPosDataArray;
		}

		// The last entry is an msPosData object for the final barline.
		this.msPosDataArray = getScoreMsPosDataArray(systems, this.viewBoxScale, tracks, trackIsOnArray, interpIndex);

		this.moveElementTo(startMarkerMsPosInScore); // sets yCoordinates if necessary

		if(displayRunningCursor)
		{
			this.setVisible(true);
		}
		else
		{
			this.setVisible(false);
		}
	}

	// use running index here if possible...
	moveElementTo(msPosInScore)
	{
		let msPosData = this.msPosDataArray.find((e) => e.msPosInScore === msPosInScore);
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



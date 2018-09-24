import { StartMarker } from "./StartMarker.js";
import { RunningMarker } from "./RunningMarker.js";
import { EndMarker } from "./EndMarker.js";
import { TimePointer } from "./TimePointer.js";
import { Conductor } from "./Conductor.js";
import { Cursor } from "./Cursor.js";
import { MidiChord, MidiRest } from "./MidiObject.js";
import { Track } from "./Track.js";
import { InputChordDef, InputRestDef } from "./InputObjectDef.js";
import { InputChord } from "./InputChord.js";

const BLACK_COLOR = "#000000",
	GREY_COLOR = "#7888A0",
	ENABLED_INPUT_TITLE_COLOR = "#3333EE",
	DISABLED_PINK_COLOR = "#FFBBBB";

let midiChannelPerOutputTrack = [], // only output tracks

	tracksData = {},
	// This array is initialized to all tracks on (=true) when the score is loaded,
	// and reset when the tracksControl calls refreshDisplay().
	trackIsOnArray = [], // all tracks, including input tracks

	viewBoxScale,

	// The frame containing the cursorLine and the start- and end-markers
	markersLayer,

	regionDefs, // each regionDef has .name, .fromStartOfBar, .startMsPos, .toEndofBar, .endMsPos
	regionNameSequence, // a string such as "aabada"
	regionDefSequence, 
	finalBarlineInScore,

	// See comments in the publicAPI definition at the bottom of this file.
	systemElems = [], // an array of all the systemElems
	systems = [], // an array of all the systems

	// This value is changed when the start runtime button is clicked.
	// It is used when setting the positions of the start and end markers.
	isLivePerformance = false,
	// This value is toggled on or off by the conducting performance button.
	isConducting = false,

	startMarker,
	runningMarker,
	endMarker,
	conductor, // an object that has a now() function).
	cursor, // The cursor that is going to replace all the RunningMarkers
	systemChanged, // callback, called when running cursor changes systems

	getConductor = function(speed)
	{
		conductor.setSpeed(speed);
		return conductor;
	},

	// Pushes the values in the trackIsOnArray into the argument (which is an empty array).
	// The returnArray will be garbage collected when it is finished with.
	// This rigmarole so that values in the trackIsOnArray can't be changed except by the tracksControl.
	getReadOnlyTrackIsOnArray = function(returnArray)
	{
		var i;
		console.assert(returnArray.length === 0);

		for(i = 0; i < trackIsOnArray.length; ++i)
		{
			returnArray.push(trackIsOnArray[i]);
		}
	},

	hideStartMarkersExcept = function(startMarker)
	{
		var i, sMarker;
		for(i = 0; i < systems.length; ++i)
		{
			sMarker = systems[i].startMarker;
			if(sMarker === startMarker)
			{
				sMarker.setVisible(true);
			}
			else
			{
				sMarker.setVisible(false);
			}
		}
	},

	hideEndMarkersExcept = function(endMarker)
	{
		var i, eMarker;
		for(i = 0; i < systems.length; ++i)
		{
			eMarker = systems[i].endMarker;
			if(eMarker === endMarker)
			{
				eMarker.setVisible(true);
			}
			else
			{
				eMarker.setVisible(false);
			}
		}
	},

	getTimeObjectsArray = function(system)
	{
		var i, nStaves = system.staves.length, j, voice, nVoices, timeObjects, timeObjectsArray = [];

		for(i = 0; i < nStaves; ++i)
		{
			nVoices = system.staves[i].voices.length;
			for(j = 0; j < nVoices; ++j)
			{
				voice = system.staves[i].voices[j];
				timeObjects = voice.timeObjects;
				timeObjectsArray.push(timeObjects);
			}
		}
		return timeObjectsArray;
	},

	// Returns null or the performing midiChord, midiRest, inputChord or voice end TimeObject closest to alignment
	// (in any performing input or output track, depending on findInput).
	// If trackIndex is defined, the returned timeObject will be in that track.
	// Returns null if no timeObject can be found that matches the arguments.
	findPerformingTimeObject = function(timeObjectsArray, nOutputTracks, trackIsOnArray, findInput, alignment, trackIndex)
	{
		var i, j, timeObjects, timeObject = null, timeObjectBefore = null, timeObjectAfter = null, returnTimeObject = null, nTimeObjects,
			nAllTracks = timeObjectsArray.length, deltaBefore = Number.MAX_VALUE, deltaAfter = Number.MAX_VALUE, startIndex, endIndex;

		function hasPerformingTrack(inputChordDef, trackIsOnArray)
		{
			var i, outputTrackFound = false, outputTrackIndices;

			console.assert(inputChordDef !== undefined, "inputChordDef must be defined.");

			outputTrackIndices = inputChordDef.referencedOutputTrackIndices();
			for(i = 0; i < outputTrackIndices.length; ++i)
			{
				if(trackIsOnArray[outputTrackIndices[i]])
				{
					outputTrackFound = true;
					break;
				}
				if(outputTrackFound === true)
				{
					break;
				}
			}
			return outputTrackFound;
		}

		startIndex = (findInput === true) ? nOutputTracks : 0;
		endIndex = (findInput === true) ? nAllTracks : nOutputTracks;

		for(i = startIndex; i < endIndex; ++i)
		{
			if(trackIndex === undefined || findInput === true || (i === trackIndex))
			{
				timeObjects = timeObjectsArray[i];
				if(trackIsOnArray[i] === true)
				{
					nTimeObjects = timeObjects.length;
					for(j = 0; j < nTimeObjects; ++j)
					{
						timeObject = timeObjects[j];
						if((findInput === false)  // timeObject contains a midiRest or midiChord
							|| (findInput && // find an inputChord
								(timeObject instanceof InputChordDef && hasPerformingTrack(timeObject, trackIsOnArray))))
						{
							if(alignment === timeObject.alignment)
							{
								returnTimeObject = timeObject;
								break;
							}
							if(alignment > timeObject.alignment && (deltaBefore > (alignment - timeObject.alignment)))
							{
								timeObjectBefore = timeObject;
								deltaBefore = alignment - timeObject.alignment;
							}
							if(alignment < timeObject.alignment && (deltaAfter > (timeObject.alignment - alignment)))
							{
								timeObjectAfter = timeObject;
								deltaAfter = timeObject.alignment - alignment;
							}
						}
					}
				}
			}
		}
		if(returnTimeObject === null && (timeObjectBefore !== null || timeObjectAfter !== null))
		{
			returnTimeObject = (deltaBefore > deltaAfter) ? timeObjectAfter : timeObjectBefore;
		}
		return returnTimeObject;
	},

	findPerformingInputTimeObject = function(timeObjectsArray, nOutputTracks, trackIsOnArray, alignment, trackIndex)
	{
		var returnTimeObject = findPerformingTimeObject(timeObjectsArray, nOutputTracks, trackIsOnArray, true, alignment, trackIndex);
		return returnTimeObject;
	},

	findPerformingOutputTimeObject = function(timeObjectsArray, nOutputTracks, trackIsOnArray, alignment, trackIndex)
	{
		var returnTimeObject = findPerformingTimeObject(timeObjectsArray, nOutputTracks, trackIsOnArray, false, alignment, trackIndex);
		return returnTimeObject;
	},

	updateStartMarker = function(timeObjectsArray, timeObject)
	{
		var nOutputTracks = midiChannelPerOutputTrack.length;

		if(isLivePerformance === false)
		{
			timeObject = findPerformingOutputTimeObject(timeObjectsArray, nOutputTracks, trackIsOnArray, timeObject.alignment);
		}
		else
		{
			timeObject = findPerformingInputTimeObject(timeObjectsArray, nOutputTracks, trackIsOnArray, timeObject.alignment);
		}

		if(timeObject.msPositionInScore < endMarker.msPositionInScore)
		{
			startMarker.moveTo(timeObject);
		}
	},

	// This function is called by the tracksControl whenever a track's on/off state is toggled.
	// It draws the staves with the right colours and, if necessary, moves the start marker to a chord.
	refreshDisplay = function(trackIsOnArrayArg)
	{
		var i, system = systems[startMarker.systemIndexInScore],
			startMarkerAlignment = startMarker.alignment,
			timeObjectsArray = getTimeObjectsArray(system), timeObject,
			nOutputTracks = midiChannelPerOutputTrack.length;

		// This function sets the opacity of the visible OutputStaves.
		// (there are no InputStaves in the system, when isLivePerformance === false)
		// Staves have either one or two voices (=tracks).
		// The tracks are 0-indexed channels from top to bottom of the system.
		// If trackIsOnArray[trackIndex] is true, its stafflines opacity is set to 1.
		// If trackIsOnArray[trackIndex] is false, its stafflines opacity is set to 0.3.
		// When the staff has one track, all its stafflines are set for the track.
		// When the staff has two tracks, the top three stafflines are set for the upper track,
		// and the lower two lines are set for the lower track. 
		function setOutputView(trackIsOnArray)
		{
			var i, nSystems = systems.length, j, nStaves = systems[0].staves.length,
				staff, trackIndex, t, nTracksPerStaff,
				opacity, voiceGraphicElements, voiceGraphicElement, g;

			function setStafflinesOpacity(voice, trackIsOnArray, trackIndex, nTracksPerStaff, opacity)
			{
				var voiceStafflinesElem = voice.stafflinesElem;

				if(voiceStafflinesElem !== undefined)
				{
					if(nTracksPerStaff > 1 && (trackIsOnArray[trackIndex] !== trackIsOnArray[trackIndex + 1]))
					{
						opacity = 1;
					}
					voiceStafflinesElem.style.opacity = opacity;
				}
			}

			for(i = 0; i < nSystems; ++i)
			{
				trackIndex = 0;
				for(j = 0; j < nStaves; ++j)
				{
					staff = systems[i].staves[j];
					if(staff.isOutput === false)
					{
						break;
					}
					nTracksPerStaff = staff.voices.length;
					for(t = 0; t < nTracksPerStaff; ++t)
					{
						if(staff.isVisible)
						{
							opacity = (trackIsOnArray[trackIndex]) ? 1 : 0.3;

							setStafflinesOpacity(staff.voices[t], trackIsOnArray, trackIndex, nTracksPerStaff, opacity);

							voiceGraphicElements = staff.voices[t].graphicElements;
							for(g = 0; g < voiceGraphicElements.length; ++g)
							{
								voiceGraphicElement = voiceGraphicElements[g];
								voiceGraphicElement.style.opacity = opacity;
							}
						}

						++trackIndex;
					}
				}
			}
		}

		if(trackIsOnArrayArg !== undefined)
		{
			trackIsOnArray = trackIsOnArrayArg; // reset by track control
		}
		else if(trackIsOnArray !== undefined)
		{
			// This happens both when the score is initialised, and when
			// it is reloaded after it has already been displayed.
			for(i = 0; i < trackIsOnArray.length; ++i)
			{
				trackIsOnArray[i] = true;
			}
		}

		setOutputView(trackIsOnArray);

		if(isLivePerformance)
		{
			timeObject = findPerformingInputTimeObject(timeObjectsArray, nOutputTracks, trackIsOnArray, startMarkerAlignment);
		}
		else
		{
			timeObject = findPerformingOutputTimeObject(timeObjectsArray, nOutputTracks, trackIsOnArray, startMarkerAlignment);
		}
		// Move the start marker if necessary.
		// timeObject will be null if there are only rests to be found. In this case, the startMarker doesn't need to be moved.
		if(timeObject !== null && timeObject.alignment !== startMarkerAlignment)
		{
			updateStartMarker(timeObjectsArray, timeObject);
		}
	},

	// this function is called only when state is 'settingStart' or 'settingEnd'.
	svgPageClicked = function(e, state)
	{
		var cursorX = e.pageX,
			cursorY = e.pageY,
			systemIndex, system,
			timeObjectsArray, timeObject, trackIndex, nOutputTracks = midiChannelPerOutputTrack.length;

		// Returns the system having stafflines closest to cursorY.
		function findSystemIndex(cursorY)
		{
			var i, topLimit, bottomLimit, systemIndex;

			if(systems.length === 1)
			{
				systemIndex = 0;
			}
			else
			{
				systemIndex = systems.length - 1;
				topLimit = -1;
				for(i = 0; i < systems.length - 1; ++i)
				{
					system = systems[i];
					bottomLimit = (systems[i].bottomLineY + systems[i + 1].topLineY) / 2;
					if(cursorY >= topLimit && cursorY < bottomLimit)
					{
						systemIndex = i;
						break;
					}
					topLimit = bottomLimit;
				}
			}
			return systemIndex;
		}

		// Returns the index of the visible staff having stafflines closest to cursorY
		// Invisble staves have undefined topLineY and bottomLineY attributes.
		// Note that the correct staff index will be returned, even if the staff has been disabled.
		function findStaffIndex(cursorY, staves)
		{
			var rStaffIndex, i, nStaves = staves.length, staff,
				topYs = [], bottomYs = [], visibleStaffIndices = [], midYBelows = [];

			for(i = 0; i < nStaves; ++i)
			{
				staff = staves[i];
				if(staff.topLineY !== undefined)
				{
					// the staff has stafflines (i.e. is visible)
					visibleStaffIndices.push(i);
					topYs.push(staff.topLineY);
					bottomYs.push(staff.bottomLineY);
				}
			}

			if(visibleStaffIndices.length === 1)
			{
				rStaffIndex = visibleStaffIndices[0];
			}
			else
			{
				for(i = 1; i < visibleStaffIndices.length; ++i)
				{
					midYBelows[i - 1] = (bottomYs[i - 1] + topYs[i]) / 2;
				}
				midYBelows[visibleStaffIndices.length - 1] = Number.MAX_VALUE;

				for(i = 0; i < midYBelows.length; ++i)
				{
					if(cursorY < midYBelows[i])
					{
						rStaffIndex = visibleStaffIndices[i];
						break;
					}
				}
			}

			return rStaffIndex;
		}

		// Returns the index of the voice closest to cursorY
		// The staff containing the voice is visible, but may have been disabled.
		function findVoiceIndex(cursorY, voices)
		{
			var index, nVoices = voices.length, midY;
			if(nVoices === 1)
			{
				index = 0;
			}
			else
			{
				midY = (voices[0].centreY + voices[1].centreY) / 2;
				index = (cursorY < midY) ? 0 : 1;
			}
			return index;
		}

		// Returns the track closest to the cursor, even if the track has been disabled.
		function findTrackIndex(cursorY, system)
		{
			var i, j, staff, staffIndex = findStaffIndex(cursorY, system.staves),
				voiceIndex = findVoiceIndex(cursorY, system.staves[staffIndex].voices),
				trackIndex = 0, found = false;

			for(i = 0; i < system.staves.length; ++i)
			{
				staff = system.staves[i];
				for(j = 0; j < staff.voices.length; ++j)
				{
					if(staffIndex === i && voiceIndex === j)
					{
						found = true;
						break;
					}
					trackIndex++;
				}
				if(found === true)
				{
					break;
				}
			}
			return trackIndex;
		}

		systemIndex = findSystemIndex(cursorY);
		system = systems[systemIndex];

		timeObjectsArray = getTimeObjectsArray(system);

		trackIndex = findTrackIndex(cursorY, system);

		if(isLivePerformance === true)
		{
			timeObject = findPerformingInputTimeObject(timeObjectsArray, nOutputTracks, trackIsOnArray, cursorX, trackIndex);
		}
		else
		{
			timeObject = findPerformingOutputTimeObject(timeObjectsArray, nOutputTracks, trackIsOnArray, cursorX, trackIndex);
		}

		// timeObject is either null (if the track has been disabled) or is now the nearest performing chord to the click,
		// either in a live performers voice (if there is one and it is performing) or in a performing output voice.
		if(timeObject !== null)
		{
			switch(state)
			{
				case 'settingStart':
					if(timeObject.msPositionInScore < endMarker.msPositionInScore)
					{
						startMarker = system.startMarker;
						hideStartMarkersExcept(startMarker);
						updateStartMarker(timeObjectsArray, timeObject);
					}
					break;
				case 'settingEnd':
					if(startMarker.msPositionInScore < timeObject.msPositionInScore)
					{
						endMarker = system.endMarker;
						hideEndMarkersExcept(endMarker);
						endMarker.moveTo(timeObject);
					}
					break;
				default:
					break;
			}
		}
	},

	hideRunningMarkers = function()
	{
		//var i, nSystems = systems.length;

		//for(i = 0; i < nSystems; ++i)
		//{
		//	systems[i].runningMarker.setVisible(false);
		//	if(isConducting)
		//	{
		//		systems[i].timePointer.setVisible(false);
		//	}
		//}

		cursor.setVisible(false);
	},

	moveRunningMarkersToStartMarkers = function()
	{
		//var i, nSystems = systems.length;

		//for(i = 0; i < nSystems; ++i)
		//{
		//	systems[i].runningMarker.moveTo(systems[i].startMarker.msPositionInScore);
		//}

		cursor.moveCursorLineTo(systems[0].startMarker.msPositionInScore);
	},

	// Called when the go button or the startConducting button is clicked.
	setRunningMarkers = function()
	{
		var sysIndex, nSystems = systems.length, system;

		for(sysIndex = 0; sysIndex < nSystems; ++sysIndex)
		{
			system = systems[sysIndex];
			system.runningMarker.setTimeObjects(system, isLivePerformance, trackIsOnArray);
		}
		//hideRunningMarkers();
		//moveRunningMarkersToStartMarkers();
		//runningMarker = systems[startMarker.systemIndexInScore].runningMarker;
		//runningMarker.setVisible(true);

		cursor.moveCursorLineTo(startMarker.msPositionInScore);
		cursor.setVisible(true);
	},

	// Called when the start conducting button is clicked on or off.
	setConducting = function(boolean)
	{
		var sysIndex, nSystems = systems.length, system, timePointers = [], endOfSystemTimeObject;

		function getEndOfSystemTimeObject(system)
		{
			var
				finalIndex = system.staves[0].voices[0].timeObjects.length - 1,
				endOfSystemTimeObject;

			endOfSystemTimeObject = system.staves[0].voices[0].timeObjects[finalIndex];

			return endOfSystemTimeObject;
		}

		setRunningMarkers();

		isConducting = boolean; // score.isConducting!
		if(isConducting)
		{
			for(sysIndex = 0; sysIndex < nSystems; ++sysIndex)
			{
				system = systems[sysIndex];

				endOfSystemTimeObject = getEndOfSystemTimeObject(system);
				system.timePointer.init(system.startMarker, system.runningMarker, endOfSystemTimeObject);

				timePointers.push(system.timePointer);

				if(sysIndex === startMarker.systemIndexInScore)
				{
					conductor.setTimePointer(system.timePointer);
				}
			}
		}
		else
		{
			conductor.setTimePointer(undefined);
		}
	},

	conduct = function(e)
	{
		conductor.conduct(e);
	},

	// Constructs empty systems for all the pages.
	// Each page has a frame and the correct number of empty systems.
	// Each system has a startMarker, a runningMarker and an endMarker, but these are left
	// on the left edge of the page.
	// Each system has the correct number of staves containing the correct number of voices.
	// The staves have set boolean isOutput and isVisible attributes.
	// The voices have a set boolean isOutput attribute, but as yet no timeObject arrays.
	// The score's trackIsOnArray is initialized to all tracks on (=true).
	// If isLivePerformance === true, then outputStaves are grey, inputStaves are black.
	// If isLivePerformance === false, then outputStaves are black, inputStaves are pink.
	getEmptySystems = function(isLivePerformanceArg, startPlayingFunction)
	{
		var system, svgPageEmbeds, viewBox,
			svgPage, svgElem, pageSystemsElem, pageSystemElems, systemElem,
			localMarkersLayer, systemIndexOnPage, pageSystems,
			systemIndexInScore = 0;

		function resetContent(isLivePerformanceArg)
		{
			isLivePerformance = isLivePerformanceArg;
			systemElems.length = 0;
			systems.length = 0;
			midiChannelPerOutputTrack.length = 0;
			trackIsOnArray.length = 0;
		}

		function getSVGElem(svgPage)
		{
			let svgPageContent = svgPage.contentDocument;
			svgElem = svgPageContent.getElementsByTagName("svg")[0];

			return svgElem;
		}

		function getEmptySystem(viewBoxScale, systemElem)
		{
			var i, j,
				systemDy, staffDy,
				staffElems, staffElem, stafflinesElem,
				outputVoiceElems, inputVoiceElems,
				staff, stafflineInfo,
				voice;

			function getElems(containerElem, classString1, classString2)
			{
				var elems1 = containerElem.getElementsByClassName(classString1),
					elems2 = containerElem.getElementsByClassName(classString2),
					elems = [],
					i;

				for(i = 0; i < elems1.length; ++i)
				{
					elems.push(elems1[i]);
				}
				for(i = 0; i < elems2.length; ++i)
				{
					elems.push(elems2[i]);
				}

				return elems;
			}

			// returns an info object containing left, right and stafflineYs
			function getStafflineInfo(stafflinesElem, dy)
			{
				var i, rStafflineInfo = {}, stafflineYs = [], left, right, stafflineY,
					lineElem, staffLinesElemChildren = stafflinesElem.children;

				for(i = 0; i < staffLinesElemChildren.length; ++i)
				{
					console.assert(staffLinesElemChildren[i].nodeName === "line");
					lineElem = staffLinesElemChildren[i];
					stafflineY = parseFloat(lineElem.getAttribute('y1')) + dy;
					stafflineYs.push((stafflineY / viewBoxScale));
					left = parseFloat(lineElem.getAttribute('x1'));
					left /= viewBoxScale;
					right = parseFloat(lineElem.getAttribute('x2'));
					right /= viewBoxScale;
				}

				rStafflineInfo.left = left;
				rStafflineInfo.right = right;
				rStafflineInfo.stafflineYs = stafflineYs;

				return rStafflineInfo;
			}

			function setVoiceCentreYs(staffTopY, staffBottomY, voices)
			{
				if(voices.length === 1)
				{
					voices[0].centreY = (staffTopY + staffBottomY) / 2;
				}
				else // voices.length === 2
				{
					voices[0].centreY = staffTopY;
					voices[1].centreY = staffBottomY;
				}
			}

			function setStaffColours(staff, isLivePerformance)
			{
				function setStaffNameStyle(staff, titleColor)
				{
					staff.nameElem.style.fill = titleColor;

					if(titleColor === ENABLED_INPUT_TITLE_COLOR)
					{
						staff.nameElem.style.fontWeight = 'bold';
					}
					else
					{
						staff.nameElem.style.fontWeight = 'normal';
					}
				}

				function setStafflinesColor(staff, color)
				{
					let stafflines = staff.stafflines;
					let nStafflines = stafflines.length;
					for(let i = 0; i < nStafflines; ++i)
					{
						stafflines[i].style.stroke = color;
					}
				}

				function setGreyDisplay(staff)
				{
					setStaffNameStyle(staff, GREY_COLOR);
					setStafflinesColor(staff, GREY_COLOR);
				}

				function setBlackDisplay(staff)
				{
					setStaffNameStyle(staff, BLACK_COLOR);
					setStafflinesColor(staff, BLACK_COLOR);
				}

				function setLiveInputDisplay(staff)
				{
					setStaffNameStyle(staff, ENABLED_INPUT_TITLE_COLOR);
					setStafflinesColor(staff, BLACK_COLOR);
				}

				function setDisabledInputDisplay(staff)
				{
					setStaffNameStyle(staff, DISABLED_PINK_COLOR);
					setStafflinesColor(staff, DISABLED_PINK_COLOR);
				}

				if(staff.isOutput === true)
				{
					if(isLivePerformance)
					{
						setGreyDisplay(staff);
					}
					else
					{
						setBlackDisplay(staff);
					}
				}
				if(staff.isOutput === false)
				{
					if(isLivePerformance)
					{
						setLiveInputDisplay(staff);
					}
					else
					{
						setDisabledInputDisplay(staff);
					}
				}
			}

			function getNameElem(staffChild)
			{
				var i, voiceChildren = staffChild.childNodes, nameElem;

				for(i = 0; i < voiceChildren.length; ++i)
				{
					if(voiceChildren[i].nodeName === "text")
					{
						nameElem = voiceChildren[i];
						break;
					}
				}
				return nameElem;
			}

			function getDy(nodeElem)
			{
				var dy = 0, transformStr, indexOfTranslate, params, yStr;

				transformStr = nodeElem.getAttribute("transform");

				if(transformStr !== null)
				{
					indexOfTranslate = transformStr.indexOf("translate(");
					if(indexOfTranslate >= 0)
					{
						params = transformStr.slice(indexOfTranslate + "translate(".length);
						yStr = params.split(",")[1];
						dy = parseFloat(yStr);
					}
				}

				return dy;
			}

			function getSystemMarkerLimits(system, systemElem, systemDY)
			{
				var i, sysElemChildren, leftToRightElem, topToBottomElem,
					minPixelsAbove = -20 * viewBoxScale, markersTopDY;

				sysElemChildren = systemElem.children;
				for(i = 0; i < sysElemChildren.length; ++i)
				{
					if(sysElemChildren[i].nodeName === "score:leftToRight")
					{
						leftToRightElem = sysElemChildren[i];
						markersTopDY = (minPixelsAbove < systemDY) ? minPixelsAbove : systemDY;
						system.markersTop = markersTopDY + parseInt(leftToRightElem.getAttribute("systemTop"), 10);
						system.markersBottom = systemDY + parseInt(leftToRightElem.getAttribute("systemBottom"), 10);
						break;
					}
					if(sysElemChildren[i].nodeName === "score:topToBottom")
					{
						topToBottomElem = sysElemChildren[i];
						system.markersLeft = parseInt(topToBottomElem.getAttribute("systemLeft"), 10);
						system.markersRight = parseInt(topToBottomElem.getAttribute("systemRight"), 10);
						break;
					}
				}
			}

			system = {};
			systemDy = getDy(systemElem);

			getSystemMarkerLimits(system, systemElem, systemDy);

			system.staves = [];

			staffElems = getElems(systemElem, "staff", "inputStaff");

			for(i = 0; i < staffElems.length; ++i)
			{
				staffElem = staffElems[i];
				staff = {};
				staffDy = systemDy + getDy(staffElem);
				staff.isOutput = (staffElem.getAttribute("class") === "staff");
				staff.isVisible = ((staffElem.getAttribute("score:invisible") === "invisible") === false);
				staff.voices = [];
				system.staves.push(staff);

				if(staff.isOutput === true)
				{
					outputVoiceElems = staffElem.getElementsByClassName("voice");
					stafflinesElem = staffElem.getElementsByClassName("stafflines")[0];
					staff.nameElem = getNameElem(outputVoiceElems[0]);
					for(j = 0; j < outputVoiceElems.length; ++j)
					{
						voice = {};
						voice.isOutput = true;
						staff.voices.push(voice);
					}
				}
				else // input staff
				{
					inputVoiceElems = staffElem.getElementsByClassName("inputVoice");
					stafflinesElem = staffElem.getElementsByClassName("inputStafflines")[0];
					staff.nameElem = getNameElem(inputVoiceElems[0]);
					for(j = 0; j < inputVoiceElems.length; ++j)
					{
						voice = {};
						voice.isOutput = false;
						staff.voices.push(voice);
					}
				}

				if(staff.isVisible)
				{
					if(stafflinesElem !== undefined)
					{
						stafflineInfo = getStafflineInfo(stafflinesElem, staffDy);
						system.left = stafflineInfo.left;
						system.right = stafflineInfo.right;

						staff.stafflines = stafflinesElem.children;
						staff.topLineY = stafflineInfo.stafflineYs[0];
						staff.bottomLineY = stafflineInfo.stafflineYs[stafflineInfo.stafflineYs.length - 1];

						setStaffColours(staff, isLivePerformance);
						setVoiceCentreYs(staff.topLineY, staff.bottomLineY, staff.voices);

						if(system.topLineY === undefined)
						{
							system.topLineY = staff.topLineY;
							system.bottomLineY = staff.bottomLineY;
						}
						else
						{
							system.topLineY = (system.topLineY < staff.topLineY) ? system.topLineY : staff.topLineY;
							system.bottomLineY = (system.bottomLineY > staff.bottomLineY) ? system.bottomLineY : staff.bottomLineY;
						}
					}
				}
			}

			return system;
		}

		// Creates a new "g" element at the top level of the svg page.
		// The element contains a transparent, clickable rect.
		// The markers and timePointer are added to the markersLayer later.
		function createMarkersLayer(svgElem)
		{
			var viewBox = svgElem.viewBox.baseVal,
				markersLayer = document.createElementNS("http://www.w3.org/2000/svg", "g"),
				rect = document.createElementNS("http://www.w3.org/2000/svg", 'rect');

			markersLayer.setAttribute("style", "display:inline");

			rect.setAttribute("x", viewBox.x.toString(10));
			rect.setAttribute("y", viewBox.y.toString(10));
			rect.setAttribute("width", viewBox.width.toString(10));
			rect.setAttribute("height", viewBox.height.toString(10));
			rect.setAttribute("style", "stroke:none; fill:#ffffff; fill-opacity:0");
			markersLayer.appendChild(rect);

			svgElem.appendChild(markersLayer);

			return markersLayer;
		}

		// returns the content of the svg <score:scoreData> element
		function getScoreData(svgElem)
		{
			// returns the content of the <regions> element
			function getRegionData(svgElem)
			{
				let	regionDefsElems = svgElem.getElementsByClassName("regionDef"),
					regionDefs = [],
					regionNameSequenceElem = svgElem.getElementsByClassName("regionSequence")[0],
					regionNameSequence;

				if(regionDefsElems.length === 0)
				{
					// default is to define a region that contains the whole score
					regionDefs.push({ name: "a", fromStartOfBar:1, startMsPos: 0, toEndOfBar:"last", endMsPos: Number.MAX_VALUE });
					regionNameSequence = "a";
				}
				else
				{
					for(let regionDefElem of regionDefsElems)
					{
						let regionDef = {},
							name = regionDefElem.getAttribute("name"),
							fromStartOfBar = parseInt(regionDefElem.getAttribute("fromStartOfBar"), 10),
							startMsPos = parseInt(regionDefElem.getAttribute("startMsPos"), 10),
							toEndOfBarAttr = regionDefElem.getAttribute("toEndOfBar"),
							toEndOfBar = (toEndOfBarAttr === "final") ? "final" : parseInt(toEndOfBarAttr, 10), 
							endMsPosAttr = regionDefElem.getAttribute("endMsPos"), 
							endMsPos = (toEndOfBarAttr === "final") ? Number.MAX_VALUE : parseInt(endMsPosAttr, 10);

						//Each name must be a (any) single character.
						console.assert(name.length === 1);
						console.assert(!isNaN(startMsPos));
						console.assert(!isNaN(endMsPos));

						// fromStartOfBar and toEndOfBar correspond correctly to the msPos values,
						// but they are currently just used as comments while debugging.
						regionDef.name = name;
						regionDef.fromStartOfBar = fromStartOfBar;
						regionDef.startMsPos = startMsPos;
						regionDef.toEndOfBar = toEndOfBar;
						regionDef.endMsPos = endMsPos;
						regionDefs.push(regionDef);
					}

					//The first regionDef must have startMsPos = "0".
					console.assert(regionDefs[0].startMsPos === 0);

					regionNameSequence = regionNameSequenceElem.getAttribute("sequence");
				}

				return { regionDefs, regionNameSequence };
			}

			let scoreData = {},
				regionData = getRegionData(svgElem);

			scoreData.regionDefs = regionData.regionDefs;
			scoreData.regionNameSequence = regionData.regionNameSequence;
				
			return scoreData;
		}

		// Appends the markers and timePointers to the markerslayer.
		function createMarkers(conductor, markersLayer, viewBoxScale, system, systemIndexInScore)
		{
			var startMarkerElem, runningMarkerElem, endMarkerElem, runningMarkerHeight;

			function newStartMarkerElem()
			{
				var startMarkerElem = document.createElementNS("http://www.w3.org/2000/svg", "g"),
					startMarkerLine = document.createElementNS("http://www.w3.org/2000/svg", 'line'),
					startMarkerDisk = document.createElementNS("http://www.w3.org/2000/svg", 'circle');

				startMarkerLine.setAttribute("x1", "0");
				startMarkerLine.setAttribute("y1", "0");
				startMarkerLine.setAttribute("x2", "0");
				startMarkerLine.setAttribute("y2", "0");
				startMarkerLine.setAttribute("style", "stroke-width:1px");

				startMarkerDisk.setAttribute("cx", "0");
				startMarkerDisk.setAttribute("cy", "0");
				startMarkerDisk.setAttribute("r", "0");
				startMarkerDisk.setAttribute("style", "stroke-width:1px");

				startMarkerElem.setAttribute("class", "startMarkerElem");
				startMarkerElem.appendChild(startMarkerLine);
				startMarkerElem.appendChild(startMarkerDisk);

				return startMarkerElem;
			}

			function newRunningMarkerElem()
			{
				var runningMarkerElem = document.createElementNS("http://www.w3.org/2000/svg", "g"),
					runningMarkerLine = document.createElementNS("http://www.w3.org/2000/svg", 'line');

				runningMarkerLine.setAttribute("x1", "0");
				runningMarkerLine.setAttribute("y1", "0");
				runningMarkerLine.setAttribute("x2", "0");
				runningMarkerLine.setAttribute("y2", "0");
				runningMarkerLine.setAttribute("style", "stroke-width:1px");

				runningMarkerElem.setAttribute("class", "runningMarkerElem");
				runningMarkerElem.appendChild(runningMarkerLine);

				return runningMarkerElem;
			}

			function newEndMarkerElem()
			{
				var endMarkerElem = document.createElementNS("http://www.w3.org/2000/svg", "g"),
					endMarkerLine = document.createElementNS("http://www.w3.org/2000/svg", 'line'),
					endMarkerRect = document.createElementNS("http://www.w3.org/2000/svg", 'rect');

				endMarkerLine.setAttribute("x1", "0");
				endMarkerLine.setAttribute("y1", "0");
				endMarkerLine.setAttribute("x2", "0");
				endMarkerLine.setAttribute("y2", "0");
				endMarkerLine.setAttribute("style", "stroke-width:1px");

				endMarkerRect.setAttribute("x", "0");
				endMarkerRect.setAttribute("y", "0");
				endMarkerRect.setAttribute("width", "0");
				endMarkerRect.setAttribute("height", "0");
				endMarkerRect.setAttribute("style", "stroke-width:1px");

				endMarkerElem.setAttribute("class", "endMarkerElem");
				endMarkerElem.appendChild(endMarkerLine);
				endMarkerElem.appendChild(endMarkerRect);

				return endMarkerElem;
			}

			startMarkerElem = newStartMarkerElem();
			runningMarkerElem = newRunningMarkerElem();
			endMarkerElem = newEndMarkerElem();

			markersLayer.appendChild(startMarkerElem);
			markersLayer.appendChild(runningMarkerElem);
			markersLayer.appendChild(endMarkerElem);

			system.startMarker = new StartMarker(system, systemIndexInScore, startMarkerElem, viewBoxScale);
			system.runningMarker = new RunningMarker(system, systemIndexInScore, runningMarkerElem, viewBoxScale);
			system.endMarker = new EndMarker(system, systemIndexInScore, endMarkerElem, viewBoxScale);

			runningMarkerHeight = system.runningMarker.yCoordinates.bottom - system.runningMarker.yCoordinates.top;

			system.timePointer = new TimePointer(system.runningMarker.yCoordinates.top, runningMarkerHeight, viewBoxScale, advanceRunningMarker);

			markersLayer.appendChild(system.timePointer.graphicElement);
		}

		function initializeTrackIsOnArray(system)
		{
			var i, j, staff;

			trackIsOnArray = []; // score variable
			for(i = 0; i < system.staves.length; ++i)
			{
				staff = system.staves[i];
				for(j = 0; j < staff.voices.length; ++j)
				{
					if(staff.voices[j].isOutput === false && isLivePerformance === false)
					{
						trackIsOnArray.push(false);
					}
					else
					{
						trackIsOnArray.push(true);
					}
				}
			}
		}

		// Sets the global viewBox object and the sizes and positions of the objects on the svgPagesFrame)
		// Returns the viewBox in the final page of the score.
		function setGraphics()
		{
			var
				i, svgPage, svgElem, viewBox, embedsWidth, pagesFrameWidth,
				svgRuntimeControlsElem = document.getElementById("svgRuntimeControls"),
				svgPagesFrameElem = document.getElementById("svgPagesFrame"), svgPagesFrameElemHeight,
				svgPageEmbeds = svgPagesFrameElem.getElementsByClassName("svgPage"),
				leftpx, nPages = svgPageEmbeds.length;

			function getViewBox(svgElem)
			{
				var height, viewBox = {}, viewBoxStr, viewBoxStrings;

				height = parseFloat(svgElem.getAttribute('height'));
				viewBoxStr = svgElem.getAttribute('viewBox');
				viewBoxStrings = viewBoxStr.split(' ');

				viewBox.x = parseFloat(viewBoxStrings[0]);
				viewBox.y = parseFloat(viewBoxStrings[1]);
				viewBox.width = parseFloat(viewBoxStrings[2]);
				viewBox.height = parseFloat(viewBoxStrings[3]);
				viewBox.scale = viewBox.height / height;

				return viewBox;
			}

			leftpx = ((window.innerWidth - parseInt(svgRuntimeControlsElem.style.width, 10)) / 2).toString() + "px";
			svgRuntimeControlsElem.style.left = leftpx;

			for(i = 0; i < nPages; ++i)
			{
				svgPage = svgPageEmbeds[i];
				svgElem = getSVGElem(svgPage);
				viewBox = getViewBox(svgElem); // global
				embedsWidth = Math.ceil(viewBox.width / viewBox.scale);
				svgPageEmbeds[i].style.width = embedsWidth.toString() + "px";
				svgPageEmbeds[i].style.height = (Math.ceil(viewBox.height / viewBox.scale)).toString() + "px";
			}

			pagesFrameWidth = embedsWidth + 17;
			svgPagesFrameElem.style.width = pagesFrameWidth.toString() + "px";
			svgPagesFrameElemHeight = (window.innerHeight - parseInt(svgPagesFrameElem.style.top, 10) - 2);
			svgPagesFrameElem.style.height = svgPagesFrameElemHeight.toString() + "px";
			leftpx = (Math.ceil((window.innerWidth - pagesFrameWidth) / 2)).toString() + "px";
			svgPagesFrameElem.style.left = leftpx;

			viewBoxScale = viewBox.scale;

			return viewBox;
		}

		function setConductingLayer()
		{
			var
				svgPagesFrame = document.getElementById("svgPagesFrame"),
				conductingLayer = document.getElementById("conductingLayer"),
				pfLeft = parseInt(svgPagesFrame.style.left, 10),
				pfWidth = parseInt(svgPagesFrame.style.width, 10);

			conductingLayer.style.top = svgPagesFrame.style.top;
			conductingLayer.style.left = "0";
			conductingLayer.style.width = (pfLeft + pfWidth + pfLeft).toString(10) + "px";
			conductingLayer.style.height = svgPagesFrame.style.height;
		}

		/*************** end of getEmptySystems function definitions *****************************/

		resetContent(isLivePerformanceArg);

		conductor = new Conductor(startPlayingFunction);

		viewBox = setGraphics(); // the viewBox is the area in which the score can be seen and is scrolled

		svgPageEmbeds = document.getElementsByClassName("svgPage");

		if(svgPageEmbeds.length !== 1)
		{
			throw "Only single page (scroll) scores are supported.";
		}
		svgPage = svgPageEmbeds[0];
		svgElem = getSVGElem(svgPage);
		pageSystemsElem = svgElem.getElementsByClassName("systems")[0];
		pageSystemElems = pageSystemsElem.getElementsByClassName("system");

		localMarkersLayer = createMarkersLayer(svgElem); // markersLayer is global inside the score namespace

		let scoreData = getScoreData(svgElem);
		// module variables
		regionDefs = scoreData.regionDefs;
		regionNameSequence = scoreData.regionNameSequence;

		pageSystems = [];
		for(systemIndexOnPage = 0; systemIndexOnPage < pageSystemElems.length; ++systemIndexOnPage)
		{
			systemElem = pageSystemElems[systemIndexOnPage];
			systemElems.push(systemElem);

			system = getEmptySystem(viewBox.scale, systemElem);
			system.pageOffsetTop = svgPage.offsetTop;
			systems.push(system); // systems is global inside the score namespace
			pageSystems.push(system);

			createMarkers(conductor, localMarkersLayer, viewBox.scale, system, systemIndexInScore++);
		}

		markersLayer = localMarkersLayer; // markersLayer is accessed outside the score using a getter function

		setConductingLayer(); // just sets its dimensions

		initializeTrackIsOnArray(systems[0]);
	},

	setEndMarkerClick = function(e)
	{
		svgPageClicked(e, 'settingEnd');
	},

	setStartMarkerClick = function(e)
	{
		svgPageClicked(e, 'settingStart');
	},

	sendStartMarkerToStart = function()
	{
		startMarker = systems[0].startMarker;
		hideStartMarkersExcept(startMarker);
		startMarker.moveTo(systems[0].staves[0].voices[0].timeObjects[0]);
	},

	sendEndMarkerToEnd = function()
	{
		var lastTimeObjects = systems[systems.length - 1].staves[0].voices[0].timeObjects;

		endMarker = systems[systems.length - 1].endMarker;
		hideEndMarkersExcept(endMarker);
		endMarker.moveTo(lastTimeObjects[lastTimeObjects.length - 1]);
	},

	startMarkerMsPosition = function()
	{
		return startMarker.msPositionInScore;
	},

	endMarkerMsPosition = function()
	{
		return endMarker.msPositionInScore;
	},

	// Called when the start button is clicked in the top options panel,
	// and when setOptions button is clicked at the top of the score.
	// If the startMarker is not fully visible in the svgPagesDiv, move
	// it to the top of the div.
	moveStartMarkerToTop = function(svgPagesDiv)
	{
		var height = Math.round(parseFloat(svgPagesDiv.style.height)),
			scrollTop = svgPagesDiv.scrollTop, startMarkerYCoordinates;

		startMarkerYCoordinates = startMarker.yCoordinates;

		if((startMarkerYCoordinates.top < scrollTop) || (startMarkerYCoordinates.bottom > (scrollTop + height)))
		{
			if(startMarker.systemIndexInScore === 0)
			{
				svgPagesDiv.scrollTop = 0;
			}
			else
			{
				svgPagesDiv.scrollTop = startMarkerYCoordinates.top - 10;
			}
		}
	},

	// Advances the running marker to msPosition (in any channel)
	// Does nothing when the end of the score is reached.
	advanceRunningMarker = function(msPosition)
	{
		cursor.moveCursorLineTo(msPosition);
	},

	// tracksData has the following defined attributes:
	//        inputTracks[] - an array of tracks containing inputChords
	//        outputTracks[] - an array of tracks containing midiChords and midiRests
	//        if inputTracks contains one or more tracks, the following attributes are also defined (on tracksData):
	//            inputKeyRange.bottomKey
	//            inputKeyRange.topKey
	setTracksData = function()
	{
		// systems->staves->voices->timeObjects
		var
			inputTracks = [], outputTracks = [],
			outputTrackIndex = 0, inputTrackIndex = 0, inputTrack, outputTrack,
			timeObjectIndex, nTimeObjects, timeObject,
			voiceIndex, nVoices, voice,
			staffIndex, nStaves, staff,
			sysIndex, nSystems = systems.length, system, systemElem,
			inputChord;

		// Gets the timeObjects for both input and output voices. 
		function getVoiceObjects()
		{
			var i, lastSystemTimeObjects;

			function getStaffElems(systemElem)
			{
				var outputStaffElems = systemElem.getElementsByClassName("staff"),
					inputStaffElems = systemElem.getElementsByClassName("inputStaff"),
					i, staffElems = [];

				for(i = 0; i < outputStaffElems.length; ++i)
				{
					staffElems.push(outputStaffElems[i]);
				}
				for(i = 0; i < inputStaffElems.length; ++i)
				{
					staffElems.push(inputStaffElems[i]);
				}
				return staffElems;
			}

			function getTimeObjects(systemIndex, voiceElem, viewBoxScale1)
			{
				var noteObjectElems, noteObjectClass,
					timeObjects = [], noteObjectAlignment, msDuration,
					timeObject, i, j, noteObjectElem, noteObjectChildren,
					scoreMidiElem;

				noteObjectElems = voiceElem.children;
				for(i = 0; i < noteObjectElems.length; ++i)
				{
					noteObjectElem = noteObjectElems[i];
					noteObjectClass = noteObjectElem.getAttribute('class');
					// noteObjectAlignment will be null if this is not a chord or rest, or if the chord or rest is invisible
					noteObjectAlignment = noteObjectElem.getAttribute('score:alignment');

					if(noteObjectClass === 'chord' || noteObjectClass === 'rest')
					{
						noteObjectChildren = noteObjectElem.children;
						for(j = 0; j < noteObjectChildren.length; ++j)
						{
							if(noteObjectChildren[j].nodeName === "score:midi")
							{
								scoreMidiElem = noteObjectChildren[j];
								if(noteObjectClass === 'chord')
								{
									timeObject = new MidiChord(scoreMidiElem, systemIndex);
								}
								else
								{
									timeObject = new MidiRest(scoreMidiElem, systemIndex); // see MidiChord constructor.
								}
								break;
							}
						}
						if(timeObject.msDurationInScore < 1)
						{
							throw "Error: The score contains chords having zero duration!";
						}

						if(noteObjectAlignment !== null)
						{
							timeObject.alignment = parseFloat(noteObjectAlignment, 10) / viewBoxScale1;
						}
						timeObjects.push(timeObject);
					}
					else if(noteObjectClass === 'inputChord' || noteObjectClass === 'inputRest')
					{
						msDuration = parseInt(noteObjectElem.getAttribute('score:msDuration'), 10);
						if(noteObjectClass === 'inputChord')
						{
							timeObject = new InputChordDef(noteObjectElem, midiChannelPerOutputTrack, msDuration);
						}
						else if(noteObjectClass === 'inputRest')
						{
							timeObject = new InputRestDef(msDuration);
						}

						if(noteObjectAlignment !== null)
						{
							timeObject.alignment = parseFloat(noteObjectAlignment, 10) / viewBoxScale1;
						}

						timeObjects.push(timeObject);
					}
				}

				return timeObjects;
			}

			// These are SVG elements in the voice that will have their opacity changed when the voice is disabled.
			function getGraphicElements(systemIndex, voiceElem)
			{
				var graphicElements = [], type, i, noteObjectElems, noteObjectElem;

				noteObjectElems = voiceElem.children;
				for(i = 0; i < noteObjectElems.length; ++i)
				{
					noteObjectElem = noteObjectElems[i];
					type = noteObjectElem.getAttribute('class');
					if(type === 'staffName'
						|| type === 'clef'
						|| type === 'cautionaryChord'
						|| type === 'beamBlock'
						|| type === 'chord' || type === 'rest'
						|| type === 'smallClef'
						|| type === 'barline'
						|| type === 'endBarline' // note that this is a group (a barline and a thickBarline)
						|| type === 'inputStaffName'
						|| type === 'inputClef'
						|| type === 'inputBeamBlock'
						|| type === 'inputChord' || type === 'inputRest'
						|| type === 'inputSmallClef')
					{
						graphicElements.push(noteObjectElem);
					}
				}

				return graphicElements;
			}

			function setVoices(systemIndex, staff, staffElem, voiceType, viewBoxScale1)
			{
				var voiceElems, voiceElem, isFirstVoiceInStaff;

				voiceElems = staffElem.getElementsByClassName(voiceType);
				isFirstVoiceInStaff = true;
				for(voiceIndex = 0; voiceIndex < voiceElems.length; ++voiceIndex)
				{
					voiceElem = voiceElems[voiceIndex];
					voice = staff.voices[voiceIndex];
					voice.timeObjects = getTimeObjects(systemIndex, voiceElem, viewBoxScale1);
					if(voice.timeObjects[0].alignment !== undefined)  // is undefined if the voice is invisible
					{
						voice.graphicElements = getGraphicElements(systemIndex, voiceElem); // will be used to set opacity when the voice is disabled
						if(isFirstVoiceInStaff === true)
						{
							voice.staffLinesElem = staffElem.getElementsByClassName("staffLines");
							isFirstVoiceInStaff = false;
						}
					}
				}
			}

			function getSystemOutputVoiceObjects(systemIndex, systemElem, system, viewBoxScale1)
			{
				var staffElems, staffElem,
					staff,
					staffIndex;

				// Moritz now always enforces that
				// 1. Every system contains all tracks
				// 2. Each track's MidiChannel is the same as its index (from top to bottom in each system).
				// The top track therefore always has MidiChannel == 0, and the
				// MidiChannels increase contiguously from top to bottom of each system.
				function getMidiChannelPerOutputTrack(system)
				{
					let staves = system.staves, staffIndex, voiceIndex, voices, trackIndex = 0;

					midiChannelPerOutputTrack.length = 0; // global array

					for(staffIndex = 0; staffIndex < staves.length; staffIndex++)
					{
						if(staves[staffIndex].isOutput === false)
						{
							break;
						}
						voices = staves[staffIndex].voices;
						for(voiceIndex = 0; voiceIndex < voices.length; voiceIndex++)
						{
							midiChannelPerOutputTrack.push(trackIndex++);
						}
					}
				}

				staffElems = getStaffElems(systemElem);
				staffIndex = 0;
				while(staffIndex < staffElems.length)
				{
					staff = system.staves[staffIndex];
					if(staff.isOutput === false)
					{
						break;
					}
					staffElem = staffElems[staffIndex];
					setVoices(systemIndex, staff, staffElem, "voice", viewBoxScale1);
					staffIndex++;
				}

				if(systemIndex === 0)
				{
					getMidiChannelPerOutputTrack(systems[0]);
				}
			}

			function getSystemInputVoiceObjects(systemIndex, systemElem, system, viewBoxScale1)
			{
				var staffElems, staffElem,
					staff,
					staffIndex,
					nOutputTracks = midiChannelPerOutputTrack.length;

				staffElems = getStaffElems(systemElem);

				for(staffIndex = nOutputTracks; staffIndex < staffElems.length; ++staffIndex)
				{
					staff = system.staves[staffIndex];
					staffElem = staffElems[staffIndex];
					setVoices(systemIndex, staff, staffElem, "inputVoice", viewBoxScale1);
					staffIndex++;
				}
			}

			// Sets the msPosition of each timeObject (input and output rests and chords) in the voice.timeObjects arrays.
			function setMsPositions(systems)
			{
				var nStaves, staffIndex, nVoices, voiceIndex, nSystems, systemIndex, msPosition,
					timeObject, timeObjects, nTimeObjects, tIndex;

				nSystems = systems.length;
				nStaves = systems[0].staves.length;
				msPosition = 0;
				for(staffIndex = 0; staffIndex < nStaves; ++staffIndex)
				{
					nVoices = systems[0].staves[staffIndex].voices.length;
					for(voiceIndex = 0; voiceIndex < nVoices; ++voiceIndex)
					{
						for(systemIndex = 0; systemIndex < nSystems; ++systemIndex)
						{
							timeObjects = systems[systemIndex].staves[staffIndex].voices[voiceIndex].timeObjects;
							if(timeObjects !== undefined)
							{
								nTimeObjects = timeObjects.length;
								for(tIndex = 0; tIndex < nTimeObjects; ++tIndex)
								{
									timeObject = timeObjects[tIndex];

									if(timeObject instanceof MidiChord || timeObject instanceof MidiRest ||
										timeObject instanceof InputChordDef || timeObject instanceof InputRestDef)
									{
										Object.defineProperty(timeObject, "msPositionInScore", { value: msPosition, writable: false });
									}

									msPosition += timeObject.msDurationInScore;
								}
							}
						}
						msPosition = 0;
					}

				}
			}

			// If the first timeObject in a voice has no Alignment attribute,
			// it is set to the value for the system.
			function setFirstTimeObjectAlignment(systems)
			{
				var i, nSystems = systems.length, system,
					firstAlignment;

				function getFirstAlignment(system)
				{
					var j, k, staff, nStaves = system.staves.length,
						voice, nVoices, firstAlignment = -1;

					for(j = 0; j < nStaves; ++j)
					{
						staff = system.staves[j];
						nVoices = staff.voices.length;
						for(k = 0; k < nVoices; ++k)
						{
							voice = staff.voices[k];
							if(voice.timeObjects[0].alignment !== undefined)
							{
								firstAlignment = voice.timeObjects[0].alignment;
								break;
							}
						}
						if(firstAlignment > -1)
						{
							break;
						}
					}
					return firstAlignment;
				}

				function setFirstAlignment(system, firstAlignment)
				{
					var j, k, staff, nStaves = system.staves.length,
						voice, nVoices;

					for(j = 0; j < nStaves; ++j)
					{
						staff = system.staves[j];
						nVoices = staff.voices.length;
						for(k = 0; k < nVoices; ++k)
						{
							voice = staff.voices[k];
							if(voice.timeObjects !== undefined && voice.timeObjects[0].alignment === undefined)
							{
								voice.timeObjects[0].alignment = firstAlignment;
							}
						}
					}
				}

				for(i = 0; i < nSystems; ++i)
				{
					system = systems[i];
					firstAlignment = getFirstAlignment(system);
					setFirstAlignment(system, firstAlignment);
				}
			}

			// These are needed for aligning start and end markers.
			function appendVoiceEndTimeObjects(systems)
			{
				var systemIndex, nSystems = systems.length, system,
					j, nStaves, staff,
					k, nVoices, voice,
					rightmostAlignment = systems[0].right,
					startMsPositionOfNextSystem,
					lastTimeObject,
					endMsPositionInScore;

				function getStartMsPositionOfNextSystem(staves)
				{
					var i, j, firstMsPos, nStaves = staves.length, minMsPos = Number.MAX_VALUE;

					for(i = 0; i < nStaves; ++i)
					{
						staff = staves[i];
						for(j = 0; j < staff.voices.length; ++j)
						{
							if(staff.voices[j].timeObjects !== undefined)
							{
								firstMsPos = staff.voices[j].timeObjects[0].msPositionInScore;
								minMsPos = (minMsPos < firstMsPos) ? minMsPos : firstMsPos;
							}
						}
					}
					return minMsPos;
				}

				for(systemIndex = 0; systemIndex < nSystems; ++systemIndex)
				{
					system = systems[systemIndex];
					if(systemIndex < nSystems - 1)
					{
						startMsPositionOfNextSystem = getStartMsPositionOfNextSystem(systems[systemIndex + 1].staves);
					}
					nStaves = system.staves.length;
					for(j = 0; j < nStaves; ++j)
					{
						staff = system.staves[j];
						nVoices = staff.voices.length;
						for(k = 0; k < nVoices; ++k)
						{
							voice = staff.voices[k];
							if(voice.timeObjects !== undefined)
							{
								timeObject = {}; // the final barline in the voice (used when changing speed)
								Object.defineProperty(timeObject, "msDurationInScore", { value: 0, writable: false });
								Object.defineProperty(timeObject, "systemIndex", { value: systemIndex, writable: false });
								Object.defineProperty(timeObject, "alignment", { value: rightmostAlignment, writable: false });
								if(systemIndex < nSystems - 1)
								{
									Object.defineProperty(timeObject, "msPositionInScore", { value: startMsPositionOfNextSystem, writable: false });
								}
								else
								{
									lastTimeObject = voice.timeObjects[voice.timeObjects.length - 1];
									endMsPositionInScore = lastTimeObject.msPositionInScore + lastTimeObject.msDurationInScore;
									Object.defineProperty(timeObject, "msPositionInScore", { value: endMsPositionInScore, writable: false });
								}

								voice.timeObjects.push(timeObject);
							}
						}
					}
				}
			}

			/*************** end of getVoiceObjects function definitions *****************************/

			for(i = 0; i < systemElems.length; ++i)
			{
				systemElem = systemElems[i];
				system = systems[i];

				getSystemOutputVoiceObjects(i, systemElem, system, viewBoxScale);

				if(isLivePerformance)
				{
					getSystemInputVoiceObjects(i, systemElem, system, viewBoxScale);
				}
			}

			setMsPositions(systems);
			setFirstTimeObjectAlignment(systems);
			appendVoiceEndTimeObjects(systems);

			lastSystemTimeObjects = systems[systems.length - 1].staves[0].voices[0].timeObjects;
			finalBarlineInScore = lastSystemTimeObjects[lastSystemTimeObjects.length - 1]; // 'global' object
		}

		function setMarkers(systems, isLivePerformance)
		{
			var i, j, nSystems = systems.length, system;
			for(i = 0; i < nSystems; ++i)
			{
				system = systems[i];
				system.startMarker.setVisible(false);
				system.runningMarker.setVisible(false);
				system.endMarker.setVisible(false);
				system.timePointer.setVisible(false);

				system.runningMarker.setTimeObjects(system, isLivePerformance, trackIsOnArray);
				for(j = 0; j < system.staves.length; ++j)
				{
					if(!isNaN(system.staves[j].voices[0].timeObjects[0].alignment))
					{
						system.startMarker.moveTo(system.staves[j].voices[0].timeObjects[0]);
						break;
					}
				}

				system.runningMarker.moveTo(system.startMarker.msPositionInScore); // system.startMarker is system.runningMarker.startMarker 
			}

			startMarker = systems[0].startMarker;
			startMarker.setVisible(true);

			runningMarker = systems[0].runningMarker;
			// runningMarker (and maybe timePointer) will be set visible later.

			endMarker = systems[systems.length - 1].endMarker;
			endMarker.moveTo(finalBarlineInScore);
			endMarker.setVisible(true);
		}

		function setTrackAttributes(outputTracks, inputTracks, system0staves)
		{
			var outputTrackIndex = 0, inputTrackIndex = 0, staffIndex, voiceIndex, nStaves = system0staves.length, staff, voice;
			for(staffIndex = 0; staffIndex < nStaves; ++staffIndex)
			{
				staff = system0staves[staffIndex];
				for(voiceIndex = 0; voiceIndex < staff.voices.length; ++voiceIndex)
				{
					voice = staff.voices[voiceIndex];
					if(voice.isOutput === true)
					{
						outputTracks.push(new Track());
						outputTracks[outputTrackIndex].midiObjects = [];
						outputTrackIndex++;
					}
					else // voice.isOutput === false 
					{
						inputTracks.push(new Track());
						inputTracks[inputTrackIndex].inputObjects = [];
						inputTrackIndex++;
					}
				}
			}
		}

		function getInputKeyRange(inputTracks)
		{
			var i, j, k, nTracks = inputTracks.length, track, inputNotes, key,
				inputKeyRange = {}, bottomKey = Number.MAX_VALUE, topKey = Number.MIN_VALUE;

			for(i = 0; i < nTracks; ++i)
			{
				track = inputTracks[i];
				for(j = 0; j < track.inputObjects.length; ++j)
				{
					if(track.inputObjects[j].inputNotes !== undefined)
					{
						// an inputChord
						inputNotes = track.inputObjects[j].inputNotes;
						for(k = 0; k < inputNotes.length; ++k)
						{
							key = inputNotes[k].notatedKey;
							bottomKey = (bottomKey < key) ? bottomKey : key;
							topKey = (topKey > key) ? topKey : key;
						}
					}
				}
			}

			inputKeyRange.bottomKey = bottomKey;
			inputKeyRange.topKey = topKey;

			return inputKeyRange;
		}

		function setRegionData(outputTracks)
		{
			function setGlobalRegionDefSequence(regionDefs, regionNameSequence)
			{
				function getRegionDef(regionDefs, name)
				{
					let regionDef = { name: "" };
					for(let j = 0; j < regionDefs.length; ++j)
					{
						if(name.localeCompare(regionDefs[j].name) === 0)
						{
							regionDef = regionDefs[j];
							break;
						}
					}
					if(regionDef.name.length === 0)
					{
						throw "regionDef is not defined";
					}
					return regionDef;
				}

				regionDefSequence = []; // global in score
				for(let i = 0; i < regionNameSequence.length; ++i)
				{
					let regionName = regionNameSequence[i];
					let regionDef = getRegionDef(regionDefs, regionName);
					regionDefSequence.push(regionDef); // global in score
				}
			}

			for(let outputTrack of outputTracks)
			{
				outputTrack.setRegionLinks(regionDefs, regionNameSequence);
			}

			setGlobalRegionDefSequence(regionDefs, regionNameSequence);
		}

		getVoiceObjects();

		setTrackAttributes(outputTracks, inputTracks, systems[0].staves);

		nStaves = systems[0].staves.length;

		for(sysIndex = 0; sysIndex < nSystems; ++sysIndex)
		{
			system = systems[sysIndex];
			outputTrackIndex = 0;
			for(staffIndex = 0; staffIndex < nStaves; ++staffIndex)
			{
				staff = system.staves[staffIndex];
				nVoices = staff.voices.length;
				for(voiceIndex = 0; voiceIndex < nVoices; ++voiceIndex)
				{
					voice = staff.voices[voiceIndex];
					if(voice.isOutput === true)
					{
						nTimeObjects = voice.timeObjects.length;
						outputTrack = outputTracks[outputTrackIndex];
						for(timeObjectIndex = 0; timeObjectIndex < nTimeObjects; ++timeObjectIndex)
						{
							timeObject = voice.timeObjects[timeObjectIndex];
							if(timeObject instanceof MidiChord || timeObject instanceof MidiRest)
							{
								outputTrack.midiObjects.push(timeObject);
							}
						}
						++outputTrackIndex;
					}
				}
			}
		}

		if(isLivePerformance)
		{
			for(sysIndex = 0; sysIndex < nSystems; ++sysIndex)
			{
				system = systems[sysIndex];
				inputTrackIndex = 0;
				for(staffIndex = 0; staffIndex < nStaves; ++staffIndex)
				{
					staff = system.staves[staffIndex];
					nVoices = staff.voices.length;
					for(voiceIndex = 0; voiceIndex < nVoices; ++voiceIndex)
					{
						voice = staff.voices[voiceIndex];
						nTimeObjects = voice.timeObjects.length;
						if(voice.isOutput === false)
						{
							inputTrack = inputTracks[inputTrackIndex];
							for(timeObjectIndex = 0; timeObjectIndex < nTimeObjects; ++timeObjectIndex)
							{
								timeObject = voice.timeObjects[timeObjectIndex];
								if(timeObject instanceof InputChordDef)
								{
									inputChord = new InputChord(timeObject, outputTracks, sysIndex); // the outputTracks should already be complete here
									inputTrack.inputObjects.push(inputChord);
								}
								// inputRestDefs have been used to calculate inputChordDef.msPositionInScore, but are no longer needed.
							}
							++inputTrackIndex;
						}
					}
				}
			}
		}

		tracksData.inputTracks = inputTracks;
		tracksData.outputTracks = outputTracks;

		setRegionData(outputTracks);

		setMarkers(systems, isLivePerformance);

		// cursor is accessed outside the score using a getter function
		cursor = new Cursor(markersLayer, endMarker.msPositionInScore, systems, viewBoxScale, systemChanged);

		//    if inputTracks contains one or more tracks, the following attributes are also defined (on tracksData):
		//        inputKeyRange.bottomKey
		//        inputKeyRange.topKey
		if(inputTracks.length > 0)
		{
			tracksData.inputKeyRange = getInputKeyRange(inputTracks);
		}
	},

	getTracksData = function()
	{
		return tracksData;
	},

	getMarkersLayer = function()
	{
		return markersLayer; // is undefined before a score is loaded
	},

	getCursor = function()
	{
		return cursor; // is undefined before a score is loaded
	},

	getStartMarker = function()
	{
		return startMarker; // is undefined before a score is loaded
	},

	getRegionDefSequence = function()
	{
		return regionDefSequence; // is undefined before a score is loaded
	};

export class Score
{	
	// an empty score
	constructor(callback)
	{
		systems = [];

		systemChanged = callback;

		// functions called when setting the start or end marker
		this.setStartMarkerClick = setStartMarkerClick;
		this.setEndMarkerClick = setEndMarkerClick;

		// functions called when clicking the sendStartMarkerToStart of senEndMarkerToEnd buttons
		this.sendStartMarkerToStart = sendStartMarkerToStart;
		this.sendEndMarkerToEnd = sendEndMarkerToEnd;

		this.startMarkerMsPosition = startMarkerMsPosition;
		this.endMarkerMsPosition = endMarkerMsPosition;
		this.getReadOnlyTrackIsOnArray = getReadOnlyTrackIsOnArray;

		// Called when the start button is clicked in the top options panel,
		// and when setOptions button is clicked at the top of the score.
		// If the startMarker is not fully visible in the svgPagesDiv, move
		// it to the top of the div.
		this.moveStartMarkerToTop = moveStartMarkerToTop;

		// Recalculates the timeObject lists for the runningMarkers (1 marker per system),
		// using trackIsOnArray (tracksControl.trackIsOnArray) to take into account which tracks are actually performing.
		// When the score is first read, all tracks perform by default.
		this.setRunningMarkers = setRunningMarkers;
		// Advances the running marker to the following timeObject (in any channel)
		// if the msPosition argument is >= that object's msPosition. Otherwise does nothing.
		this.advanceRunningMarker = advanceRunningMarker;
		this.hideRunningMarkers = hideRunningMarkers;
		this.moveRunningMarkersToStartMarkers = moveRunningMarkersToStartMarkers;

		this.setConducting = setConducting;
		this.getConductor = getConductor;
		this.conduct = conduct;

		this.getEmptySystems = getEmptySystems;

		// tracksData is an object having the following defined attributes:
		//        inputTracks[] - an array of tracks containing inputChords
		//        outputTracks[] - an array of tracks containing outputChords and outputRests
		//        if inputTracks contains one or more tracks, the following attributes are also defined (on tracksData):
		//            inputKeyRange.bottomKey
		//            inputKeyRange.topKey
		this.setTracksData = setTracksData;
		this.getTracksData = getTracksData;

		// The markersLayer is set when a specific score is loaded.
		// It contains the cursor line and the start- and endMarkers for each system in the score.
		// It is also the transparent, clickable surface used when setting the start and end markers.
		this.getMarkersLayer = getMarkersLayer;
		this.getCursor = getCursor;
		this.getStartMarker = getStartMarker;
		this.getRegionDefSequence = getRegionDefSequence;

		// The TracksControl controls the display, and should be the only module to call this function.
		this.refreshDisplay = refreshDisplay;
	}
}

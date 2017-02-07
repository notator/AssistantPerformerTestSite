/*
*  copyright 2012 James Ingram
*  http://james-ingram-act-two.de/
*
*  Code licensed under MIT
*  https://github.com/notator/assistant-performer/blob/master/License.md
*
*  ap/Score.js
*  The _AP.score namespace which defines the
*    Score(callback) constructor.
*  
*/


/*jslint white:true */
/*global _AP,  window,  document, performance, console */

_AP.namespace('_AP.score');

_AP.score = (function (document)
{
    "use strict";

    var
    CMD = _AP.constants.COMMAND,
    Message = _AP.message.Message,
    Track = _AP.track.Track,

    Markers = _AP.markers,
    InputChordDef = _AP.inputChordDef.InputChordDef,
    InputChord = _AP.inputChord.InputChord,
    InputRest = _AP.inputRest.InputRest,

    BLACK_COLOR = "#000000",
    GREY_COLOR = "#7888A0",
    ENABLED_INPUT_TITLE_COLOR = "#3333EE",
    DISABLED_PINK_COLOR = "#FFBBBB",

    outputTrackPerMidiChannel = [], // only output tracks

    // This array is initialized to all tracks on (=true) when the score is loaded,
    // and reset when the tracksControl calls refreshDisplay().
    trackIsOnArray = [], // all tracks, including input tracks

    viewBoxScale,

    // The frames around each svgPage
    markersLayers = [],

    systemElems = [], // all the SVG elements having class "system"

    // See comments in the publicAPI definition at the bottom of this file.
    systems = [], // an array of all the systems

    // This value is changed when the start runtime button is clicked.
    // It is used when setting the positions of the start and end markers.
    isLivePerformance = false,

    startMarker,
    runningMarker,
    endMarker,
    runningMarkerHeightChanged, // callback, called when runningMarker changes systems

    finalBarlineInScore,

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

    // Sends a noteOff to all notes on all channels on the midi output device.
    allNotesOff = function (midiOutputDevice)
    {
        var 
        noteOffMessage, channelIndex, noteIndex,
        nOutputChannels = outputTrackPerMidiChannel.length,
        now = performance.now();

        if (midiOutputDevice !== undefined && midiOutputDevice !== null)
        {
            for (channelIndex = 0; channelIndex < nOutputChannels; ++channelIndex)
            {
                for (noteIndex = 0; noteIndex < 128; ++noteIndex)
                {
                    noteOffMessage = new Message(CMD.NOTE_OFF + channelIndex, noteIndex, 127);
                    midiOutputDevice.send(noteOffMessage.data, now);
                }
            }
        }
    },

    hideStartMarkersExcept = function (startMarker)
    {
        var i, sMarker;
        for (i = 0; i < systems.length; ++i)
        {
            sMarker = systems[i].startMarker;
            if (sMarker === startMarker)
            {
                sMarker.setVisible(true);
            }
            else
            {
                sMarker.setVisible(false);
            }
        }
    },

    hideEndMarkersExcept = function (endMarker)
    {
        var i, eMarker;
        for (i = 0; i < systems.length; ++i)
        {
            eMarker = systems[i].endMarker;
            if (eMarker === endMarker)
            {
                eMarker.setVisible(true);
            }
            else
            {
                eMarker.setVisible(false);
            }
        }
    },

    getTimeObjectsArray = function (system)
    {
        var i, nStaves = system.staves.length, j, voice, nVoices, timeObjects, timeObjectsArray = [];

        for (i = 0; i < nStaves; ++i)
        {
            nVoices = system.staves[i].voices.length;
            for (j = 0; j < nVoices; ++j)
            {
                voice = system.staves[i].voices[j];
                timeObjects = voice.timeObjects;
                timeObjectsArray.push(timeObjects);
            }
        }
        return timeObjectsArray;
    },

    // Returns the performing restDef or (in any performing input or output track, depending on findInput) midiChordDef or inputChordDef closest to alignment.
    // If trackIndex is defined, the returned timeObject will be in that track.
    // If there are no chordDefs matching the arguments (i.e. if all the timeObjects are restDefs), the returned timeObject will be null.
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
                        if((!findInput)  // timeObject is a restDef or midiChordDef in an outputVoice
                        || (findInput &&
                            (timeObject.inputChordDef === undefined // a rest in an inputVoice
                            || (timeObject.inputChordDef !== undefined && hasPerformingTrack(timeObject.inputChordDef, trackIsOnArray)))))
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
        var nOutputTracks = outputTrackPerMidiChannel.length;

        if(isLivePerformance === false)
        {
            timeObject = findPerformingOutputTimeObject(timeObjectsArray, nOutputTracks, trackIsOnArray, timeObject.alignment);
        }
        else
        {
            timeObject = findPerformingInputTimeObject(timeObjectsArray, nOutputTracks, trackIsOnArray, timeObject.alignment);
        }

        if(timeObject.msPosition < endMarker.msPosition())
        {
            startMarker.moveTo(timeObject);
        }
    },

    // This function is called by the tracksControl whenever a track's on/off state is toggled.
    // It draws the staves with the right colours and, if necessary, moves the start marker to a chord.
    refreshDisplay = function(trackIsOnArrayArg)
    {
        var i, system = systems[startMarker.systemIndex()],
        startMarkerAlignment = startMarker.timeObject().alignment,
        timeObjectsArray = getTimeObjectsArray(system), timeObject,
        nOutputTracks = outputTrackPerMidiChannel.length;

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
    svgPageClicked = function (e, state)
    {
        var frame = e.target,
            cursorX = e.pageX,
            cursorY = e.pageY + frame.originY,
            systemIndex, system,
            timeObjectsArray, timeObject, trackIndex, nOutputTracks = outputTrackPerMidiChannel.length;

        // cursorX and cursorY now use the <body> element as their frame of reference.
        // this is the same frame of reference as in the systems.
        // systems is a single global array (inside this namespace)of all systems.
        // This is important when identifying systems, and when performing.

        // Returns the system having stafflines closest to cursorY.
        function findSystemIndex(cursorY)
        {
            var i, topLimit, bottomLimit, systemIndex1;

            if (systems.length === 1)
            {
                systemIndex1 = 0;
            }
            else
            {
                topLimit = -1;
                for (i = 0; i < systems.length - 1; ++i)
                {
                    bottomLimit = (systems[i].bottomLineY + systems[i + 1].topLineY) / 2;
                    if (cursorY >= topLimit && cursorY < bottomLimit)
                    {
                        systemIndex1 = i;
                        break;
                    }
                    topLimit = bottomLimit;
                }

                if (systemIndex1 === undefined)
                {
                    systemIndex1 = systems.length - 1; // last system
                }
            }
            return systemIndex1;
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
                if(staff.topLineY !== undefined ) 
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
            if (nVoices === 1)
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

        function getEndMarkerTimeObject(timeObject, cursorX, systems, systemIndex)
        {
            var returnObject,
                voiceTimeObjects = systems[systemIndex].staves[0].voices[0].timeObjects,
                rightBarlineTimeObject = voiceTimeObjects[voiceTimeObjects.length - 1],
                earliestAlignment;

            function findEarliestChordAlignment(system)
            {
                var i, j, k, staff, earliestAlignment = Number.MAX_VALUE, timeObjects, timeObject;

                for(i = 0; i < system.staves.length; ++i)
                {
                    staff = system.staves[i];
                    for(j = 0; j < staff.voices.length; ++j)
                    {
                        timeObjects = staff.voices[j].timeObjects;
                        for(k = 0; k < timeObjects.length; ++k)
                        {
                            timeObject = timeObjects[k];
                            if(timeObject.midiChordDef !== undefined || timeObject.inputChordDef !== undefined)
                            {
                                break;
                            }
                        }
                        earliestAlignment = (earliestAlignment < timeObject.alignment) ? earliestAlignment : timeObject.alignment;
                    }
                }
                return earliestAlignment;
            }

            earliestAlignment = findEarliestChordAlignment(systems[systemIndex]);

            if(cursorX > rightBarlineTimeObject.alignment || ((rightBarlineTimeObject.alignment - cursorX) < (cursorX - timeObject.alignment)))
            {
                returnObject = rightBarlineTimeObject;
            }
            else if(timeObject.alignment === earliestAlignment)
            {
                returnObject = null;
            }
            else
            {
                returnObject = timeObject;
            }
            return returnObject;
        }

        systemIndex = findSystemIndex(cursorY);
        if (systemIndex !== undefined)
        {
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
                        if(timeObject.msPosition < endMarker.msPosition())
                        {
                            startMarker = system.startMarker;
                            hideStartMarkersExcept(startMarker);
                            updateStartMarker(timeObjectsArray, timeObject);
                        }
                        break;
                    case 'settingEnd':
                        // returns the rightmost barline if that is closer to cursorX than the timeObject
                        // returns null if timeObject.alignment is the alignmentx of the first chord on the system.
                        timeObject = getEndMarkerTimeObject(timeObject, cursorX, systems, systemIndex);
                        if(timeObject !== null && startMarker.msPosition() < timeObject.msPosition)
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
        }
    },

    showRunningMarker = function ()
    {
        runningMarker.setVisible(true);
    },

    hideRunningMarkers = function ()
    {
        var i, nSystems = systems.length;
        for (i = 0; i < nSystems; ++i)
        {
            systems[i].runningMarker.setVisible(false);
        }
    },

    moveRunningMarkerToStartMarker = function ()
    {
        hideRunningMarkers();
        runningMarker = systems[startMarker.systemIndex()].runningMarker;
        runningMarker.moveToStartMarker(startMarker);
    },

    // Called when the go button is clicked.
    setRunningMarkers = function ()
    {
        var sysIndex, nSystems = systems.length, system;

        for (sysIndex = 0; sysIndex < nSystems; ++sysIndex)
        {
            system = systems[sysIndex];
            system.runningMarker.setTimeObjects(system, isLivePerformance, trackIsOnArray);
        }
        moveRunningMarkerToStartMarker();
        showRunningMarker();
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
    getEmptySystems = function (isLivePerformanceArg)
    {
        var system, svgPageEmbeds, viewBox, nPages, runningViewBoxOriginY,
            i, j, k,
            svgPage, svgElem, svgChildren, systemsContainerChildren, markersLayer,
            pageHeight, pageSystems, attrVal;

        function resetContent(isLivePerformanceArg)
        {
            markersLayers.length = 0;
            systems.length = 0;
            systemElems.length = 0;
            //while (markersLayers.length > 0)
            //{
            //    markersLayers.pop();
            //}
            //while (systems.length > 0)
            //{
            //    systems.pop();
            //    systemElems.pop();
            //}

            isLivePerformance = isLivePerformanceArg;
            outputTrackPerMidiChannel = []; // reset global
            trackIsOnArray = []; // reset global
        }

        function getEmptySystem(viewBoxOriginY, viewBoxScale, systemElem)
        {
            var i, j,
                systemDy, staffDy,
                staffElems, staffElem, stafflinesElems,
                outputVoiceElem, outputVoiceElems, inputVoiceElem, inputVoiceElems,                
                staff, stafflineInfo,
                voice;

            function getInputAndOutputElems(containerElem)
            {
                var i, containerChildren, inputAndOutputElems = [], attrVal;

                containerChildren = containerElem.children;
                for(i = 0; i < containerChildren.length; ++i)
                {
                    attrVal = containerChildren[i].getAttribute("score:hasMidi");
                    if(attrVal === "true" || attrVal === "false")
                    {
                        inputAndOutputElems.push(containerChildren[i]);
                    }
                }
                return inputAndOutputElems;
            }

            // returns an info object containing left, right and stafflineYs
            function getStafflineInfo(stafflinesElem, dy)
            {
                var i, rStafflineInfo = {}, stafflineYs = [], left, right, stafflineY,
                lineElem, svgStafflines = [], staffLinesElemChildren = stafflinesElem.children;

                for (i = 0; i < staffLinesElemChildren.length; ++i)
                {
                    console.assert(staffLinesElemChildren[i].nodeName === "line");
                    lineElem = staffLinesElemChildren[i];
                    svgStafflines.push(lineElem);
                    stafflineY = parseFloat(lineElem.getAttribute('y1')) + dy;
                    stafflineYs.push((stafflineY / viewBoxScale) + viewBoxOriginY);
                    left = parseFloat(lineElem.getAttribute('x1'));
                    left /= viewBoxScale;
                    right = parseFloat(lineElem.getAttribute('x2'));
                    right /= viewBoxScale;
                }
                rStafflineInfo.left = left;
                rStafflineInfo.right = right;
                rStafflineInfo.stafflineYs = stafflineYs;
                rStafflineInfo.svgStafflines = svgStafflines;

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
                function setTitle(staff, titleColor)
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

                function setStafflines(staff, colour)
                {
                    var i, nLines = staff.svgStafflines.length;
                    for(i = 0; i < nLines; ++i) // could be any number of lines
                    {
                        staff.svgStafflines[i].style.stroke = colour;
                    }
                }

                function setGreyDisplay(staff)
                {
                    setTitle(staff, GREY_COLOR);
                    setStafflines(staff, GREY_COLOR);
                }

                function setBlackDisplay(staff)
                {
                    setTitle(staff, BLACK_COLOR);
                    setStafflines(staff, BLACK_COLOR);
                }

                function setLiveInputDisplay(staff)
                {
                    setTitle(staff, ENABLED_INPUT_TITLE_COLOR);
                    setStafflines(staff, BLACK_COLOR);
                }

                function setDisabledInputDisplay(staff)
                {
                    setTitle(staff, DISABLED_PINK_COLOR);
                    setStafflines(staff, DISABLED_PINK_COLOR);
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
                var i, sysElemChildren, leftToRightElem, topToBottomElem;
                
                sysElemChildren = systemElem.children;
                for(i = 0; i < sysElemChildren.length; ++i)
                {
                    if(sysElemChildren[i].nodeName === "score:leftToRight")
                    {
                        leftToRightElem = sysElemChildren[i];
                        system.markersTop = systemDY + parseInt(leftToRightElem.getAttribute("systemTop"), 10);
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

            staffElems = getInputAndOutputElems(systemElem);

            for(i = 0; i < staffElems.length; ++i)
            {
                staffElem = staffElems[i];
                staff = {};
                staffDy = systemDy + getDy(staffElem);
                staff.isOutput = (staffElem.getAttribute("score:hasMidi") === "true");
                staff.isVisible = ((staffElem.getAttribute("score:invisible") === "1") === false);
                staff.voices = [];
                system.staves.push(staff);

                if(staff.isOutput === true)
                {
                    outputVoiceElems = getInputAndOutputElems(staffElem);
                    for(j = 0; j < outputVoiceElems.length; ++j)
                    {
                        outputVoiceElem = outputVoiceElems[j];
                        staff.nameElem = getNameElem(outputVoiceElem);
                        voice = {};
                        voice.isOutput = true;
                        staff.voices.push(voice);
                    }
                }
                else // input staff
                {
                    inputVoiceElems = getInputAndOutputElems(staffElem);
                    for(j = 0; j < inputVoiceElems.length; ++j)
                    {
                        inputVoiceElem = inputVoiceElems[j];
                        staff.nameElem = getNameElem(inputVoiceElem);
                        voice = {};
                        voice.isOutput = false;
                        staff.voices.push(voice);
                    }
                }

                if(staff.isVisible)
                {
                    stafflinesElems = staffElem.getElementsByClassName("stafflines");
                    if(stafflinesElems !== undefined && stafflinesElems.length > 0)
                    {
                        stafflineInfo = getStafflineInfo(stafflinesElems[0], staffDy);
                        system.left = stafflineInfo.left;
                        system.right = stafflineInfo.right;

                        staff.topLineY = stafflineInfo.stafflineYs[0];
                        staff.bottomLineY = stafflineInfo.stafflineYs[stafflineInfo.stafflineYs.length - 1];
                        staff.svgStafflines = stafflineInfo.svgStafflines; // top down

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
        // The element contains the transparent, clickable rect and the start-, running- and
        // end-markers for each system on the page.
        function createMarkersLayer(svgElem, viewBox, runningViewBoxOriginY, pageSystems)
        {
            var i, markersLayer = document.createElementNS("http://www.w3.org/2000/svg", "g"),
                rect = document.createElementNS("http://www.w3.org/2000/svg", 'rect');

            function createMarkers(markersLayer, viewBox, system, systIndex)
            {
                var startMarkerElem = document.createElementNS("http://www.w3.org/2000/svg", "g"),
                    runningMarkerElem = document.createElementNS("http://www.w3.org/2000/svg", "g"),
                    endMarkerElem = document.createElementNS("http://www.w3.org/2000/svg", "g"),
                    startMarkerLine = document.createElementNS("http://www.w3.org/2000/svg", 'line'),
                    startMarkerCircle = document.createElementNS("http://www.w3.org/2000/svg", 'circle'),
                    runningMarkerLine = document.createElementNS("http://www.w3.org/2000/svg", 'line'),
                    endMarkerLine = document.createElementNS("http://www.w3.org/2000/svg", 'line'),
                    endMarkerRect = document.createElementNS("http://www.w3.org/2000/svg", 'rect');

                startMarkerLine.setAttribute("x1", "0");
                startMarkerLine.setAttribute("y1", "0");
                startMarkerLine.setAttribute("x2", "0");
                startMarkerLine.setAttribute("y2", "0");
                startMarkerLine.setAttribute("style", "stroke-width:1px");

                startMarkerCircle.setAttribute("cx", "0");
                startMarkerCircle.setAttribute("cy", "0");
                startMarkerCircle.setAttribute("r", "0");
                startMarkerCircle.setAttribute("style", "stroke-width:1px");

                runningMarkerLine.setAttribute("x1", "0");
                runningMarkerLine.setAttribute("y1", "0");
                runningMarkerLine.setAttribute("x2", "0");
                runningMarkerLine.setAttribute("y2", "0");
                runningMarkerLine.setAttribute("style", "stroke-width:1px");

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

                startMarkerElem.appendChild(startMarkerLine);
                startMarkerElem.appendChild(startMarkerCircle);
                runningMarkerElem.appendChild(runningMarkerLine);
                endMarkerElem.appendChild(endMarkerLine);
                endMarkerElem.appendChild(endMarkerRect);

                markersLayer.appendChild(startMarkerElem);
                markersLayer.appendChild(runningMarkerElem);
                markersLayer.appendChild(endMarkerElem);

                system.startMarker = new Markers.StartMarker(system, systIndex, startMarkerElem, markersLayer.rect.originY, viewBox.scale);
                system.runningMarker = new Markers.RunningMarker(system, systIndex, runningMarkerElem, markersLayer.rect.originY, viewBox.scale);
                system.endMarker = new Markers.EndMarker(system, systIndex, endMarkerElem, markersLayer.rect.originY, viewBox.scale);
            }

            markersLayer.setAttribute("style", "display:inline");

            rect.setAttribute("x", viewBox.x.toString());
            rect.setAttribute("y", viewBox.y.toString());
            rect.setAttribute("width", viewBox.width.toString());
            rect.setAttribute("height", viewBox.height.toString());
            rect.setAttribute("style", "stroke:none; fill:#ffffff; fill-opacity:0");
            rect.originY = runningViewBoxOriginY;
            markersLayer.appendChild(rect);
            markersLayer.rect = rect;

            for(i = 0; i < pageSystems.length; i++)
            {
                createMarkers(markersLayer, viewBox, pageSystems[i], i);
            }

            svgElem.appendChild(markersLayer);

            return markersLayer;
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

        function getSVGElem(svgPage)
        {
            var i, children = svgPage.children, svgElem;

            for(i = 0; i < children.length; ++i)
            {
                if(children[i].nodeName === 'svg')
                {
                    svgElem = children[i];
                    break;
                }
            }

            return svgElem;
        }

        // Sets the global viewBox object and the sizes and positions of the objects on page 2 (the div that is originally invisible)
        // Returns the viewBox in the final page of the score.
        function setGraphics()
        {
            var
            i, svgPage, embedsWidth, viewBox, pagesFrameWidth,
            svgRuntimeControlsElem = document.getElementById("svgRuntimeControls"),
            svgPagesFrameElem = document.getElementById("svgPagesFrame"),
            svgPageEmbeds = document.getElementsByClassName("svgPage"),
            nPages = svgPageEmbeds.length;

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

            svgRuntimeControlsElem.style.left = ((window.innerWidth - parseInt(svgRuntimeControlsElem.style.width, 10)) / 2).toString();

            for(i = 0; i < nPages; ++i)
            {
                svgPage = svgPageEmbeds[i].getSVGDocument();
                svgElem = getSVGElem(svgPage);
                viewBox = getViewBox(svgElem); // global
                embedsWidth = Math.ceil(viewBox.width / viewBox.scale);
                svgPageEmbeds[i].style.width = embedsWidth.toString();
                svgPageEmbeds[i].style.height = (Math.ceil(viewBox.height / viewBox.scale)).toString();
            }

            pagesFrameWidth = embedsWidth + 17; 
            svgPagesFrameElem.style.width = pagesFrameWidth.toString();
            svgPagesFrameElem.style.height = (window.innerHeight - parseInt(svgPagesFrameElem.style.top, 10) -2).toString();
            svgPagesFrameElem.style.left = (Math.ceil((window.innerWidth - pagesFrameWidth) / 2)).toString();

            viewBoxScale = viewBox.scale;
            
            return viewBox;
        }

        /*************** end of getEmptySystems function definitions *****************************/

        resetContent(isLivePerformanceArg);

        viewBox = setGraphics();

        svgPageEmbeds = document.getElementsByClassName("svgPage");

        nPages = svgPageEmbeds.length;
        runningViewBoxOriginY = 0; // absolute coordinates
        for(i = 0; i < nPages; ++i)
        {
            svgPage = svgPageEmbeds[i].getSVGDocument();
            svgElem = getSVGElem(svgPage);

            svgChildren = svgElem.children;
            pageSystems = [];
            for(j = 0; j < svgChildren.length; ++j)
            {
                attrVal = svgChildren[j].getAttribute("score:hasMidi"); 
                if(attrVal === "true")
                {
                    // svgChildren[j] is the unique "systems" container
                    systemsContainerChildren = svgChildren[j].children;
                    for(k = 0; k < systemsContainerChildren.length; ++k)
                    {
                        attrVal = systemsContainerChildren[k].getAttribute("score:hasMidi"); 
                        if(attrVal === "true")
                        {
                            system = getEmptySystem(runningViewBoxOriginY, viewBox.scale, systemsContainerChildren[k]);
                            systems.push(system); // systems is global inside this namespace
                            systemElems.push(systemsContainerChildren[k]); // used when creating timeObjects...
                            pageSystems.push(system);
                        }
                    }
                    break; // there is only one container of systems
                }
            }

            markersLayer = createMarkersLayer(svgElem, viewBox, runningViewBoxOriginY, pageSystems);
            markersLayers.push(markersLayer);

            pageHeight = parseInt(svgElem.getAttribute('height'), 10);
            runningViewBoxOriginY += pageHeight;
        }
        initializeTrackIsOnArray(systems[0]);
    },

    setEndMarkerClick = function (e)
    {
        svgPageClicked(e, 'settingEnd');
    },

    setStartMarkerClick = function (e)
    {
        svgPageClicked(e, 'settingStart');
    },

    sendStartMarkerToStart = function ()
    {
        startMarker = systems[0].startMarker;
        hideStartMarkersExcept(startMarker);
        startMarker.moveTo(systems[0].staves[0].voices[0].timeObjects[0]);
    },

    sendEndMarkerToEnd = function ()
    {
        var lastTimeObjects = systems[systems.length - 1].staves[0].voices[0].timeObjects;

        endMarker = systems[systems.length - 1].endMarker;
        hideEndMarkersExcept(endMarker);
        endMarker.moveTo(lastTimeObjects[lastTimeObjects.length - 1]);
    },

    startMarkerMsPosition = function ()
    {
        return startMarker.msPosition();
    },

    endMarkerMsPosition = function ()
    {
        return endMarker.msPosition();
    },

    // Called when the start button is clicked in the top options panel,
    // and when setOptions button is clicked at the top of the score.
    // If the startMarker is not fully visible in the svgPagesDiv, move
    // it to the top of the div.
    moveStartMarkerToTop = function (svgPagesDiv)
    {
        var height = Math.round(parseFloat(svgPagesDiv.style.height)),
        scrollTop = svgPagesDiv.scrollTop, startMarkerYCoordinates;

        startMarkerYCoordinates = startMarker.getYCoordinates();

        if ((startMarkerYCoordinates.top < scrollTop) || (startMarkerYCoordinates.bottom > (scrollTop + height)))
        {
            if (startMarker.systemIndex() === 0)
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
    // if msPosition is >= that object's msPosition. Otherwise does nothing.
    // Also does nothing when the end of the score is reached.
    advanceRunningMarker = function(msPosition, systemIndex)
    {
        if(systemIndex > runningMarker.systemIndex())
        {
            // Move runningMarker to msPosition in the next system.
            runningMarker.setVisible(false);
            if(runningMarker.systemIndex() < endMarker.systemIndex())
            {
                runningMarker = systems[runningMarker.systemIndex() + 1].runningMarker;
                runningMarker.moveTo(msPosition);
                runningMarker.setVisible(true);
                // callback for auto scroll
                runningMarkerHeightChanged(runningMarker.getYCoordinates());
            }
        }
        else
        {
            while(msPosition >= runningMarker.nextMsPosition())
            {
                // this function can assume that the runningMarker's currentPosition can simply be incremented
                runningMarker.incrementPosition();
            }
        }
    },


    // Returns a tracksData object having the following defined attributes:
    //        inputTracks[] - an array of tracks containing inputChords and inputRests
    //        outputTracks[] - an array of tracks containing outputChords and outputRests
    //        if inputTracks contains one or more tracks, the following attributes are also defined (on tracksData):
    //            inputKeyRange.bottomKey
    //            inputKeyRange.topKey
    getTracksData = function(globalSpeed)
    {
        // systems->staves->voices->timeObjects
        var
        tracksData = {}, inputTracks = [], outputTracks = [],
        outputTrackIndex = 0, inputTrackIndex = 0, inputTrack, outputTrack,
        timeObjectIndex, nTimeObjects, timeObject,
        voiceIndex, nVoices, voice,
        staffIndex, nStaves, staff,
        sysIndex, nSystems = systems.length, system,
        midiChordDef, midiChord, midiRest,
        inputChord, inputRest;

        // Gets the timeObjects for both input and output voices. 
        // msDurations are retrieved from the score (not changed by the current speed option).
        function getVoiceObjects(speed)
        {
            var systemElem,
                i, systemIndex,
                lastSystemTimeObjects;

            function getSystemVoiceObjects(systems, systemIndex, viewBoxScale1, systemElem)
            {
                var i, j,
                    system = systems[systemIndex],
                    systemChildren, systemChildClass,
                    staff, staffChildren, staffChildClass, staffChild,
                    voice,
                    staffIndex,
                    voiceIndex,
                    isFirstVoiceInStaff,
                    attrVal;

                // There is a timeObject for every input and output chord or rest and the final barline in each voice.
                // All timeObjects are allocated alignment and msDuration fields.
                // Chord timeObjects are allocated either a moments[] or an inputChordDef field depending on whether they are input or output chords.
                function getTimeObjects(systemIndex, noteObjectElems, isOutput)
                {
                    var timeObjects = [], noteObjectAlignment, alignmentAttribute,
                        timeObject, i, j, length, noteObjectElem, chordChildElems, otpmc = outputTrackPerMidiChannel;

                    function getMsDuration(moments)
                    {
                        var i, msDuration = 0;

                        for(i = 0; i < moments.length; ++i)
                        {
                            msDuration += moments[i].msDuration;
                        }

                        return msDuration;
                    }

                    function getMoments(scoreMidiElem)
                    {
                        var i, moments, momentMoments, envMoments, envsGridMoments, envsVtMoments, combinedMoments, msDuration = 0,
                            scoreMidiChild, scoreMidiChildren = scoreMidiElem.children;

                        function getMsg(bytes)
                        {
                            var i, msg = new Uint8Array(bytes.length);
                            for(i = 0; i < bytes.length; ++i)
                            {
                                msg[i] = bytes[i];
                            }
                            return msg;
                        }

                        // adds the momentsToCombine to moments,
                        // if msPos is equal, either msgs or the envMsgs are moved.
                        function combineMoments(moments, momentsToCombine, msDuration, setMomentEnvMsgsAttribute, gridWidth)
                        {
                            var mi, mci, msgIndex, prevMsPos, momentToCombine, mcMsPos,
                                moment, mMsPos, mMsgs, mcMsgs, momentInsertion, momentInsertions = [];

                            if(momentsToCombine === undefined)
                            {
                                return moments;
                            }

                            for(mci = 0; mci < momentsToCombine.length; ++mci)
                            {
                                prevMsPos = -1;
                                momentToCombine = momentsToCombine[mci];
                                mcMsPos = momentToCombine.msPos;
                                for(mi = 0; mi < moments.length; ++mi)
                                {
                                    moment = moments[mi];
                                    mMsPos = moment.msPos;
                                    mMsgs = moment.msgs;
                                    if(mMsPos === mcMsPos)
                                    {
                                        if(setMomentEnvMsgsAttribute === false)
                                        {
                                            mcMsgs = momentToCombine.msgs;
                                            for(msgIndex = 0; msgIndex < mcMsgs.length; ++msgIndex)
                                            {
                                                mMsgs.push(mcMsgs[msgIndex]);
                                            }
                                        }
                                        else
                                        {
                                            moment.envMsgs = momentToCombine.msgs;
                                        }
                                        break;
                                    }
                                    else if(mcMsPos > prevMsPos && mcMsPos < mMsPos)
                                    {
                                        momentInsertion = {};
                                        momentInsertion.index = mi;
                                        momentInsertion.moment = momentToCombine;
                                        momentInsertions.push(momentInsertion);
                                        break;
                                    }
                                    else if(mi === moments.length - 1)
                                    {
                                        momentInsertion = {};
                                        momentInsertion.index = moments.length;
                                        momentInsertion.moment = momentToCombine;
                                        momentInsertions.push(momentInsertion);
                                    }

                                    prevMsPos = mMsPos;
                                }
                            }
                            for(mi = momentInsertions.length - 1; mi >= 0; --mi)
                            {
                                momentInsertion = momentInsertions[mi];
                                moments.splice(momentInsertion.index, 0, momentInsertion.moment);
                            }
                            moments[moments.length - 1].msDuration = msDuration - moments[moments.length - 1].msPos;
                        }

                        // returns the moments in the momentsElem, with all the msgs
                        // converted to Uint8 arrays.
                        function getMomentsMoments(momentsElem)
                        { 
                            var i, j, msPos = 0, momentsMoment, momentsMoments = [], msChildren = momentsElem.children,
                                momentChildren, noteOnsElem, switchesElem;

                            function getMsgs(msgsElem)
                            {
                                var i, j, msgsChildren = msgsElem.children,
                                    msgStr, byteStrs, byteStr, bytes = [], byte, msgs = [], msg;

                                for(i = 0; i < msgsChildren.length; ++i)
                                {
                                    if(msgsChildren[i].nodeName === "msg")
                                    {
                                        msgStr = msgsChildren[i].getAttribute("m");
                                        byteStrs = msgStr.split(' ');
                                        bytes.length = 0;
                                        for(j = 0; j < byteStrs.length; ++j)
                                        {
                                            byteStr = byteStrs[j]; 
                                            if(byteStr.indexOf("0x") >= 0)
                                            {
                                                byte = parseInt(byteStr, 16);
                                            }
                                            else
                                            {
                                                byte = parseInt(byteStr, 10);
                                            }
                                            bytes.push(byte);
                                        }
                                        msg = getMsg(bytes);
                                        msgs.push(msg);
                                    }
                                }
                                return msgs;
                            }

                            function getMomentsMoment(momentElem)
                            { 
                                var i, momentChildren = momentElem.children,
                                    momentsMoment = {};

                                momentsMoment.msDuration = parseInt(momentElem.getAttribute("msDuration"), 10);
                                momentsMoment.noteOffMsgs = [];
                                momentsMoment.switchesMsgs = [];
                                momentsMoment.noteOnMsgs = [];

                                for(i = 0; i < momentChildren.length; ++i)
                                {
                                    if(momentChildren[i].nodeName === "noteOffs")
                                    {
                                        momentsMoment.noteOffMsgs = getMsgs(momentChildren[i]);
                                    }
                                    if(momentChildren[i].nodeName === "switches")
                                    {
                                        momentsMoment.switchesMsgs = getMsgs(momentChildren[i]);
                                    }
                                    if(momentChildren[i].nodeName === "noteOns")
                                    {
                                        momentsMoment.noteOnMsgs = getMsgs(momentChildren[i]);
                                    }
                                }
                                return momentsMoment;
                            }

                            for(i = 0; i < msChildren.length; ++i)
                            {
                                if(msChildren[i].nodeName === "moment")
                                {  
                                    momentsMoment = getMomentsMoment(msChildren[i]);
                                    momentsMoment.msPos = msPos;
                                    msPos += momentsMoment.msDuration;
                                    momentsMoments.push(momentsMoment);
                                }
                            }

                            return momentsMoments;
                        }

                        function getDuration(moments)
                        {
                            var lastMoment = moments[moments.length - 1];

                            return (lastMoment.msPos + lastMoment.msDuration);
                        }

                        function getEnvMoments(envsElem, msDuration)
                        {
                            var i, envElem, envMoments, status, data1, vts, gridWidth = 100,
                                envsChildren = envsElem.children;

                            function getEmptyGridMoments(msDuration, gridWidth)
                            {
                                var mmt, mmts = [], msPos = 0;
                                // Algorithm: a set of moments every gridWidth ms, then add the moments between that are the vertices of the envs.
                                // Most env moments will then be on the 100ms grid.
                                do
                                {
                                    mmt = {};
                                    mmt.msPos = msPos;
                                    mmt.msgs = [];
                                    mmts.push(mmt);
                                    msPos += gridWidth;
                                }
                                while(msPos < msDuration);

                                return mmts;
                            }

                            function getVtsData2ConstD1(envElem, data1)
                            {
                                var i, vtElem, envElemChildren = envElem.children, vt, vts = [];

                                for(i = 0; i < envElemChildren.length; ++i)
                                {
                                    if(envElemChildren[i].nodeName === "vt")
                                    {
                                        vtElem = envElemChildren[i];
                                        vt = {};
                                        vt.data1 = data1;
                                        vt.data2 = parseInt(vtElem.getAttribute("d2"), 10);
                                        vt.msDur = parseInt(vtElem.getAttribute("msDur"), 10);
                                        vts.push(vt);
                                    }
                                }
                                return vts;
                            }

                            function getVtsData1UndefinedData2(envElem)
                            {
                                var i, vtElem, envElemChildren = envElem.children, vt, vts = [];

                                for(i = 0; i < envElemChildren.length; ++i)
                                {
                                    if(envElemChildren[i].nodeName === "vt")
                                    {
                                        vtElem = envElemChildren[i];
                                        vt = {};
                                        vt.data1 = parseInt(vtElem.getAttribute("d1"), 10);
                                        vt.msDur = parseInt(vtElem.getAttribute("msDur"), 10);
                                        vts.push(vt);
                                    }
                                }

                                return vts;
                            }

                            function getVtsData1AndData2(envElem)
                            {
                                var i, vtElem, envElemChildren = envElem.children, vt, vts = [];

                                for(i = 0; i < envElemChildren.length; ++i)
                                {
                                    if(envElemChildren[i].nodeName === "vt")
                                    {
                                        vtElem = envElemChildren[i];
                                        vt = {};
                                        vt.data1 = parseInt(vtElem.getAttribute("d1"), 10);
                                        vt.data2 = parseInt(vtElem.getAttribute("d2"), 10);
                                        vt.msDur = parseInt(vtElem.getAttribute("msDur"), 10);
                                        vts.push(vt);
                                    }
                                }
                                return vts;
                            }

                            function setGridMoments(envMoments, status, vts, gridWidth)
                            {
                                var i, msg, vtsState = {}, oldVtIndex = 0, bytes = [];

                                function getD1IncrPerMs(vtIndex, vt1s)
                                {
                                    var d1IncrPerMs = 0;
                                    if(vt1s[vtIndex].msDur > 0 && (vt1s.length > vtIndex + 1))
                                    {
                                        d1IncrPerMs = (vt1s[vtIndex + 1].data2 - vt1s[vtIndex].data2) / (vt1s[vtIndex].msDur);
                                    }
                                    return d1IncrPerMs;
                                }
                                function getD2IncrPerMs(vtIndex, vt2s)
                                {
                                    var d2IncrPerMs = 0;
                                    if(vt2s[vtIndex].msDur > 0 && (vt2s.length > vtIndex + 1))
                                    {
                                        d2IncrPerMs = (vt2s[vtIndex + 1].data2 - vt2s[vtIndex].data2) / (vt2s[vtIndex].msDur);
                                    }
                                    return d2IncrPerMs;
                                }
                                // sets vtsState to the state of the vt2s at msPos.
                                // sets vtsState.vtIndex = 0;
                                // sets vtsState.data1Value = vts[0].data1;
                                // sets vtsState.data2Value = vts[0].data2;
                                // sets vtsState.data1IncrPerMillisecond = (vts[1].data1 - vts[0].data1) / vts[vtsState.vtIndex].msDur;
                                // sets vtsState.data2IncrPerMillisecond = (vts[1].data2 - vts[0].data2) / vts[vtsState.vtIndex].msDur;
                                // sets vtsState.currentVtMsPos = 0;
                                // sets vtsState.nextVtMsPos = vts[0].msDur;
                                function nextData(msPos, vts, vtsState)
                                {
                                    if(msPos >= vtsState.nextVtMsPos)
                                    {
                                        vtsState.vtIndex++;
                                        vtsState.currentVtMsPos = vtsState.nextVtMsPos;
                                        vtsState.nextVtMsPos += vts[vtsState.vtIndex].msDur;
                                        if(vts[vtsState.vtIndex].msDur > 0)
                                        {
                                            vtsState.data1IncrPerMillisecond =
                                                (vts[vtsState.vtIndex + 1].data1 - vts[vtsState.vtIndex].data1) / vts[vtsState.vtIndex].msDur;
                                            if(vts[vtsState.vtIndex].data2 !== undefined)
                                            {
                                                vtsState.data2IncrPerMillisecond =
                                                    (vts[vtsState.vtIndex + 1].data2 - vts[vtsState.vtIndex].data2) / vts[vtsState.vtIndex].msDur;
                                            }
                                        }
                                        else
                                        {
                                            vtsState.dataIncrPerMillisecond = 0;
                                        }
                                    }

                                    vtsState.data1Value = Math.floor(vts[vtsState.vtIndex].data1 +
                                            ((msPos - vtsState.currentVtMsPos) * vtsState.data1IncrPerMillisecond));
                                    if(vts[vtsState.vtIndex].data2 === undefined)
                                    {
                                        vtsState.data2Value = undefined;
                                    }
                                    else
                                    {
                                        vtsState.data2Value = Math.floor(vts[vtsState.vtIndex].data2 +
                                                ((msPos - vtsState.currentVtMsPos) * vtsState.data2IncrPerMillisecond));
                                    }

                                    return vtsState;
                                }

                                bytes.push(status);
                                bytes.push(vts[0].data1);
                                if(vts[0].data2 !== undefined)
                                {
                                    bytes.push(vts[0].data2);
                                }

                                msg = getMsg(bytes);

                                envMoments[0].msgs.push(msg);

                                if(vts.length > 1 && vts[0].msDur > 0)
                                {
                                    vtsState.vtIndex = 0;
                                    vtsState.data1Value = vts[vtsState.vtIndex].data1;
                                    vtsState.data2Value = vts[vtsState.vtIndex].data2;
                                    vtsState.data1IncrPerMillisecond = (vts[1].data1 - vts[0].data1) / vts[vtsState.vtIndex].msDur;
                                    vtsState.data2IncrPerMillisecond = (vts[1].data2 - vts[0].data2) / vts[vtsState.vtIndex].msDur;
                                    vtsState.currentVtMsPos = 0;
                                    vtsState.nextVtMsPos = vts[0].msDur;

                                    for(i = 1; i < envMoments.length; ++i)
                                    {
                                        vtsState = nextData(envMoments[i].msPos, vts, vtsState);

                                        if(vtsState.data1Value !== msg[1]
                                        || (vtsState.data2Value !== undefined && msg[2] !== undefined && vtsState.data2Value !== msg[2]
                                        || (vtsState.vtIndex !== oldVtIndex)))
                                        {
                                            // messages will always be written when the vtIndex has changed
                                            oldVtIndex = vtsState.vtIndex;

                                            bytes.length = 0;
                                            bytes.push(status);
                                            bytes.push(vtsState.data1Value);
                                            if(vtsState.data2Value !== undefined)
                                            {
                                                bytes.push(vtsState.data2Value);
                                            }

                                            msg = getMsg(bytes);

                                            envMoments[i].msgs.push(msg);
                                        }
                                    }
                                }
                            }

                            function setVtMoments(envMoments, status, vts, msDuration, gridWidth)
                            {
                                var i, localEnvMoments = [], localEnvMoment,
                                    msg, msgs, msPos = 0, vt, bytes = [];

                                for(i = 0; i < vts.length; ++i)
                                {
                                    localEnvMoment = {};
                                    localEnvMoment.msPos = msPos;
                                    localEnvMoment.msgs = [];
                                    vt = vts[i];

                                    if(Math.floor(msPos % gridWidth) !== 0)
                                    {
                                        bytes.length = 0;
                                        bytes.push(status);
                                        bytes.push(vt.data1);
                                        if(vt.data2 !== undefined)
                                        {
                                            bytes.push(vt.data2);
                                        }
                                        msg = getMsg(bytes);
                                        localEnvMoment.msgs.push(msg);
                                        localEnvMoments.push(localEnvMoment);
                                    }

                                    msPos += vt.msDur;
                                }

                                combineMoments(envMoments, localEnvMoments, msDuration, false, gridWidth); 
                            }

                            envMoments = getEmptyGridMoments(msDuration, gridWidth);

                            for(i = 0; i < envsChildren.length; ++i)
                            {
                                if(envsChildren[i].nodeName === "env")
                                {
                                    envElem = envsChildren[i];
                                    status = parseInt(envElem.getAttribute("s"), 16);
                                    switch(Math.floor(status / 16))
                                    {
                                        case 10: // 0xA Aftertouch
                                            data1 = parseInt(envElem.getAttribute("d1"), 10);
                                            vts = getVtsData2ConstD1(envElem, data1);
                                            setGridMoments(envMoments, status, vts);
                                            setVtMoments(envMoments, status, vts, msDuration, gridWidth);
                                            break;
                                        case 11: // 0xB ControlChange
                                            data1 = parseInt(envElem.getAttribute("d1"), 10);
                                            vts = getVtsData2ConstD1(envElem, data1);
                                            setGridMoments(envMoments, status, vts);
                                            setVtMoments(envMoments, status, vts, msDuration, gridWidth);
                                            break;
                                        case 13: // 0xD ChannelPressure
                                            vts = getVtsData1UndefinedData2(envElem);
                                            setGridMoments(envMoments, status, vts);
                                            setVtMoments(envMoments, status, vts, msDuration, gridWidth);
                                            break;
                                        case 14: // 0xE PitchWheel
                                            vts = getVtsData1AndData2(envElem);
                                            setGridMoments(envMoments, status, vts);
                                            setVtMoments(envMoments, status, vts, msDuration, gridWidth);
                                            break;
                                        default:
                                            break;
                                    }
                                }
                            }

                            return envMoments;
                        }

                        function getFlatMoments(momentMoments, envsMoments, msDuration)
                        {
                            var i, flatMoment, flatMoments = [],
                                moment, noteOffMsgs, switchesMsgs, envMsgs, noteOnMsgs;

                            function setMsDurations(flatMoments, moments)
                            {
                                var i;

                                console.assert(flatMoments.length === moments.length, "Moments length error.");
                                console.assert(moments[moments.length - 1].msDuration !== undefined, "Last moment msDuration undefined.");

                                for(i = 1; i < moments.length; ++i)
                                {
                                    flatMoments[i - 1].msDuration = moments[i].msPos - moments[i - 1].msPos;
                                }
                                flatMoments[flatMoments.length - 1].msDuration = moments[moments.length - 1].msDuration;
                            }

                            combineMoments(momentMoments, envsMoments, msDuration, true);

                            for(i = 0; i < momentMoments.length; ++i)
                            {
                                flatMoment = {};
                                flatMoment.msgs = [];
                                flatMoments.push(flatMoment);

                                moment = momentMoments[i];

                                if(moment.noteOffMsgs !== undefined)
                                {
                                    noteOffMsgs = moment.noteOffMsgs;
                                    for(j = 0; j < noteOffMsgs.length; ++j)
                                    {
                                        flatMoment.msgs.push(noteOffMsgs[j]);
                                    }
                                }

                                if(moment.switchesMsgs !== undefined)
                                {
                                    switchesMsgs = moment.switchesMsgs;
                                    for(j = 0; j < switchesMsgs.length; ++j)
                                    {
                                        flatMoment.msgs.push(switchesMsgs[j]);
                                    }
                                }

                                if(moment.envMsgs !== undefined)
                                {
                                    envMsgs = moment.envMsgs;
                                    for(j = 0; j < envMsgs.length; ++j)
                                    {
                                        flatMoment.msgs.push(envMsgs[j]);
                                    }
                                }

                                if(moment.noteOnMsgs !== undefined)
                                {
                                    noteOnMsgs = moment.noteOnMsgs;
                                    for(j = 0; j < noteOnMsgs.length; ++j)
                                    {
                                        flatMoment.msgs.push(noteOnMsgs[j]);
                                    }
                                }
                            }
                            setMsDurations(flatMoments, momentMoments);

                            return flatMoments;
                        }

                        for(i = 0; i < scoreMidiChildren.length; ++i)
                        {
                            scoreMidiChild = scoreMidiChildren[i];
                            if(scoreMidiChild.nodeName === "moments")
                            {
                                momentMoments = getMomentsMoments(scoreMidiChild);
                                msDuration = getDuration(momentMoments);
                            }
                           
                            if(scoreMidiChild.nodeName === "envs")
                            {
                                envMoments = getEnvMoments(scoreMidiChild, msDuration);
                            }
                        }

                        moments = getFlatMoments(momentMoments, envMoments, msDuration);

                        return moments;
                    }

                    length = noteObjectElems.length;
                    for(i = 0; i < length; ++i)
                    {
                        noteObjectElem = noteObjectElems[i];
                        noteObjectAlignment = noteObjectElem.getAttribute('score:alignment');
                        if(noteObjectAlignment !== null)
                        {
                            timeObject = {};
                            timeObject.alignment = parseFloat(noteObjectAlignment, 10) / viewBoxScale1;
                            timeObject.systemIndex = systemIndex;
                            chordChildElems = noteObjectElem.children;
                            for(j = 0; j < chordChildElems.length; ++j)
                            {
                                if(isOutput)
                                {
                                    if(chordChildElems[j].nodeName === "score:midi")
                                    {
                                        timeObject.moments = getMoments(chordChildElems[j]);
                                        timeObject.msDuration = getMsDuration(timeObject.moments); // was midiChordDef
                                    }
                                }
                                else
                                {
                                    timeObject.inputChordDef = new InputChordDef(noteObjectElem, otpmc);
                                    timeObject.msDuration = parseInt(noteObjectElem.getAttribute('score:msDuration'), 10);
                                }
                            }
                            if(timeObject.msDuration < 1)
                            {
                                throw "Error: The score contains chords having zero duration!";
                            }
                            timeObjects.push(timeObject);
                        }

                        if(i === length - 1)
                        {
                            timeObject = {}; // the final barline in the voice (used when changing speed)
                            timeObject.msDuration = 0;
                            timeObject.systemIndex = systemIndex;
                            // msPosition and alignment are set later
                            // timeObject.msPosition = systems[systemIndex + 1].startMsPosition;
                            // timeObject.alignment = system.right;
                            timeObjects.push(timeObject);
                        }
                    }

                    return timeObjects;
                }

                // These are SVG elements in the voice that will have their opacity changed when the voice is disabled.
                function getGraphicElements(systemIndex, noteObjectElems)
                {
                    var graphicElements = [], type, i, length, noteObjectElem;

                    length = noteObjectElems.length;
                    for(i = 0; i < length; ++i)
                    {
                        noteObjectElem = noteObjectElems[i];
                        type = noteObjectElem.getAttribute('class');
                        if(type === 'outputChord' || type === 'inputChord' || type === 'cautionaryChord' || type === 'rest'
                        || type === 'clef' || type === 'barline' || type === 'staffName' || type === 'beamBlock' || type === 'clefChange'
                        || type === 'endBarlineLeft' || type === 'endBarlineRight')
                        {
                            graphicElements.push(noteObjectElem);
                        }
                    }

                    return graphicElements;
                }

                // The stafflines element that will have its opacity changed when the staff's voices are both disabled.
                function getStaffLinesElem(staffChildren)
                {
                    var i, stafflinesElem;

                    for(i = 0; i < staffChildren.length; ++i)
                    {
                        if(staffChildren[i].getAttribute('class') === "stafflines")
                        {
                            stafflinesElem = staffChildren[i];
                            break;
                        }
                    }

                    return stafflinesElem;
                }

                systemChildren = systemElem.children;
                staffIndex = 0;
                for(i = 0; i < systemChildren.length; ++i)
                {
                    attrVal = systemChildren[i].getAttribute("score:hasMidi");
                    if(attrVal === "true")  // input staves have attrVal === "false"
                    {
                        staff = system.staves[staffIndex++];
                        staffChildren = systemChildren[i].children;
                        isFirstVoiceInStaff = true;
                        voiceIndex = 0;
                        for(j = 0; j < staffChildren.length; ++j)
                        {
                            staffChild = staffChildren[j];
                            attrVal = staffChild.getAttribute("score:hasMidi");
                            if(attrVal === "true")
                            {
                                voice = staff.voices[voiceIndex++];
                                voice.timeObjects = getTimeObjects(systemIndex, staffChild.children, voice.isOutput);
                                voice.graphicElements = getGraphicElements(systemIndex, staffChild.children); // will be used to set opacity when the voice is disabled
                                if(isFirstVoiceInStaff === true)
                                {
                                    voice.staffLinesElem = getStaffLinesElem(staffChildren);
                                    isFirstVoiceInStaff = false;
                                }
                            }
                        }
                    }
                }
            }

            // Sets the msPosition of each timeObject (input and output rests and chords, and each voice's final barline)
            // in the voice.timeObjectArrays.
            function setMsPositions(systems)
            {
                var nStaves, staffIndex, nVoices, voiceIndex, nSystems, systemIndex, msPosition,
                    timeObjects, nTimeObjects, tIndex;

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
                            nTimeObjects = timeObjects.length;
                            for(tIndex = 0; tIndex < nTimeObjects; ++tIndex)
                            {
                                timeObjects[tIndex].msPosition = msPosition;
                                msPosition += timeObjects[tIndex].msDuration;
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
                            if(voice.timeObjects[0].alignment === undefined)
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

            // The rightmost barlines all need an Alignment to which the EndMarker can be set.
            function setRightmostBarlinesAlignment(systems)
            {
                var i, nSystems = systems.length, system,
                    j, nStaves, staff,
                    k, nVoices, voice,
                    finalBarline,
                    rightmostAlignment = systems[0].right;

                for(i = 0; i < nSystems; ++i)
                {
                    system = systems[i];
                    nStaves = system.staves.length;
                    for(j = 0; j < nStaves; ++j)
                    {
                        staff = system.staves[j];
                        nVoices = staff.voices.length;
                        for(k = 0; k < nVoices; ++k)
                        {
                            voice = staff.voices[k];
                            finalBarline = voice.timeObjects[voice.timeObjects.length - 1];
                            finalBarline.alignment = rightmostAlignment;
                        }
                    }
                }
            }

            // voice.timeObjects is an array of timeObject.
            // speed is a floating point number, greater than zero.
            // timeObject.msPosition and timeObject.msDuration have the values set in the score (speed === 1).
            function changeSpeed(systems, speed)
            {
                var i, j, k, nSystems = systems.length, system, staff, voice;

                // adjust the top level msDuration of each timeObject
                // the final timeObject is the final barline (msDuration = 0).
                function adjustTotalDurations(timeObjects, speed)
                {
                    var i, msDuration, nTimeObjects = timeObjects.length;

                    for(i = 0; i < nTimeObjects; ++i)
                    {
                        timeObjects[i].msPosition = Math.round(timeObjects[i].msPosition / speed);
                    }

                    // the final timeObject is the final barline (msDuration = 0).
                    for(i = 1; i < nTimeObjects; ++i)
                    {
                        msDuration = timeObjects[i].msPosition - timeObjects[i-1].msPosition;
                        if(msDuration < 1)
                        {
                            throw "Error: The speed has been set too high!\n\n" +
                                  "(Attempt to create a chord or rest having no duration.)";
                        }
                        timeObjects[i - 1].msDuration = msDuration;
                    }
                }

                // Adjust the msDuration of each object in each timeObject.midiChordDef.basicChordsArray,
                // correcting rounding errors to ensure that the sum of the durations of the
                // basicChords is exactly equal to the containing timeObject.msDuration (which has
                // already been adjusted).
                function adjustBasicChordDurations(timeObjects, speed)
                {
                    var i, nTimeObjects = timeObjects.length;

                    function adjustDurations(basicChords, speed, chordMsDuration)
                    {
                        var i, nBasicChords = basicChords.length, msFPDuration,
                        msFPPositions = [], totalBasicMsDurations = 0,
                        excessDuration;

                        function correctRoundingError(basicChords, excessDuration)
                        {
                            var changed;

                            while(excessDuration !== 0)
                            {
                                changed = false;

                                for(i = basicChords.length - 1; i >= 0; --i)
                                {
                                    if(excessDuration > 0)
                                    {
                                        if(basicChords[i].msDuration > 1)
                                        {
                                            basicChords[i].msDuration -= 1;
                                            excessDuration -= 1;
                                            changed = true;
                                        }
                                    }
                                    else if(excessDuration < 0)
                                    {
                                        basicChords[nBasicChords - 1].msDuration += 1;
                                        excessDuration += 1;
                                        changed = true;
                                    }
                                    else
                                    {
                                        break;
                                    }
                                }

                                if(excessDuration !== 0 && !changed)
                                {
                                    throw "Error: The speed has been set too high!\n\n" +
                                            "(Can't adjust the duration of a set of basicChords.)";
                                }
                            }
                        }

                        // get the speed changed (floating point) basic chord positions re start of chord.
                        msFPPositions.push(0);
                        for(i = 0; i < nBasicChords; ++i)
                        {
                            msFPDuration = basicChords[i].msDuration / speed;
                            msFPPositions.push(msFPDuration + msFPPositions[i]);
                        }

                        // get the (integer) msDuration of each basic chord (possibly with rounding errors)
                        // nMsPositions = nBasicChords + 1;
                        for(i = 0; i < nBasicChords; ++i)
                        {
                            basicChords[i].msDuration = Math.round(msFPPositions[i + 1] - msFPPositions[i]);
                            if(basicChords[i].msDuration < 1)
                            {
                                throw "Error: The speed has been set too high!\n\n" +
                                      "(Attempt to create a basicChord with no duration.)";
                            }
                            totalBasicMsDurations += basicChords[i].msDuration;
                        }

                        // if there is a rounding error, correct it.
                        excessDuration = totalBasicMsDurations - chordMsDuration;
                        if(excessDuration !== 0)
                        {
                            correctRoundingError(basicChords, excessDuration);
                        }
                    }

                    for(i = 0; i < nTimeObjects; ++i)
                    {
                        if(timeObjects[i].midiChordDef !== undefined)
                        {
                            adjustDurations(timeObjects[i].midiChordDef.basicChordsArray, speed, timeObjects[i].msDuration);
                        }
                    }
                }

                for(i = 0; i < nSystems; ++i)
                {
                    system = systems[i];
                    for(j = 0; j < system.staves.length; ++j)
                    {
                        staff = system.staves[j];
                        for(k = 0; k < staff.voices.length; ++k)
                        {
                            voice = staff.voices[k];
                            adjustTotalDurations(voice.timeObjects, speed);
                            if(voice.isOutput === true)
                            {
                                adjustBasicChordDurations(voice.timeObjects, speed);
                            }                            
                        }
                    }
                }
            }

            /*************** end of getTimeObjects function definitions *****************************/

            systemIndex = 0;
            for(i = 0; i < systemElems.length; ++i)
            {
                systemElem = systemElems[i];
                if(systems[systemIndex].msDuration !== undefined)
                {
                    delete systems[systemIndex].msDuration; // is reset in the following function
                }
                getSystemVoiceObjects(systems, systemIndex, viewBoxScale, systemElem);
                systemIndex++;
            }

            setMsPositions(systems);
            setFirstTimeObjectAlignment(systems);
            setRightmostBarlinesAlignment(systems);

            if(speed !== 1)
            {
                changeSpeed(systems, speed); // can throw an exception
            }

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

                system.runningMarker.setTimeObjects(system, isLivePerformance, trackIsOnArray);
                for(j = 0; j < system.staves.length; ++j)
                {
                    if(!isNaN(system.staves[j].voices[0].timeObjects[0].alignment))
                    {
                        system.startMarker.moveTo(system.staves[j].voices[0].timeObjects[0]);
                        break;
                    }
                }
            }

            startMarker = systems[0].startMarker;
            startMarker.setVisible(true);

            moveRunningMarkerToStartMarker(); // is only visible when playing...

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
                        outputTracks[outputTrackIndex].outputObjects = [];
                        outputTracks[outputTrackIndex].isVisible = staff.isVisible;
                        outputTrackIndex++;
                    }
                    else // voice.isOutput === false 
                    {
                        inputTracks.push(new Track());
                        inputTracks[inputTrackIndex].inputObjects = [];
                        inputTracks[inputTrackIndex].isVisible = staff.isVisible;
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

        getVoiceObjects(globalSpeed);

        setMarkers(systems, isLivePerformance);

        setTrackAttributes(outputTracks, inputTracks, systems[0].staves);

        nStaves = systems[0].staves.length;

        for(sysIndex = 0; sysIndex < nSystems; ++sysIndex)
        {
            system = systems[sysIndex];
            outputTrackIndex = 0;
            inputTrackIndex = 0;
            for(staffIndex = 0; staffIndex < nStaves; ++staffIndex)
            {
                staff = system.staves[staffIndex];
                nVoices = staff.voices.length;
                for(voiceIndex = 0; voiceIndex < nVoices; ++voiceIndex)
                {
                    voice = staff.voices[voiceIndex];
                    nTimeObjects = voice.timeObjects.length;
                    if(voice.isOutput === true)
                    {
                        outputTrack = outputTracks[outputTrackIndex];
                        for(timeObjectIndex = 0; timeObjectIndex < nTimeObjects; ++timeObjectIndex)
                        {
                            timeObject = voice.timeObjects[timeObjectIndex];
                            outputTrack.outputObjects.push(timeObject);
                        }
                        ++outputTrackIndex;
                    }
                    else // inputVoice
                    {
                        inputTrack = inputTracks[inputTrackIndex];
                        for(timeObjectIndex = 0; timeObjectIndex < nTimeObjects; ++timeObjectIndex)
                        {
                            timeObject = voice.timeObjects[timeObjectIndex];
                            if(timeObject.inputChordDef === undefined)
                            {
                                if(timeObjectIndex < (nTimeObjects - 1))
                                {
                                    // A real rest. All barlines on the right ends of staves are ignored.
                                    inputRest = new InputRest(timeObject);
                                    inputTrack.inputObjects.push(inputRest);
                                }
                            }
                            else
                            {
                                inputChord = new InputChord(timeObject, outputTracks); // the outputTracks should already be complete here
                                inputTrack.inputObjects.push(inputChord);
                            }
                        }
                        ++inputTrackIndex;
                    }
                }
            }
        }

        tracksData.inputTracks = inputTracks;
        tracksData.outputTracks = outputTracks;

        //    if inputTracks contains one or more tracks, the following attributes are also defined (on tracksData):
        //        inputKeyRange.bottomKey
        //        inputKeyRange.topKey
        if(inputTracks.length > 0)
        {
            tracksData.inputKeyRange = getInputKeyRange(inputTracks);            
        }

        return tracksData;
    },

    // an empty score
    Score = function (callback)
    {
        if (!(this instanceof Score))
        {
            return new Score(callback);
        }

        markersLayers = [];
        systems = [];

        runningMarkerHeightChanged = callback;

        // Sends a noteOff to all notes on all channels on the midi output device.
        this.allNotesOff = allNotesOff;

        // functions called when setting the start or end marker
        this.setStartMarkerClick = setStartMarkerClick;
        this.setEndMarkerClick = setEndMarkerClick;

        // functions called when clicking the sendStartMarkerToStart of senEndMarkerToEnd buttons
        this.sendStartMarkerToStart = sendStartMarkerToStart;
        this.sendEndMarkerToEnd = sendEndMarkerToEnd;

        // functions which return the current start and end times.
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
        this.moveRunningMarkerToStartMarker = moveRunningMarkerToStartMarker;

        // markersLayers contains one markersLayer per page of the score.
        // Each markersLayer contains the assistant performer's markers
        // and the page-sized transparent, clickable surface used when
        // setting them.
        this.markersLayers = markersLayers;

        this.getEmptySystems = getEmptySystems;

        // Returns a tracksData object having the following defined attributes:
        //        inputTracks[] - an array of tracks containing inputChords and inputRests
        //        outputTracks[] - an array of tracks containing outputChords and outputRests
        //        if inputTracks contains one or more tracks, the following attributes are also defined (on tracksData):
        //            inputKeyRange.bottomKey
        //            inputKeyRange.topKey
        this.getTracksData = getTracksData;

        // The TracksControl controls the display, and should be the only module to call this function.
        this.refreshDisplay = refreshDisplay;
    },

    publicAPI =
    {
        // empty score constructor (access to GUI functions)
        Score: Score

    };
// end var

return publicAPI;

}(document));


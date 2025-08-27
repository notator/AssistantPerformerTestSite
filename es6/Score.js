import {StartMarker} from "./Markers.js";
import {EndMarker} from "./Markers.js";
import {Cursor} from "./Cursor.js";
import {MidiChord, MidiRest} from "./MidiObject.js";
import {Track} from "./Track.js";
import {RegionDef} from "./RegionDef.js";

const BLACK_COLOR = "#000000";

let //******************************************************************************************
    // Constant values, set when a score is loaded. (When the Start button is pressed on page 1)
    viewBox,
    viewBoxScale,

    // See comments in the publicAPI definition at the bottom of this file.
    systemElems = [], // an array of all the systemElems
    systems = [], // an array of all the systems

    // The frame containing the cursorLine and the start- and end-markers
    markersLayer,
    startMarker,
    endMarker,
    cursor, // The (grey) cursor
    systemChanged, // callback, called when running cursor changes systems

    // The number of voices per system (There can be either 1 or 2 voices per staff.)
    numberOfTracks = 0,

    // a constant list of unique region definitions.
    // When no regions are defined explicitly in a score, default regions are constructed for each interpretation .
    regionSequence,

    // A constant array of objects of the form {startMsPosInScore, array of regionShortName}
    // used by the SetStartMarker and SetEndMarker tools.
    regionShortNamesPerMsPosInScore,

    // Contains an array of track.
    // Each track contains:
    //    1. an array of Interpretations, each of which contains a single layer of midiChords and midiRests
    //    2. the currentInterpretation -- a pointer to track.Interpretations[interpIndex]
    // Comment 17.08.2025: 2 is unnecessary and should be deleted. Use track.Interpretations[currentInterpIndex] instead.
    tracks = [],

    //******************************************************************************************
    // Variable values: These can be changed by controls on page 2. (After the Start button is pressed on page 1)

    // This value (currentRegionIndex) is owned by the InterpretationSelect control.
    // The control sets it (and other things) by calling this.setInterpretation(region).
    currentRegionIndex = 0, // default value: the index of the current region in the regionSequence.
    // currentInterpretationIndex is regionSequence[currentRegionIndex].interpIndex;

    // This array is initialized to all tracks on (=true) when the score is loaded,
    // and reset when the tracksControl calls this.refreshDisplay().
    trackIsOnArray = [], // all tracks, including input tracks

    // used by setStartMarker and setEndMarker tools.
    regionShortName = "",
    startRegionIndex,
    endRegionIndex,
    setMarkerEvent,
    setMarkerState,

    //******************************************************************************************
    // functions

    // This callback is called by sequence.tick() if it can't keep up with the speed of a performance,
    // so that moments having different msPositionInScore have had to be sent "synchronously" in a tight loop.
    // nAsynchMomentsSentAtOnce is the number of moments sent "synchronously" during the overload.
    reportTickOverload = function ()
    {
        let tickOverloadMarkerElem = cursor.element.cloneNode();

        const LIGHT_BLUE = "#AAAAFF";

        let strokeWidth = parseInt(tickOverloadMarkerElem.style.strokeWidth) / 2,
            strokeWidthString = strokeWidth.toString() + "px";

        tickOverloadMarkerElem.style.stroke = LIGHT_BLUE;
        tickOverloadMarkerElem.style.strokeWidth = strokeWidthString;
        tickOverloadMarkerElem.setAttribute("class", "tickOverloadMarker");

        markersLayer.appendChild(tickOverloadMarkerElem);
    },

    deleteTickOverloadMarkers = function ()
    {
        let markerElems = markersLayer.getElementsByClassName("tickOverloadMarker");
        for(let i = markerElems.length - 1; i >= 0; --i)
        {
            markersLayer.removeChild(markerElems[i]);
        }
    },

    // Pushes the values in the trackIsOnArray into the argument (which is an empty array).
    // The returnArray will be garbage collected when it is finished with.
    // This rigmarole so that values in the trackIsOnArray can't be changed except by the tracksControl.
    getReadOnlyTrackIsOnArray = function (returnArray)
    {
        var i;
        console.assert(returnArray.length === 0);

        for(i = 0; i < trackIsOnArray.length; ++i)
        {
            returnArray.push(trackIsOnArray[i]);
        }
    },

    getInterpretationIndex = function ()
    {
        // TODO (get it from controls.currentInterpretationIndex)
        return 0;
    },

    hideStartMarkersExcept = function (startMarker)
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

    hideEndMarkersExcept = function (endMarker)
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

    getTimeObjectsArray = function (system)
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

    // Returns null or the performing midiChord, midiRest or barline closest to the startMarkerTool or endMarkerTool click position.
    // Displays an alert if an attempt is made to position the start marker at the end of a system, or
    // the end marker at the beginning of a system.
    // Returns null if no midiObject or barline can be found that matches the arguments.
    findPerformingMidiObjectOrBarline = function (system, timeObjectsArray, numberOfTracks, trackIsOnArray, alignment, trackIndex, state)
    {
        function findBarlineOrMidiObject(system, midiObjectBefore, midiObjectAfter, firstMidiObject, lastMidiObject, deltaBefore, deltaAfter, settingStart)
        {
            function findBarline(system, msPos)
            {
                let currentInterpIndex = regionSequence[currentRegionIndex].interpIndex,
                    barline = system.barlinesPerInterpretation[currentInterpIndex].find(x => x.msPositionInScore === msPos);

                return barline;
            }

            let returnObject = null;

            if(midiObjectBefore !== null && midiObjectAfter === null) // clicked to right of last midiObject
            {
                if(settingStart)
                {
                    returnObject = midiObjectBefore;
                }
                else  // setting end
                {
                    let msPos = lastMidiObject.msPositionInScore + lastMidiObject.msDurationInScore,
                        barline = findBarline(system, msPos);

                    returnObject = barline;
                }
            }
            else if(midiObjectBefore === null && midiObjectAfter !== null)	 // clicked to left of first midiObject
            {
                if(settingStart)
                {
                    let msPos = firstMidiObject.msPositionInScore,
                        barline = findBarline(system, msPos);

                    returnObject = barline;
                }
                else // setting end
                {
                    alert("The end marker cannot be set at the beginning of a system.\nSet it at the end of the previous one.");
                }
            }
            else // clicked between two midiObjects (both midiObjectBefore and midiObjectAfter are defined)
            {
                let midiObject = (deltaAfter < deltaBefore) ? midiObjectAfter : midiObjectBefore,
                    msPos = midiObject.msPositionInScore,
                    barline = findBarline(system, msPos);

                if(barline !== null)
                {
                    returnObject = barline;
                }
                else
                {
                    returnObject = midiObject;
                }
            }

            return returnObject;
        }

        let midiObjectBefore = null, midiObjectAfter = null, returnObject = null,
            deltaBefore = Number.MAX_VALUE, deltaAfter = Number.MAX_VALUE,
            startIndex = 0, endIndex = numberOfTracks,
            firstMidiObject, lastMidiObject,
            currentInterpIndex = regionSequence[currentRegionIndex].interpIndex;

        for(let i = startIndex; i < endIndex; ++i)
        {
            if(trackIndex === undefined || (i === trackIndex))
            {
                let timeObjects = timeObjectsArray[i];
                if(trackIsOnArray[i] === true)
                {
                    let nTimeObjects = timeObjects.length;
                    for(let j = 0; j < nTimeObjects; ++j)
                    {
                        let midiObject = timeObjects[j][currentInterpIndex];
                        if(alignment === midiObject.alignment)
                        {
                            returnObject = midiObject;
                            firstMidiObject = timeObjects[0][currentInterpIndex];
                            lastMidiObject = timeObjects[timeObjects.length - 1][currentInterpIndex];
                            break;
                        }
                        if(alignment > midiObject.alignment && (deltaBefore > (alignment - midiObject.alignment)))
                        {
                            midiObjectBefore = midiObject;
                            deltaBefore = alignment - midiObject.alignment;
                            firstMidiObject = timeObjects[0][currentInterpIndex];
                            lastMidiObject = timeObjects[timeObjects.length - 1][currentInterpIndex];
                        }
                        if(alignment < midiObject.alignment && (deltaAfter > (midiObject.alignment - alignment)))
                        {
                            midiObjectAfter = midiObject;
                            deltaAfter = midiObject.alignment - alignment;
                            firstMidiObject = timeObjects[0][currentInterpIndex];
                            lastMidiObject = timeObjects[timeObjects.length - 1][currentInterpIndex];
                        }
                    }
                }
            }
        }

        if(returnObject === null)
        {
            if(midiObjectBefore === null || midiObjectAfter === null)
            {
                let settingStart = state.localeCompare('settingStart') === 0;
                returnObject = findBarlineOrMidiObject(system, midiObjectBefore, midiObjectAfter, firstMidiObject, lastMidiObject, deltaBefore, deltaAfter, settingStart);
            }
            else
            {
                returnObject = (deltaAfter < deltaBefore) ? midiObjectAfter : midiObjectBefore;
            }
        }

        return returnObject;
    },

    // This function is called by the tracksControl whenever a track's on/off state is toggled.
    // It draws the staves with the right colours and, if necessary, moves the start marker to a chord.
    // Either argument can be undefined, in which case the corresponding internal attribute is not changed.
    refreshDisplay = function (trackIsOnArrayArg)
    {
        var i, system = systems[startMarker.systemIndex],
            startMarkerAlignment = startMarker.alignment,
            timeObjectsArray = getTimeObjectsArray(system), midiObject;

        // This function sets the opacity of the staves.
        // Staves have either one or two voices (=tracks).
        // The tracks are 0-indexed channels from top to bottom of the system.
        // If trackIsOnArray[trackIndex] is true, its stafflines opacity is set to 1.
        // If trackIsOnArray[trackIndex] is false, its stafflines opacity is set to 0.3.
        // When the staff has one track, all its stafflines are set for the track.
        // When the staff has two tracks, the top three stafflines are set for the upper track,
        // and the lower two lines are set for the lower track. 
        function setView(trackIsOnArray)
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
                    nTracksPerStaff = staff.voices.length;
                    for(t = 0; t < nTracksPerStaff; ++t)
                    {
                        opacity = (trackIsOnArray[trackIndex]) ? 1 : 0.3;

                        setStafflinesOpacity(staff.voices[t], trackIsOnArray, trackIndex, nTracksPerStaff, opacity);

                        voiceGraphicElements = staff.voices[t].graphicElements;
                        for(g = 0; g < voiceGraphicElements.length; ++g)
                        {
                            voiceGraphicElement = voiceGraphicElements[g];
                            voiceGraphicElement.style.opacity = opacity;
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

        setView(trackIsOnArray);

        midiObject = findPerformingMidiObjectOrBarline(system, timeObjectsArray, numberOfTracks, trackIsOnArray, startMarkerAlignment, undefined, 'settingStart');

        startMarker.moveTo(midiObject); // can be a midiChord, midiRest or barline
    },

    // this function is called only when state is 'settingStart' or 'settingEnd'.
    // It is called again by regionSelectControlMouseOut (above) after selecting a regionShortName
    svgPageClicked = function (e, state)
    {
        let ignoreOtherMarker = e.ignoreOtherMarker, // used when changing interpretations
            cursorX = e.pageX,
            cursorY = e.pageY,
            systemIndex, system,
            timeObjectsArray, midiObjectOrBarline, trackIndex;

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

        // Displays an alert if an attempt was made to set the startMarker or endMarker in the wrong order.
        function selectRegionIndex(timeObject, settingEndMarker)
        {
            function findMsPositionForRegions(timeObject, settingEndMarker)
            {
                let msPos = timeObject.msPositionInScore;
                if(settingEndMarker === true)
                {
                    msPos--;
                }
                return msPos;
            }

            function findRegionShortNamesAtMsPos(msPositionInScore)
            {
                let regionShortNames = undefined;
                for(let i = 1; i < regionShortNamesPerMsPosInScore.length; ++i)
                {
                    if(regionShortNamesPerMsPosInScore[i - 1].msPosInScore <= msPositionInScore
                        && regionShortNamesPerMsPosInScore[i].msPosInScore > msPositionInScore)
                    {
                        regionShortNames = regionShortNamesPerMsPosInScore[i - 1].regionShortNames;
                        break;
                    }
                }
                return regionShortNames;
            }

            // Creates the regionSelectElem and its containing div (=layer).
            // Populates the regionSelectElem's options, and adds the div to the document.
            function openRegionSelectControl(possibleRegionNames, cursorX, cursorY)
            {
                function makeSelectElem(possibleRegionNames, cursorX, cursorY)
                {
                    // sets the global regionShortName variable to the select's current value,
                    // then deletes the tempSelectRegionLayer (together with its 'select' element).
                    function regionSelectControlMouseLeave()
                    {
                        let selectElem = document.getElementById("tempRegionSelectElem");

                        if(selectElem.selectedIndex > 0)
                        {
                            regionShortName = selectElem.options[selectElem.selectedIndex].text.slice(0);

                            selectElem.removeEventListener('mouseleave', regionSelectControlMouseLeave, false);

                            let selectRegionLayer = document.getElementById("tempSelectRegionLayer");
                            selectRegionLayer.removeChild(selectElem);
                            document.body.removeChild(selectRegionLayer);

                            svgPageClicked(setMarkerEvent, setMarkerState);

                            regionShortName = "";
                        }
                    }

                    let selectElem = document.createElement("select"),
                        svgPagesFrame = document.getElementById("svgPagesFrame"),
                        scrollTop = svgPagesFrame.scrollTop;

                    selectElem.id = "tempRegionSelectElem";
                    selectElem.style.position = "absolute";
                    selectElem.style.top = (cursorY - scrollTop).toString(10) + "px";
                    selectElem.style.left = cursorX.toString(10) + "px";
                    selectElem.style.width = "65px";
                    selectElem.addEventListener('mouseleave', regionSelectControlMouseLeave);

                    var option = document.createElement("option");
                    option.text = "region:";
                    selectElem.add(option);

                    for(let name of possibleRegionNames)
                    {
                        var option = document.createElement("option");
                        option.text = name;
                        selectElem.add(option);
                    }

                    return selectElem;
                }

                function makeSelectRegionLayer(selectElem)
                {
                    let svgPagesFrame = document.getElementById("svgPagesFrame"),
                        layer = document.createElement("div");

                    layer.id = "tempSelectRegionLayer"; // used when deleting this div.
                    layer.style.position = "absolute";
                    layer.style.margin = "0";
                    layer.style.padding = "0";
                    layer.style.top = svgPagesFrame.style.top;
                    layer.style.left = svgPagesFrame.style.left;
                    layer.style.width = svgPagesFrame.style.width;
                    layer.style.height = svgPagesFrame.style.height;

                    layer.appendChild(selectElem);

                    return layer;
                }

                let selectElem = makeSelectElem(possibleRegionNames, cursorX, cursorY),
                    selectRegionLayer = makeSelectRegionLayer(selectElem);

                document.body.appendChild(selectRegionLayer);
            }

            function getPossibleRegionShortNames(msPositionInScore, regionShortNames, settingEndMarker, ignoreOtherMarker)
            {
                let possibleNames = [];
                for(let regionShortName of regionShortNames)
                {
                    let index = indexInRegionSequence(regionShortName);
                    if(settingEndMarker === false)
                    {
                        if(index < endRegionIndex
                            || (ignoreOtherMarker === undefined && index === endRegionIndex && msPositionInScore < endMarker.msPositionInScore))
                        {
                            // ignoreOtherMarker is defined only when changing interpretations.
                            // In this case, the markers are not actually moving in the graphics, so the check does not need to be made,
                            // and the  marker.msPositionInScore values are currently invalid anyway (they are being reset).
                            possibleNames.push(regionShortName);
                        }
                    }
                    else // find end region names
                    {
                        if(index > startRegionIndex
                            || (ignoreOtherMarker === undefined && index === startRegionIndex && msPositionInScore > startMarker.msPositionInScore))
                        {
                            possibleNames.push(regionShortName);
                        }
                    }
                }

                if(possibleNames.length === 0 && ignoreOtherMarker === undefined)
                {
                    if(settingEndMarker === false)
                    {
                        alert("Can't position the startMarker on or after the endMarker.");
                    }
                    else
                    {
                        alert("Can't position the endMarker on or before the startMarker.");
                    }
                    possibleNames = null; // illegal marker position click
                }

                return possibleNames;
            }

            let msPositionForRegions = findMsPositionForRegions(timeObject, settingEndMarker),
                regionShortNames = findRegionShortNamesAtMsPos(msPositionForRegions),
                possibleRegionNames = getPossibleRegionShortNames(msPositionForRegions, regionShortNames, settingEndMarker, ignoreOtherMarker),
                regionIndex = 0; // default

            if(possibleRegionNames === null) // illegal marker position click
            {
                regionIndex = -1;
            }
            else if(possibleRegionNames.length === 1)
            {
                regionShortName = possibleRegionNames[0];
                regionIndex = indexInRegionSequence(regionShortName);
                regionShortName = "";
            }
            else if(possibleRegionNames.length > 1)
            {
                openRegionSelectControl(possibleRegionNames, cursorX, cursorY);
            }

            return regionIndex;
        }

        systemIndex = findSystemIndex(cursorY);
        system = systems[systemIndex];

        timeObjectsArray = getTimeObjectsArray(system);

        trackIndex = findTrackIndex(cursorY, system);

        midiObjectOrBarline = findPerformingMidiObjectOrBarline(system, timeObjectsArray, numberOfTracks, trackIsOnArray, cursorX, trackIndex, state);

        // timeObject is either null (if the track has been disabled) or is now the nearest performing chord to the click,
        // either in a live performers voice (if there is one and it is performing) or in a performing voice.
        if(midiObjectOrBarline !== null)
        {
            let regionIndex = 0;
            switch(state)
            {
                case 'settingStart':
                    if(regionShortName.localeCompare("") === 0)
                    {
                        regionIndex = selectRegionIndex(midiObjectOrBarline, false);
                        setMarkerEvent = e; // global: This function is called again with this event when a region has been selected.
                        setMarkerState = state; // global: This function is called again with this state when a region has been selected. 
                    }
                    else regionIndex = indexInRegionSequence(regionShortName);

                    if(regionIndex >= 0 && (regionSequence.length === 1 || regionIndex <= endRegionIndex))
                    {
                        startRegionIndex = regionIndex;
                        startMarker = system.startMarker;
                        hideStartMarkersExcept(startMarker);
                        startMarker.moveTo(midiObjectOrBarline);
                        if(regionSequence.length > 1)
                        {
                            startMarker.setLable(regionSequence[startRegionIndex].shortName);
                        }
                    }
                    currentRegionIndex = (regionIndex === -1) ? currentRegionIndex : regionIndex;
                    break;
                case 'settingEnd':
                    if(regionShortName.localeCompare("") === 0)
                    {
                        regionIndex = selectRegionIndex(midiObjectOrBarline, true);
                        setMarkerEvent = e; // global: This function is called again with this event when a region has been selected.
                        setMarkerState = state; // global: This function is called again with this state when a region has been selected. 
                    }
                    else regionIndex = indexInRegionSequence(regionShortName);

                    if(regionIndex >= 0 && (regionSequence.length === 1 || regionIndex >= startRegionIndex))
                    {
                        endRegionIndex = regionIndex;
                        endMarker = system.endMarker;
                        hideEndMarkersExcept(endMarker);
                        endMarker.moveTo(midiObjectOrBarline);
                        if(regionSequence.length > 1)
                        {
                            endMarker.setLable(regionSequence[endRegionIndex].shortName);
                        }
                    }
                    break;
                default:
                    break;
            }
        }
    },

    hideCursor = function ()
    {
        cursor.setVisible(false);
    },

    // This function does nothing if there are no defined infoStrings
    // (such as for simpleInterpretations, or when there is only one region).
    setActiveInfoStringsStyle = function (regionIndex)
    {
        // This function does nothing if there are no defined infoStrings
        // (such as for simpleInterpretations, or when there is only one region).
        regionSequence[regionIndex].setActiveInfoStringsStyle(true);
    },

    leaveRegion = function (regionIndex)
    {
        // There are no regionInfo boxes if there is only one region.
        if(regionSequence.length > 1)
        {
            // regionIndex is -1 when starting in the first region.
            if(regionIndex >= 0)  
            {
                regionSequence[regionIndex].setActiveInfoStringsStyle(false);
            }

            currentRegionIndex = regionIndex + 1;
            if(currentRegionIndex < regionSequence.length)
            {
                regionSequence[currentRegionIndex].setActiveInfoStringsStyle(true);
            }
        }
    },

    resetRegionInfoStrings = function ()
    {
        // There are no regionInfo boxes if there is only one region.
        if(regionSequence.length > 1)
        {
            for(let regionDef of regionSequence)
            {
                regionDef.setActiveInfoStringsStyle(false);
            }
        }
    },

    // Called when the go button or a startConducting button is clicked.
    setCursor = function ()
    {
        let displayRunningCursor = true,
            currentInterpIndex = regionSequence[currentRegionIndex].interpIndex;
        cursor.set(systems, startMarker.msPositionInScore, endMarker.msPositionInScore, trackIsOnArray, currentInterpIndex, displayRunningCursor);
    },


    init = function ()
    {
        // Constructs empty systems for all the pages.
        // Each page has a frame and the correct number of empty systems.
        // Each system has a startMarker and an endMarker, but these are left
        // on the left edge of the page.
        // Each system has the correct number of staves containing the correct number of voices.
        // The score's trackIsOnArray is initialized to all tracks on (=true).
        function getEmptySystems()
        {
            var system, svgPageEmbeds,
                svgPage, svgElem, pageSystemsElem, pageSystemElems, systemElem;

            function resetContent()
            {
                systemElems.length = 0;
                systems.length = 0;
                numberOfTracks = 0;
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
                    voiceElems,
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

                function setStaffColours(staff)
                {
                    function setStaffNameStyle(staff, titleColor)
                    {
                        staff.nameElem.style.fill = titleColor;
                        staff.nameElem.style.fontWeight = 'normal';
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

                    setStaffNameStyle(staff, BLACK_COLOR);
                    setStafflinesColor(staff, BLACK_COLOR);
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

                system = {};
                systemDy = getDy(systemElem);

                system.staves = [];

                staffElems = getElems(systemElem, "staff", "inputStaff");

                for(i = 0; i < staffElems.length; ++i)
                {
                    staffElem = staffElems[i];
                    staff = {};
                    staffDy = systemDy + getDy(staffElem);
                    staff.voices = [];
                    system.staves.push(staff);

                    voiceElems = staffElem.getElementsByClassName("voice");
                    stafflinesElem = staffElem.getElementsByClassName("stafflines")[0];
                    staff.nameElem = getNameElem(voiceElems[0]);
                    for(j = 0; j < voiceElems.length; ++j)
                    {
                        voice = {};
                        staff.voices.push(voice);
                    }

                    if(stafflinesElem !== undefined)
                    {
                        stafflineInfo = getStafflineInfo(stafflinesElem, staffDy);
                        system.left = stafflineInfo.left;
                        system.right = stafflineInfo.right;

                        staff.stafflines = stafflinesElem.children;
                        staff.topLineY = stafflineInfo.stafflineYs[0];
                        staff.bottomLineY = stafflineInfo.stafflineYs[stafflineInfo.stafflineYs.length - 1];

                        setStaffColours(staff);
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

                return system;
            }

            // uses the <regionSequence> element to set the following values (global inside Score.js):
            // 	   startRegionIndex, endRegionIndex, regionSequence.
            function getRegionData(svgElem)
            {
                let regionSeq = [],
                    regionDefElems = svgElem.getElementsByClassName("regionDef"),
                    regionInfoStringElems = svgElem.getElementsByClassName("regionInfoString");

                // one region per interpretation will be created later, when the number of interpretations is known.
                if(regionDefElems.length > 0)
                {
                    for(let regionDefElem of regionDefElems)
                    {
                        let regionDef = new RegionDef(regionDefElem, regionInfoStringElems);
                        regionSeq.push(regionDef);
                    }

                    //The first regionDef must have startMsPosInScore = "0".
                    console.assert(regionSeq[0].startMsPosInScore === 0);
                }

                startRegionIndex = 0;
                endRegionIndex = regionSeq.length - 1;
                regionSequence = regionSeq;
            }

            // Sets (or resets) the markersLayer (global in this namespace),
            // together with its startMarkers, endMarkers and cursor.
            function setMarkersLayer(svgElem, systems, regionSequence, vbScale)
            {
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

                // returns an array containing nSystems {top, bottom} objects
                function getMarkerYLimitsArray(systems)
                {
                    let ys = [], nSystems = systems.length,
                        topDelta = 10 + (systems[0].topLineY / 2);

                    ys.push(topDelta);
                    for(let i = 1; i < nSystems; ++i)
                    {
                        ys.push(systems[i - 1].bottomLineY + ((systems[i].topLineY - systems[i - 1].bottomLineY) / 2));
                    }
                    let bottomDelta = (nSystems === 1) ? topDelta : ((systems[nSystems - 1].topLineY - systems[nSystems - 2].bottomLineY) / 2);
                    ys.push(systems[nSystems - 1].bottomLineY + bottomDelta);

                    let returnArray = [];
                    for(let i = 0; i < nSystems; ++i)
                    {
                        returnArray.push({"top": ys[i], "bottom": ys[i + 1]});
                    }

                    return returnArray;
                }

                // markersLayer is global inside the score namespace
                // A fresh markersLayer is always created because the score's dimensions
                // may have changed after returning from performing a different one.
                if(markersLayer !== undefined)
                {
                    markersLayer.remove();
                }

                markersLayer = createMarkersLayer(svgElem);

                let markerYLimitsArray = getMarkerYLimitsArray(systems),
                    displayLable = (regionSequence.length > 0) ? true : false;
                for(let systemIndex = 0; systemIndex < systems.length; ++systemIndex)
                {
                    let yCoordinates = {top: markerYLimitsArray[systemIndex].top + 5, bottom: markerYLimitsArray[systemIndex].bottom - 5};

                    system = systems[systemIndex];

                    system.startMarker = new StartMarker(yCoordinates, systemIndex, vbScale, displayLable);
                    markersLayer.appendChild(system.startMarker.element);

                    system.endMarker = new EndMarker(yCoordinates, systemIndex, vbScale, displayLable);
                    markersLayer.appendChild(system.endMarker.element);
                }
                // cursor is accessed outside the score using a getter function
                cursor = new Cursor(systemChanged, viewBoxScale);
                // This is a new markerslayer, so it needs a new cursor.
                markersLayer.appendChild(cursor.element);
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
                        trackIsOnArray.push(true);
                    }
                }
            }

            // Sets the global viewBox object and the sizes and positions of the objects on the svgPagesFrame)
            // Returns the viewBox in the final page of the score.
            function setGraphics()
            {
                var
                    i, svgPage, svgElem, embedsWidth, pagesFrameWidth,
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

            /*************** end of getEmptySystems function definitions *****************************/

            resetContent();

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

            // get regions into regionSequence and default values for startRegionIndex, endRegionIndex.
            // Region and MidiObject msPosInPerf values will be set when the MidiObjects have been loaded.
            getRegionData(svgElem);

            for(let systemIndex = 0; systemIndex < pageSystemElems.length; ++systemIndex)
            {
                systemElem = pageSystemElems[systemIndex];
                systemElems.push(systemElem);

                system = getEmptySystem(viewBox.scale, systemElem);
                systems.push(system); // systems is global inside the score namespace
            }

            // markersLayer is a new layer in (on top of) the svg of the score
            setMarkersLayer(svgElem, systems, regionSequence, viewBox.scale);

            initializeTrackIsOnArray(systems[0]);
        }

        // Loads the global tracks array
        function getMidiObjects()
        {
            // systems->staves->voices->timeObjects
            let
                trackIndex = 0, track,
                nTimeObjects,
                voiceIndex, nVoices, voice,
                staffIndex, nStaves, staff,
                sysIndex, nSystems = systems.length, system, systemElem;

            // Gets the chord, rest and barline timeObjects for the voices in each system. 
            function getVoiceAndSystemTimeObjects()
            {
                function getVoiceTimeObjects()
                {
                    function getTimeObjects(systemIndex, voiceElem, viewBoxScale1)
                    {
                        var noteObjectElems, noteObjectClass,
                            timeObjects = [], noteObjectAlignment,
                            i, j, k, noteObjectElem, noteObjectChildren;

                        noteObjectElems = voiceElem.children;
                        for(i = 0; i < noteObjectElems.length; ++i)
                        {
                            let timeObject = [];

                            noteObjectElem = noteObjectElems[i];
                            noteObjectClass = noteObjectElem.getAttribute('class');
                            // noteObjectAlignment will be null if this is not a chord or rest
                            noteObjectAlignment = noteObjectElem.getAttribute('score:alignment');

                            if(noteObjectClass === 'chord' || noteObjectClass === 'rest')
                            {
                                noteObjectChildren = noteObjectElem.children;
                                for(j = 0; j < noteObjectChildren.length; ++j)
                                {
                                    if(noteObjectChildren[j].nodeName === "score:midiChords")
                                    {
                                        let midiChordsChildren = noteObjectChildren[j].children;
                                        for(k = 0; k < midiChordsChildren.length; ++k)
                                        {
                                            timeObject.push(new MidiChord(midiChordsChildren[k], systemIndex));
                                        }
                                        break;
                                    }
                                    else if(noteObjectChildren[j].nodeName === "score:midiRests")
                                    {
                                        let midiRestsChildren = noteObjectChildren[j].children;
                                        for(k = 0; k < midiRestsChildren.length; ++k)
                                        {
                                            timeObject.push(new MidiRest(midiRestsChildren[k], systemIndex)); // see MidiChord constructor.
                                        }
                                        break;
                                    }
                                }

                                timeObject.forEach((midiObject) =>
                                {
                                    if(midiObject.msDurationInScore === undefined || midiObject.msDurationInScore < 1)
                                    {
                                        throw "Error: Chords and Rests must have a duration greater than 0!";
                                    }

                                    if(noteObjectAlignment !== null)
                                    {
                                        midiObject.alignment = parseFloat(noteObjectAlignment, 10) / viewBoxScale1;
                                    }
                                });


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
                                || type === 'endBarline') // note that is a group (a barline and a thickBarline)
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
                            if(voice.timeObjects[0][0].alignment !== undefined)  // is undefined if the voice is invisible
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

                    function getSystemVoiceObjects(systemIndex, systemElem, system, viewBoxScale1)
                    {
                        var staffElems, staffElem,
                            staff,
                            staffIndex;

                        // Moritz now always enforces that
                        // 1. Every system contains all tracks
                        // 2. Each track's MidiChannel is the same as its index (from top to bottom in each system).
                        // The top track therefore always has MidiChannel == 0, and the
                        // MidiChannels increase contiguously from top to bottom of each system.
                        function getNumberOfTracks(system)
                        {
                            let staves = system.staves, staffIndex, voiceIndex, voices;

                            numberOfTracks = 0;

                            for(staffIndex = 0; staffIndex < staves.length; staffIndex++)
                            {
                                voices = staves[staffIndex].voices;
                                for(voiceIndex = 0; voiceIndex < voices.length; voiceIndex++)
                                {
                                    numberOfTracks++;
                                }
                            }
                        }

                        staffElems = systemElem.getElementsByClassName("staff");
                        staffIndex = 0;
                        while(staffIndex < staffElems.length)
                        {
                            staff = system.staves[staffIndex];
                            staffElem = staffElems[staffIndex];
                            setVoices(systemIndex, staff, staffElem, "voice", viewBoxScale1);
                            staffIndex++;
                        }

                        if(systemIndex === 0)
                        {
                            getNumberOfTracks(systems[0]);
                        }
                    }

                    // Sets the msPosition of each timeObject (rests and chords) in the voice.timeObjects arrays.
                    function setMsPositions(systems)
                    {
                        let nStaves, nVoices, nSystems,
                            timeObjects, nTimeObjects, nInterpretations;

                        nSystems = systems.length;
                        nStaves = systems[0].staves.length;
                        nInterpretations = systems[0].staves[0].voices[0].timeObjects[0].length;

                        for(let interpIndex = 0; interpIndex < nInterpretations; ++interpIndex)
                        {
                            for(let staffIndex = 0; staffIndex < nStaves; ++staffIndex)
                            {
                                nVoices = systems[0].staves[staffIndex].voices.length;
                                for(let voiceIndex = 0; voiceIndex < nVoices; ++voiceIndex)
                                {
                                    let msPosition = 0;
                                    for(let systemIndex = 0; systemIndex < nSystems; ++systemIndex)
                                    {
                                        timeObjects = systems[systemIndex].staves[staffIndex].voices[voiceIndex].timeObjects;
                                        if(timeObjects !== undefined)
                                        {
                                            nTimeObjects = timeObjects.length;
                                            for(let tIndex = 0; tIndex < nTimeObjects; ++tIndex)
                                            {
                                                let midiObject = timeObjects[tIndex][interpIndex];

                                                if(midiObject instanceof MidiChord || midiObject instanceof MidiRest)
                                                {
                                                    Object.defineProperty(midiObject, "msPositionInScore", {value: msPosition, writable: false});
                                                }

                                                msPosition += midiObject.msDurationInScore;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    /*************** end of getVoiceAndSystemTimeObjects function definitions *****************************/

                    for(let i = 0; i < systemElems.length; ++i)
                    {
                        systemElem = systemElems[i];
                        system = systems[i];

                        getSystemVoiceObjects(i, systemElem, system, viewBoxScale);
                    }

                    setMsPositions(systems);
                }

                function getSystemBarlineTimeObjects(systemElems, systemElem)
                {
                    function getBarlinesPerInterpretation(systemElem, voiceTimeObjects, nInterpretations)
                    {
                        function getBarlineTypeAndAlignments(barlineElems, typeString)
                        {
                            let barlineElem, barlineX1,
                                barlineObjs = [], barlineObj, thickBarlines,
                                alignment, currentAlignment = -1;

                            for(var i = 0; i < barlineElems.length; i++)
                            {
                                barlineElem = barlineElems[i];
                                thickBarlines = barlineElem.getElementsByClassName('thickBarline');
                                if(thickBarlines.length === 0)
                                {
                                    barlineX1 = barlineElem.getAttribute('x1');
                                }
                                else
                                {
                                    barlineX1 = thickBarlines[0].getAttribute('x1');
                                }
                                alignment = parseFloat(barlineX1, 10) / viewBoxScale;
                                if(alignment > currentAlignment)
                                {
                                    barlineObj = {};
                                    barlineObj.typeString = typeString;
                                    barlineObj.alignment = alignment;
                                    barlineObjs.push(barlineObj);

                                    currentAlignment = alignment;
                                }
                                else
                                {
                                    break;
                                }
                            }

                            return barlineObjs;
                        }

                        let normalBarlineElems = Array.from(systemElem.getElementsByClassName('normalBarline')),
                            startRegionBarlineElems = Array.from(systemElem.getElementsByClassName('startRegionBarline')),
                            endAndStartRegionBarlineElems = Array.from(systemElem.getElementsByClassName('endAndStartRegionBarline')),
                            endRegionBarlineElems = Array.from(systemElem.getElementsByClassName('endRegionBarline')),
                            endOfScoreBarlineElems = Array.from(systemElem.getElementsByClassName('endOfScoreBarline')),
                            barlineObjs, normalBarlineObjs = [], startRegionBarlineObjs = [], endRegionBarlineObjs = [], endOfScoreBarlineObjs = [],
                            endAndStartBarlineObjs = [];

                        normalBarlineObjs = getBarlineTypeAndAlignments(normalBarlineElems, "normalBarline");
                        startRegionBarlineObjs = getBarlineTypeAndAlignments(startRegionBarlineElems, "startRegionBarline");
                        endRegionBarlineObjs = getBarlineTypeAndAlignments(endRegionBarlineElems, "endRegionBarline");
                        endOfScoreBarlineObjs = getBarlineTypeAndAlignments(endOfScoreBarlineElems, "endOfScoreBarline");
                        endAndStartBarlineObjs = getBarlineTypeAndAlignments(endAndStartRegionBarlineElems, "endAndStartRegionBarline");

                        barlineObjs = [...normalBarlineObjs, ...startRegionBarlineObjs, ...endAndStartBarlineObjs, ...endRegionBarlineObjs, ...endOfScoreBarlineObjs];
                        barlineObjs.sort((x, y) => x.alignment - y.alignment);

                        if(barlineObjs[barlineObjs.length - 1].typeString === "endOfScoreBarline")
                        {
                            barlineObjs.splice(barlineObjs.length - 2, 1); // remove the normalBarline contained in the endOfScoreBarline
                        }

                        let barlinesPerInterpretation = [];

                        barlinesPerInterpretation[0] = barlineObjs;
                        for(let interpIndex = 1; interpIndex < nInterpretations; ++interpIndex)
                        {
                            barlinesPerInterpretation.push(JSON.parse(JSON.stringify(barlineObjs))); // deep clone
                        }

                        for(let interpIndex = 0; interpIndex < nInterpretations; ++interpIndex)
                        {
                            let jIndex = 0, barlines = barlinesPerInterpretation[interpIndex];
                            for(let i = 0; i < barlines.length; i++)
                            {
                                let barline = barlines[i];
                                for(var j = jIndex; j < voiceTimeObjects.length; j++)
                                {
                                    let midiObject = voiceTimeObjects[j][interpIndex];
                                    if((midiObject instanceof MidiChord || midiObject instanceof MidiRest)
                                        && midiObject.alignment > barline.alignment)
                                    {
                                        barline.msPositionInScore = midiObject.msPositionInScore;
                                        jIndex = j + 1;
                                        break;
                                    }
                                }
                            }
                            if(barlines.length > 1)
                            {
                                let lastBarline = barlines[barlines.length - 1],
                                    lastMidiObject = voiceTimeObjects[voiceTimeObjects.length - 1][interpIndex],
                                    lastBarlineMsPos = lastMidiObject.msPositionInScore + lastMidiObject.msDurationInScore;

                                lastBarline.msPositionInScore = lastBarlineMsPos;
                            }
                        }

                        return barlinesPerInterpretation;
                    }

                    let voiceTimeObjects, nInterpretations = systems[0].staves[0].voices[0].timeObjects[0].length;
                    for(let systemIndex = 0; systemIndex < systems.length; ++systemIndex)
                    {
                        system = systems[systemIndex];
                        systemElem = systemElems[systemIndex];
                        voiceTimeObjects = system.staves[0].voices[0].timeObjects;

                        system.barlinesPerInterpretation = getBarlinesPerInterpretation(systemElem, voiceTimeObjects, nInterpretations);
                    }
                }

                getVoiceTimeObjects();
                getSystemBarlineTimeObjects(systemElems, systems);
            }

            function getEmptyTracks(system0staves, nInterpretations)
            {
                var tracks = [],
                    staffIndex, voiceIndex, nStaves = system0staves.length, staff;

                for(staffIndex = 0; staffIndex < nStaves; ++staffIndex)
                {
                    staff = system0staves[staffIndex];
                    for(voiceIndex = 0; voiceIndex < staff.voices.length; ++voiceIndex)
                    {
                        tracks.push(new Track(nInterpretations));
                    }
                }
                return tracks;
            }

            if(systems[0].staves[0].voices[0].timeObjects === undefined)
            {
                getVoiceAndSystemTimeObjects();

                let nInterpretations = systems[0].staves[0].voices[0].timeObjects[0].length;

                tracks = getEmptyTracks(systems[0].staves, nInterpretations);

                nStaves = systems[0].staves.length;

                for(sysIndex = 0; sysIndex < nSystems; ++sysIndex)
                {
                    system = systems[sysIndex];
                    trackIndex = 0;
                    for(staffIndex = 0; staffIndex < nStaves; ++staffIndex)
                    {
                        staff = system.staves[staffIndex];
                        nVoices = staff.voices.length;
                        for(voiceIndex = 0; voiceIndex < nVoices; ++voiceIndex)
                        {
                            voice = staff.voices[voiceIndex];

                            nTimeObjects = voice.timeObjects.length;
                            track = tracks[trackIndex];
                            for(let timeObjectIndex = 0; timeObjectIndex < nTimeObjects; ++timeObjectIndex)
                            {
                                let timeObject = voice.timeObjects[timeObjectIndex];
                                for(let interpIndex = 0; interpIndex < nInterpretations; ++interpIndex)
                                {
                                    let midiObject = timeObject[interpIndex];
                                    if(midiObject instanceof MidiChord || midiObject instanceof MidiRest)
                                    {
                                        track.interpretations[interpIndex].midiObjects.push(midiObject);
                                    }
                                }
                            }
                            ++trackIndex;
                        }
                    }
                }
            }
        }

        getEmptySystems();
        getMidiObjects();
        setInitialInterpretationState(systems);
        setTrackPerformanceObjects();
    },

    setEndMarkerClick = function (e)
    {
        svgPageClicked(e, 'settingEnd');
    },

    setStartMarkerClick = function (e)
    {
        svgPageClicked(e, 'settingStart');
    },

    // Returns a clone of the regionSequence
    getRegionsClone = function ()
    {
        return [...regionSequence];
    },

    // Returns -1 if the regionShortName is not present in regionSequence
    indexInRegionSequence = function (regionShortName)
    {
        let index = -1;
        for(let i = 0; i < regionSequence.length; ++i)
        {
            let region = regionSequence[i];
            if(regionShortName.localeCompare(region.shortName) === 0)
            {
                index = i;
                break;
            }
        }
        return index;
    },

    sendStartMarkerToStart = function ()
    {
        startMarker = systems[0].startMarker;
        hideStartMarkersExcept(startMarker);

        startMarker.setLable(regionSequence[0].shortName);
        startMarker.moveTo(systems[0].barlinesPerInterpretation[0][0]);
        startMarker.setVisible(true);
        startRegionIndex = 0;
    },

    sendEndMarkerToEnd = function ()
    {
        function findSystemAndBarline(regionDef)
        {
            for(var i = 0; i < systems.length; ++i)	
            {
                let system = systems[i],
                    barlines = system.barlinesPerInterpretation[0],
                    endBarline = barlines.find(x => (x.typeString === "endRegionBarline" || x.typeString === "endOfScoreBarline"));

                if(endBarline !== undefined)
                {
                    if(endBarline.typeString === "endRegionBarline" && endBarline.msPositionInScore === regionDef.endMsPosInScore)
                    {
                        return {system, endBarline};
                    }
                    else if(endBarline.typeString === "endOfScoreBarline")
                    {
                        endBarline.msPositionInScore = regionDef.endMsPosInScore;
                        return {system, endBarline};
                    }
                }
                else continue;
            }

            throw "error: cant find the system!";
        }

        let lastRegion = regionSequence[regionSequence.length - 1],
            systemAndBarline = findSystemAndBarline(lastRegion),
            regionSystem = systemAndBarline.system,
            endOfRegionBarline = systemAndBarline.endBarline;

        endMarker = regionSystem.endMarker;
        endMarker.setLable(lastRegion.shortName);
        hideEndMarkersExcept(endMarker);
        endMarker.moveTo(endOfRegionBarline);
        endMarker.setVisible(true);
        endRegionIndex = regionSequence.length - 1;
    },

    getStartMarkerMsPositionInScore = function ()
    {
        return startMarker.msPositionInScore;
    },

    getEndMarkerMsPositionInScore = function ()
    {
        return endMarker.msPositionInScore;
    },

    // Called when the start button is clicked in the top options panel,
    // and when setOptions button is clicked at the top of the score.
    // If the startMarker is not fully visible in the svgPagesDiv, move
    // it to the top of the div.
    moveStartMarkerToTop = function (svgPagesDiv)
    {
        var height = Math.round(parseFloat(svgPagesDiv.style.height)),
            scrollTop = svgPagesDiv.scrollTop, startMarkerYCoordinates;

        startMarkerYCoordinates = startMarker.yCoordinates;

        if((startMarkerYCoordinates.top < scrollTop) || (startMarkerYCoordinates.bottom > (scrollTop + height)))
        {
            if(startMarker.systemIndex === 0)
            {
                svgPagesDiv.scrollTop = 0;
            }
            else
            {
                svgPagesDiv.scrollTop = startMarkerYCoordinates.top - 10;
            }
        }
    },

    // Advances the cursor to msPosition (in any channel)
    // Sets the cursor invisible when the end of the score is reached.
    advanceCursor = function (msPositionInScore)
    {
        if(msPositionInScore === endMarker.msPositionInScore && currentRegionIndex === endRegionIndex)
        {
            cursor.setVisible(false);
        }
        else
        {
            cursor.moveElementTo(msPositionInScore);
        }
    },

    setInitialInterpretationState = function (systems)
    {
        function setRegionData(systems)
        {
            // Sets regionShortNamesPerMsPosInScore (global in score),
            // which is used by the SetStartMarker and SetEndMarker tools.
            function setRegionNamesPerMsPosInScore(regionSequence)
            {
                // Returns an array containing one unique name per performed region.
                // Uses Moritz' algorithm (A, A1, A2 etc.).
                function getRegionShortNameSequence(regionSequence)
                {
                    let shortNames = [];
                    for(let region of regionSequence)
                    {
                        shortNames.push(region.shortName);
                    }
                    return shortNames;
                }

                function getRegionMsPosBounds(regionSequence)
                {
                    let regionMsPosBounds = [];
                    for(let region of regionSequence)
                    {
                        let msPositionInScore = region.startMsPosInScore;
                        if(regionMsPosBounds.indexOf(msPositionInScore) === -1)
                        {
                            regionMsPosBounds.push(msPositionInScore);
                        }
                        msPositionInScore = region.endMsPosInScore;
                        if(regionMsPosBounds.indexOf(msPositionInScore) === -1)
                        {
                            regionMsPosBounds.push(msPositionInScore);
                        }
                    }
                    regionMsPosBounds.sort((a, b) => (a - b));

                    return regionMsPosBounds;
                }

                let regionShortNameSequence = getRegionShortNameSequence(regionSequence);
                let regionMsPosBoundsInScore = getRegionMsPosBounds(regionSequence);

                // global in Score.js: will contain objects of the form {startMsPosInScore, array of regionInstanceName}
                regionShortNamesPerMsPosInScore = [];
                for(let msPosInScore of regionMsPosBoundsInScore)
                {
                    let regionShortNames = [];
                    for(let i = 0; i < regionSequence.length; ++i)
                    {
                        let region = regionSequence[i],
                            regionShortName = regionShortNameSequence[i],
                            duration = region.endMsPosInScore - region.startMsPosInScore;

                        if(msPosInScore >= region.startMsPosInScore && msPosInScore < (region.startMsPosInScore + duration))
                        {
                            regionShortNames.push(regionShortName);
                        }
                    }
                    let entry = {msPosInScore, regionShortNames};
                    regionShortNamesPerMsPosInScore.push(entry);
                }
            }

            // Set each region.startBarline and region.systemIndex.
            // These attributes are used when selecting a region with the InterpretatonsSelect control.
            function setRegionStartBarlineAndSystemIndex(regionSequence, systems)
            {
                for(let region of regionSequence)
                {
                    let found = false;
                    for(let systemIndex = 0; systemIndex < systems.length; ++systemIndex)
                    {
                        let barlines = systems[systemIndex].barlinesPerInterpretation[0];
                        for(let barline of barlines)
                        {
                            if(region.startMsPosInScore === barline.msPositionInScore)
                            {
                                region.startBarline = barline;
                                region.systemIndex = systemIndex;
                                found = true;
                                break;
                            }
                        }
                        if(found)
                        {
                            break;
                        }
                    }
                }
            }

            function setRegionLinks(regionSequence, tracks)
            {
                for(let track of tracks)
                {
                    for(let interpretation of track.interpretations)
                    {
                        interpretation.setRegionLinks(regionSequence);
                    }
                }
            }

            if(regionSequence.length === 0)
            {
                // create one region per interpretation (each region spans the whole score).
                let timeObjects = systems[systems.length - 1].staves[0].voices[0].timeObjects,
                    nInterpretations = timeObjects[0].length;

                for(let interpIndex = 0; interpIndex < nInterpretations; ++interpIndex)
                {
                    let scoreSpanRegionData = {},
                        finalMidiObject = timeObjects[timeObjects.length - 1][interpIndex],
                        finalBarlineMsPosInScore = finalMidiObject.msPositionInScore + finalMidiObject.msDurationInScore,
                        interpretationNr = (interpIndex + 1).toString();

                    scoreSpanRegionData.shortName = interpretationNr; // used as label on Markers
                    scoreSpanRegionData.longName = "interpretation " + interpretationNr; // used in the interpretationSelect control
                    scoreSpanRegionData.interpIndex = interpIndex;
                    scoreSpanRegionData.startMsPosInScore = 0;
                    scoreSpanRegionData.endMsPosInScore = finalBarlineMsPosInScore;

                    let region = new RegionDef(undefined, undefined, scoreSpanRegionData);
                    // must I set the start barline later?

                    regionSequence.push(region);
                }
                // These variables (global in Score) need to be ignored when performing scoreSpanRegions...
                startRegionIndex = -1;
                endRegionIndex = -1;
            }

            setRegionNamesPerMsPosInScore(regionSequence);
            setRegionStartBarlineAndSystemIndex(regionSequence, systems);
            setRegionLinks(regionSequence, tracks);

        } // end of setRegionData()

        function sendMarkersToInitialPositions()
        {
            for(let i = 0; i < systems.length; ++i)
            {
                let system = systems[i];
                system.startMarker.setVisible(false);
                system.endMarker.setVisible(false);
            }

            sendStartMarkerToStart();
            sendEndMarkerToEnd();
        }


        for(let i = 0; i < tracks.length; ++i)
        {
            tracks[i].setCurrentInterpretation(0);
        }

        setRegionData(systems);

        sendMarkersToInitialPositions();

        let displayRunningCursor = false;
        cursor.set(systems, startMarker.msPositionInScore, endMarker.msPositionInScore, trackIsOnArray, 0, displayRunningCursor);
    },



    getSystems = function ()
    {
        return systems;
    },

    getCursor = function ()
    {
        return cursor;
    },

    getNumberOfTracks = function ()
    {
        return tracks.length;
    },

    // If regionSequence[0].isSimpleInterpretation(), each track.performanceObjects will contain an array of
    // _parallel_ alternative interpretations (each of which contains a flat list of midiObjects).
    // Otherwise track.performanceObjects contains all the midiObjects for the complete _sequence_ of regions.
    setTrackPerformanceObjects = function ()
    {
        let performanceDuration = -1;
        for(let track of tracks)
        {
            track.setPerformanceObjects(regionSequence);

            if(regionSequence[0].isSimpleInterpretation() === false)
            {
                // check that all track durations are the same
                let lastObject = track.performanceObjects[track.performanceObjects.length - 1],
                    trackDuration = lastObject.msPosInPerf + lastObject.msDurInPerf;
                if(performanceDuration > 0)
                {
                    console.assert(trackDuration === performanceDuration);
                }
                performanceDuration = trackDuration;
            }
        }
    },

    getPerformanceObjectsPerTrack = function ()
    {
        let trackPerformanceObjects = [];

        for(let track of tracks)
        {
            trackPerformanceObjects.push(track.performanceObjects);
        }

        return trackPerformanceObjects;
    },

    getMarkersLayer = function ()
    {
        return markersLayer; // is undefined before a score is loaded
    },

    getRegionStartMsPositionsInScore = function ()
    {
        let rval = [];
        rval.push(0); // always include the beginning of the score
        for(let i = 0; i < regionSequence.length; ++i)
        {
            let rl = regionSequence[i];
            if(rval.indexOf(rl.startMsPosInScore) < 0)
            {
                rval.push(rl.startMsPosInScore);
            }
        }
        rval.sort(function (a, b) {return a - b;});
        return rval;
    },

    getRegionNamesPerMsPosInScore = function ()
    {
        return regionShortNamesPerMsPosInScore; // is undefined before a score is loaded (used at runtime)
    },

    getStartRegionIndex = function ()
    {
        return startRegionIndex;
    },

    getEndRegionIndex = function ()
    {
        if(regionSequence[currentRegionIndex].isSimpleInterpretation()) 
        {
            // e.g. Study 1 with several interpretations of the same score
            return startRegionIndex;
        }
        else
        {
            return endRegionIndex;
        }        
    },

    // called by interpretationSelect.leave
    setInterpretation = function (region)
    {
        // global: currentInterpIndex == regionSequence[currentRegionIndex].interpIndex
        currentRegionIndex = regionSequence.findIndex(x => x.shortName === region.shortName);

        let system = systems[region.systemIndex];

        startMarker = system.startMarker;
        hideStartMarkersExcept(startMarker);
        startMarker.moveTo(region.startBarline);
        startMarker.setLable(region.shortName);

        sendEndMarkerToEnd();

        cursor.set(systems, startMarker.msPositionInScore, endMarker.msPositionInScore, trackIsOnArray, currentRegionIndex, false);
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

        this.getStartMarkerMsPositionInScore = getStartMarkerMsPositionInScore;
        this.getEndMarkerMsPositionInScore = getEndMarkerMsPositionInScore;
        this.getReadOnlyTrackIsOnArray = getReadOnlyTrackIsOnArray;
        this.getInterpretationIndex = getInterpretationIndex;

        // Called when the start button is clicked in the top options panel,
        // and when setOptions button is clicked at the top of the score.
        // If the startMarker is not fully visible in the svgPagesDiv, move
        // it to the top of the div.
        this.moveStartMarkerToTop = moveStartMarkerToTop;

        // Recalculates the timeObject lists for the cursor using trackIsOnArray
        // (tracksControl.trackIsOnArray) to take into account which tracks are actually performing.
        // When the score is first read, all tracks perform by default.
        this.setCursor = setCursor;
        // Advances the cursor to the following timeObject (in any channel)
        // if the msPosition argument is >= that object's msPosition. Otherwise does nothing.
        this.advanceCursor = advanceCursor;
        this.hideCursor = hideCursor;

        this.resetRegionInfoStrings = resetRegionInfoStrings;
        this.setActiveInfoStringsStyle = setActiveInfoStringsStyle;
        this.leaveRegion = leaveRegion;

        this.init = init;

        this.getNumberOfTracks = getNumberOfTracks;
        //this.getMidiObjectsPerTrack = getMidiObjectsPerTrack;

        this.getRegionsClone = getRegionsClone;

        this.setInterpretation = setInterpretation;

        // The markersLayer is set when a specific score is loaded.
        // It contains the cursor line and the start- and endMarkers for each system in the score.
        // It is also the transparent, clickable surface used when setting the start and end markers.
        this.getMarkersLayer = getMarkersLayer;
        this.getSystems = getSystems;
        this.getCursor = getCursor;
        this.getRegionNamesPerMsPosInScore = getRegionNamesPerMsPosInScore;
        this.getRegionStartMsPositionsInScore = getRegionStartMsPositionsInScore;
        this.getStartRegionIndex = getStartRegionIndex;
        this.getEndRegionIndex = getEndRegionIndex;

        // The TracksControl controls the display, and should be the only module to call this function.
        this.refreshDisplay = refreshDisplay;

        this.getPerformanceObjectsPerTrack = getPerformanceObjectsPerTrack; // used by Sequence.js

        this.reportTickOverload = reportTickOverload;
        this.deleteTickOverloadMarkers = deleteTickOverloadMarkers;
    }
}


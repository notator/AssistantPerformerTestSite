import {StartMarker} from "./Markers.js";
import {EndMarker} from "./Markers.js";
import {Cursor} from "./Cursor.js";
import {MidiChord, MidiRest} from "./MidiObject.js";
import {NormalBarline, StartRegionBarline, EndRegionBarline, EndAndStartRegionBarline, EndOfScoreBarline} from "./Barline.js";
import {Track} from "./Track.js";
import {Moment} from "./Moment.js";
import {Region} from "./Region.js";

const BLACK_COLOR = "#000000";

/***********************************************************************************************
 * Interpretation is currently a confused concept, that needs to be sorted out.
 * This means redefining various classes, and the way they are constructed.
 *
 * I'm revising the code so that, when a score has been loaded, the global tracks and systems data structures in this Score namespace
 * are defined as follows:
 * 
 * tracks is an array of Track objects, each of which has an .interpretations attribute that is an array of interpretation.
 * Each interpretation is a sequence of midiObjects (MidiChord and MidiRest objects) spanning the whole score.
 * So each tracks[trackIndex].interpretations[interpIndex][midiObjectIndex] contains a particular interpretation of the midiObject at midiObjectIndex. 
 * 
 * systems is an array of system objects. 
 * system.firstMidiObjectIndexPerTrack is an array of indices, one per track.
 * Each midiObjectIndex is that of the first midiObject in the track at the beginning of the system given by systemIndex.
 * The midiObjectIndex can be used to find the midiObject in an interpretation of the track, as follows:
 * firstMidiObject = tracks[trackIndex].interpretations[interpIndex][midiObjectIndex]
 * 
 * At the top level:
 *      1. The Interpretation class will be removed entirely
 *      2. The "InterpretationSelect" control will be renamed to "RegionSelect", and its functionality will change.
 *          Probably, selecting a Region will set the EndMarker to the end of the Region, not the end of the Score.
 * 
 * Lower down, the Track and Region classes need to be modified as follows: 
 * As before, a Score contains a .tracks array containing Track objects
 * Tracks are constructed from the <voice> elements in the SVG-MIDI file.
 * Each Track has a .interpretations attribute, that is an array containing interpretation arrays.
 * Each interpretation is a sequence of midiObjects:
 *          tracks[trackIndex].interpretations[interpIndex]
 * is an array (temporal sequence) of MidiChord and MidiRest objects spanning the whole score.
 * These are the <midiChord> and <midiRest> objects defined at midiObjectIndex inside the <midiChords>
 * and <midiRests> elements in the SVG-MIDI file.
 * These midiObjects' .msPosInScore attributes are set, but their .msPosInPerf attributes are undefined.
 * 
 * As before, the Score also contains a .regionSequence array containing Region objects that are defined
 * (in chronological order) in the SVG-MIDI file.
 * Each Region has a single .moments array that will be constructed as follows:
 *      1. The SVG-MIDI file defines the region's startMsPosInScore, endMsPosInScore and midiObjectIndex.
 *      2. Get the Region's parallel .interpretations by cloning the midiObjects in the corresponding
 *          segment of the tracks[trackIndex].interpretations[interpIndex] interpretation (midiObjects array).
 *          Note:
 *          a) that the midiObjects must be cloned, so that their .msPosInPerf attributes can be set independently
 *             per region. Regions may overlap, so a midiObject at a particular .msPosInScore will have
 *             different .msPosInPerf values in different Regions.    
 *          b) that a region's .interpretations only span the range between its startMsPosInScore and
 *             endMsPosInScore 
 *      3. Convert each Region's parallel .interpretations to a single sequence of vertical moments (.moments)
 */

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

    // a constant list of unique region definitions.
    // When no regions are defined explicitly in a score, default regions are constructed for each interpretation .
    regionSequence,

    // An array of Track objects.
    tracks = [],

    //******************************************************************************************
    // Variable values: These can be changed by controls on page 2. (After the Start button is pressed on page 1)

    // This value (currentRegionIndex) is owned by the RegionSelect control.
    // The control sets it (and other things) by calling this.setInterpretation(region).
    currentRegionIndex = 0, // default value: the index of the current region in the regionSequence.
    // currentInterpretationIndex is regionSequence[currentRegionIndex].sequenceIndex;

    // This array is initialized to all tracks on (=true) when the score is loaded,
    // and reset when the tracksControl calls this.refreshDisplay().
    trackIsOnArray = [], // all tracks, including input tracks

    // used by setStartMarker and setEndMarker tools.
    regionShortName = "",
    setMarkerEvent,
    setMarkerState,

    //******************************************************************************************
    // functions

    // Returns a clone of the trackIsOnArray
    // (so that values in the trackIsOnArray can't be changed except by the tracksControl).
    getReadOnlyTrackIsOnArray = function ()
    {
        return [...trackIsOnArray];
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

    // Returns null or the performing midiChord, midiRest or barline closest to the startMarkerTool or endMarkerTool click position.
    // Displays an alert if an attempt is made to position the start marker at the end of a system, or
    // the end marker at the beginning of a system.
    // Returns undefined if no midiObject or barline can be found that matches the arguments.
    findPerformingMidiObject = function (system, tracks, trackIsOnArray, alignment, trackIndex, state)
    {
        function findTimeObject(system, midiObjectBefore, midiObjectAfter, clickAlignment, settingStart)
        {
            function findNearestObject(clickAlignment, leftObject, rightObject)
            {
                let deltaBefore = clickAlignment - leftObject.alignment,
                    deltaAfter = rightObject.alignment - clickAlignment,
                    returnObject = (deltaBefore < deltaAfter) ? leftObject : rightObject;

                console.assert(deltaBefore >= 0 && deltaAfter >= 0);

                return returnObject;
            }

            let returnObject = undefined;

            if(midiObjectBefore !== undefined && midiObjectAfter === undefined) // clicked to right of last midiObject
            {
                let rightMostBarline = system.barlines[system.barlines.length - 1],
                    nearestObject = undefined;

                if(clickAlignment < rightMostBarline.alignment)
                {
                    // clicked to the left of the rightMostBarline
                    nearestObject = findNearestObject(clickAlignment, midiObjectBefore, rightMostBarline);
                }

                if(nearestObject === midiObjectBefore)
                {
                    returnObject = midiObjectBefore;
                }
                else if(settingStart)
                {
                    alert("The start marker cannot be set at the end of a system.\nSet it at the beginning of the next one.");
                }
                else  // setting end
                {
                    if(nearestObject === undefined)  // clicked to the right of the rightMostBarline
                    {
                        returnObject = rightMostBarline;
                    }
                    else
                    {
                        returnObject = nearestObject;
                    }
                }
            }
            else if(midiObjectBefore === undefined && midiObjectAfter !== undefined) // clicked to left of first midiObject
            {
                let leftMostBarline = system.barlines[0],
                    nearestObject = undefined;

                if(clickAlignment > leftMostBarline.alignment)
                {
                    // clicked to the right of the leftMostBarline
                    nearestObject = findNearestObject(clickAlignment, leftMostBarline, midiObjectAfter);
                }

                if(nearestObject === midiObjectAfter && (midiObjectAfter.alignment > (leftMostBarline.alignment + 30)))
                {
                    returnObject = midiObjectAfter;
                }
                else if(settingStart)
                {
                    returnObject = leftMostBarline;
                }
                else // setting end
                {
                    if(nearestObject === undefined)  // clicked to the left of the leftMostBarline
                    {
                        alert("The end marker cannot be set at the beginning of a system.\nSet it at the end of the previous one.");
                    }
                    else
                    {
                        returnObject = nearestObject;
                    }
                }
            }
            else // clicked between two midiObjects (both midiObjectBefore and midiObjectAfter are defined)
            {
                let alignmentBefore = midiObjectBefore.alignment,
                    alignmentAfter = midiObjectAfter.alignment,
                    barline = system.barlines.find(x => (x.alignment > alignmentBefore && x.alignment < alignmentAfter));

                if(barline !== undefined)
                {
                    if((clickAlignment - barline.alignment) >= 0)
                    {
                        returnObject = barline;
                    }
                    else // clicked between midiObjectBefore and barline
                    {
                        returnObject = findNearestObject(clickAlignment, midiObjectBefore, barline);
                    }
                }
                else
                {
                    returnObject = findNearestObject(clickAlignment, midiObjectBefore, midiObjectAfter);
                }
            }

            return returnObject;
        }

        let midiObjectBefore = undefined, midiObjectAfter = undefined, returnObject = undefined,
            deltaBefore = Number.MAX_VALUE, deltaAfter = Number.MAX_VALUE,
            startIndex = 0, endIndex = tracks.length,
            currentMidiObjectIndex = regionSequence[currentRegionIndex].sequenceIndex;

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
                        let midiObject = timeObjects[j][currentMidiObjectIndex];
                        if(alignment === midiObject.alignment)
                        {
                            returnObject = midiObject;
                            break;
                        }
                        if(alignment > midiObject.alignment && (deltaBefore > (alignment - midiObject.alignment)))
                        {
                            midiObjectBefore = midiObject;
                            deltaBefore = alignment - midiObject.alignment;
                        }
                        if(alignment < midiObject.alignment && (deltaAfter > (midiObject.alignment - alignment)))
                        {
                            midiObjectAfter = midiObject;
                            deltaAfter = midiObject.alignment - alignment;
                        }
                    }
                }
            }
        }

        if(returnObject === undefined)
        {
            let settingStart = state.localeCompare('settingStart') === 0;
            returnObject = findTimeObject(system, midiObjectBefore, midiObjectAfter, alignment, settingStart);
        }

        return returnObject; // a MidiChord, MidiRest or (untyped) barline
    },

    getStartMarker = function ()
    {
        return startMarker;
    },

    getEndMarker = function ()
    {
        return endMarker;
    },

    // This function is called by the tracksControl whenever a track's on/off state is toggled.
    // It draws the staves with the right colours and, if necessary, moves the start marker to a chord.
    // Either argument can be undefined, in which case the corresponding internal attribute is not changed.
    refreshDisplay = function (trackIsOnArrayArg)
    {
        var i, system = systems[startMarker.systemIndex],
            startMarkerAlignment = startMarker.alignment,
            midiObject;

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

        midiObject = findPerformingMidiObject(system, tracks, trackIsOnArray, startMarkerAlignment, undefined, 'settingStart');

        startMarker.moveTo(midiObject); // can be a midiChord, midiRest or barline
    },

    // this function is called only when state is 'settingStart' or 'settingEnd'.
    // It is called again by regionSelectControlMouseOut (above) after selecting a regionShortName
    svgPageClicked = function (e, state)
    {
        let cursorX = e.pageX,
            cursorY = e.pageY,
            systemIndex, system,
            timeObjectsArray, timeObject, trackIndex;

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

        function getMsPosInPerf(timeObject, region)
        {
            function findMidiObject(msPosInScore, interpretationIndex)
            {
                let midiObject = undefined;
                for(let track of tracks)
                {
                    let interpretation = track.interpretations[interpretationIndex];
                    midiObject = interpretation.find(x => x.msPosInScore === msPosInScore);
                    if(midiObject !== undefined)
                    {
                        break;
                    }
                }

                return midiObject;
            }

            let regionIndex = regionSequence.indexOf(region),
                msPosInPerf;

            if(timeObject instanceof MidiChord || timeObject instanceof MidiRest)
            {
                let midiObject = findMidiObject(timeObject.msPosInScore, regionIndex);
                msPosInPerf = midiObject.msPosInPerf;
            }
            else // timeObject is a barline
            {
                let barline = timeObject;
                msPosInPerf = barline.msPosInPerfPerRegion[regionIndex];
            }

            return msPosInPerf;
        }

        function selectRegionIndex(timeObject, settingEndMarker)
        {
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
                        let tempRegionSelect = document.getElementById("tempRegionSelect"),
                            regionSelect = document.getElementById("regionSelect");

                        if(tempRegionSelect.selectedIndex > 0)
                        {
                            regionShortName = tempRegionSelect.options[tempRegionSelect.selectedIndex].text.slice(0);

                            let interpretationIndex = indexOfShortNameInRegionSequence(regionShortName);
                            regionSelect.selectedIndex = interpretationIndex;

                            tempRegionSelect.removeEventListener('mouseleave', regionSelectControlMouseLeave, false);

                            let selectRegionLayer = document.getElementById("tempSelectRegionLayer");
                            selectRegionLayer.removeChild(tempRegionSelect);
                            document.body.removeChild(selectRegionLayer);

                            svgPageClicked(setMarkerEvent, setMarkerState);

                            regionShortName = "";
                        }
                    }

                    let selectElem = document.createElement("select"),
                        svgPagesFrame = document.getElementById("svgPagesFrame"),
                        scrollTop = svgPagesFrame.scrollTop;

                    selectElem.id = "tempRegionSelect";
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

            function getPossibleRegionShortNames(msPosInScore, settingEndMarker)
            {
                function findAllRegionsAtMsPosInScore(msPosInScore)
                {
                    let regionsAtMsPosInScore = [];
                    for(let region of regionSequence)
                    {
                        if(region.startMsPosInScore <= msPosInScore && region.endMsPosInScore > msPosInScore)
                        {
                            regionsAtMsPosInScore.push(region);
                        }
                    }
                    return regionsAtMsPosInScore;
                }

                let regionsAtMsPosInScore = findAllRegionsAtMsPosInScore(timeObject.msPosInScore),
                    possibleNames = [];

                for(let regionAtMsPosInScore of regionsAtMsPosInScore)
                {
                    let msPosInPerf = getMsPosInPerf(timeObject, regionAtMsPosInScore);

                    if(settingEndMarker === false)
                    {   // settting startMarker
                        let endMarkerRegion = regionSequence[endMarker.regionIndex];
                        if(msPosInPerf < endMarker.msPosInPerf
                            || (msPosInPerf < endMarker.msPosInPerf && msPosInPerf >= endMarkerRegion.startMsPosInPerf && msPosInPerf < endMarkerRegion.endMsPosInPerf))
                        {
                            possibleNames.push(regionAtMsPosInScore.shortName);
                        }
                    }
                    else 
                    {   // setting endMarker
                        let startMarkerRegion = regionSequence[startMarker.regionIndex];
                        if(msPosInPerf > startMarker.msPosInPerf
                            || (msPosInPerf > startMarker.msPosInPerf && msPosInPerf >= startMarkerRegion.startMsPosInPerf && msPosInPerf < startMarkerRegion.endMsPosInPerf))
                        {
                            possibleNames.push(regionAtMsPosInScore.shortName);
                        }
                    }
                }

                if(possibleNames.length === 0)
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

            let possibleRegionNames = getPossibleRegionShortNames(timeObject.msPosInScore, settingEndMarker),
                regionIndex = 0; // default

            if(possibleRegionNames === null) // illegal marker position click
            {
                regionIndex = -1;
            }
            else
            {
                openRegionSelectControl(possibleRegionNames, cursorX, cursorY);
            }

            return regionIndex;
        }

        systemIndex = findSystemIndex(cursorY);
        system = systems[systemIndex];

        trackIndex = findTrackIndex(cursorY, system);

        timeObject = findPerformingMidiObject(system, tracks, trackIsOnArray, cursorX, trackIndex, state);

        // timeObject is either undefined (if the track has been disabled) or is now the nearest performing chord or barline to the click,
        // either in a live performers voice (if there is one and it is performing) or in a performing voice.
        if(timeObject !== undefined)
        {
            let regionIndex = 0;
            switch(state)
            {
                case 'settingStart':
                    if(regionShortName.localeCompare("") === 0)
                    {
                        regionIndex = selectRegionIndex(timeObject, false);
                        setMarkerEvent = e; // global: This function is called again with this event when a region has been selected.
                        setMarkerState = state; // global: This function is called again with this state when a region has been selected. 
                    }
                    else
                    {
                        regionIndex = indexOfShortNameInRegionSequence(regionShortName);
                        regionShortName = "";
                        if(regionIndex >= 0)
                        {
                            let region = regionSequence[regionIndex],
                                msPosInPerf = getMsPosInPerf(timeObject, region);

                            if(msPosInPerf >= endMarker.msPosInPerf)
                            {
                                alert("Attempt to position the startMarker after the endMarker");
                            }
                            else
                            {
                                startMarker = system.startMarker;
                                hideStartMarkersExcept(startMarker);
                                startMarker.regionIndex = regionIndex;
                                startMarker.moveTo(timeObject);
                                startMarker.setLable(region.shortName);
                                startMarker.msPosInPerf = msPosInPerf;
                            }
                        }
                    }
                    currentRegionIndex = (regionIndex === -1) ? currentRegionIndex : regionIndex;
                    break;
                case 'settingEnd':
                    if(regionShortName.localeCompare("") === 0)
                    {
                        regionIndex = selectRegionIndex(timeObject, true);
                        setMarkerEvent = e; // global: This function is called again with this event when a region has been selected.
                        setMarkerState = state; // global: This function is called again with this state when a region has been selected. 
                    }
                    else
                    {
                        regionIndex = indexOfShortNameInRegionSequence(regionShortName);
                        regionShortName = "";
                        if(regionIndex >= 0)
                        {
                            let region = regionSequence[regionIndex],
                                msPosInPerf = getMsPosInPerf(timeObject, region);

                            if(msPosInPerf <= startMarker.msPosInPerf)
                            {
                                alert("Attempt to position the endMarker before the startMarker");
                            }
                            else
                            {
                                endMarker = system.endMarker;
                                hideEndMarkersExcept(endMarker);
                                endMarker.regionIndex = regionIndex;
                                endMarker.moveTo(timeObject);
                                endMarker.setLable(region.shortName);
                                endMarker.msPosInPerf = msPosInPerf;
                            }
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
    setActiveInfoStringsStyle = function ()
    {
        // This function does nothing if there are no defined infoStrings
        // (such as for simpleInterpretations, or when there is only one region).
        regionSequence[startMarker.regionIndex].setActiveInfoStringsStyle(true);
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
            currentMidiObjectIndex = regionSequence[currentRegionIndex].sequenceIndex;

        cursor.set(systems, startMarker.msPosInScore, trackIsOnArray, currentMidiObjectIndex, displayRunningCursor);
    },


    init = function ()
    {
        // Constructs empty systems for all the pages.
        // Each page has a frame and the correct number of empty systems.
        // Each system has a startMarker and an endMarker, but these are left
        // on the left edge of the page.
        // Each system has the correct number of staves containing the correct number of voices.
        // The score's trackIsOnArray is initialized to all tracks on (=true).
        function setEmptySystems()
        {
            var system, svgPageEmbeds,
                svgPage, svgElem, pageSystemsElem, pageSystemElems, systemElem;

            function resetContent()
            {
                systemElems.length = 0;
                systems.length = 0;
                tracks = [];
                trackIsOnArray.length = 0;
                currentRegionIndex = 0;
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

            // If the <regionSequence> element is defined in the score, this function uses it to set the following values (global inside Score.js):
            // 	   startMarker.regionIndex, endMarker.regionIndex, regionSequence.
            // If there are no regions defined in the score, one region per level of midiObject in the score's <midiChords> or <midiRests> elements
            // will be created later.
            function getConsecutiveRegionDataFromScore(svgElem)
            {
                let regionSeq = [],
                    regionDefElems = svgElem.getElementsByClassName("regionDef"),
                    regionInfoStringElems = svgElem.getElementsByClassName("regionInfoString");

                if(regionDefElems.length > 0)
                {
                    for(let regionDefElem of regionDefElems)
                    {
                        let regionDef = new Region(regionDefElem, regionInfoStringElems);
                        regionSeq.push(regionDef);
                    }
                    regionSeq.hasConsecutiveRegions = true; // will be false in interpretation regions (created later).
                }

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

                    system.startMarker = new StartMarker(yCoordinates, systemIndex, vbScale, displayLable, 0);
                    markersLayer.appendChild(system.startMarker.element);

                    system.endMarker = new EndMarker(yCoordinates, systemIndex, vbScale, displayLable, regionSequence.length - 1);
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

            // get regions into regionSequence and default values for startMarker.regionIndex, endMarker.regionIndex.
            // Region and MidiObject msPosInPerf values will be set when the MidiObjects have been loaded.
            getConsecutiveRegionDataFromScore(svgElem);

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

        // Constructs each track.interpretations array,
        // setting the following attributes in all midiObjects:
        //  .alignment
        //  .msPosInScore
        function setTrackMidiObjectSequences()
        {
            // Moritz now always enforces that
            // 1. Every system contains all tracks
            // 2. Each track's MidiChannel is the same as its index (from top to bottom in each system).
            // The top track therefore always has MidiChannel == 0, and the
            // MidiChannels increase contiguously from top to bottom of each system.
            function constructTracks(system)
            {
                let staves = system.staves,
                    numberOfTracks = 0;

                for(let staffIndex = 0; staffIndex < staves.length; staffIndex++)
                {
                    let voices = staves[staffIndex].voices;
                    for(let voiceIndex = 0; voiceIndex < voices.length; voiceIndex++)
                    {
                        numberOfTracks++;
                    }
                }

                let localTracks = [];
                for(let trackIndex = 0; trackIndex < numberOfTracks; trackIndex++)
                {
                    localTracks.push(new Track());
                }

                return localTracks;
            }

            function getTrackVoiceElem(trackIndex, systemElem)
            {
                let staffElems = systemElem.getElementsByClassName("staff"),
                    allVoiceElems = [];

                for(let staffElem of staffElems)
                {
                    let voiceElem = staffElem.getElementsByClassName("voice")[0];

                    allVoiceElems.push(voiceElem);                    
                }
                return allVoiceElems[trackIndex];
            }

            function getCurrentMsPosInScore(midiObjectSequence)
            {
                let endMsPosInScore = 0;
                if(midiObjectSequence.length > 0)
                {
                    let lastMidiObject = midiObjectSequence[midiObjectSequence.length - 1];
                    endMsPosInScore = lastMidiObject.msPosInScore + lastMidiObject.msDuration;
                }
                return endMsPosInScore;
            }

            function getTrackInterpretations(track, trackVoiceElems)
            {
                let interpretations = [];

                for(let voiceElem of trackVoiceElems)
                {
                    let noteObjectElems = voiceElem.children;
                    for(let noteObjectElem of noteObjectElems)
                    {
                        let noteObjectClass = noteObjectElem.getAttribute('class');
                        if(noteObjectClass !== 'chord' && noteObjectClass !== "rest")
                        {
                            continue;
                        }

                        let alignment = parseFloat(noteObjectElem.getAttribute('score:alignment'), 10) / viewBoxScale,
                            scoreMidiChordsElem = noteObjectElem.getElementsByTagName('score:midiChords')[0],
                            scoreMidiRestsElem = noteObjectElem.getElementsByTagName('score:midiRests')[0],
                            alternativeMidiChordElems = [],
                            alternativeMidiRestElems = [];

                        if(scoreMidiChordsElem !== undefined)
                        {
                            alternativeMidiChordElems = Array.from(scoreMidiChordsElem.getElementsByTagName('midiChord'));
                        }
                        else if(scoreMidiRestsElem !== undefined)
                        {
                            alternativeMidiRestElems = Array.from(scoreMidiRestsElem.getElementsByTagName('midiRest'));
                        }

                        let alternativeMidiObjectElems = (alternativeMidiChordElems.length > 0) ? alternativeMidiChordElems : alternativeMidiRestElems,
                            nInterpretations = alternativeMidiObjectElems.length;

                        console.assert(alternativeMidiChordElems.length > 0);

                        if(interpretations.length === 0)
                        {
                            for(let i = 0; i < nInterpretations; ++i)
                            {
                                interpretations.push([]);
                            }
                        }

                        for(let interpIndex = 0; interpIndex < nInterpretations; ++interpIndex)
                        {
                            let interpretation = interpretations[interpIndex],
                                msPosInScore = getCurrentMsPosInScore(interpretation);

                            if(alternativeMidiChordElems.length > 0)
                            {
                                let midiChordElem = alternativeMidiChordElems[interpIndex];

                                interpretation.push(new MidiChord(midiChordElem, alignment, msPosInScore));
                            }
                            else if(alternativeMidiRestElems.length > 0)
                            {
                                let midiRestElem = alternativeMidiRestElems[interpIndex];

                                interpretation.push(new MidiChord(midiRestElem, alignment, msPosInScore));
                            }
                        }
                    }
                }

                return interpretations;
            }

            function checkInterpretations(thisInterpretation, previousInterpretation)
            {
                console.assert(thisInterpretation.length === previousInterpretation.length);

                for(let j = 0; j < thisInterpretation.length; ++j)
                {
                    console.assert(thisInterpretation[j].alignment === previousInterpretation[j].alignment);
                }
            }

            /*************** end of setTrackMidiObjectSequences function definitions *****************************/

            // global inside the score namespace
            tracks = constructTracks(systems[0]);

            for(let trackIndex = 0; trackIndex < tracks.length; ++trackIndex)
            {
                let trackVoiceElems = [];
                for(let systemElem of systemElems)
                {
                    trackVoiceElems.push(getTrackVoiceElem(trackIndex, systemElem));
                }

                let track = tracks[trackIndex],
                    interpretations = getTrackInterpretations(track, trackVoiceElems);

                for(let i = 1; i < interpretations.length; ++i)
                {
                    let thisInterpretation = interpretations[i],
                        previousInterpretation = interpretations[i - 1];

                    checkInterpretations(thisInterpretation, previousInterpretation);
                }

                track.interpretations = interpretations;
            }
        }

        function setSystemVoiceGraphics(systemElems, systems)
        {
            function setVoiceGraphics(systemIndex, staff, staffElem)
            {
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

                var voiceElems, voiceElem, isFirstVoiceInStaff;

                voiceElems = staffElem.getElementsByClassName("voice");
                isFirstVoiceInStaff = true;
                for(let voiceIndex = 0; voiceIndex < voiceElems.length; ++voiceIndex)
                {
                    voiceElem = voiceElems[voiceIndex];
                    let voice = staff.voices[voiceIndex];
                    voice.graphicElements = getGraphicElements(systemIndex, voiceElem); // will be used to set opacity when the voice is disabled
                    if(isFirstVoiceInStaff === true)
                    {
                        voice.staffLinesElem = staffElem.getElementsByClassName("staffLines");
                        isFirstVoiceInStaff = false;
                    }
                }
            }

            for(let systemIndex = 0; systemIndex < systemElems.length; ++systemIndex)
            {
                let systemElem = systemElems[systemIndex],
                    system = systems[systemIndex],
                    staffElems = systemElem.getElementsByClassName("staff");
                for(let staffIndex = 0; staffIndex < system.staves.length; staffIndex++)
                {
                    let staff = system.staves[staffIndex],
                        staffElem = staffElems[staffIndex];

                    setVoiceGraphics(systemIndex, staff, staffElem);
                }
            }
        }

        function setAllSystemBarlines(systemElems, systems)
        {
            function getBarlineElemsSortedLeftToRight(systemElem)
            {
                function reducedArray(systemElem, classString)
                {
                    let reducedArray = [],
                        alignments = [],                        
                        barlineElemsArray = Array.from(systemElem.getElementsByClassName(classString));

                    for(let barlineElem of barlineElemsArray)
                    {
                        let alignment,
                            thickBarlineElem = barlineElem.getElementsByClassName('thickBarline')[0];

                        if(thickBarlineElem !== undefined)
                        {
                            alignment = parseFloat(thickBarlineElem.getAttribute('x1'), 10) / viewBoxScale;
                        }
                        else
                        {
                            alignment = parseFloat(barlineElem.getAttribute('x1'), 10) / viewBoxScale;
                        }

                        if(alignments.indexOf(alignment) === -1)
                        {
                            reducedArray.push(barlineElem);
                            alignments.push(alignment);
                        }
                    }
                    return reducedArray;
                }

                function sortBarlinesLeftToRight(a, b)
                {
                    const getX1 = (barlineElem) =>
                    {
                        // Check if the barlineElem is a single line or a group containing lines
                        if(barlineElem.tagName === 'line')
                        {
                            return parseFloat(barlineElem.getAttribute('x1'));
                        }
                        else
                        {
                            const firstLine = barlineElem.getElementsByTagName('line')[0];
                            return firstLine ? parseFloat(firstLine.getAttribute('x1')) : 0;
                        }
                    };

                    const x1A = getX1(a);
                    const x1B = getX1(b);

                    return x1A - x1B;
                }

                function getBarlineElems(normalBarlineElems, compositeBarlineElems)
                {
                    let barlineElems = [],
                        compositeNormalAlignments = [];

                    for(let compositeBarlineElem of compositeBarlineElems)
                    {
                        let normalBarlines = compositeBarlineElem.getElementsByClassName('normalBarline');
                        for(let normalBarline of normalBarlines)
                        {
                            compositeNormalAlignments.push(parseFloat(normalBarline.getAttribute('x1'), 10) / viewBoxScale);
                        }
                    }

                    // If a normal barline has the same alignment as a normal barline in a composite barline,
                    // the normal barline is not added to the array, to avoid double counting.
                    for(let normalBarlineElem of normalBarlineElems)
                    {
                        let normalBarlineAlignment = parseFloat(normalBarlineElem.getAttribute('x1'), 10) / viewBoxScale;
                        // If compositeNormalAlignments contains normalBarlineAlignment,
                        // then there is a normal barline in a composite barline with the same alignment as normalBarlineElem,
                        // so normalBarlineElem is not added to the barlineElems array.
                        if(compositeNormalAlignments.indexOf(normalBarlineAlignment) === -1)
                        {
                            barlineElems.push(normalBarlineElem);
                        }
                    }

                    return [...barlineElems, ...compositeBarlineElems];
                }

                let normalBarlineElems = reducedArray(systemElem, 'normalBarline'),
                    startRegionBarlineElems = reducedArray(systemElem, 'startRegionBarline'),
                    endAndStartRegionBarlineElems = reducedArray(systemElem, 'endAndStartRegionBarline'),
                    endRegionBarlineElems = reducedArray(systemElem, 'endRegionBarline'),
                    endOfScoreBarlineElems = reducedArray(systemElem, 'endOfScoreBarline'),
                    compositeBarlineElems = [...startRegionBarlineElems, ...endAndStartRegionBarlineElems, ...endRegionBarlineElems, ...endOfScoreBarlineElems],
                    barlineElems = getBarlineElems(normalBarlineElems, compositeBarlineElems);

                barlineElems.sort(sortBarlinesLeftToRight);

                return barlineElems;
            }

            function constructBarline(typeString, alignment, msPosInScore)
            {
                let barline;
                switch(typeString)
                {
                    case "normalBarline":
                        {
                            barline = new NormalBarline(alignment, msPosInScore); break;
                        }
                    case "startRegionBarline":
                        {
                            barline = new StartRegionBarline(alignment, msPosInScore); break;
                        }
                    case "endRegionBarline":
                        {
                            barline = new EndRegionBarline(alignment, msPosInScore); break;
                        }
                    case "endAndStartRegionBarline":
                        {
                            barline = new EndAndStartRegionBarline(alignment, msPosInScore); break;
                        }
                    case "endOfScoreBarline":
                        {
                            barline = new EndOfScoreBarline(alignment, msPosInScore); break;
                        }
                    default:
                        {
                            throw "Unknown barline type string: " + typeString;
                        }
                }
                return barline;
            }

            function getTypeStringAndAlignment(barlineElem)
            {
                function getAlignment(barlineElem)
                {
                    let thickBarline = barlineElem.getElementsByClassName('thickBarline')[0],
                        barlineX1;

                    if(thickBarline !== undefined)
                    {
                        barlineX1 = thickBarline.getAttribute('x1');
                    }
                    else
                    {
                        barlineX1 = barlineElem.getAttribute('x1');
                    }
                    let alignment = parseFloat(barlineX1, 10) / viewBoxScale;

                    return alignment;
                }

                let typeString = barlineElem.getAttribute('class'),
                    alignment = getAlignment(barlineElem);

                return {typeString: typeString, alignment: alignment};
            }

            // Returns an array of indices per Track.
            // Each index is that of the first midiObject in the track at the beginning of the system given by systemIndex.
            // Each interpretation in tracks[trackIndex].interpretations spans the whole score.
            // Each tracks[trackIndex].interpretations[interpretation] contains a particular interpretation of the track.
            // Each tracks[trackIndex].interpretations[interpretation][index] contains a particular interpretation of the midiObject at that index.
            function getFirstMidiObjectIndexPerTrackInSystem(systemIndex, tracks)
            {
                let firstMidiObjectIndexPerTrackInSystem = [];

                for(let trackIndex = 0; trackIndex < tracks.length; trackIndex++)
                {
                    let sysIndex = 0,
                        interpretation = tracks[trackIndex].interpretations[0];

                    for(let midiObjectIndex = 1; midiObjectIndex < interpretation.length; midiObjectIndex++)
                    {
                        if(systemIndex === 0)
                        {
                            firstMidiObjectIndexPerTrackInSystem.push(0);
                            break;
                        }
                        else if(interpretation[midiObjectIndex].alignment < interpretation[midiObjectIndex - 1].alignment)
                        {
                            sysIndex++;
                            if(sysIndex === systemIndex)
                            {
                                firstMidiObjectIndexPerTrackInSystem.push(midiObjectIndex);
                                break;
                            }
                        }
                    }
                }

                return firstMidiObjectIndexPerTrackInSystem;
            }
            // constructs all barlines in a system
            function getSystemBarlines(barlineElemsSortedLeftToRight, midiObjects0IndexPerTrackInThisSystem, midiObjects0IndexPerTrackInNextSystem)
            {
                // returns the msPosInScore of the first midiObject after the barline in any track.interpretation[0]
                // If there is no midiObject after the barline in any track in the same system,
                // then the barline's msPosInScore is that of the first midiObject in any track in the next system,
                // If there is no following system, then the barline's msPosition is the end of the last midiObject in the score..
                function getBarlineMsPosInSystem(barlineAlignment, midiObjects0IndexPerTrackInThisSystem, midiObjects0IndexPerTrackInNextSystem)
                {
                    // returns the msPosInScore of the first midiObject after the barline in any track.interpretation[0]
                    // or undefined if there is no midiObject after the barline in any track.interpretation[0].
                    function getALeftBarlineMsPosInSystem(barlineAlignment, midiObjects0IndexPerTrackInThisSystem)
                    {
                        let barlineMsPos = Number.MAX_VALUE;

                        console.assert(midiObjects0IndexPerTrackInThisSystem.length === tracks.length);

                        for(let trackIndex = 0; trackIndex < tracks.length; trackIndex++)
                        {
                            let interpretation = tracks[trackIndex].interpretations[0],
                                midiObjectIndex = midiObjects0IndexPerTrackInThisSystem[trackIndex],
                                currentMidiObject = interpretation[midiObjectIndex];

                            while(midiObjectIndex < interpretation.length && barlineMsPos !== undefined)
                            {
                                if(currentMidiObject.alignment > barlineAlignment)
                                {
                                    let midiObjectMsPos = currentMidiObject.msPosInScore;
                                    barlineMsPos = (barlineMsPos < midiObjectMsPos) ? barlineMsPos : midiObjectMsPos;
                                    break; // to next track.interpretation
                                }
                                else
                                {
                                    barlineMsPos = undefined; // the relevant midiObject is on the next system (if there is one), so return undefined;
                                }

                                midiObjectIndex++;
                            } 
                            if(barlineMsPos === undefined)
                            {
                                break;
                            }
                        }
                        console.assert(barlineMsPos !== Number.MAX_VALUE);

                        return barlineMsPos;

                    }

                    // returns the msPosInScore of the first midiObject on the following system in any track.interpretation[0]
                    // or undefined if there is no following system.
                    function getTheRightBarlineMsPosInSystem(midiObjects0IndexPerTrackInNextSystem)
                    {
                        let barlineMsPos = Number.MAX_VALUE;

                        console.assert(midiObjects0IndexPerTrackInThisSystem.length === tracks.length);

                        for(let trackIndex = 0; trackIndex < tracks.length; trackIndex++)
                        {
                            let interpretation = tracks[trackIndex].interpretations[0],
                                midiObjectIndex = midiObjects0IndexPerTrackInNextSystem[trackIndex];

                            console.assert(midiObjectIndex < interpretation.length);

                            let currentMidiObject = interpretation[midiObjectIndex],
                                midiObjectMsPos = currentMidiObject.msPosInScore;

                            barlineMsPos = (barlineMsPos < midiObjectMsPos) ? barlineMsPos : midiObjectMsPos;
                        }
                        console.assert(barlineMsPos !== Number.MAX_VALUE);
                        return barlineMsPos;
                    }

                    // returns the endMsPosInScore of the last midiObject in the last system.track[0].interpretation[0]..
                    function getTheLastBarlineMsPosInScore()
                    {
                        let interpretation = tracks[0].interpretations[0],
                            lastMidiObject = interpretation[interpretation.length - 1],
                            lastBarlineMsPosInScore = lastMidiObject.msPosInScore + lastMidiObject.msDuration;

                        return lastBarlineMsPosInScore;
                    }

                    let barlineMsPos = undefined;

                    if((barlineMsPos = getALeftBarlineMsPosInSystem(barlineAlignment, midiObjects0IndexPerTrackInThisSystem)) === undefined)
                    {
                        if(midiObjects0IndexPerTrackInNextSystem === null) // there is no next system
                        {
                            barlineMsPos = getTheLastBarlineMsPosInScore();
                        }
                        else
                        {
                            barlineMsPos = getTheRightBarlineMsPosInSystem(midiObjects0IndexPerTrackInNextSystem);
                            console.assert(barlineMsPos !== undefined);                            
                        }
                    }

                    return barlineMsPos;
                }

                let barlines = [];

                for(var i = 0; i < barlineElemsSortedLeftToRight.length; i++)
                {
                    let barlineElem = barlineElemsSortedLeftToRight[i],
                        barline,
                        rVal = getTypeStringAndAlignment(barlineElem),
                        typeString = rVal.typeString,
                        barlineAlignment = rVal.alignment,
                        msPosInScore = getBarlineMsPosInSystem(barlineAlignment, midiObjects0IndexPerTrackInThisSystem, midiObjects0IndexPerTrackInNextSystem);

                    console.assert(msPosInScore >= 0);

                    barline = constructBarline(typeString, barlineAlignment, msPosInScore);
                    barlines.push(barline);
                }

                return barlines;
            }

            // set each system.barlines and system.firstMidiObjectIndexPerTrack.
            // system.barlines is an array of barline objects.
            for(let systemIndex = 0; systemIndex < systems.length; ++systemIndex)
            {
                let system = systems[systemIndex],
                    systemElem = systemElems[systemIndex],
                    barlineElemsSortedLeftToRight = getBarlineElemsSortedLeftToRight(systemElem),
                    firstMidiObjectIndexPerTrackInThisSystem = getFirstMidiObjectIndexPerTrackInSystem(systemIndex, tracks),
                    firstMidiObjectIndexPerTrackInNextSystem = (systemIndex + 1 < systems.length) ? getFirstMidiObjectIndexPerTrackInSystem(systemIndex + 1, tracks) : null;

                system.barlines = getSystemBarlines(barlineElemsSortedLeftToRight, firstMidiObjectIndexPerTrackInThisSystem, firstMidiObjectIndexPerTrackInNextSystem);
                system.firstMidiObjectIndexPerTrack = firstMidiObjectIndexPerTrackInThisSystem;
            }

        }

        function setInitialInterpretationState(systems)
        {
            function setRegionData(systems)
            {
                // Set each region.startBarline and region.systemIndex.
                // These attributes are used when selecting a region with the InterpretatonsSelect control.
                function setRegionStartBarlineAndSystemIndex(regionSequence, systems)
                {
                    for(let region of regionSequence)
                    {
                        let found = false;
                        for(let systemIndex = 0; systemIndex < systems.length; ++systemIndex)
                        {
                            let barlines = systems[systemIndex].barlines;
                            for(let barline of barlines)
                            {
                                if(region.startMsPosInScore === barline.msPosInScore)
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

                // Convert integer (1 → 'A', 2 → 'B', etc.)
                function intToUppercaseChar(num)
                {
                    if(typeof num !== 'number' || !Number.isInteger(num) || num < 1 || num > 26)
                    {
                        throw new Error('Input must be an integer between 1 and 26.');
                    }

                    // ASCII code for 'A' is 65
                    const baseCode = 65;
                    return String.fromCharCode(baseCode + num - 1);
                }

                if(regionSequence.length === 0) // no regions defined in the score
                {
                    // create one region per interpretation in the track.interpretations
                    // (each interpretation spans the whole score).
                    let interpretations = tracks[0].interpretations,
                        nMidiObjects = interpretations[0].length,
                        nInterpretations = interpretations.length;

                    for(let interpIndex = 0; interpIndex < nInterpretations; ++interpIndex)
                    {
                        let scoreSpanRegionData = {},
                            finalMidiObject = interpretations[interpIndex][nMidiObjects - 1],
                            finalBarlineMsPosInScore = finalMidiObject.msPosInScore + finalMidiObject.msDuration,
                            shortName = intToUppercaseChar(interpIndex + 1); // used as label on Markers ("A", "B", etc.) 

                        scoreSpanRegionData.shortName = shortName;
                        scoreSpanRegionData.longName = "Region " + shortName; // used in the regionSelect control
                        scoreSpanRegionData.sequenceIndex = interpIndex;
                        scoreSpanRegionData.startMsPosInScore = 0;
                        scoreSpanRegionData.endMsPosInScore = finalBarlineMsPosInScore;

                        let region = new Region(undefined, undefined, scoreSpanRegionData);

                        regionSequence.push(region);
                    }

                    regionSequence.hasConsecutiveRegions = false; // is true if a regionSequence is defined in the score.
                    // These two variables (global in Score) need to be ignored in scores that have no consecutive regions.
                    startMarker.regionIndex = -1;
                    endMarker.regionIndex = -1;
                }

                function setRegionStartAndEndMsPosInPerf(regionSequence)
                {
                    function getRegionDurationInPerformance(interpIndex)
                    {
                        let interpretation = tracks[0].interpretations[interpIndex],
                            msDuration = 0;

                        for(let midiObject of interpretation)
                        {
                            msDuration += midiObject.msDuration;
                        }
                        return msDuration;
                    }

                    if(regionSequence.hasConsecutiveRegions === false)
                    {
                        for(let region of regionSequence)
                        {
                            region.startMsPosInPerf = region.startMsPosInScore;
                            region.endMsPosInPerf = region.endMsPosInScore;

                            Object.freeze(region.startMsPosInPerf);
                            Object.freeze(region.endMsPosInPerf);
                        }
                    }
                    else // regions are concatenated
                    {
                        let msPos = 0;
                        for(let region of regionSequence)
                        {
                            let regionDurationInPerformance = getRegionDurationInPerformance(region.sequenceIndex);

                            region.startMsPosInPerf = msPos;
                            region.endMsPosInPerf = region.startMsPosInPerf + regionDurationInPerformance;

                            Object.freeze(region.startMsPosInPerf);
                            Object.freeze(region.endMsPosInPerf);

                            msPos = region.endMsPosInPerf;
                        }
                    }
                }

                setRegionStartBarlineAndSystemIndex(regionSequence, systems);
                setRegionStartAndEndMsPosInPerf(regionSequence);
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

            setRegionData(systems);

            sendMarkersToInitialPositions();

            let displayRunningCursor = false;
            cursor.set(systems, startMarker.msPosInScore, tracks, trackIsOnArray, 0, displayRunningCursor);
        }
        
        setEmptySystems();
        setTrackMidiObjectSequences();
        setSystemVoiceGraphics(systemElems, systems);
        setAllSystemBarlines(systemElems, systems); // uses global tracks (track.interpretations[0])
        setInitialInterpretationState(systems);
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
    getRegionSequence = function ()
    {
        return [...regionSequence];
    },

    // Returns -1 if the regionShortName is not present in regionSequence
    indexOfShortNameInRegionSequence = function (regionShortName)
    {
        let index = regionSequence.findIndex(x => x.shortName.localeCompare(regionShortName) === 0);
        return index;
    },

    sendStartMarkerToStart = function ()
    {
        startMarker = systems[0].startMarker;
        hideStartMarkersExcept(startMarker);

        let regionSelect = document.getElementById("regionSelect"),
            firstRegionIndex = 0;

        regionSelect.selectedIndex = firstRegionIndex;

        startMarker.setLable(regionSequence[firstRegionIndex].shortName);
        startMarker.moveTo(systems[0].barlines[0]);
        startMarker.msPosInPerf = 0;
        startMarker.regionIndex = 0;

        // update the way the current region will be displayed in performance
        resetRegionInfoStrings();

        startMarker.setVisible(true);
    },

    sendEndMarkerToEnd = function ()
    {
        function findFinalSystemAndBarline(regionDef)
        {
            let finalSystem = undefined,
                finalBarline = undefined;

            for(let system of systems)	
            {
                let barlines = system.barlines,
                    endBarline = barlines.find(x => x.msPosInScore === regionDef.endMsPosInScore);

                if(endBarline !== undefined)
                {
                    finalSystem = system;
                    finalBarline = endBarline;
                    break;
                }
            }
            if(finalBarline === undefined)
            {
                throw "error: cant find the final barline!";
            }
            else
            {
                return {finalSystem, finalBarline};
            }
        }

        let lastRegionIndex = regionSequence.length - 1,
            lastRegion = regionSequence[lastRegionIndex],
            finalSystemAndBarline = findFinalSystemAndBarline(lastRegion),
            regionSystem = finalSystemAndBarline.finalSystem,
            endOfRegionBarline = finalSystemAndBarline.finalBarline;

        endMarker = regionSystem.endMarker;
        endMarker.setLable(lastRegion.shortName);
        hideEndMarkersExcept(endMarker);
        endMarker.moveTo(endOfRegionBarline);
        endMarker.msPosInPerf = lastRegion.endMsPosInPerf;
        endMarker.regionIndex = lastRegionIndex;

        // update the way the current region will be displayed in performance
        resetRegionInfoStrings();

        endMarker.setVisible(true);
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

    // Advances the cursor to msPos (in any channel)
    // Sets the cursor invisible when the end of the score is reached.
    advanceCursor = function (msPosInScore)
    {
        if(msPosInScore === endMarker.msPosInScore && currentRegionIndex === endMarker.regionIndex)
        {
            cursor.setVisible(false);
        }
        else
        {
            cursor.moveElementTo(msPosInScore);
        }
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

    getMarkersLayer = function ()
    {
        return markersLayer; // is undefined before a score is loaded
    },

    // called by regionSelect.leave
    setInterpretation = function(region)
    {
        // the Score global currentRegionIndex value
        currentRegionIndex = regionSequence.findIndex(x => x.shortName === region.shortName);

        let system = systems[region.systemIndex];

        startMarker = system.startMarker;
        hideStartMarkersExcept(startMarker);
        startMarker.moveTo(region.startBarline);
        startMarker.setLable(region.shortName);
        startMarker.msPosInPerf = region.startMsPosInPerf;
        startMarker.regionIndex = currentRegionIndex;

        // update the way the current region will be displayed in performance
        resetRegionInfoStrings();

        sendEndMarkerToEnd();

        cursor.set(systems, startMarker.msPosInScore, trackIsOnArray, currentRegionIndex, false);

        if(regionSequence.hasConsecutiveRegions === false)
        {
            // track.runtimeInterpretation doesn't change when regionSequence.hasConsecutiveRegions is true.
            for(let track of tracks)
            {
                track.runtimeInterpretation = track.interpretations[region.sequenceIndex];
            }
        }
    },

    // Called by getMoments(), called by Controls.startPlaying() before performer.play() i.e. when the Go button is clicked. 
    getLinkedMoments = function (regionSequence, tracks, trackIsOnArray)
    {
        // The track.setRuntimeInterpretation attributes are the only track attributes that can change after being initialized.
        // If trackIsOn === false, track.runtimeInterpretation is undefined.
        function setTrackRuntimeInterpretations(tracks, trackIsOnArray)
        {
            let nTracks = trackIsOnArray.length;

            for(let i = 0; i < nTracks; ++i)
            {
                let track = tracks[i];
                track.setRuntimeInterpretation(trackIsOnArray[i], regionSequence, currentRegionIndex);
            }
        }

        function getAllMoments(tracks)
        {
            let allMoments = [];
            for(let track of tracks)
            {
                if(track !== undefined && track.runtimeInterpretation !== undefined)
                {
                    let runtimeInterpretation = track.runtimeInterpretation;
                    for(let midiObject of runtimeInterpretation.midiObjects)
                    {
                        allMoments = allMoments.concat(midiObject.moments);
                    }
                }
            }
            return allMoments;
        }

        function mergeMoments(allMoments)
        {
            let currentMoment = new Moment(allMoments[0]),
                mergedMoments = [];

            for(let i = 1; i < allMoments.length; ++i)
            {
                let moment = allMoments[i];

                if(moment.msPosInPerf === currentMoment.msPosInPerf)
                {
                    currentMoment.mergeMoment(moment);
                    currentMoment.msPosInScore = moment.msPosInScore; // changes the first moment in each region
                }
                else
                {
                    mergedMoments.push(currentMoment);
                    currentMoment = new Moment(moment);
                }
            }

            mergedMoments.push(currentMoment);

            return mergedMoments;
        }

        function setRegionIndexAttributes(mergedMoments, regionSequence)
        {
            for(let regionIndex = 0; regionIndex < regionSequence.length; ++regionIndex)
            {
                let region = regionSequence[regionIndex],
                    moment = mergedMoments.find(x => x.msPosInPerf === region.startMsPosInPerf);
                console.assert(moment !== undefined);
                moment.regionIndex = regionIndex;
            }
        }

        function linkedMoments(moments, lastRegionEndMsPosInPerf)
        {
            for(let i = 0; i < moments.length - 2; ++i)
            {
                let thisMoment = moments[i],
                    nextMoment = moments[i + 1]; 
                thisMoment.nextMoment = nextMoment;
                thisMoment.msDuration = nextMoment.msPosInPerf - thisMoment.msPosInPerf;
            }
            let lastMoment = moments[moments.length - 1];
            lastMoment.nextMoment = null;
            lastMoment.msDuration = lastRegionEndMsPosInPerf - lastMoment.msPosInPerf;

            return moments;
        }

        function setBarlineMsPosInPerfPerRegionArrays(systems, tracks)
        {
           // all barlines except the rightmost.
            for(let system of systems)
            {
                let barlines = system.barlines;
                for(let barlineIndex = 0; barlineIndex < barlines.length - 1; barlineIndex++)
                {
                    // all barlines except the rightmost.
                    let barline = barlines[barlineIndex];

                    barline.msPosInPerfPerRegion = [];

                    // find a midiObject in a track.interpretation[0] having the same msPosInScore as the barline.
                    for(let track of tracks)
                    {
                        let interpretation = track.interpretations[0],
                            midiObjectIndex = interpretation.findIndex(x => x.msPosInScore === barline.msPosInScore);
                        if(midiObjectIndex >= 0)
                        {
                            for(let interpretation of track.interpretations)
                            {
                                let midiObject = interpretation[midiObjectIndex];

                                barline.msPosInPerfPerRegion.push(midiObject.msPosInPerf);
                            }
                            break;
                        }
                    }
                }
            }
            // set each rightmost barline.msPosInPerfPerRegion array to share the
            // .msPosInPerfPerRegion array of the first barline on the following system.
            for(let systemIndex = 1; systemIndex < systems.length; systemIndex++)
            {
                let upperSystemBarlines = systems[systemIndex - 1].barlines,
                    upperSystemRightMostBarline = upperSystemBarlines[upperSystemBarlines.length - 1],
                    lowerSystemBarlines = systems[systemIndex].barlines,
                    lowerSystemLeftMostBarline = lowerSystemBarlines[0];

                    upperSystemRightMostBarline.msPosInPerfPerRegion = lowerSystemLeftMostBarline.msPosInPerfPerRegion;
            }
        }

        setTrackRuntimeInterpretations(tracks, trackIsOnArray);

        setBarlineMsPosInPerfPerRegionArrays(systems, tracks);

        let allMoments = getAllMoments(tracks);

        allMoments.sort((x, y) => x.msPosInPerf - y.msPosInPerf);

        let mergedMoments = mergeMoments(allMoments);

        if(regionSequence.hasConsecutiveRegions)
        {
            setRegionIndexAttributes(mergedMoments, regionSequence);
        }

        let lastRegionEndMsPosInPerf = regionSequence[regionSequence.length - 1].endMsPosInPerf;
        // Moments that need to update the cursor in the GUI during performance have a .msPosInScore attribute.
        // Moments that need to update the current region in the GUI during performance have a .regionIndex attribute.
        return linkedMoments(mergedMoments, lastRegionEndMsPosInPerf);
    },

    // Returns a flat, linked list of moments.
    getMoments = function ()
    {
        let linkedMoments = getLinkedMoments(regionSequence, tracks, trackIsOnArray);
        return linkedMoments;
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

        this.getReadOnlyTrackIsOnArray = getReadOnlyTrackIsOnArray;

        // Called when the start button is clicked in the top options panel,
        // and when setOptions button is clicked at the top of the score.
        // If the startMarker is not fully visible in the svgPagesDiv, move
        // it to the top of the div.
        this.moveStartMarkerToTop = moveStartMarkerToTop;

        this.getStartMarker = getStartMarker;
        this.getEndMarker = getEndMarker;

        // Recalculates the timeObject lists for the cursor using trackIsOnArray
        // (tracksControl.trackIsOnArray) to take into account which tracks are actually performing.
        // When the score is first read, all tracks perform by default.
        this.setCursor = setCursor;
        // Advances the cursor to the following timeObject (in any channel)
        // if the msPos argument is >= that object's msPos. Otherwise does nothing.
        this.advanceCursor = advanceCursor;
        this.hideCursor = hideCursor;

        this.resetRegionInfoStrings = resetRegionInfoStrings;
        this.setActiveInfoStringsStyle = setActiveInfoStringsStyle;
        this.leaveRegion = leaveRegion;

        this.init = init;

        this.getNumberOfTracks = getNumberOfTracks;

        this.getRegionSequence = getRegionSequence;

        this.setInterpretation = setInterpretation;

        // The markersLayer is set when a specific score is loaded.
        // It contains the cursor line and the start- and endMarkers for each system in the score.
        // It is also the transparent, clickable surface used when setting the start and end markers.
        this.getMarkersLayer = getMarkersLayer;
        this.getSystems = getSystems;
        this.getCursor = getCursor;

        // The TracksControl controls the display, and should be the only module to call this function.
        this.refreshDisplay = refreshDisplay;

        this.getMoments = getMoments; // called by performer to get the current moments
    }
}

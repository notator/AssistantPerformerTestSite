
import {constants} from "./Constants.js";
import {TracksControl} from "./TracksControl.js";
import {Score} from "./Score.js";
import {TimerConductor, CreepConductor} from "./Conductor.js";
import {Sequence} from "./Sequence.js";
import {SequenceRecording} from "./SequenceRecording.js";
import {sequenceToSMF} from "./StandardMidiFile.js";

const
    // constants for control layer opacity values
    METAL = "1", // control layer is completely opaque
    SMOKE = "0.7", // control layer is smoky (semi-transparent)
    GLASS = "0", // control layer is completely transparent

    PIANOLA_MUSIC_SCORE_INDEX = 1,
    PIANOLA_MUSIC_3STAVES_SCORE_INDEX = 2,
    STUDY1_SCORE_INDEX = 3,
    STUDY2_SCORE_INDEX = 4,
    STUDY2_2STAVES_SCORE_INDEX = 5,
    STUDY3_SKETCH1_SCORE_INDEX = 6,
    STUDY3_SKETCH1_4STAVES_SCORE_INDEX = 7,
    ERRATUM_MUSICAL_I_VIII_SCORE_INDEX = 8,
    THREE_CRASHES_SCORE_INDEX = 9,
    TOMBEAU1_SCORE_INDEX = 10,

    SPEEDCONTROL_MIDDLE = 90, // range is 0..180

    performanceMode = Object.freeze({score: 0, conductingTimer: 1, conductingCreep: 2});

var
    residentSynth,
    player, // player is always a Sequence
    tracksControl = new TracksControl(),

    score,
    conductor,
    svgControlsState = 'stopped', //svgControlsState can be 'disabled', 'stopped', 'paused', 'playing', 'settingStart', 'settingEnd', conducting.
    globalElements = {}, // assistantPerformer.html elements
    conductingLimit = {}, // conducting stops if the cursor reaches these left and right limits
    cl = {}, // control layers

    // options set in the top dialog
    deviceOptions = {},

    // deletes the 'save' button created by createSaveMIDIFileLink() 
    deleteSaveLink = function()
    {
        let
            saveLink = document.getElementById("saveLink"),
            downloadLinkDiv = document.getElementById("downloadLinkDiv"); // the div containing the saveLink

        if(saveLink !== null)
        {
            // Need a small delay for the revokeObjectURL to work properly.
            window.setTimeout(function()
            {
                window.URL.revokeObjectURL(saveLink.href); // window.URL is set in Main.js
                downloadLinkDiv.removeChild(saveLink);
            }, 1500);
        }
    },

    // Returns true if any of the defined trackRecordings contain moments, otherwise false.
    // Used to prevent the creation of a 'save' button when there is nothing to save.
    hasData = function(nOutputVoices, trackRecordings)
    {
        var i, has = false;
        for(i = 0; i < nOutputVoices; ++i)
        {
            if(trackRecordings[i] !== undefined && trackRecordings[i].moments.length > 0)
            {
                has = true;
                break;
            }
        }
        return has;
    },

    // Returns the name of the file to be downloaded
    // The date part of the name is formatted as
    //     year-month-day, with month and day always having two characters
    // so that downloaded files will list in order of creation time.
    getMIDIFileName = function(scoreName)
    {
        var
            d = new Date(),
            dayOfTheMonth = (d.getDate()).toString(),
            month = (d.getMonth() + 1).toString(),
            year = (d.getFullYear()).toString(),
            downloadName;

        if(month.length === 1)
        {
            month = "0".concat(month);
        }

        if(dayOfTheMonth.length === 1)
        {
            dayOfTheMonth = "0".concat(dayOfTheMonth);
        }

        downloadName = scoreName.concat('_', year, '-', month, '-', dayOfTheMonth, '.mid'); // .mid is added in case scoreName contains a '.'.

        return downloadName;
    },

    // Creates a button which, when clicked, downloads a standard MIDI file recording
    // of the sequenceRecording which has just stopped being recorded.
    // The performance may have ended by reaching the stop marker, or by the user clicking
    // the 'stop' button.
    // The 'save' button (and its associated recording) are deleted
    //    either when it is clicked (and the file has been downloaded)
    //    or when a new performance is started
    //    or when the user clicks the 'set options' button
    // Arguments:
    // scoreName is the name of the score (as selected in the main score selector).
    //     The name of the downloaded file is:
    //         scoreName + '_' + the current date (format:year-month-day) + '.mid'.
    //         (e.g. "Study 2c3.1_2013-01-08.mid")
    // sequenceRecording is a SequenceRecording object.
    // sequenceMsDuration is the total duration of the sequenceRecording in milliseconds (an integer).
    //      and determines the timing of the end-of-track events. When this is a recorded sequenceRecording,
    //      this value is simply the duration between the start and end markers.
    createSaveMIDIFileLink = function(scoreName, sequenceRecording, sequenceMsDuration)
    {
        var
            standardMidiFile,
            downloadName,
            downloadLinkDiv, saveLink, a,
            nOutputVoices = sequenceRecording.trackRecordings.length;

        if(hasData(nOutputVoices, sequenceRecording.trackRecordings))
        {
            downloadLinkDiv = document.getElementById("downloadLinkDiv"); // the Element which will contain the link

            if(downloadLinkDiv !== null)
            {
                saveLink = document.getElementById("saveLink");

                if(saveLink === null) // It doesn't exist, so can be created and added to downloadLinkDiv.
                {
                    downloadName = getMIDIFileName(scoreName);

                    standardMidiFile = sequenceToSMF(sequenceRecording, sequenceMsDuration);

                    a = document.createElement('a');
                    a.id = "saveLink";
                    a.download = downloadName;
                    a.href = window.URL.createObjectURL(standardMidiFile); // window.URL is set in Main.js
                    a.innerHTML = '<img id="saveImg" border="0" src="images/saveMouseOut.png" alt="saveMouseOutImage" width="56" height="31">';

                    a.onmouseover = function() // there is an event argument, but it is ignored
                    {
                        var img = document.getElementById("saveImg");
                        img.src = "images/saveMouseOver.png";
                        a.style.cursor = 'default';
                    };

                    a.onmouseout = function() // there is an event argument, but it is ignored
                    {
                        var img = document.getElementById("saveImg");
                        if(img !== null)
                        {
                            img.src = "images/saveMouseOut.png";
                        }
                    };

                    a.onclick = function() // there is an event argument, but it is ignored
                    {
                        // The link's download field has been set, so the file is downloaded here.
                        deleteSaveLink();
                    };

                    downloadLinkDiv.appendChild(a);
                }
            }
        }
    },

    setMainOptionsState = function(mainOptionsState)
    {
        function setResidentSynthFunctions(residentSynth)
        {
            let CONTROL_CHANGE = constants.COMMAND.CONTROL_CHANGE,
                ALL_SOUND_OFF = constants.CONTROL.ALL_SOUND_OFF,
                ALL_CONTROLLERS_OFF = constants.CONTROL.ALL_CONTROLLERS_OFF,
                allSoundOffMessage = new Uint8Array([CONTROL_CHANGE, ALL_SOUND_OFF, 0]),
                allControllersOffMessage = new Uint8Array([CONTROL_CHANGE, ALL_CONTROLLERS_OFF, 0]);

            function setAllChannelSoundOff()
            {
                this.send(allSoundOffMessage, performance.now());
            }

            function setAllChannelControllersOff()
            {
                this.send(allControllersOffMessage, performance.now());
            }

            if(residentSynth)
            {
                residentSynth.setAllChannelSoundOff = setAllChannelSoundOff;
                residentSynth.setAllChannelControllersOff = setAllChannelControllersOff;
            }
        }

        var scoreIndex = globalElements.scoreSelect.selectedIndex;

        switch(mainOptionsState)
        {
            case "toFront": // set main options visible with the appropriate controls enabled/disabled
                globalElements.titleOptionsDiv.style.visibility = "visible";
                globalElements.aboutLinkDiv.style.display = "none";
                globalElements.startRuntimeButton.style.display = "none";
                globalElements.svgRuntimeControls.style.visibility = "hidden";
                globalElements.svgPagesFrame.style.visibility = "hidden";

                if(scoreIndex > 0 && globalElements.waitingForScoreDiv.style.display === "none")
                {
                    globalElements.aboutLinkDiv.style.display = "block";
                    globalElements.startRuntimeButton.style.display = "initial";

                    deviceOptions.outputDevice = residentSynth;
                    setResidentSynthFunctions(residentSynth);

                    // Its important to do the following _after_ user interaction with the GUI.
                    residentSynth.close()
                        .then(() =>
                        {
                            console.log("Closed ResidentSynth");
                            residentSynth.open()
                                .then(() =>
                                {
                                    console.log("Opened ResidentSynth");                                    
                                })
                                .catch(() => {console.error("Error opening ResidentSynth");});
                        })
                        .catch(() => {console.error("Error closing ResidentSynth");});                    
                }
                break;
            case "toBack": // set svg controls and score visible
                globalElements.titleOptionsDiv.style.visibility = "hidden";
                globalElements.svgRuntimeControls.style.visibility = "visible";
                globalElements.svgPagesFrame.style.visibility = "visible";
                break;
            default:
                throw "Unknown program state.";
        }
    },

    setPage2ControlsDisabled = function()
    {
        tracksControl.setDisabled(true);

        globalElements.speedControlInput.disabled = true;
        globalElements.speedControlCheckbox.disabled = true;
        globalElements.speedControlSmokeDiv.style.display = "block";

        // begin performance buttons
        cl.goDisabled.setAttribute("opacity", SMOKE);
        cl.stopControlDisabled.setAttribute("opacity", SMOKE);
        cl.setStartControlDisabled.setAttribute("opacity", SMOKE);
        cl.setEndControlDisabled.setAttribute("opacity", SMOKE);
        cl.sendStartToBeginningControlDisabled.setAttribute("opacity", SMOKE);
        cl.sendStopToEndControlDisabled.setAttribute("opacity", SMOKE);
        cl.setConductTimerControlDisabled.setAttribute("opacity", SMOKE);
        cl.setConductCreepControlDisabled.setAttribute("opacity", SMOKE);
        // end performance buttons

        cl.gotoOptionsDisabled.setAttribute("opacity", SMOKE);
    },

    setConductTimerControlClicked = function()
    {
        if(cl.setConductTimerControlDisabled.getAttribute("opacity") === GLASS)
        {
            // the button is enabled 
            if(svgControlsState === 'stopped')
            {
                setSvgControlsState('conductingTimer');
            }
            else
            {
                setSvgControlsState('stopped');
            }
        }
    },

    setConductCreepControlClicked = function()
    {
        if(cl.setConductCreepControlDisabled.getAttribute("opacity") === GLASS)
        {
            // the button is enabled 
            if(svgControlsState === 'stopped')
            {
                setSvgControlsState('conductingCreep');
            }
            else
            {
                setSvgControlsState('stopped');
            }
        }
    },

    // mousemove handler
    conductTimer = function(e)
    {
        if(e.clientX > conductingLimit.left && e.clientX < conductingLimit.right)
        {
            conductor.conductTimer(e);
        }
    },

    // mousedown handler
    startConductTimer = function(e)
    {
        if(e.button === 0) // main (=left) button
        {
            globalElements.conductingLayer.removeEventListener('mousemove', conductTimer, {passive: true});
            globalElements.conductingLayer.addEventListener('mousemove', conductTimer, {passive: true});
            conductor.initConducting();

            if(e.clientX > conductingLimit.left && e.clientX < conductingLimit.right)
            {
                conductor.conductTimer(e);
            }
        }
    },

    // mouseup handler
    stopConductTimer = function(e)
    {
        if(e.button === 0) // main (=left) button
        {
            globalElements.conductingLayer.removeEventListener('mousemove', conductTimer, {passive: true});
        }
    },

    // mousemove handler
    conductCreep = function(e)
    {
        if(e.clientX > conductingLimit.left && e.clientX < conductingLimit.right)
        {
            conductor.conductCreep(e);
        }
    },

    // mousedown handler
    startConductCreep = function(e)
    {
        if(e.button === 0) // main (=left) button
        {
            globalElements.conductingLayer.removeEventListener('mousemove', conductCreep, {passive: true});
            globalElements.conductingLayer.addEventListener('mousemove', conductCreep, {passive: true});
            conductor.initConducting();
        }
    },

    // mouseup handler
    stopConductCreep = function(e)
    {
        if(e.button === 0) // main (=left) button
        {
            globalElements.conductingLayer.removeEventListener('mousemove', conductCreep, {passive: true});
        }
    },

    setEventListenersAndMouseCursors = function(svgControlsState)
    {
        let s = score,
            markersLayer = s.getMarkersLayer(),
            conductingLayer = globalElements.conductingLayer;

        if(markersLayer !== undefined)
        {
            switch(svgControlsState)
            {
                case 'settingStart':
                    markersLayer.addEventListener('click', s.setStartMarkerClick, false);
                    markersLayer.style.cursor = "url('https://james-ingram-act-two.de/open-source/assistantPerformer/cursors/setStartCursor.cur'), crosshair";
                    break;
                case 'settingEnd':
                    markersLayer.addEventListener('click', s.setEndMarkerClick, false);
                    markersLayer.style.cursor = "url('https://james-ingram-act-two.de/open-source/assistantPerformer/cursors/setEndCursor.cur'), pointer";
                    break;
                case 'conductingTimer':
                    conductingLayer.style.visibility = "visible";
                    conductingLayer.style.cursor = "url('https://james-ingram-act-two.de/open-source/assistantPerformer/cursors/conductor.cur'), move";
                    conductingLayer.removeEventListener('mousedown', startConductTimer, {passive: true});
                    conductingLayer.removeEventListener('mouseup', stopConductTimer, {passive: true});
                    conductingLayer.addEventListener('mousedown', startConductTimer, {passive: true});
                    conductingLayer.addEventListener('mouseup', stopConductTimer, {passive: true});
                    break;
                case 'conductingCreep':
                    conductingLayer.style.visibility = "visible";
                    conductingLayer.style.cursor = "url('https://james-ingram-act-two.de/open-source/assistantPerformer/cursors/conductor.cur'), move";
                    conductingLayer.removeEventListener('mousedown', startConductCreep, {passive: true});
                    conductingLayer.removeEventListener('mouseup', stopConductCreep, {passive: true});
                    conductingLayer.addEventListener('mousedown', startConductCreep, {passive: true});
                    conductingLayer.addEventListener('mouseup', stopConductCreep, {passive: true});
                    break;
                case 'stopped':
                    // According to
                    // https://developer.mozilla.org/en-US/docs/DOM/element.removeEventListener#Notes
                    // "Calling removeEventListener() with arguments which do not identify any currently 
                    //  registered EventListener on the EventTarget has no effect."
                    markersLayer.removeEventListener('click', s.setStartMarkerClick, false);
                    markersLayer.removeEventListener('click', s.setEndMarkerClick, false);
                    markersLayer.style.cursor = 'auto';
                    conductingLayer.style.visibility = "hidden";
                    conductingLayer.removeEventListener('mousedown', startConductTimer, {passive: true});
                    conductingLayer.removeEventListener('mousedown', startConductCreep, {passive: true});
                    conductingLayer.removeEventListener('mouseup', stopConductTimer, {passive: true});
                    conductingLayer.removeEventListener('mouseup', stopConductCreep, {passive: true});
                    conductingLayer.removeEventListener('mousemove', conductTimer, {passive: true});
                    conductingLayer.removeEventListener('mousemove', conductCreep, {passive: true});
                    conductingLayer.style.cursor = 'auto';
                    break;
                default:
                    throw "Unknown state!";
            }
        }
    },

    startPlaying = function()
    {
        let startRegionIndex, startMarkerMsPosition, endRegionIndex, endMarkerMsPosition, baseSpeed,
            sequenceRecording, trackIsOnArray = [];

        deleteSaveLink();

        score.deleteTickOverloadMarkers();

        setPage2ControlsDisabled();

        switch(deviceOptions.performanceMode)
        {
            case performanceMode.score:
                cl.goDisabled.setAttribute("opacity", GLASS);
                cl.pauseUnselected.setAttribute("opacity", METAL);
                cl.pauseSelected.setAttribute("opacity", GLASS);
                cl.stopControlSelected.setAttribute("opacity", GLASS);
                cl.stopControlDisabled.setAttribute("opacity", GLASS);
                break;
            case performanceMode.conductingTimer:
                cl.conductTimerSelected.setAttribute("opacity", METAL);
                cl.setConductTimerControlDisabled.setAttribute("opacity", GLASS);
                break;
            case performanceMode.conductingCreep:
                cl.conductCreepSelected.setAttribute("opacity", METAL);
                cl.setConductCreepControlDisabled.setAttribute("opacity", GLASS);
                break;
        }

        if(deviceOptions.performanceMode === performanceMode.score && player.isPaused())
        {
            player.resume();
        }
        else if(player.isStopped())
        {
            sequenceRecording = new SequenceRecording(player.getOutputTracks());

            if(deviceOptions.performanceMode === performanceMode.score)
            {
                score.setCursor();
            }

            score.moveStartMarkerToTop(globalElements.svgPagesFrame);
            score.getReadOnlyTrackIsOnArray(trackIsOnArray);

            startRegionIndex = score.getStartRegionIndex();
            score.setActiveInfoStringsStyle(startRegionIndex);
            startMarkerMsPosition = score.getStartMarkerMsPositionInScore();
            endRegionIndex = score.getEndRegionIndex();
            endMarkerMsPosition = score.getEndMarkerMsPositionInScore();

            if(deviceOptions.performanceMode === performanceMode.conductingTimer || deviceOptions.performanceMode === performanceMode.conductingCreep)
            {
                baseSpeed = 1;
                player.setTimerAndOutputDevice(conductor, conductor);  // Sequence can use conductor or performance timer
            }
            else // options.performanceMode === score)
            {
                baseSpeed = speedSliderValue(globalElements.speedControlInput.value);
                player.setTimerAndOutputDevice(performance, deviceOptions.outputDevice); // Sequence can use conductor or performance timer
            }

            deviceOptions.outputDevice.setAllChannelControllersOff(trackIsOnArray);

            player.play(trackIsOnArray, startRegionIndex, startMarkerMsPosition, endRegionIndex, endMarkerMsPosition, baseSpeed, sequenceRecording);
        }
    },

    // Called when a start conducting button is clicked on.
    setConducting = function(speed)
    {
        score.setCursor();

        if(speed > 0)
        {
            score.deleteTickOverloadMarkers();
            score.getMarkersLayer().appendChild(conductor.timeMarkerElement());
            player.setTimerAndOutputDevice(conductor, conductor);
        }
        else
        {
            throw "illegal speed! (call setStopped() when a button is clicked off)";
        }
    },

    setStopped = function()
    {
        player.stop();

        if(conductor !== undefined)
        {
            score.getMarkersLayer().removeChild(conductor.timeMarkerElement());
            conductor.stopConducting();
            conductor = undefined;
        }

        deviceOptions.performanceMode = performanceMode.score;        

        score.hideCursor();
        score.resetRegionInfoStrings();

        setMainOptionsState("toBack");

        setEventListenersAndMouseCursors('stopped');

        svgControlsState = 'stopped';

        cl.gotoOptionsDisabled.setAttribute("opacity", GLASS);

        /********* begin performance buttons *******************/
        cl.performanceButtonsDisabled.setAttribute("opacity", GLASS);

        // cl.goUnselected.setAttribute("opacity", METAL); -- never changes
        cl.pauseUnselected.setAttribute("opacity", GLASS);
        cl.pauseSelected.setAttribute("opacity", GLASS);
        cl.goDisabled.setAttribute("opacity", GLASS);

        cl.stopControlDisabled.setAttribute("opacity", SMOKE);

        //cl.setStartControlUnselected("opacity", METAL); -- never changes
        cl.setStartControlSelected.setAttribute("opacity", GLASS);
        cl.setStartControlDisabled.setAttribute("opacity", GLASS);

        //cl.setEndControlUnselected("opacity", METAL); -- never changes
        cl.setEndControlSelected.setAttribute("opacity", GLASS);
        cl.setEndControlDisabled.setAttribute("opacity", GLASS);

        // cl.sendStartToBeginningControlUnselected.setAttribute("opacity", METAL); -- never changes
        cl.sendStartToBeginningControlSelected.setAttribute("opacity", GLASS);
        cl.sendStartToBeginningControlDisabled.setAttribute("opacity", GLASS);

        // cl.sendStopToEndControlUnselected.setAttribute("opacity", METAL); -- never changes
        cl.sendStopToEndControlSelected.setAttribute("opacity", GLASS);
        cl.sendStopToEndControlDisabled.setAttribute("opacity", GLASS);

        cl.conductTimerSelected.setAttribute("opacity", GLASS);
        cl.setConductTimerControlDisabled.setAttribute("opacity", GLASS);

        cl.conductCreepSelected.setAttribute("opacity", GLASS);
        cl.setConductCreepControlDisabled.setAttribute("opacity", GLASS);

        /********* end performance buttons *******************/

        tracksControl.setDisabled(false);

        globalElements.speedControlInput.disabled = false;
        globalElements.speedControlSmokeDiv.style.display = "none";
    },

    reportEndOfRegion = function(regionIndex)
    {
        score.leaveRegion(regionIndex);
    },

    // Callback called when a performing sequenceRecording is stopped or has played its last message,
    // or when the player is stopped or has played its last subsequence.
    reportEndOfPerformance = function(sequenceRecording, performanceMsDuration)
    {
        var
            scoreName = globalElements.scoreSelect.options[globalElements.scoreSelect.selectedIndex].text;

        // Moment timestamps in the recording are shifted so as to be relative to the beginning of the
        // recording. Returns false if the if the sequenceRecording is undefined, null or has no moments.
        function setTimestampsRelativeToSequenceRecording(sequenceRecording)
        {
            var i, nOutputVoices = sequenceRecording.trackRecordings.length, trackRecording,
                j, nMoments, moment,
                offset, success = true;

            // Returns the earliest moment.timestamp in the sequenceRecording.
            // Returns Number.MAX_VALUE if sequenceRecording is undefined, null or has no moments.
            function findOffset(sequenceRecording)
            {
                var
                    k, nTrks, trackRec,
                    timestamp,
                    rOffset = Number.MAX_VALUE;

                if(sequenceRecording !== undefined && sequenceRecording !== null)
                {
                    nTrks = sequenceRecording.trackRecordings.length;
                    for(k = 0; k < nTrks; ++k)
                    {
                        trackRec = sequenceRecording.trackRecordings[k];
                        // trackRec can be undefined, e.g. if a single track has channel > 0.
                        if(trackRec !== undefined && trackRec.moments.length > 0)
                        {
                            timestamp = trackRec.moments[0].timestamp;
                            rOffset = (rOffset < timestamp) ? rOffset : timestamp;
                        }
                    }
                }

                return rOffset;
            }

            offset = findOffset(sequenceRecording);

            if(offset === Number.MAX_VALUE)
            {
                success = false;
            }
            else
            {
                for(i = 0; i < nOutputVoices; ++i)
                {
                    trackRecording = sequenceRecording.trackRecordings[i];
                    // trackRecording can be undefined, e.g. if a single track has channel > 0.
                    if(trackRecording !== undefined)
                    {
                        nMoments = trackRecording.moments.length;
                        for(j = 0; j < nMoments; ++j)
                        {
                            moment = trackRecording.moments[j];
                            moment.timestamp -= offset;
                        }
                    }
                }
            }
            return success;
        }

        if(setTimestampsRelativeToSequenceRecording(sequenceRecording))
        {
            createSaveMIDIFileLink(scoreName, sequenceRecording, performanceMsDuration);
        }

        // The moment.timestamps do not need to be restored to their original values here
        // because they will be re-assigned next time sequenceRecording.nextMoment() is called.

        deviceOptions.outputDevice.setAllChannelSoundOff();

        setStopped();
        // the following line is important, because the stop button is also the pause button.
        svgControlsState = "stopped";
    },

    // Callback called by a performing sequence. Reports the msPositionInScore of the
    // Moment curently being sent. When all the events in the span have been played,
    // reportEndOfPerformance() is called (see above).
    reportMsPos = function(msPositionInScore)
    {
        //console.log("Controls: calling score.advanceRunningMarker(msPosition), msPositionInScore=" + msPositionInScore);
        // If there is a graphic object in the score having msPositionInScore,
        // the running cursor is aligned to that object.
        score.advanceCursor(msPositionInScore);
    },

    // see: http://stackoverflow.com/questions/846221/logarithmic-slider
    // Returns the speed from the (logarithmic) speed slider control.
    speedSliderValue = function(position)
    {
        var
            // the slider has min="0" max="180" (default value=SPEEDCONTROL_MIDDLE (=90))
            minp = 0, maxp = 180, // The slider has width 180px
            // The result will be between 1/10 and 9.99, the middle value is 1.
            minv = Math.log(0.1), maxv = Math.log(9.99),
            // the adjustment factor
            scale = (maxv - minv) / (maxp - minp);

        return Math.exp(minv + scale * (position - minp));
    },

    //svgControlsState can be 'disabled', 'stopped', 'paused', 'playing', 'settingStart', 'settingEnd'.
    setSvgControlsState = function(svgCtlsState)
    {

        function setPage1Controls()
        {
            setMainOptionsState("toFront");

            setEventListenersAndMouseCursors('stopped');
        }

        // setStopped and setPage2ControlsDisabled are outer functions

        function setPaused()
        {
            if(deviceOptions.performanceMode !== performanceMode.score)
            {
                throw "Error: Assisted performances are never paused.";
            }

            if(player.isRunning())
            {
                player.pause();
            }

            deviceOptions.outputDevice.setAllChannelSoundOff();

            setPage2ControlsDisabled();

            cl.pauseSelected.setAttribute("opacity", METAL);
            cl.goDisabled.setAttribute("opacity", GLASS);

            cl.stopControlSelected.setAttribute("opacity", GLASS);
            cl.stopControlDisabled.setAttribute("opacity", GLASS);
        }

        function setSettingStart()
        {
            setPage2ControlsDisabled();

            cl.setStartControlSelected.setAttribute("opacity", METAL);
            cl.setStartControlDisabled.setAttribute("opacity", GLASS);

            setEventListenersAndMouseCursors('settingStart');
        }

        function setSettingEnd()
        {
            setPage2ControlsDisabled();

            cl.setEndControlSelected.setAttribute("opacity", METAL);
            cl.setEndControlDisabled.setAttribute("opacity", GLASS);

            setEventListenersAndMouseCursors('settingEnd');
        }

        function setConductingTimer()
        {
            deviceOptions.performanceMode = performanceMode.conductingTimer;

            setPage2ControlsDisabled();

            cl.conductTimerSelected.setAttribute("opacity", METAL);
            cl.setConductTimerControlDisabled.setAttribute("opacity", GLASS);

            setEventListenersAndMouseCursors('conductingTimer');

            let speed = speedSliderValue(globalElements.speedControlInput.value);

            if(conductor === undefined)
            {
                conductor = new TimerConductor(score, startPlaying, deviceOptions.outputDevice, speed);
            }

            setConducting(speed);

            score.moveStartMarkerToTop(globalElements.svgPagesFrame);
        }

        function setConductingCreep()
        {
            deviceOptions.performanceMode = performanceMode.conductingCreep;

            setPage2ControlsDisabled();

            cl.conductCreepSelected.setAttribute("opacity", METAL);
            cl.setConductCreepControlDisabled.setAttribute("opacity", GLASS);

            setEventListenersAndMouseCursors('conductingCreep');

            let speed = speedSliderValue(globalElements.speedControlInput.value);

            if(conductor === undefined)
            {
                conductor = new CreepConductor(score, startPlaying, deviceOptions.outputDevice, speed);
            }

            setConducting(speed);

            score.moveStartMarkerToTop(globalElements.svgPagesFrame);
        }

        svgControlsState = svgCtlsState;

        switch(svgControlsState)
        {
            case 'disabled':
                setPage1Controls(); // enables the main options panel
                break;
            case 'stopped':
                setStopped();
                break;
            case 'paused':
                if(deviceOptions.performanceMode === performanceMode.score) // conducted performances cannot be paused
                {
                    setPaused();
                }
                break;
            case 'playing':
                startPlaying();
                break;
            case 'settingStart':
                setSettingStart();
                break;
            case 'settingEnd':
                setSettingEnd();
                break;
            case 'conductingTimer':
                setConductingTimer();
                break;
            case 'conductingCreep':
                setConductingCreep();
                break;
        }
    },

    // The Go control can be clicked directly.
    // Also, it is called automatically when assisted performances start.
    goControlClicked = function()
    {
        if(svgControlsState === 'stopped' || svgControlsState === 'paused')
        {
            setSvgControlsState('playing');
        }
        else if(svgControlsState === 'playing')
        {
            setSvgControlsState('paused');
        }
    },

    resetSpeed = function()
    {
        if(player.setSpeed !== undefined)
        {
            player.setSpeed(1);
        }
        globalElements.speedControlInput.value = SPEEDCONTROL_MIDDLE;
        globalElements.speedControlCheckbox.checked = false;
        globalElements.speedControlCheckbox.disabled = true;
        globalElements.speedControlLabel2.innerHTML = "100%";
    };

export class Controls
{
    constructor()
    { }

    // Sets up the pop-up menu for scores.
    init()
    {
        function getGlobalElements()
        {
            globalElements.titleOptionsDiv = document.getElementById("titleOptionsDiv");
            globalElements.scoreSelect = document.getElementById("scoreSelect");
            globalElements.waitingForScoreDiv = document.getElementById("waitingForScoreDiv");
            globalElements.aboutLinkDiv = document.getElementById("aboutLinkDiv");
            globalElements.startRuntimeButton = document.getElementById("startRuntimeButton");

            globalElements.svgRuntimeControls = document.getElementById("svgRuntimeControls");
            globalElements.speedControlInput = document.getElementById("speedControlInput");
            globalElements.speedControlCheckbox = document.getElementById("speedControlCheckbox");
            globalElements.speedControlLabel2 = document.getElementById("speedControlLabel2");
            globalElements.speedControlSmokeDiv = document.getElementById("speedControlSmokeDiv");

            globalElements.conductingLayer = document.getElementById("conductingLayer");
            globalElements.svgPagesFrame = document.getElementById("svgPagesFrame");
        }

        // resets the score selector in case the browser has cached the last value
        function initScoreSelector(systemChanged)
        {
            globalElements.scoreSelect.selectedIndex = 0;
            score = new Score(systemChanged); // an empty score, with callback function            
        }

        function getControlLayers(document)
        {
            cl.gotoOptionsDisabled = document.getElementById("gotoOptionsDisabled");

            cl.performanceButtonsDisabled = document.getElementById("performanceButtonsDisabled");

            cl.pauseUnselected = document.getElementById("pauseUnselected");
            cl.pauseSelected = document.getElementById("pauseSelected");
            cl.goDisabled = document.getElementById("goDisabled");

            cl.stopControlSelected = document.getElementById("stopControlSelected");
            cl.stopControlDisabled = document.getElementById("stopControlDisabled");

            cl.setStartControlSelected = document.getElementById("setStartControlSelected");
            cl.setStartControlDisabled = document.getElementById("setStartControlDisabled");

            cl.setEndControlSelected = document.getElementById("setEndControlSelected");
            cl.setEndControlDisabled = document.getElementById("setEndControlDisabled");

            cl.sendStartToBeginningControlSelected = document.getElementById("sendStartToBeginningControlSelected");
            cl.sendStartToBeginningControlDisabled = document.getElementById("sendStartToBeginningControlDisabled");

            cl.sendStopToEndControlSelected = document.getElementById("sendStopToEndControlSelected");
            cl.sendStopToEndControlDisabled = document.getElementById("sendStopToEndControlDisabled");

            cl.conductTimerSelected = document.getElementById("conductTimerSelected");
            cl.setConductTimerControlDisabled = document.getElementById("setConductTimerControlDisabled");

            cl.conductCreepSelected = document.getElementById("conductCreepSelected");
            cl.setConductCreepControlDisabled = document.getElementById("setConductCreepControlDisabled");

        }

        // callback passed to score, which passes it to cursor. Called when the running cursor moves to a new system.
        function systemChanged(runningMarkerYCoordinates)
        {
            var div = globalElements.svgPagesFrame,
                height = Math.round(parseFloat(div.style.height));

            if(((runningMarkerYCoordinates.bottom) > (height + div.scrollTop))
                || ((runningMarkerYCoordinates.top) < (div.scrollTop)))
            {
                div.scrollTop = runningMarkerYCoordinates.top - 10;
            }
        }

        // eslint-disable-next-line no-undef
        residentSynth = new ResSynth.residentSynth.ResidentSynth();

        getGlobalElements();

        initScoreSelector(systemChanged);

        getControlLayers(document);

        setSvgControlsState('disabled');
    }

    // called when the user clicks a control in the GUI
    doControl(controlID)
    {
        let scoreSelect = globalElements.scoreSelect;

        // This function analyses the score's id string in the scoreSelector in assistantPerformer.html,
        // and uses the information to load the score's svg files into the "svgPagesFrame" div,
        // The score is actually analyzed when the Start button is clicked.
        function setScore(scoreIndex)
        {
            var scoreInfo, nPagesLoading;

            // The scoreSelectIndex argument is the index of the score in the score selector
            // Returns a scoreInfo object having the following fields:
            //    scoreInfo.path -- the path to the score's file
            //    scoreInfo.aboutText
            //    scoreInfo.aboutURL
            // The path setting includes the complete path from the Assistant Performer's "scores" folder
            // to the page(s) to be used, and ends with either "(scroll)" or "(<nPages> pages)" -- e.g. "(14 pages)".
            // "Song Six/Song Six (scroll).svg" is a file. If separate pages are to be used, their paths will be:
            // "Song Six/Song Six page 1.svg", "Song Six/Song Six page 2.svg", "Song Six/Song Six page 3.svg" etc.
            // Note that if annotated page(s) are to be used, their path value will include the name of their
            // folder (e.g. "Song Six/annotated/Song Six (14 pages)").
            function getScoreInfo(scoreSelectIndex)
            {
                var scoreInfo = {path: "", aboutText: "", aboutURL: ""};

                switch(scoreSelectIndex)
                {
                    case PIANOLA_MUSIC_SCORE_INDEX:
                        scoreInfo.path = "Pianola Music/Pianola Music (scroll)";
                        scoreInfo.aboutText = "about Pianola Music";
                        scoreInfo.aboutURL = "https://james-ingram-act-two.de/compositions/pianolaMusic/aboutPianolaMusic.html";
                        break;
                    case PIANOLA_MUSIC_3STAVES_SCORE_INDEX:
                        scoreInfo.path = "Pianola Music - 3 staves/Pianola Music (scroll)";
                        scoreInfo.aboutText = "about Pianola Music";
                        scoreInfo.aboutURL = "https://james-ingram-act-two.de/compositions/pianolaMusic/aboutPianolaMusic.html";
                        break;
                    case STUDY1_SCORE_INDEX:
                        scoreInfo.path = "Study 1/Study 1 (scroll)";
                        scoreInfo.aboutText = "about Study 1";
                        scoreInfo.aboutURL = "https://james-ingram-act-two.de/compositions/study1/aboutStudy1.html";
                        break;
                    case STUDY2_SCORE_INDEX:
                        scoreInfo.path = "Study 2/Study 2 (scroll)";
                        scoreInfo.aboutText = "about Study 2";
                        scoreInfo.aboutURL = "https://james-ingram-act-two.de/compositions/study2/aboutStudy2.html";
                        break;
                    case STUDY2_2STAVES_SCORE_INDEX:
                        scoreInfo.path = "Study 2 - 2 staves/Study 2 (scroll)";
                        scoreInfo.aboutText = "about Study 2";
                        scoreInfo.aboutURL = "https://james-ingram-act-two.de/compositions/study2/aboutStudy2.html";
                        break;
                    case STUDY3_SKETCH1_SCORE_INDEX:
                        scoreInfo.path = "Study 3 sketch 1/Study 3 sketch 1 (scroll)";
                        scoreInfo.aboutText = "about Study 3 Sketch";
                        scoreInfo.aboutURL = "https://james-ingram-act-two.de/compositions/sketches/study3Sketch/aboutStudy3Sketch.html";
                        break;
                    case STUDY3_SKETCH1_4STAVES_SCORE_INDEX:
                        scoreInfo.path = "Study 3 sketch 1 - 4 staves/Study 3 sketch 1 (scroll)";
                        scoreInfo.aboutText = "about Study 3 Sketch";
                        scoreInfo.aboutURL = "https://james-ingram-act-two.de/compositions/sketches/study3Sketch/aboutStudy3Sketch.html";
                        break;
                    case TOMBEAU1_SCORE_INDEX:
                        scoreInfo.path = "Tombeau 1/Tombeau 1 (scroll)";
                        scoreInfo.aboutText = "about Tombeau 1";
                        scoreInfo.aboutURL = "https://james-ingram-act-two.de/compositions/tombeau1/aboutTombeau1.html";
                        break;
                    case ERRATUM_MUSICAL_I_VIII_SCORE_INDEX:
                        scoreInfo.path = "Erratum Musical/Erratum Musical (scroll)";
                        scoreInfo.aboutText = "about Erratum Musical I-VIII";
                        scoreInfo.aboutURL = "https://james-ingram-act-two.de/writings/ErratumMusical/erratumMusical.selectionsI-VIII.html";
                        break;
                    case THREE_CRASHES_SCORE_INDEX:
                        scoreInfo.path = "Three Crashes/Three Crashes (scroll)";
                        scoreInfo.aboutText = "about Three Crashes";
                        scoreInfo.aboutURL = "https://james-ingram-act-two.de/writings/ErratumMusical/erratumMusical.threeCrashes.html";
                        break;
                    default:
                        break;
                }

                return scoreInfo;
            }

            function getPathData(path)
            {
                var pathData = {}, components;

                components = path.split("(");
                if(components[0][components[0].length - 1] !== ' ')
                {
                    alert("Error in pages path string:\nThere must be a space character before the '('");
                }
                pathData.basePath = components[0] + "page ";

                // the second search argument is a regular expression for a single ')' character.
                if(components[1].search("page") < 0 || components[1].search(/\)/i) < 0)
                {
                    alert("Error in pages path string:\nThe number of pages is not correctly defined in the final bracket.");
                }

                pathData.nPages = parseInt(components[1], 10);
                if(pathData.nPages === null || pathData.nPages === undefined || pathData.nPages < 1)
                {
                    alert("Error in pages path string:\nIllegal number of pages.");
                }

                return pathData;
            }

            function setAboutLink(scoreInfo)
            {
                globalElements.aboutLinkDiv.style.display = "none";
                globalElements.startRuntimeButton.style.display = "none";

                if(scoreInfo.aboutURL !== undefined)
                {
                    globalElements.aboutLinkDiv.innerHTML = '<a href=\"' + scoreInfo.aboutURL + '\" target="_blank">' + scoreInfo.aboutText + '</a>';
                }
            }

            function setScoreLoadedState()
            {
                nPagesLoading--;
                if(nPagesLoading === 0)
                {
                    globalElements.waitingForScoreDiv.style.display = "none";
                    setMainOptionsState("toFront");
                }
            }

            function setLoadingScoreState()
            {
                if(nPagesLoading === 0)
                {
                    globalElements.waitingForScoreDiv.style.display = "block";
                }
                nPagesLoading++;
            }

            function getNewSvgPageElem(pageURL)
            {
                var newNode;

                newNode = document.createElement("object");

                newNode.setAttribute("data", pageURL);
                newNode.setAttribute("type", "image/svg+xml");
                newNode.setAttribute("class", "svgPage");
                newNode.addEventListener('load', function() {setScoreLoadedState();});

                return newNode;
            }

            // Returns the URL of the scores directory. This can either be a file:
            // e.g. "file:///D:/Visual Studio/Projects/MyWebsite/james-ingram-act-two/open-source/assistantPerformer/scores/"
            // served from IIS:
            // e.g. "http://localhost:49560/james-ingram-act-two.de/open-source/assistantPerformer/scores/"
            // or on the web:
            // e.g. "https://james-ingram-act-two.de/open-source/assistantPerformer/scores/"
            // Note that Chrome needs to be started with its --allow-file-access-from-files flag to use the first of these.
            function getScoresURL()
            {
                var documentURL = document.URL,
                    apIndex = documentURL.search("assistantPerformer.html"),
                    url = documentURL.slice(0, apIndex) + "scores/";

                return url;
            }

            function setPages(scoreInfo)
            {
                var i, scoresURL, newNode,
                    svgPagesFrame,
                    pathData,
                    pageURL;

                scoresURL = getScoresURL();
                svgPagesFrame = document.getElementById('svgPagesFrame');
                svgPagesFrame.innerHTML = "";
                nPagesLoading = 0;

                if(scoreInfo.path.search("(scroll)") >= 0)
                {
                    setLoadingScoreState();
                    pageURL = scoresURL + scoreInfo.path + ".svg";
                    newNode = getNewSvgPageElem(pageURL);
                    svgPagesFrame.appendChild(newNode);
                }
                else
                {
                    pathData = getPathData(scoreInfo.path);
                    for(i = 0; i < pathData.nPages; ++i)
                    {
                        setLoadingScoreState();
                        pageURL = scoresURL + pathData.basePath + (i + 1).toString(10) + ".svg";
                        newNode = getNewSvgPageElem(pageURL);
                        svgPagesFrame.appendChild(newNode);
                    }
                }
            }

            scoreInfo = getScoreInfo(scoreIndex);

            setAboutLink(scoreInfo);

            setPages(scoreInfo);

            globalElements.svgPagesFrame.scrollTop = 0;
        }

        // used when the control automatically toggles back
        // toggleBack('setStartControlSelected')
        function toggleBack(selected)
        {
            selected.setAttribute("opacity", "1");
            window.setTimeout(function()
            {
                selected.setAttribute("opacity", "0");
            }, 200);
        }

        // goControlClicked is an outer function

        function stopControlClicked()
        {
            if(svgControlsState === 'paused')
            {
                toggleBack(cl.stopControlSelected);
                setSvgControlsState('stopped');
            }

            if(svgControlsState === 'playing')
            {
                toggleBack(cl.stopControlSelected);
                setSvgControlsState('stopped');
            }
        }

        function setStartControlClicked()
        {
            if(svgControlsState === 'stopped')
            {
                setSvgControlsState('settingStart');
            }
            else if(svgControlsState === 'settingStart')
            {
                setSvgControlsState('stopped');
                player.initTracks();
            }
        }

        function setEndControlClicked()
        {
            if(svgControlsState === 'stopped')
            {
                setSvgControlsState('settingEnd');
            }
            else if(svgControlsState === 'settingEnd')
            {
                setSvgControlsState('stopped');
                player.initTracks();
            }
        }

        function sendStartToBeginningControlClicked()
        {
            if(svgControlsState === 'stopped')
            {
                toggleBack(cl.sendStartToBeginningControlSelected);
                score.sendStartMarkerToStart();
                score.hideCursor();
                player.initTracks();
            }
        }

        function sendStopToEndControlClicked()
        {
            if(svgControlsState === 'stopped')
            {
                toggleBack(cl.sendStopToEndControlSelected);
                score.sendEndMarkerToEnd();
                player.initTracks();
            }
        }

        if(controlID === "scoreSelect")
        {
            if(scoreSelect.selectedIndex > 0)
            {
                setScore(scoreSelect.selectedIndex);
            }
            else
            {
                setMainOptionsState("toFront"); // hides startRuntimeButton and "about" text
            }
        }

        /**** controls in options panel ***/
        if(controlID === "scoreSelect")
        {
            setMainOptionsState("toFront"); // enables only the appropriate controls
        }

        /*** SVG controls ***/
        if(cl.performanceButtonsDisabled.getAttribute("opacity") !== SMOKE)
        {
            switch(controlID)
            {
                case "goControl":
                    goControlClicked();
                    break;
                case "stopControl":
                    stopControlClicked();
                    break;
                case "setStartControl":
                    setStartControlClicked();
                    break;
                case "setEndControl":
                    setEndControlClicked();
                    break;
                case "sendStartToBeginningControl":
                    sendStartToBeginningControlClicked();
                    break;
                case "sendStopToEndControl":
                    sendStopToEndControlClicked();
                    break;
                case "setConductTimerControl":
                    setConductTimerControlClicked();
                    break;
                case "setConductCreepControl":
                    setConductCreepControlClicked();
                    break;
                default:
                    break;
            }
        }

        if(controlID === "gotoOptions")
        {
            deleteSaveLink();

            if(cl.gotoOptionsDisabled.getAttribute("opacity") !== SMOKE)
            {
                setSvgControlsState('disabled');
                score.moveStartMarkerToTop(globalElements.svgPagesFrame);
            }
        }

        if(controlID === "speedControlMousemove")
        {
            var speed = speedSliderValue(globalElements.speedControlInput.value);
            if(player.setSpeed !== undefined)
            {
                player.setSpeed(speed);
            }

            if(globalElements.speedControlInput.value === SPEEDCONTROL_MIDDLE)
            {
                globalElements.speedControlCheckbox.checked = true;
                globalElements.speedControlCheckbox.disabled = true;
            }
            else
            {
                globalElements.speedControlCheckbox.checked = false;
                globalElements.speedControlCheckbox.disabled = false;
            }
            globalElements.speedControlLabel2.innerHTML = Math.round(speed * 100) + "%";
        }

        if(controlID === "speedControlCheckboxClick")
        {
            resetSpeed();
        }
    }

    // functions for adjusting the appearance of the score options
    showOverRect(overRectID, disabledID)
    {
        var overRectElem = document.getElementById(overRectID),
            disabledElem = document.getElementById(disabledID),
            disabledOpacity = disabledElem.getAttribute("opacity");

        if(disabledOpacity !== SMOKE)
        {
            overRectElem.setAttribute("opacity", METAL);
        }
    }
    hideOverRect(overRectID)
    {
        var overRect = document.getElementById(overRectID);

        overRect.setAttribute("opacity", GLASS);
    }

    // Called when the Start button is clicked.
    // The score selector sets the array of svgScorePage urls.
    // The Start button is enabled when a score and MIDI output have been selected.
    beginRuntime()
    {
        // tracksData is set up inside score (where it can be retrieved again later), and the tracksControl is initialized.
        function getTracksData(score)
        {
            let tracksData;

            // Get everything except the timeObjects (which have to take account of speed)
            score.getEmptySystems();

            score.setTracksData();

            // tracksData has a single outputTracks[] attribute containing tracks containing midiChords and midRests
            tracksData = score.getTracksData();

            // The tracksControl is in charge of refreshing the entire display, including both itself and the score.
            // It calls score.refreshDisplay(undefined, trackIsOnArray) function as a callback when one
            // of its track controls is turned on or off.
            // score.refreshDisplay(trackIsOnArray) simply tells the score to repaint itself using trackIsOnArray.
            // Repainting includes using the correct staff colours, but the score may also update the position of
            // its start marker (which always starts on a chord) if a track is turned off.
            tracksControl.init(tracksData.outputTracks);
        }

        function setSpeedControl(tracksControlWidth)
        {
            var
                speedControlDiv = document.getElementById("speedControlDiv"),
                performanceButtonsSVG = document.getElementById("performanceButtonsSVG"),
                speedControlSmokeDivWidth = parseInt(globalElements.speedControlSmokeDiv.style.width, 10),
                performanceButtonsSVGLeft = parseInt(performanceButtonsSVG.style.left, 10),
                margin = Math.round((performanceButtonsSVGLeft - tracksControlWidth - speedControlSmokeDivWidth) / 2),
                speedControlDivLeft;

            margin = (margin < 4) ? 4 : margin;

            speedControlDivLeft = tracksControlWidth + margin - 1;
            performanceButtonsSVGLeft = speedControlDivLeft + speedControlSmokeDivWidth + margin;
            speedControlDiv.style.left = speedControlDivLeft.toString(10) + "px";
            performanceButtonsSVG.style.left = performanceButtonsSVGLeft.toString(10) + "px";

            globalElements.speedControlSmokeDiv.style.display = "none";
        }

        function setConductingLayer()
        {
            var
                svgPagesFrame = document.getElementById("svgPagesFrame"),
                conductingLayer = document.getElementById("conductingLayer"),
                pfWidth = parseInt(svgPagesFrame.style.width, 10),
                pfLeft = parseInt(svgPagesFrame.style.left, 10);

            conductingLayer.style.top = svgPagesFrame.style.top;
            conductingLayer.style.left = "0";
            conductingLayer.style.width = (pfLeft + pfWidth + pfLeft).toString(10) + "px";
            conductingLayer.style.height = svgPagesFrame.style.height;

            // conducting stops if
            //     e.clientX <= conductingLimit.left
            // or  e.clientX >= conductingLimit.right
            conductingLimit.left = parseInt(conductingLayer.style.left) + 2;
            conductingLimit.right = parseInt(conductingLayer.style.width) - 2;
        }

        // This function can throw an exception
        // (e.g. if an attempt is made to create an event that has no duration).
        getTracksData(score);

        setConductingLayer();

        score.sendStartMarkerToStart();
        score.sendEndMarkerToEnd();
        score.moveStartMarkerToTop(globalElements.svgPagesFrame);

        player = new Sequence();
        player.init(deviceOptions.outputDevice, score, reportEndOfRegion, reportEndOfPerformance, reportMsPos);

        tracksControl.setOnChangeCallbacks(score.refreshDisplay, player.initTracks);

        setSpeedControl(tracksControl.width());

        resetSpeed(); // if (player.setSpeed !== undefined) calls player.setSpeed(1) (100%)

        score.refreshDisplay(undefined); // arg 2 is undefined so score.trackIsOnArray is not changed.

        setSvgControlsState('stopped');
    }
}



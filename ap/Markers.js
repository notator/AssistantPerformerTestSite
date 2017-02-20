﻿/*
 *  copyright 2012 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  ap/Markers.js
 *  Defines the StartMarker, EndMarker and RunningMarker objects.
 *  The StartMarker and EndMarker are the objects in a score which determine
 *  where a performance begins and ends.
 *  The RunningMarker is the line which shows the current position in a
 *  performance while it is running.
 *  
 */

/*jslint white:true */
/*global _AP,  window,  document */

_AP.namespace('_AP.markers');

_AP.markers = (function ()
{
    "use strict";

    var EXTRA_TOP_AND_BOTTOM = 45, // user html pixels
        CIRCLE_RADIUS = 5, // user html pixels
        RECT_WIDTH_AND_HEIGHT = 8, // user html pixels

    // markers are used to determine the start and end points of a performance
    // when playing a MIDI file

    // The svgStartMarkerGroup is an svg group with class='startMarker'.
    // It contains an svg line and an svg circle element.
    StartMarker = function (system, systIndex, svgStartMarkerGroup, vbOriginY, vbScale)
    {
        if (!(this instanceof StartMarker))
        {
            return new StartMarker();
        }

        var 
        viewBoxScale, line, circle,
        color = '#009900', disabledColor = '#AAFFAA',
        sysIndex, timObject,
        msPosInScore, yCoordinates = {},
        groupChildren, i,

        moveTo = function (tObject)
        {
            var x = tObject.alignment;

            timObject = tObject;

            msPosInScore = tObject.msPositionInScore;

            x *= viewBoxScale;
            line.setAttribute('x1', x.toString());
            line.setAttribute('x2', x.toString());
            circle.setAttribute('cx', x.toString());
        },

        msPositionInScore = function ()
        {
            return msPosInScore;
        },

        systemIndex = function ()
        {
            return sysIndex;
        },

        timeObject = function ()
        {
            return timObject;
        },

        setEnabledColor = function (setToEnabledColor)
        {
            if (setToEnabledColor)
            {
                line.style.stroke = color;
                circle.style.fill = color;
            }
            else
            {
                line.style.stroke = disabledColor;
                circle.style.fill = disabledColor;
            }
        },

        setVisible = function (setToVisible)
        {
            if (setToVisible)
            {
                line.style.visibility = 'visible';
                circle.style.visibility = 'visible';
            }
            else
            {
                line.style.visibility = 'hidden';
                circle.style.visibility = 'hidden';
            }
        },

        getYCoordinates = function ()
        {
            var val = {};
            val.top = yCoordinates.top;
            val.bottom = yCoordinates.bottom;
            return val;
        };

        function setParameters(system, vbOriginY, vbScale)
        {
            var top, bottom;

            viewBoxScale = vbScale;

            top = (system.markersTop - vbOriginY - EXTRA_TOP_AND_BOTTOM).toString();
            bottom = (system.markersBottom - vbOriginY + EXTRA_TOP_AND_BOTTOM).toString();

            line.setAttribute('x1', '0');
            line.setAttribute('y1', top);
            line.setAttribute('x2', '0');
            line.setAttribute('y2', bottom);

            line.style.strokeWidth = 4; // 1/2 pixel
            line.style.stroke = color;

            circle.setAttribute('cy', top);
            circle.setAttribute('r', (vbScale * CIRCLE_RADIUS).toString());
            circle.style.strokeWidth = 0;
            circle.style.fill = color;

            yCoordinates.top = Math.round(parseFloat(top) / vbScale) + vbOriginY;
            yCoordinates.bottom = Math.round(parseFloat(bottom) / vbScale) + vbOriginY;
        }

        groupChildren = svgStartMarkerGroup.childNodes;
        for(i = 0; i < groupChildren.length; ++i)
        {
            if(groupChildren[i].nodeName === 'line')
            {
                line = groupChildren[i];
            }
            if(groupChildren[i].nodeName === 'circle')
            {
                circle = groupChildren[i];
            }
        }
        sysIndex = systIndex; // returned by systemIndex();
        setVisible(false);
        setParameters(system, vbOriginY, vbScale); 

        this.systemIndex = systemIndex; // function returns sysIndex
        this.timeObject = timeObject; // function returns timObject
        this.msPositionInScore = msPositionInScore; // function returns msPosInScore
        this.moveTo = moveTo;
        this.setVisible = setVisible;
        this.setEnabledColor = setEnabledColor;
        this.getYCoordinates = getYCoordinates;

        return this;
    },

    // The svgEndMarkerGroup is an svg group with id='endMarker'.
    // It contains an svg line and an svg rect element.
    EndMarker = function (system, systIndex, svgEndMarkerGroup, vbOriginY, vbScale)
    {
        if (!(this instanceof EndMarker))
        {
            return new EndMarker();
        }

        var 
        viewBoxScale, line, rect,
        halfRectWidth,
        color = '#EE0000', disabledColor = '#FFC8C8',
        sysIndex, msPosInScore,
        groupChildren, i,

        // the argument's alignment is in user html pixels
        moveTo = function (timeObject)
        {
            var x = timeObject.alignment;

            msPosInScore = timeObject.msPositionInScore;

            x *= viewBoxScale;
            line.setAttribute('x1', x.toString());
            line.setAttribute('x2', x.toString());
            rect.setAttribute('x', (x - halfRectWidth).toString());
        },

        msPositionInScore = function ()
        {
            return msPosInScore;
        },

        systemIndex = function()
        {
            return sysIndex;
        },

        setEnabledColor = function (setToEnabledColor)
        {
            if (setToEnabledColor)
            {
                rect.style.fill = color;
                line.style.stroke = color;
            }
            else
            {
                rect.style.fill = disabledColor;
                line.style.stroke = disabledColor;
            }
        },

        setVisible = function (setToVisible)
        {
            if (setToVisible)
            {
                rect.style.visibility = 'visible';
                line.style.visibility = 'visible';
            }
            else
            {
                rect.style.visibility = 'hidden';
                line.style.visibility = 'hidden';
            }
        };

        function setParameters(system, vbOriginY, vbScale)
        {
            var top, bottom, rectX, rectY, widthHeight;

            viewBoxScale = vbScale;

            top = (system.markersTop - vbOriginY - EXTRA_TOP_AND_BOTTOM).toString();
            bottom = (system.markersBottom - vbOriginY + EXTRA_TOP_AND_BOTTOM).toString();

            rectX = (vbScale * (-RECT_WIDTH_AND_HEIGHT / 2)).toString(10);
            rectY = (top - (vbScale * (RECT_WIDTH_AND_HEIGHT / 2))).toString(10);

            halfRectWidth = (vbScale * RECT_WIDTH_AND_HEIGHT) / 2;
            widthHeight = (vbScale * RECT_WIDTH_AND_HEIGHT).toString(10);

            line.setAttribute('x1', '0');
            line.setAttribute('y1', top);
            line.setAttribute('x2', '0');
            line.setAttribute('y2', bottom);

            line.style.strokeWidth = 4;
            line.style.stroke = color;

            rect.setAttribute('x', rectX);
            rect.setAttribute('y', rectY);
            rect.setAttribute('width', widthHeight);
            rect.setAttribute('height', widthHeight);

            rect.style.strokeWidth = 0;
            rect.style.fill = color;
        }

        groupChildren = svgEndMarkerGroup.childNodes;
        for(i = 0; i < groupChildren.length; ++i)
        {
            if(groupChildren[i].nodeName === 'line')
            {
                line = groupChildren[i];
            }
            if(groupChildren[i].nodeName === 'rect')
            {
                rect = groupChildren[i];
            }
        }
        sysIndex = systIndex;
        setVisible(false);
        setParameters(system, vbOriginY, vbScale);

        this.systemIndex = systemIndex;
        this.msPositionInScore = msPositionInScore;
        this.moveTo = moveTo;
        this.setVisible = setVisible;
        this.setEnabledColor = setEnabledColor;

        return this;
    },

    // The argument is an svg group with id='runningMarker'.
    // The group contains a single svg line.
    RunningMarker = function (system, systIndex, svgStartMarkerGroup, vbOriginY, vbScale)
    {
        if (!(this instanceof RunningMarker))
        {
            return new RunningMarker();
        }

        var 
        // private variables ***********************************
        viewBoxScale,
        line, timeObjects, positionIndex,
        nextMillisecondPosition,
        sysIndex, yCoordinates = {},
        groupChildren, i,
        MidiChord = _AP.midiObject.MidiChord,
        MidiRest = _AP.midiObject.MidiRest,
        InputChord = _AP.inputChord.InputChord,

        moveLineToAlignment = function (alignment)
        {
            var x = alignment * viewBoxScale;
            line.setAttribute('x1', x.toString());
            line.setAttribute('x2', x.toString());
        },

        setNextMsPosition = function (currentIndex)
        {
            if (currentIndex < (timeObjects.length - 1))
            {
                nextMillisecondPosition = timeObjects[currentIndex + 1].msPositionInScore;
            }
            else
            {
                nextMillisecondPosition = undefined;
            }
        },

        // This function is necessary after changing systems, where the first position of the system needs to be skipped.
        // msPositionInScore must be in the current system
        moveTo = function(msPosInScoreArg)
        {
            positionIndex = 0;
            while(timeObjects[positionIndex].msPositionInScore !== msPosInScoreArg)
            {
                positionIndex++;
            }

            moveLineToAlignment(timeObjects[positionIndex].alignment);
            nextMillisecondPosition = timeObjects[positionIndex + 1].msPositionInScore; // may be system's end msPosition
        },

        // The startMarker argument is in the same system as this runningMarker
        // If the startMarker is on the system's end barline, nextMsPosition is set to undefined.
        // (The current runningMarker is changed to the following system's runningMarker,
        // if the sequencer's msTimeStamp > system.endMsPosition, so the undefined value for
        // the runningMarker.nextMsPosition should never be accessed.
        moveToStartMarker = function (startMarker)
        {
            //moveTo(startMarker.timeObject().msPositionInScore);
            var msPos = startMarker.timeObject().msPositionInScore;

            positionIndex = 0;
            while(timeObjects[positionIndex].msPositionInScore < msPos)
            {
                positionIndex++;
            }

            moveLineToAlignment(timeObjects[positionIndex].alignment);
            nextMillisecondPosition = timeObjects[positionIndex + 1].msPositionInScore; // may be system's end msPosition
        },

        moveToStartOfSystem = function()
        {
            moveTo(timeObjects[0].msPositionInScore);
        },

        incrementPosition = function ()
        {
            //console.log("runningMarker: msPos before increment=%i, after increment=%i", timeObjects[positionIndex].msPositionInScore, timeObjects[positionIndex + 1].msPositionInScore);
            positionIndex++;
            setNextMsPosition(positionIndex);
            moveLineToAlignment(timeObjects[positionIndex].alignment);
        },

        systemIndex = function ()
        {
            return sysIndex;
        },

        nextMsPosition = function ()
        {
            return nextMillisecondPosition;
        },

        // The timeObjects array contains one timeObject per msPositionInScore in the system.
        // It is ordered according to each timeObject msPositionInScore.
        // If isLivePerformance === true, the timeObjects are inputObjects from inputVoices,
        // otherwise the timeObjects are midiObjects from outputVoices.
        setTimeObjects = function (system, isLivePerformance, trackIsOnArray)
        {
            var timeObject;

            function findFollowingTimeObject(system, msPositionInScore, isLivePerformance, trackIsOnArray)
            {
                var nextTimeObject, staff, voice, i, k, voiceIndex, trackIndex = 0,
                        voiceTimeObjects = [];

                for (i = 0; i < system.staves.length; ++i)
                {
                    staff = system.staves[i];
                    for(voiceIndex = 0; voiceIndex < staff.voices.length; ++voiceIndex)
                    {
                        if(staff.isVisible && staff.topLineY !== undefined)
                        {  
                            if(trackIsOnArray[trackIndex] === true)
                            {
                                voice = staff.voices[voiceIndex];
                                if(voice.isOutput === true && isLivePerformance === false)
                                {
                                    for(k = 0; k < voice.timeObjects.length; ++k)
                                    {
                                        if(voice.timeObjects[k].msPositionInScore > msPositionInScore)
                                        {
                                            voiceTimeObjects.push(voice.timeObjects[k]);
                                            break;
                                        }
                                    }
                                }
                                else if(voice.isOutput === false && isLivePerformance === true)
                                {
                                    for(k = 0; k < voice.timeObjects.length; ++k)
                                    {
                                        if(voice.timeObjects[k].msPositionInScore > msPositionInScore)
                                        {
                                            voiceTimeObjects.push(voice.timeObjects[k]);
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                        trackIndex++;
                    }
                }

                // voiceTimeObjects now contains the next timeObject in each active, visible voice.
                // Now find the one having the minimum msPositionInScore.
                nextTimeObject = voiceTimeObjects[0];
                if (voiceTimeObjects.length > 1)
                {
                    for (i = 1; i < voiceTimeObjects.length; ++i)
                    {
                        if (voiceTimeObjects[i].msPositionInScore < nextTimeObject.msPositionInScore)
                        {
                            nextTimeObject = voiceTimeObjects[i];
                        }
                    }
                }
                return nextTimeObject;
            }

            timeObjects = [];
            timeObject = findFollowingTimeObject(system, -1, isLivePerformance, trackIsOnArray);
            while(timeObject instanceof MidiChord || timeObject instanceof MidiRest || timeObject instanceof InputChord)
            {
                timeObjects.push(timeObject);
                timeObject = findFollowingTimeObject(system, timeObject.msPositionInScore, isLivePerformance, trackIsOnArray);
            }
        },

        setVisible = function (setToVisible)
        {
            if (setToVisible)
            {
                line.style.visibility = 'visible';
            }
            else
            {
                line.style.visibility = 'hidden';
            }
        },

        getYCoordinates = function ()
        {
            var val = {};
            val.top = yCoordinates.top;
            val.bottom = yCoordinates.bottom;
            return val;
        };

        // The trackIsOnArray contains the boolean on/off state of eack track.
        function setParameters(system, vbOriginY, vbScale)
        {
            var top, bottom, color = '#999999';

            viewBoxScale = vbScale;

            top = (system.markersTop - vbOriginY - EXTRA_TOP_AND_BOTTOM).toString();
            bottom = (system.markersBottom - vbOriginY + EXTRA_TOP_AND_BOTTOM).toString();

            line.setAttribute('x1', '0');
            line.setAttribute('y1', top);
            line.setAttribute('x2', '0');
            line.setAttribute('y2', bottom);

            line.style.strokeWidth = 8; // 1 pixel
            line.style.stroke = color;

            yCoordinates.top = Math.round(parseFloat(top) / vbScale) + vbOriginY;
            yCoordinates.bottom = Math.round(parseFloat(bottom) / vbScale) + vbOriginY;
        }

        groupChildren = svgStartMarkerGroup.childNodes;
        for(i = 0; i < groupChildren.length; ++i)
        {
            if(groupChildren[i].nodeName === 'line')
            {
                line = groupChildren[i];
            }
        }
        sysIndex = systIndex;
        setVisible(false);
        setParameters(system, vbOriginY, vbScale);

        // public functions interface
        this.setTimeObjects = setTimeObjects;
        this.setVisible = setVisible;
        this.systemIndex = systemIndex;
        this.nextMsPosition = nextMsPosition;
        this.moveToStartOfSystem = moveToStartOfSystem;
        this.moveTo = moveTo;
        this.moveToStartMarker = moveToStartMarker;
        this.incrementPosition = incrementPosition;
        this.getYCoordinates = getYCoordinates;

        return this;
    },

    // public API
    publicAPI =
    {
        StartMarker: StartMarker,
        RunningMarker: RunningMarker,
        EndMarker: EndMarker
    };

    return publicAPI;

} ());


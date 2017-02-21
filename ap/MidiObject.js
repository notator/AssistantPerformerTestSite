/*
 *  copyright 2012 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  ap/MidiObject.js
 *  Public interface:
 *      MidiChord(scoreMidiElem) // MidiChord constructor
 *      MidiRest(scoreMidiElem) // MidiRest constructor
 */

/*jslint white:true */
/*global _AP,  window,  document, console */

_AP.namespace('_AP.midiChord');

_AP.midiObject = (function()
{
    "use strict";
    // begin var
    var
    Message = _AP.message.Message,
    SysExMessage = _AP.message.SysExMessage,
    Moment = _AP.moment.Moment, // constructor

    // The rate (milliseconds) at which slider messages are sent.
    SLIDER_MILLISECONDS = 100,

    defineMidiObjectProperties = function(that, scoreMidiElem, systemIndex)
    {
        // moments is an ordered array of Moment objects.
        // A Moment is a list of logically synchronous Messages.
        // The msDurationInScore and msPositionInScore properties are not changed by the global speed option!
        // These values are used, but not changed, either when moving Markers about or during performances.)
        Object.defineProperty(that, "moments", { value: that._getMoments(scoreMidiElem, systemIndex), writable: true });
        Object.defineProperty(that, "msDurationInScore", { value: that.msDurationInScore, writable: false });
        //Object.defineProperty(that, "msPositionInScore", { value: 0, writable: true });

        // used at runtime
        Object.defineProperty(that, "currentMoment", { value: that.moments[0], writable: true });
        Object.defineProperty(that, "_currentMomentIndex", { value: -1, writable: true });
    },

    // public MidiChord constructor
    // A MidiChord contains all the midi messages required for playing an (ornamented) chord. 
    MidiChord = function(scoreMidiElem, systemIndex)
    {
        if(!(this instanceof MidiChord))
        {
            return new MidiChord(scoreMidiElem, systemIndex);
        }

        defineMidiObjectProperties(this, scoreMidiElem, systemIndex);

        return this;
    },

    // public MidiRest constructor
    // A MidiRest is functionally identical to a MidiChord.
    // The only way to distinguish between the two is by using the instanceof operator.
    MidiRest = function(scoreMidiElem, systemIndex)
    {
        if(!(this instanceof MidiRest))
        {
            return new MidiRest(scoreMidiElem, systemIndex);
        }

        defineMidiObjectProperties(this, scoreMidiElem, systemIndex);

        return this;
    },

    publicMidiObjectAPI =
    {
        // public MidiChord constructor
        // A MidiChord contains a private array of Moments containing all
        // the midi messages required for playing an (ornamented) chord.
        // A Moment is a collection of logically synchronous MIDI Messages.
        MidiChord: MidiChord,
        // public MidiRest constructor
        // A MidiRest is functionally identical to a MidiChord.
        // The only way to distinguish between the two is by using the instanceof operator.
        MidiRest: MidiRest
    };
    // end var

    // returns strongly classed Moment objects containing strongly classed Message objects
    MidiChord.prototype._getMoments = function(scoreMidiElem, systemIndex)
    {
        var i, stronglyClassedMoment, stronglyClassedMoments = [], moments, momentMoments, envMoments, msDuration = 0,
            scoreMidiChild, scoreMidiChildren = scoreMidiElem.children;

        function getMsg(bytes)
        {
            var msg;

            switch(bytes.length)
            {
                case 1:
                    msg = new Message(bytes[0]);
                    break;
                case 2:
                    msg = new Message(bytes[0], bytes[1]);
                    break;
                case 3:
                    msg = new Message(bytes[0], bytes[1], bytes[2]);
                    break;
                default:
                    msg = new SysExMessage(bytes);
                    break;
            }
            return msg;
        }

        // adds the momentsToCombine to moments,
        // if msPositionInScore is equal, either msgs or the envMsgs are moved.
        function combineMoments(moments, momentsToCombine, msDuration, setMomentEnvMsgsAttribute)
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
                mcMsPos = momentToCombine.msPositionInChord;
                for(mi = 0; mi < moments.length; ++mi)
                {
                    moment = moments[mi];
                    mMsPos = moment.msPositionInChord;
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
                        if(setMomentEnvMsgsAttribute === true)
                        {
                            momentInsertion.moment.envMsgs = momentInsertion.moment.msgs;
                        }
                        momentInsertions.push(momentInsertion);
                        break;
                    }
                    else if(mi === moments.length - 1)
                    {
                        momentInsertion = {};
                        momentInsertion.index = moments.length;
                        momentInsertion.moment = momentToCombine;
                        if(setMomentEnvMsgsAttribute === true)
                        {
                            momentInsertion.moment.envMsgs = momentInsertion.moment.msgs;
                        }
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
        }

        // returns the moments in the momentsElem, with all the msgs
        // converted to Uint8 arrays.
        function getMomentsMoments(momentsElem)
        {
            var i, msPos = 0, momentsMoment, momentsMoments = [], msChildren = momentsElem.children;

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

            function getMomentsMoment(momentElem, msPos)
            {
                var i, momentChildren = momentElem.children,
                    momentsMoment = {};

                momentsMoment.msPositionInChord = msPos;
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
                    momentsMoment = getMomentsMoment(msChildren[i], msPos);
                    msPos += momentsMoment.msDuration;
                    momentsMoments.push(momentsMoment);
                }
            }

            return momentsMoments;
        }

        function getDuration(momentMoments)
        {
            var lastMomentMoment = momentMoments[momentMoments.length - 1];

            return (lastMomentMoment.msPositionInChord + lastMomentMoment.msDuration);
        }

        function getEnvMoments(envsElem, msDuration)
        {
            var i, envElem, envMoments, status, data1, vts,
                envsChildren = envsElem.children;

            function getEmptyGridMoments(msDuration)
            {
                var mmt, mmts = [], msPos = 0;
                // Algorithm: a set of moments every SLIDER_MILLISECONDS ms, then add the moments between that are the vertices of the envs.
                // Most env moments will then be on the 100ms grid.
                while(msPos < msDuration)
                {
                    mmt = {};
                    mmt.msPositionInChord = msPos;
                    mmt.msgs = [];
                    mmts.push(mmt);
                    msPos += SLIDER_MILLISECONDS;
                }

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

            function setGridMoments(envMoments, status, vts)
            {
                var i, msg, vtsState = {}, oldVtIndex = 0, bytes = [];

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
                    while(msPos >= vtsState.nextVtMsPos && vtsState.vtIndex < (vts.length - 2))
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
                            vtsState.data1IncrPerMillisecond = 0;
                            vtsState.data2IncrPerMillisecond = 0;
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
                        vtsState = nextData(envMoments[i].msPositionInChord, vts, vtsState);

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

            function setVtMoments(envMoments, status, vts, msDuration)
            {
                var i, localEnvMoments = [], localEnvMoment,
                    msg, msPos = 0, vt, bytes = [];

                for(i = 0; i < vts.length; ++i)
                {
                    localEnvMoment = {};
                    localEnvMoment.msPositionInChord = msPos;
                    localEnvMoment.msgs = [];
                    vt = vts[i];

                    if(Math.floor(msPos % SLIDER_MILLISECONDS) !== 0)
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

                combineMoments(envMoments, localEnvMoments, msDuration, false);
            }

            envMoments = getEmptyGridMoments(msDuration);

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
                            setVtMoments(envMoments, status, vts, msDuration);
                            break;
                        case 11: // 0xB ControlChange
                            data1 = parseInt(envElem.getAttribute("d1"), 10);
                            vts = getVtsData2ConstD1(envElem, data1);
                            setGridMoments(envMoments, status, vts);
                            setVtMoments(envMoments, status, vts, msDuration);
                            break;
                        case 13: // 0xD ChannelPressure
                            vts = getVtsData1UndefinedData2(envElem);
                            setGridMoments(envMoments, status, vts);
                            setVtMoments(envMoments, status, vts, msDuration);
                            break;
                        case 14: // 0xE PitchWheel
                            vts = getVtsData1AndData2(envElem);
                            setGridMoments(envMoments, status, vts);
                            setVtMoments(envMoments, status, vts, msDuration);
                            break;
                        default:
                            break;
                    }
                }
            }

            return envMoments;
        }

        function getCombinedMoments(momentMoments, envsMoments, msDuration)
        {
            var i, j, combinedMoment, combinedMoments = [],
                moment, noteOffMsgs, switchesMsgs, envMsgs, noteOnMsgs;

            combineMoments(momentMoments, envsMoments, msDuration, true);

            for(i = 0; i < momentMoments.length; ++i)
            {
                moment = momentMoments[i];

                combinedMoment = {};
                combinedMoment.msPositionInChord = moment.msPositionInChord;
                combinedMoment.msgs = [];
                combinedMoments.push(combinedMoment);

                if(moment.noteOffMsgs !== undefined)
                {
                    noteOffMsgs = moment.noteOffMsgs;
                    for(j = 0; j < noteOffMsgs.length; ++j)
                    {
                        combinedMoment.msgs.push(noteOffMsgs[j]);
                    }
                }

                if(moment.switchesMsgs !== undefined)
                {
                    switchesMsgs = moment.switchesMsgs;
                    for(j = 0; j < switchesMsgs.length; ++j)
                    {
                        combinedMoment.msgs.push(switchesMsgs[j]);
                    }
                }

                if(moment.envMsgs !== undefined)
                {
                    envMsgs = moment.envMsgs;
                    for(j = 0; j < envMsgs.length; ++j)
                    {
                        combinedMoment.msgs.push(envMsgs[j]);
                    }
                }

                if(moment.noteOnMsgs !== undefined)
                {
                    noteOnMsgs = moment.noteOnMsgs;
                    for(j = 0; j < noteOnMsgs.length; ++j)
                    {
                        combinedMoment.msgs.push(noteOnMsgs[j]);
                    }
                }
            }

            return combinedMoments;
        }

        for(i = 0; i < scoreMidiChildren.length; ++i)
        {
            scoreMidiChild = scoreMidiChildren[i];
            if(scoreMidiChild.nodeName === "moments")
            {
                momentMoments = getMomentsMoments(scoreMidiChild);
                msDuration = getDuration(momentMoments);
                this.msDurationInScore = msDuration;
            }

            if(scoreMidiChild.nodeName === "envs")
            {
                envMoments = getEnvMoments(scoreMidiChild, msDuration);
            }
        }

        moments = getCombinedMoments(momentMoments, envMoments, msDuration);

        for(i = 0; i < moments.length; ++i)
        {
            stronglyClassedMoment = new Moment(moments[i].msPositionInChord, systemIndex);
            stronglyClassedMoment.messages = moments[i].msgs;
            stronglyClassedMoments.push(stronglyClassedMoment);
        }

        return stronglyClassedMoments;
    };

    /***** The following functions are defined for both MidiChords and MidiRests *****************/

    // The chord must be at or straddle the start marker.
    // This function sets the chord to the state it should have when a performance starts.
    // this.currentMoment is set to the first moment at or after startMarkerMsPositionInScore.
    // this.currentMoment will be undefined if there are no moments at or after startMarkerMsPositionInScore. 
    MidiChord.prototype.setToStartMarker = function(startMarkerMsPositionInScore)
    {
        var
        nMoments = this.moments.length,
        currentIndex, currentPosition;

        console.assert(
            ((this.msPositionInScore <= startMarkerMsPositionInScore)
            && (this.msPositionInScore + this.msDurationInScore > startMarkerMsPositionInScore)),
            "This chord or rest must be at or straddle the start marker.");

        for(currentIndex = 0; currentIndex < nMoments; ++currentIndex)
        {
            currentPosition = this.msPositionInScore + this.moments[currentIndex].msPositionInChord;
            if(currentPosition >= startMarkerMsPositionInScore)
            {
                break;
            }
        }
        this._currentMomentIndex = currentIndex;
        this.currentMoment = this.moments[currentIndex];
    };

    MidiChord.prototype.advanceCurrentMoment = function()
    {
        var returnMoment;

        console.assert(this.currentMoment !== null, "CurrentMoment should never be null here!");

        this._currentMomentIndex++;
        returnMoment = null;
        if(this._currentMomentIndex < this.moments.length)
        {
            this.currentMoment = this.moments[this._currentMomentIndex];
            returnMoment = this.currentMoment;
        }
        return returnMoment;
    };

    MidiChord.prototype.setToStartAtBeginning = function()
    {
        this._currentMomentIndex = 0;
        this.currentMoment = this.moments[0];
    };

    MidiRest.prototype = MidiChord.prototype;

    return publicMidiObjectAPI;
}());

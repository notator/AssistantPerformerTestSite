/*
 *  copyright 2012 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  ap/InputChord.js
 *  Public interface:
 *      InputChord(inputChordDef, outputTracks) // InputChord constructor 
 */

/*jslint bitwise: false, nomen: true, plusplus: true, white: true */
/*global _AP: false,  window: false,  document: false, performance: false, console: false, alert: false, XMLHttpRequest: false */

_AP.namespace('_AP.inputChord');

_AP.inputChord = (function()
{
    "use strict";
    // begin var
    var

    // public InputChord constructor
    // An InputChord contains all the information required for playing an (ornamented) chord.
    InputChord = function(inputChordDef, outputTracks, systemIndex)
    {
        if(!(this instanceof InputChord))
        {
            return new InputChord(inputChordDef, outputTracks, systemIndex);
        }

        // The msDurationInScore and msPositionInScore properties are not subject to the global speed option!
        // These values are used, but not changed, either when moving Markers about or during performances.)
        Object.defineProperty(this, "msPositionInScore", { value: inputChordDef.msPositionInScore, writable: false });
        Object.defineProperty(this, "msDurationInScore", { value: inputChordDef.msDurationInScore, writable: false });
        Object.defineProperty(this, "alignment", { value: inputChordDef.alignment, writable: false });
        Object.defineProperty(this, "systemIndex", { value: systemIndex, writable: false });

        if(inputChordDef.ccSettings !== undefined)
        {
            Object.defineProperty(this, "ccSettings", { value: inputChordDef.ccSettings, writable: false });
        }

        if(inputChordDef.trkOptions !== undefined)
        {
            Object.defineProperty(this, "trkOptions", { value: inputChordDef.trkOptions, writable: false });
        }

        Object.defineProperty(this, "inputNotes", { value: this.getInputNotes(inputChordDef.inputNotes, outputTracks, inputChordDef.msPositionInScore), writable: false });

        return this;
    },

    publicInputChordAPI =
    {
        // public InputChord constructor
        // A InputChord contains a private array of inputNotes.
        // Each inputNote contains an array of parallel MidiObject arrays (trks). 
        InputChord: InputChord
    };
    // end var

    // getInputNotes() Arguments:
    // Each object in the inputNoteDefs argument contains the following fields
    //      .notatedKey (a number. The MIDI index of the notated key.)
    //      .trkOptions -- undefined or an TrkOptions object
    //      .noteOn -- undefined (or see below)
    //      .noteOff -- undefined (or see below)
    //
    //      .noteOn and .noteOff can have the following fields:
    //        .seqDef -- undefined or an array of trkRef, which may have a trkOptions attribute.
    //            Each trkRef has the following fields:
    //                .trkOptions -- undefined or an TrkOptions object
    //                .trackIndex (compulsory int >= 0. The trackIndex of the voice containing the referenced Trk. )
    //                .msPositionInScore (compulsory int >= 0. The msPositionInScore of the referenced Trk.)
    //                .length (compulsory int >= 0. The number of MidiChords and Rests the referenced Trk.)
    //                .trkOffs -- undefined or an array of trackIndex
    //------------------------------------------------------------------------------
    // getInputNotes() Returns:
    // An array of inputNote objects, the fields of which have been copied from the corresponding inputNoteDefs (see above)
    // but with trackIndex values converted to trackIndices:
    InputChord.prototype.getInputNotes = function(inputNoteDefs, outputTracks, inputChordMsPositionInScore)
    {
        var i, nInputNoteDefs = inputNoteDefs.length, inputNoteDef,
            inputNote, inputNotes = [];

        function getNoteOnOrOff(noteInfo, outputTracks, inputChordMsPositionInScore)
        {
            var noteOnOrOff = {};

            function getSeq(onSeq, outputTracks, inputChordMsPositionInScore)
            {
                var trk, trks = [], i, trkOn, nTrkOns = onSeq.length, trackMidiObjects;

                function getMidiObjectIndex(trkMsPosition, midiObjects)
                {
                    var found = false, midiObjectIndex;

                    for(midiObjectIndex = 0; midiObjectIndex < midiObjects.length; ++midiObjectIndex)
                    {
                        if(midiObjects[midiObjectIndex].msPositionInScore === trkMsPosition)
                        {
                            found = true;
                            break;
                        }
                    }
                    if(found === false)
                    {
                        throw "InputChord.js: Can't find the first midiObject in the trk!";
                    }
                    return midiObjectIndex;
                }

                function getMidiObjects(startIndex, length, trackMidiObjects)
                {
                    var midiObjects = [], i, midiObjIndex = startIndex;

                    for(i = 0; i < length; ++i)
                    {
                        midiObjects.push(trackMidiObjects[midiObjIndex++]);
                    }
                    return midiObjects;
                }

                for(i = 0; i < nTrkOns; ++i)
                {
                    trkOn = onSeq[i];
                    trk = {};

                    if(trkOn.trkOptions !== undefined)
                    {
                        trk.trkOptions = trkOn.trkOptions;
                    }
                    trk.trackIndex = trkOn.trackIndex;
                    trackMidiObjects = outputTracks[trk.trackIndex].midiObjects;
                    trk.midiObjectIndex = getMidiObjectIndex(trkOn.msPositionInScore, trackMidiObjects);
                    trk.msOffset = trackMidiObjects[trk.midiObjectIndex].msPositionInScore - inputChordMsPositionInScore;
                    trk.midiObjects = getMidiObjects(trk.midiObjectIndex, trkOn.nMidiObjects, trackMidiObjects);

                    trks.push(trk);
                }

                if(onSeq.trkOptions !== undefined)
                {
                    trks.trkOptions = onSeq.trkOptions;
                }

                return trks;
            }

            if(noteInfo.seqDef !== undefined)
            {
                noteOnOrOff.seqDef = getSeq(noteInfo.seqDef, outputTracks, inputChordMsPositionInScore);
            }

            if(noteInfo.trkOffs !== undefined)
            {
                noteOnOrOff.trkOffs = noteInfo.trkOffs;
            }

            return noteOnOrOff;
        }

        for(i = 0; i < nInputNoteDefs; ++i)
        {
            inputNoteDef = inputNoteDefs[i];
            inputNote = {};
            inputNote.notatedKey = inputNoteDef.notatedKey;
            if(inputNoteDef.trkOptions !== undefined)
            {
                inputNote.trkOptions = inputNoteDef.trkOptions;
            }
            if(inputNoteDef.noteOn !== undefined)
            {
                inputNote.noteOn = getNoteOnOrOff(inputNoteDef.noteOn, outputTracks, inputChordMsPositionInScore);
            }
            if(inputNoteDef.noteOff !== undefined)
            {
                inputNote.noteOff = getNoteOnOrOff(inputNoteDef.noteOff, outputTracks, inputChordMsPositionInScore);
            }
            inputNotes.push(inputNote);
        }

        return inputNotes;
    };

    InputChord.prototype.referencedOutputTrackIndices = function()
    {
        var i, inputNote, nInputNotes = this.inputNotes.length, nonUniqueOutputIndices = [], returnArray = [];

        function outIndices(noteOnOff)
        {
            var i,
            seqDef = noteOnOff.seqDef, nSeqTrks,
            trkOffs = noteOnOff.trkOffs, nTrkOffs,
            outputIndices = [];

            if(seqDef !== undefined)
            {
                nSeqTrks = seqDef.length;
                for(i = 0; i < nSeqTrks; ++i)
                {
                    outputIndices.push(seqDef[i].trackIndex);
                }
            }
            if(trkOffs !== undefined)
            {
                nTrkOffs = trkOffs.length;
                for(i = 0; i < nTrkOffs; ++i)
                {
                    outputIndices.push(trkOffs[i]);
                }
            }

            return outputIndices;
        }

        function uniqueOutputIndices(nonUniqueOutputIndices)
        {
            var i, nAllOutputIndices = nonUniqueOutputIndices.length, rVal = [];
            for(i = 0; i < nAllOutputIndices; ++i)
            {
                if(rVal.indexOf(nonUniqueOutputIndices[i]) < 0)
                {
                    rVal.push(nonUniqueOutputIndices[i]);
                }
            }
            return rVal;
        }

        for(i = 0; i < nInputNotes; ++i)
        {
            inputNote = this.inputNotes[i];
            if(inputNote.noteOn !== undefined)
            {
                nonUniqueOutputIndices = nonUniqueOutputIndices.concat(outIndices(inputNote.noteOn));
            }
            if(inputNote.noteOff !== undefined)
            {
                nonUniqueOutputIndices = nonUniqueOutputIndices.concat(outIndices(inputNote.noteOff));
            }
        }

        returnArray = uniqueOutputIndices(nonUniqueOutputIndices);

        return returnArray;
    };

    return publicInputChordAPI;
}());

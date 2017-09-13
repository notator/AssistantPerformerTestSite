/*
* Copyright 2015 James Ingram
* http://james-ingram-act-two.de/
* 
* This code is based on the gree soundFont synthesizer at
* https://github.com/gree/sf2synth.js
*
* All this code is licensed under MIT
*
* The WebMIDI.soundFont namespace containing:
* 
*        // SoundFont constructor
*        SoundFont(soundFontUrl, soundFontName, presetIndices, onLoad)
*/

/*global WebMIDI */

WebMIDI.namespace('WebMIDI.soundFont');

WebMIDI.soundFont = (function()
{
	"use strict";
	var
	name, // ji for host
	presetInfo, // ji for host
	banks, // export to synth

	createBagModGen_ = function(indexStart, indexEnd, zoneModGen)
	{
	    var modgenInfo = [],
			modgen = {
			    unknown: [],
			    keyRange: {
			        hi: 127,
			        lo: 0
			    }
			},
			info,
			i;

	    for(i = indexStart; i < indexEnd; ++i)
	    {
	        info = zoneModGen[i];
	        modgenInfo.push(info);

	        if(info.type === 'unknown')
	        {
	            modgen.unknown.push(info.value);
	        } else
	        {
	            modgen[info.type] = info.value;
	        }
	    }

	    return {
	        modgen: modgen,
	        modgenInfo: modgenInfo
	    };
	},

	getPresetModulator_ = function(parser, zone, index)
	{
	    var modgen = createBagModGen_(
		  zone[index].presetModulatorIndex,
		  zone[index + 1] ? zone[index + 1].presetModulatorIndex : parser.presetZoneModulator.length,
		  parser.presetZoneModulator
		);

	    return {
	        modulator: modgen.modgen,
	        modulatorInfo: modgen.modgenInfo
	    };
	},

	getPresetGenerator_ = function(parser, zone, index)
	{
	    var modgen = parser.createBagModGen_(
		  zone,
		  zone[index].presetGeneratorIndex,
		  zone[index + 1] ? zone[index + 1].presetGeneratorIndex : parser.presetZoneGenerator.length,
		  parser.presetZoneGenerator
		);

	    return {
	        generator: modgen.modgen,
	        generatorInfo: modgen.modgenInfo
	    };
	},

	createInstrumentModulator_ = function(parser, zone, index)
	{
	    var modgen = parser.createBagModGen_(
		  zone,
		  zone[index].presetModulatorIndex,
		  zone[index + 1] ? zone[index + 1].instrumentModulatorIndex : parser.instrumentZoneModulator.length,
		  parser.instrumentZoneModulator
		);

	    return {
	        modulator: modgen.modgen,
	        modulatorInfo: modgen.modgenInfo
	    };
	},

	createInstrumentGenerator_ = function(parser, zone, index)
	{
	    var modgen = parser.createBagModGen_(
		  zone,
		  zone[index].instrumentGeneratorIndex,
		  zone[index + 1] ? zone[index + 1].instrumentGeneratorIndex : parser.instrumentZoneGenerator.length,
		  parser.instrumentZoneGenerator
		);

	    return {
	        generator: modgen.modgen,
	        generatorInfo: modgen.modgenInfo
	    };
	},

    // Creates a keyLayer for each key in the generator's keyRange, and adds it to the key's keyLayers array in the preset.
    // Each key's keyLayers array is at preset[keyIndex], and contains an array of keyLayer objects.
    // This function creates an attribute for each generator in each keyLayer. The attribute values are the raw integer values
    // that are either found in the soundFont or are default values. The attribute names are the official names of the
    // generators in the sf2spec (see §8.1.2 and §8.1.3).
    // When this function has returned, the following function (setPresetValues) converts these "amounts" to (possibly
    // floating point) values that can subsequently be used more conveniently (in soundFontSynthNote.js).
    getPresetAmounts = function(generatorTable, generator, preset)
    {
        // The terms presetZone, layer and keyLayer:
        // The sfspec says that a "presetZone" is "A subset of a preset containing generators, modulators, and an instrument."
        // The sfspec also says that "layer" is an obsolete term for a "presetZone".
        // The Awave soundfont editor says that a "layer" is "a set of regions with non-overlapping key ranges".
        // The Arachno soundFont contains two "presetZones" in the Grand Piano preset. The first has a pan
        // setting of -500, the second a pan setting of +500.
        // I am therefore assuming that a "presetZone" is a preset-level "channel", that is sent at the same time
        // as other "presetZones" in the same preset, so as to create a fuller sound.
        // I use the term "keyLayer" to mean the subsection of a presetZone associated with a single key.
        // A keyLayer contains a single audio sample and the parameters (generators) for playing it.
        // There will always be a single MIDI output channel, whose pan position is realised by combining the
        // channel's current pan value with the pan values of the key's (note's) "keyLayers".
        // The sfspec allows an unlimited number of "presetZones" in the pbag chunk, so the number of "keyLayers"
        // is also unlimted.

        let keyIndex = 0, keyLayer, keyLayers;

        function getKeyLayer(generatorTable, generator)
        {
            let genIndex = 0, nGens = generatorTable.length, gen, amount, keyLayer = {};

            for(genIndex = 0; genIndex < nGens; ++genIndex)
            {
                gen = generatorTable[genIndex];
                if(gen !== undefined)
                {
                    amount = generator[gen.name] ? generator[gen.name].amount : gen.default;
                    keyLayer[gen.name] = amount;
                }
            }
            return keyLayer;
        }

        if(generator.keyRange === undefined || generator.sampleID === undefined)
        {
            throw "invalid soundFont";
        }

        for(keyIndex = generator.keyRange.lo; keyIndex <= generator.keyRange.hi; ++keyIndex)
        {
            keyLayers = preset[keyIndex];
            if(keyLayers === undefined)
            {
                keyLayers = [];
                preset[keyIndex] = keyLayers;
            }

            keyLayer = getKeyLayer(generatorTable, generator);
            keyLayers.push(keyLayer);
        }
    },

    // This function converts the (integer) values created by the previous function to (possibly floating-point)values
    // that will be more convenient to use at runtime.
    // It also combines some of the original attributes into new attributes (which I call pseudoGenerators in this code).
    // Newly created attributes are, if meaningful given names that are the original names concatenated with their unit
    // of measurement (delayModLFO_sec, chorusEffectsSend_percent etc.).
    // Attributes that have been consumed, and are no longer needed, are deleted.
    setPresetValues = function (parser, preset)
    {
        let keyIndex, keyLayers, layerIndex, nLayers, keyLayer, amount,
            generatorTable = parser.GeneratorEnumeratorTable, nGenerators = generatorTable.length,
            genIndex = 0, gen, genName, newGenName;

        // PseudoGenerators are attributes of the keyLayer that are calculated
        // from the generators in the soundFont (that already exist in the keyLayer).
        // When they have been used, redundant generators are deleted.
        function setPseudoGenerators1(parser, keyIndex, keyLayer)
        {
            let kl = keyLayer,
                sampleHeader = parser.sampleHeader[kl.sampleID],
                tune = kl.coarseTune + kl.fineTune / 100, // semitones              
                rootKey = (kl.overridingRootKey === -1) ? sampleHeader.originalPitch : kl.overridingRootKey,
                scaleTuning = kl.scaleTuning / 100;

            kl.sample = parser.sample[kl.sampleID];
            kl.sampleRate = sampleHeader.sampleRate;
            kl.bufferStartTime_sec = ((kl.startAddrsCoarseOffset * 32768) + kl.startAddrsOffset) / kl.sampleRate;
            kl.basePlaybackRate = Math.pow(Math.pow(2, 1 / 12), (keyIndex - rootKey + tune + (sampleHeader.pitchCorrection / 100)) * scaleTuning);

            kl.endAddressOffset = (kl.endAddrsCoarseOffset * 32768) + kl.endAddrsOffset;

            kl.velocityMax = kl.velRange & 0xFF;
            kl.velocityMin = (kl.velRange & 0xFF00) / 32767;

            kl.modEnvToPitch_scaled = kl.modEnvToPitch * scaleTuning;

            kl.loopFlags = kl.sampleModes & 3;
            if(kl.loopFlags === 1 || kl.loopFlags === 3)
            {
                kl.loopStart_sec = (sampleHeader.startLoop + (kl.startloopAddrsCoarseOffset * 32768) + kl.startloopAddrsOffset) / kl.sampleRate;
                kl.loopEnd_sec = (sampleHeader.endLoop + (kl.endloopAddrsCoarseOffset * 32768) + kl.endloopAddrsOffset) / kl.sampleRate;
            }

            delete kl.sampleID;
            delete kl.coarseTune; // semitones
            delete kl.fineTune; // cents
            delete kl.startAddrsCoarseOffset;
            delete kl.startAddrsOffset;
            delete kl.endAddrsCoarseOffset;
            delete kl.endAddrsOffset;
            delete kl.startloopAddrsCoarseOffset;
            delete kl.startloopAddrsOffset;
            delete kl.endloopAddrsCoarseOffset;
            delete kl.endloopAddrsOffset;

            delete kl.instrument;
            delete kl.keyRange;
            delete kl.velRange;
            delete kl.modEnvToPitch;
            delete kl.sampleModes;
            // kl.scaleTuning is required in SchedulePlaybackRate()
            // kl.sampleRate is required for creating AudioBuffer.
        }

        function setPseudoGenerators2(keyLayer)
        {
            let baseFreq = keyLayer.initialFilterFc_Hz, peakFreq = baseFreq + keyLayer.modEnvToFilterFc_Hz;

            keyLayer.modHoldDuration_sec *= keyLayer.keynumToModEnvHold_factor;
            delete keyLayer.keynumToModEnvHold_factor;

            keyLayer.modDecayDuration_sec = keyLayer.decayModEnv_sec * keyLayer.keynumToModEnvDecay_factor * keyLayer.sustainModEnv_factor; // see spec!                
            delete keyLayer.decayModEnv_sec;
            delete keyLayer.keynumToModEnvDecay_factor;

            keyLayer.filterBaseFreq_Hz = baseFreq;
            keyLayer.filterPeakFreq_Hz = peakFreq;
            keyLayer.filterSustainFreq_Hz = baseFreq + ((peakFreq - baseFreq) * (1 - keyLayer.sustainModEnv_factor));
            delete keyLayer.initialFilterFc_Hz;
            delete keyLayer.modEnvToFilterFc_Hz;
            delete keyLayer.sustainModEnv_factor;

            keyLayer.volHoldDuration_sec *= keyLayer.keynumToVolEnvHold_factor;
            delete keyLayer.keynumToVolEnvHold_factor;

            keyLayer.volDecayDuration_sec = keyLayer.decayVolEnv_sec * keyLayer.keynumToVolEnvDecay_factor * keyLayer.sustainVolEnv_dB / 100; // see spec!
            keyLayer.volSustainLevel_factor = (100 - keyLayer.sustainVolEnv_dB) / 100;
            delete keyLayer.decayVolEnv_sec;
            delete keyLayer.keynumToVolEnvDecay_factor;
            delete keyLayer.sustainVolEnv_dB;
        }
            
        for(keyIndex = 0; keyIndex < preset.length; ++keyIndex)
        {
            keyLayers = preset[keyIndex];
            nLayers = keyLayers.length;
            for(layerIndex = 0; layerIndex < nLayers; ++layerIndex)
            {
                keyLayer = keyLayers[layerIndex];
                setPseudoGenerators1(parser, keyIndex, keyLayer);
                for(genIndex = 0; genIndex < nGenerators; ++genIndex)
                {
                    gen = generatorTable[genIndex];
                    if(gen !== undefined)
                    {
                        genName = gen.name;
                        if(keyLayer[genName] !== undefined)
                        {
                            amount = keyLayer[genName];
                            delete keyLayer[genName];

                            switch(gen.conv)
                            {
                                case 'timecentToSec': // (original unit: timecent) delayVolEnv, delayModEnv etc.
                                    switch(genName)
                                    {
                                        case 'delayModEnv':
                                            newGenName = 'modDelayDuration_sec';
                                            break;
                                        case 'attackModEnv':
                                            newGenName = 'modAttackDuration_sec';
                                            break;
                                        case 'holdModEnv':
                                            newGenName = 'modHoldDuration_sec';
                                            break;
                                        case 'decayModEnv':
                                            newGenName = 'decayModEnv_sec';  // see below in this function
                                            break;
                                        case 'releaseModEnv':
                                            newGenName = 'modReleaseDuration_sec';
                                            break;
                                        case 'delayVolEnv':
                                            newGenName = 'volDelayDuration_sec';
                                            break;
                                        case 'attackVolEnv':
                                            newGenName = 'volAttackDuration_sec';
                                            break;
                                        case 'holdVolEnv':
                                            newGenName = 'volHoldDuration_sec';
                                            break;
                                        case 'decayVolEnv':
                                            newGenName = 'decayVolEnv_sec';  // see below in this function
                                            break;
                                        case 'releaseVolEnv':
                                            newGenName = 'volReleaseDuration_sec';
                                            break;
                                        case 'delayModLFO':
                                            newGenName = 'modLFODelayDuration_sec';
                                            break;
                                        case 'delayVibLFO':
                                            newGenName = 'vibLFODelayDuration_sec';
                                            break;
                                        default:
                                            throw "Wrong generator for this conversion.";
                                            break;
                                    }
                                    keyLayer[newGenName] = (amount === 0) ? 0 : Math.pow(2, amount / 1200);
                                    break;
                                case 'keynumToFactor': // (original unit: timecents/keyNumber) keynumToModEnvHold, keynumToModEnvDecay etc.
                                    // ji Sept 2017: This formula needs verifying.
                                    // It does, however, satisfy the descriptions of the keynumTo... amounts in the spec.
                                    // Simply multiply the corresponding duration by this factor to get the final value.
                                    // The default amount in the soundFont file is 0, which gives a default factor 1 here.
                                    keyLayer[genName + '_factor'] = Math.pow(2, ((60 - keyIndex) * amount) / 1200);
                                    break;
                                case 'div100': // original is int in range [0..100] (e.g. scaleTuning)
                                    keyLayer[genName + '_factor'] = amount / 100;
                                    break;
                                case 'div1000': // (original unit: 0.1%) chorusEffectsSend etc.
                                    keyLayer[genName + '_factor'] = amount / 1000;
                                    break;
                                case 'centsToSemitones':
                                    keyLayer[genName + '_semitones'] = amount / 100;
                                    break;
                                case 'centsToHz':
                                    // *************** formula needs checking/correcting
                                    keyLayer[genName + '_Hz'] = amount / 100;
                                    break;
                                case 'centFsToSemitone': // (original unit: centFs) modLfoToPitch etc .
                                    // *************** formula needs checking/correcting
                                    keyLayer[genName + '_semitones'] = amount / 100;
                                    break;
                                case 'centFsToHz': // (original unit: centFs) modLfoToFilterFc etc.
                                    // *************** this is the gree formula. Needs checking/correcting                                    
                                    keyLayer[genName + '_Hz'] = Math.pow(2, (amount - 6900) / 1200) * 440;
                                    break;
                                case 'cBtoDB': // (original unit: centibels) initialFilterQ etc.
                                    keyLayer[genName + '_dB'] = amount / 10;
                                    break;
                                case 'panPos': // pan (see sfspec)
                                    keyLayer[genName + '_pos'] = (amount + 500) / 1000;
                                    // keyLayer.pan_pos is now a number in range [0..1] corresponding to the left-right pan position.
                                    break;
                                case 'byte':
                                    if(amount >= 0 && amount <= 127)
                                    {
                                        keyLayer[genName + '_byte'] = amount;                                        
                                    }
                                    break;
                                case 'exclusiveClass':
                                    // do nothing
                                    keyLayer[genName + '_ID'] = amount;
                                    break;
                                default:
                                    // generators that have units other than the above should already have been deleted
                                    throw "Unknown unit conversion.";
                                    break;
                            }
                        }
                    }
                }

                setPseudoGenerators2(keyLayer);
            }
        }
    },

	// Parses the Uin8Array to create this soundFont's banks.
	getBanks = function(uint8Array, nRequiredPresets)
	{
		var banks, sf2Parser = new WebMIDI.soundFontParser.SoundFontParser(uint8Array);

		function createBanks(parser, nRequiredPresets)
		{
			var i, j, k,
			presets, instruments,
			presetName, patchIndex, bankIndex, instrument,
			banks = [], bank, instr;

		    // Gets the preset level info that the parser has found in the phdr, pbag, pMod and pGen chunks
            // This is similar to the getInstrumentBags function (inside the getInstruments function below, but at the preset level.
			function getPresets(parser)
			{
				var i, j,
				preset = parser.presetHeader,
				zone = parser.presetZone,
				output = [],
				bagIndex,
				bagIndexEnd,
				zoneInfo,
				instrument,
				presetGenerator,
				presetModulator;

				// preset -> preset bag -> generator / modulator
				for(i = 0; i < preset.length; ++i)
				{
					bagIndex = preset[i].presetBagIndex;
					bagIndexEnd = preset[i + 1] ? preset[i + 1].presetBagIndex : zone.length;
					zoneInfo = [];

					// preset bag
					for(j = bagIndex; j < bagIndexEnd; ++j)
					{
						presetGenerator = getPresetGenerator_(parser, zone, j);
						presetModulator = getPresetModulator_(parser, zone, j);

						zoneInfo.push({
							generator: presetGenerator.generator,
							generatorSequence: presetGenerator.generatorInfo,
							modulator: presetModulator.modulator,
							modulatorSequence: presetModulator.modulatorInfo
						});

						if(presetGenerator.generator.instrument !== undefined)
						{
							instrument = presetGenerator.generator.instrument.amount;
						}
						else if(presetModulator.modulator.instrument !== undefined)
						{
							instrument = presetGenerator.modulator.instrument.amount;
						}
						else
						{
							instrument = null;
						}
					}

					output.push({
						name: preset[i].presetName,
						info: zoneInfo,
						header: preset[i],
						instrument: instrument
					});
				}

				return output;
			}

			// ji function:
			// This function returns an array containing one array per preset. Each preset array contains
			// a list of instrumentZones. The end of the list is marked by an empty entry.
			function getInstruments(parser)
			{
			    var i = 0, parsersInstrumentBags,
                instrIndex = -1, instruments = [], instrBagIndexString, instrBag, instrBagName;

			    // ji: This is the original gree "creatInstrument()" function, edited to comply with my programming style.
			    //
			    // Useful Definitions:
			    // A Zone has a single sample, and is associated with a contiguous set of MIDI keys.
			    // An instrumentBag is a list of (single-channel) Zones.
			    // The Arachno Grand Piano, for example, has two instrumentBags, each of which contains
			    // the 20 Zones, for two (mono, left and right) channels.
			    // The returned records therefore contain *two* entries for each (stereo) preset zone.
			    // For example: "Grand Piano0        " (left channel) and "GrandPiano1         " (right channel)
			    // for the Grand Piano preset.
			    //
			    // This function returns the instrument level info that the parser has found in the inst, ibag,
			    // iMod and iGen chunks as a list of records (one record per mono Zone -- see definitions above:
			    // {
			    //    name; // instrumentBag name
			    //    info[];
			    // }
			    // where info is a sub-list of records of the form:
			    // {
			    //    generator[],
			    //    generatorSequence[],
			    //    modulator[],
			    //    modulatorSequence[]
			    // }
			    // The generator[] and generatorSequence[] contain the values of the Generator Enumerators
			    // (delayModEnv etc. -- see spec) associated with each Zone in the instrumentBag
			    // The generator entry contains the same information as the generatorSequence entry, except that
			    // the generatorSequence consists of {string, value} objects, while the generator entry has
			    // named subentries: i.e.: The value of generator.decayModEnv is the generatorSequence.value.amount
			    // of the generatorSequence whose generatorSequence.type === "decayModEnv".
			    // Are both generator[] and generatorSequence[] returned because the order of the sequence in
			    // generatorSequence is important, while the values in generator[] are more accessible??
			    // All this is done similarly for modulator and modulatorSequence.
			    function getInstrumentBags(parser)
			    {
			        var i, j,
                    instrument = parser.instrument,
                    zone = parser.instrumentZone,
                    output = [],
                    bagIndex,
                    bagIndexEnd,
                    zoneInfo,
                    instrumentGenerator,
                    instrumentModulator;

			        // instrument -> instrument bag -> generator / modulator
			        for(i = 0; i < instrument.length; ++i)
			        {
			            bagIndex = instrument[i].instrumentBagIndex;
			            bagIndexEnd = instrument[i + 1] ? instrument[i + 1].instrumentBagIndex : zone.length;
			            zoneInfo = [];

			            // instrument bag
			            for(j = bagIndex; j < bagIndexEnd; ++j)
			            {
			                instrumentGenerator = createInstrumentGenerator_(parser, zone, j);
			                instrumentModulator = createInstrumentModulator_(parser, zone, j);

			                zoneInfo.push({
			                    generator: instrumentGenerator.generator,
			                    generatorSequence: instrumentGenerator.generatorInfo,
			                    modulator: instrumentModulator.modulator,
			                    modulatorSequence: instrumentModulator.modulatorInfo
			                });
			            }

			            output.push({
			                name: instrument[i].instrumentName,
			                info: zoneInfo
			            });
			        }

			        return output;
			    }

			    // The parser leaves instrBagName with invisible 0 charCodes beyond the end of the visible string
			    // (instrBagName always has 20 chars in the soundFont file), so the usual .length property does
			    // not work as expected.
			    // This getBagIndexString function takes account of this problem, and returns a
			    // normal string containing the numeric characters visible at the end of the instrBagName.
			    // The returned string can be empty if there are no visible numeric characters
			    // at the end of instrBagName. Numeric characters _inside_ instrBagName are _not_ returned.
			    function getBagIndexString(instrBagName)
			    {
			        var i, char, charCode, rval = "", lastNumCharIndex = -1, lastAlphaCharIndex = -1;

			        // instrBagName is an unusual string... (unicode?)
			        // console.log("instrBagName=", instrBagName);
			        for(i = instrBagName.length - 1; i >= 0; --i)
			        {
			            charCode = instrBagName.charCodeAt(i);
			            // console.log("i=", i, " charCode=", charCode);
			            // ignore trailing 0 charCodes
			            if(charCode !== 0)
			            {
			                if(lastNumCharIndex === -1)
			                {
			                    lastNumCharIndex = i;
			                }
			                if(!(charCode >= 48 && charCode <= 57)) // chars '0' to '9'
			                {
			                    lastAlphaCharIndex = i;
			                    break;
			                }
			            }
			        }

			        if(lastAlphaCharIndex < lastNumCharIndex)
			        {
			            for(i = lastAlphaCharIndex + 1; i <= lastNumCharIndex; ++i)
			            {
			                char = (instrBagName.charCodeAt(i) - 48).toString();
			                // console.log("char=", char);
			                rval = rval.concat(char);
			                // console.log("rval=", rval);
			            }
			        }
			        return rval;
			    }

			    // See comment at top of the getInstrumentBags function.
			    parsersInstrumentBags = getInstrumentBags(parser);
			    // See comment at top of the getInstruments function

				for(i = 0; i < parsersInstrumentBags.length; ++i)
				{
					instrBag = parsersInstrumentBags[i];
					instrBagName = instrBag.name.toString();

					if(i === parsersInstrumentBags.length - 1)
					{
						break;
					}

					instrBagIndexString = getBagIndexString(instrBagName);
					// instrBagIndexString contains only the visible, trailing numeric characters, if any.
					if(instrBagIndexString.length === 0 || parseInt(instrBagIndexString, 10) === 0)
					{
						instrIndex++;
						instruments[instrIndex] = [];
					}
					instruments[instrIndex].push(instrBag);
				}

				return instruments;
			}

		    // Get the preset level info that the parser has found in the phdr, pbag, pMod and pGen chunks
			presets = getPresets(parser);

		    // Get the instrument level info that the parser has found in the inst, ibag, iMod and iGen chunks
            // Each instrument now contains an array containing its instrumenBags (stereo).
			instruments = getInstruments(parser);

			// the final entry in presets is 'EOP'
			if(nRequiredPresets !== (presets.length - 1))
			{
				throw "Error: the expected number of presets does not match the number of presets in the sf2 file.";
			}

			for(i = 0; i < instruments.length; ++i)
			{
				presetName = presets[i].header.presetName;
				patchIndex = presets[i].header.preset;
				bankIndex = presets[i].header.bank;
				instrument = instruments[i];

				if(banks[bankIndex] === undefined)
				{
					banks[bankIndex] = [];
				}
				bank = banks[bankIndex];
				if(bank[patchIndex] === undefined)
				{
					bank[patchIndex] = [];
				}
				bank[patchIndex].name = presetName;
				for(j = 0; j < instrument.length; ++j)
				{
					instr = instrument[j];
					for(k = 0; k < instr.info.length; ++k)
					{
					    getPresetAmounts(parser.GeneratorEnumeratorTable, instr.info[k].generator, bank[patchIndex]);
					}
				}
				setPresetValues(parser, bank[patchIndex]);
			}

			return banks;
		}

		sf2Parser.parse();

		banks = createBanks(sf2Parser, nRequiredPresets);

		return banks;
	},

	// The SoundFont is constructed asychronously (using XmlHttpRequest).
	// When ready, the callback function is invoked.
	// Note that XMLHttpRequest does not work with local files (localhost:).
	// To make it work, run the app from the web (http:).
	SoundFont = function(soundFontUrl, soundFontName, presetIndices, callback)
	{
		var xhr = new XMLHttpRequest();

		if(!(this instanceof SoundFont))
		{
			return new SoundFont(soundFontUrl, soundFontName, presetIndices, callback);
		}

		function getPresetInfo(presetIndices)
		{
			var i, name, presetIndex, soundFontPresets = [];
			for(i = 0; i < presetIndices.length; ++i)
			{
				presetIndex = presetIndices[i];
				name = WebMIDI.constants.generalMIDIPatchName(presetIndex);
				soundFontPresets.push({ name: name, presetIndex: presetIndex });
			}
			return soundFontPresets;
		}

		function onLoad()
		{
			var arrayBuffer, uint8Array;

			if(xhr.status === 200)
			{
				arrayBuffer = xhr.response;
				if(arrayBuffer)
				{
					uint8Array = new Uint8Array(arrayBuffer);
					banks = getBanks(uint8Array, presetInfo.length);
					callback();
				}
			}
			else
			{
				alert("Error in XMLHttpRequest: status =" + xhr.status);
			}
		}

		name = soundFontName;
		presetInfo = getPresetInfo(presetIndices);

		xhr.open('GET', soundFontUrl);
		xhr.addEventListener('load', onLoad, false);
		xhr.responseType = 'arraybuffer';
		xhr.send();
	},

	API =
	{
		SoundFont: SoundFont // constructor
	};
	// end var

	// Call this function immediately after the SoundFont has been constructed.
	SoundFont.prototype.init = function()
	{
		Object.defineProperty(this, "name", { value: name, writable: false });
		Object.defineProperty(this, "presets", { value: presetInfo, writable: false });
		Object.defineProperty(this, "banks", { value: banks, writable: false });
	};

	return API;

}());

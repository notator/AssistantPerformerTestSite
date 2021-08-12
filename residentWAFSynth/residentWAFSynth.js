/* Copyright 2020 James Ingram, Sergey Surikov
 * https://james-ingram-act-two.de/
 * https://github.com/surikov
 *  
 * This code has been developed from the code for my original ResidentSf2Synth:
 * https://github.com/notator/WebMIDISynthHost/residentSf2Synth/residentSf2Synth.js.
 * It uses both javascript preset files, cloned from
 * https://surikov.github.io/webaudiofontdata/sound/, and
 * other code that originated in the following repository:
 * https://github.com/surikov/webaudiofont
 * 
 * All the code in this project is covered by an MIT license.
 * https://github.com/surikov/webaudiofont/blob/master/LICENSE.md
 * https://github.com/notator/WebMIDISynthHost/blob/master/License.md
 */

/* WebMIDI.residentWAFSynth namespace containing a ResidentWAFSynth constructor.
 * 
 * The original object of creating this code was to be able to discuss and improve the interface.
 * See the discussion at https://github.com/WebAudio/web-midi-api/issues/124
 */

WebMIDI.namespace('residentWAFSynth');

WebMIDI.residentWAFSynth = (function(window)
{
    "use strict";
	let
		banks, // set in synth.setSoundFont
		channelAudioNodes = [], // initialized in synth.open
		channelControls = [], // initialized in synth.open
		tuningGroupIndex = 0, // used by updateChannelTuning() -- set by DataEntry message.

		tuningsFactory = new WebMIDI.tuningsFactory.TuningsFactory(),

		triggerStack,
		triggerStackIndex,
		currentTriggerKey,

		getCurrentTriggerKey = function(triggerStack, triggerStackIndex)
		{
			let triggerKey = undefined;
			for(var i = triggerStackIndex; i <= triggerStack.maxIndex; i++)
			{
				let triggerDef = triggerStack[i];
				if(triggerDef !== undefined)
				{
					triggerKey = triggerDef.triggerKey;
					break;
                }
			}
			return triggerKey;
        },

		// returns a three character string representing the index
		getIndexString = function(index)
		{
			let iString = index.toString();
			while(iString.length < 3)
			{
				iString = "0" + iString;
			}
			return iString;
		},

		// Called by the constructor, which sets this.webAudioFonts to the return value of this function.
		// Creates all the WebAudioFonts defined in "synthConfig/webAudioFontDefs.js",
		// adjusting (=decoding) all the required WebAudioFontPresets.
		getWebAudioFonts = function(audioContext)
		{
			function adjustAllPresetVariables()
			{
				// Adapted from code in Sergey Surikov's WebAudioFontLoader
				function decodeAfterLoading(audioContext, variableName)
				{
					// ji: This function just waits until window[variableName] exists,
					// i.e. until the variable has loaded.
					function waitUntilLoaded(variableName, onLoaded)
					{
						if(window[variableName])
						{
							onLoaded();
						}
						else
						{
							setTimeout(function()
							{
								waitUntilLoaded(variableName, onLoaded);
							}, 111);
						}
					}

					// The presetName parameter has only been added for use in console.log when the preset adjustment is complete.
					function adjustPreset(audioContext, preset, presetName)
					{
						// 13.01.2020, ji: Added presetName and isLastZone arguments for console.log code
						function adjustZone(audioContext, zone, presetName, isLastZone)
						{
							function numValue(aValue, defValue)
							{
								if(typeof aValue === "number")
								{
									return aValue;
								} else
								{
									return defValue;
								}
							}

							// 13.01.2020 -- ji
							// The original preset files used by the ResidentWAFSynth all have a zone.file attribute
							// but neither zone.buffer nor zone.sample attributes. I have therefore deleted the
							// original (Surikov) code for coping with those cases.
							// (This code creates and sets the zone.buffer attribute.)
							if(zone.file)
							{
								// 27.02.2020 -- ji
								// Added this nested condition since this code can now be revisited afer creating zone.buffer.
								if(zone.buffer === undefined)
								{
									// this code sets zone.buffer
									var datalen = zone.file.length;
									var arraybuffer = new ArrayBuffer(datalen);
									var view = new Uint8Array(arraybuffer);
									var decoded = atob(zone.file);
									var b;
									for(let i = 0; i < decoded.length; i++)
									{
										b = decoded.charCodeAt(i);
										view[i] = b;
									}
									// 12.01.2020, ji: Changed to Promise syntax.
									audioContext.decodeAudioData(arraybuffer).then(function(audioBuffer)
									{
										zone.buffer = audioBuffer;
										// 13.01.2020, ji: Added console.log code 
										if(isLastZone === true)
										{
											console.log("adjusted " + presetName);
										}
									});
								}
							}
							else // 13.01.2020 -- ji
							{
								throw "zone.file not found.";
							}
							// The value of zone.delay never changes in Surikov's code (as far as I can see).
							// It is the duration between calling bufferNode.start(...) and the time at which the attack phase begins.
							// For simplicity, it could be deleted.
							zone.delay = 0;
							zone.loopStart = numValue(zone.loopStart, 0);
							zone.loopEnd = numValue(zone.loopEnd, 0);
							zone.coarseTune = numValue(zone.coarseTune, 0);
							zone.fineTune = numValue(zone.fineTune, 0);
							zone.originalPitch = numValue(zone.originalPitch, 6000);
							zone.sampleRate = numValue(zone.sampleRate, 44100);
							// The zone.sustain attribute is defined but never used by Surikov (as far as I can see).
							// zone.sustain = numValue(zone.originalPitch, 0);
						}

						for(let zoneIndex = 0; zoneIndex < preset.zones.length; zoneIndex++)
						{
							let isLastZone = (zoneIndex === (preset.zones.length - 1));
							adjustZone(audioContext, preset.zones[zoneIndex], presetName, isLastZone);
						}
					}

					waitUntilLoaded(variableName, function()
					{
						adjustPreset(audioContext, window[variableName], variableName);
					});
				}

				let webAudioFontDefs = WebMIDI.webAudioFontDefs;
				for(let i = 0; i < webAudioFontDefs.length; i++)
				{
					let presetNamesPerBank = webAudioFontDefs[i].presetNamesPerBank;
					for(let bankIndex = 0; bankIndex < presetNamesPerBank.length; bankIndex++)
					{
						let presetNames = presetNamesPerBank[bankIndex];
						for(var nameIndex = 0; nameIndex < presetNames.length; nameIndex++)
						{
							let variable = presetNames[nameIndex];
							if(variable.includes("_tone_")) // "percussion" presets are decoded belowe.
							{
								decodeAfterLoading(audioContext, variable);
							}
						}
					}
				}

				if(WebMIDI.percussionPresets !== undefined)
				{
					let percussionPresets = WebMIDI.percussionPresets;
					for(let i = 0; i < percussionPresets.length; i++)
					{
						let presetKeys = percussionPresets[i].keys;
						for(let j = 0; j < presetKeys.length; j++)
						{
							let variable = presetKeys[j];
							decodeAfterLoading(audioContext, variable);
						}
					}
				}
			}

			// sets window[<percussionFontName>].zones
			//      each zone.midi to presetIndex
			function getPercussionPresets()
			{
				if(WebMIDI.percussionPresets === undefined)
				{
					return undefined;
				}
				else
				{
					let percussionPresets = [];

					for(var i = 0; i < WebMIDI.percussionPresets.length; i++)
					{
						let zones = [];
						let presetDef = WebMIDI.percussionPresets[i];
						for(var j = 0; j < presetDef.keys.length; j++)
						{
							let keyVariable = presetDef.keys[j],
								keyZone = window[keyVariable].zones[0];

							keyZone.midi = presetDef.presetIndex;
							zones.push(keyZone);
						}
						percussionPresets.push({ name: presetDef.name, zones: zones });
					}
					return percussionPresets;
				}
			}

			function finalizeAllPresetsPerWAFBank(webAudioFontDef, percussionPresets)
			{
				// returns a string of the form "000:000 - " + standardGMPresetName + " (" + soundFontSourceName + ")"
				// where the "000" groups are the bank and preset indices.
				function getPresetOptionName(presetName, bankIndex, presetIndex, isPercussion)
				{
					function getIndex(str, substr, ind)
					{
						let len = str.length, i = -1;
						while(ind-- && i++ < len)
						{
							i = str.indexOf(substr, i);
							if(i < 0) break;
						}
						return i;
					}

					let presetOptionName = "error: illegal presetVariable",
						bankString = getIndexString(bankIndex),
						presetString = getIndexString(presetIndex);

					if(isPercussion === true)
					{
						presetOptionName = bankString + ":" + presetString + " - " + presetName;
					}
					else
					{
						let truncStart = getIndex(presetName, "_", 3) + 1,
							truncEnd = getIndex(presetName, "_", 4);

						if(truncStart > 0 && truncEnd > 0 && truncEnd > truncStart)
						{
							let soundFontSourceName = presetName.slice(truncStart, truncEnd),
								gmName = WebMIDI.constants.generalMIDIPresetName(presetIndex);

							presetOptionName = bankString + ":" + presetString + " - " + gmName + " (" + soundFontSourceName + ")";
						}

					}

					return presetOptionName;
				}

				let allPresetsPerBank = [];

				let presetNamesPerBank = webAudioFontDef.presetNamesPerBank;
				for(let bankIndex = 0; bankIndex < presetNamesPerBank.length; ++bankIndex)
				{
					let bankPresets = [],
						presetNames = presetNamesPerBank[bankIndex];

					for(var nameIndex = 0; nameIndex < presetNames.length; nameIndex++)
					{
						let isPercussion = false,
							presetName = presetNames[nameIndex],
							zones;

						if(window[presetName] === undefined)
						{
							if(percussionPresets !== undefined)
							{
								let percussionPreset = percussionPresets.find(preset => preset.name.localeCompare(presetName) === 0);
								zones = percussionPreset.zones;
								isPercussion = true;
							}
						}
						else
						{
							zones = window[presetName].zones;
						}
						let presetIndex = zones[0].midi,
							presetOptionName = getPresetOptionName(presetName, bankIndex, presetIndex, isPercussion);

						bankPresets.push({ name: presetOptionName, presetIndex: presetIndex, zones: zones });
					}

					allPresetsPerBank.push(bankPresets);
				}

				return allPresetsPerBank;
			}

			function adjustForWAFSynth(webAudioFont)
			{
				function setZonesToMaximumRange(presetName, presetGMIndex, zones)
				{
					let bottomZone = zones[0],
						topZone = zones[zones.length - 1],
						expanded = false;

					if(bottomZone.keyRangeLow !== 0)
					{
						bottomZone.keyRangeLow = 0;
						expanded = true;
					}
					if(topZone.keyRangeHigh !== 127)
					{
						topZone.keyRangeHigh = 127;
						expanded = true;
					}

					if(expanded)
					{
						let gmName = WebMIDI.constants.generalMIDIPresetName(presetGMIndex);
						console.warn("WAFSynth: extended the pitch range of preset " + presetName + " (" + gmName + ").");
					}
				}


				function deleteZoneAHDSRs(zones)
				{
					for(var i = 0; i < zones.length; i++)
					{
						if(! delete zones[i].ahdsr)
						{
							console.warn("Failed to delete preset.ahdsr.");
						}
					}

				}

				function setZoneVEnvData(presetName, presetIndex, zones)
				{
					// envTypes:
					// 0: short envelope (e.g. drum, xylophone, percussion)
					// 1: long envelope (e.g. piano)
					// 2: unending envelope (e.g. wind instrument, organ)
					const PRESET_ENVTYPE = { SHORT: 0, LONG: 1, UNENDING: 2 },
						MAX_DURATION = 300000, // five minutes should be long enough...
						DEFAULT_NOTEOFF_RELEASE_DURATION = 0.2;

					function presetEnvType(isPercussion, presetIndex)
					{
						const shortEnvs = [
							13,
							45, 47,
							55,
							112, 113, 114, 115, 116, 117, 118, 119,
							120, 123, 127
						],
							longEnvs = [
								0, 1, 2, 3, 4, 5, 6, 7,
								8, 9, 10, 11, 12, 14, 15,
								24, 25, 26, 27, 28, 29, 30, 31,
								46,
								32, 33, 34, 35, 36, 37, 38, 39,
								104, 105, 106, 107, 108, 109, 110, 111
							],
							unendingEnvs = [
								16, 17, 18, 19, 20, 21, 22, 23,
								40, 41, 42, 43, 44,
								48, 49, 50, 51, 52, 53, 54,
								56, 57, 58, 59, 60, 61, 62, 63,
								64, 65, 66, 67, 68, 69, 70, 71,
								72, 73, 74, 75, 76, 77, 78, 79,
								80, 81, 82, 83, 84, 85, 86, 87,
								88, 89, 90, 91, 92, 93, 94, 95,
								96, 97, 98, 99, 100, 101, 102, 103,
								121, 122, 124, 125, 126
							];

						if(isPercussion)
						{
							return PRESET_ENVTYPE.SHORT;
						}
						else if(shortEnvs.indexOf(presetIndex) >= 0)
						{
							return PRESET_ENVTYPE.SHORT;
						}
						else if(longEnvs.indexOf(presetIndex) >= 0)
						{
							return PRESET_ENVTYPE.LONG;
						}
						else if(unendingEnvs.indexOf(presetIndex) >= 0)
						{
							return PRESET_ENVTYPE.UNENDING;
						}
						else
						{
							throw "presetIndex not found.";
						}
					}

					function checkDurations(envData)
					{
						// The following restrictions apply because setTimeout(..) uses a millisecond delay parameter:
						// ((envData.envelopeDuration * 1000) <= Number.MAX_VALUE), and
						// ((envData.noteOffReleaseDuration * 1000) + 1000) < Number.MAX_VALUE) -- see noteOff().
						// These should in practice never be a problem, but just in case...
						if(!((envData.envelopeDuration * 1000) <= Number.MAX_VALUE)) // see noteOn() 
						{
							throw "illegal envelopeDuration";
						}

						if(!(((envData.noteOffReleaseDuration * 1000) + 1000) < Number.MAX_VALUE)) // see noteOff()
						{
							throw "illegal noteOffReleaseDuration";
						}
					}

					function setSHORT_vEnvData(zones)
					{
						// Sets attack, hold, decay and release durations for each zone.
						for(var i = 0; i < zones.length; i++)
						{
							let vEnvData = { attack: 0, hold: 0.5, decay: 4.5, release: DEFAULT_NOTEOFF_RELEASE_DURATION }; // Surikov envelope
							vEnvData.envelopeDuration = 5; // zoneVEnvData.attack + zoneVEnvData.hold + zoneVEnvData.decay;
							vEnvData.noteOffReleaseDuration = DEFAULT_NOTEOFF_RELEASE_DURATION; // zoneVEnvData.release;
							zones[i].vEnvData = vEnvData;
						}
						checkDurations(zones[0].vEnvData);
					}

					function setLONG_vEnvData(presetName, presetIndex, zones)
					{
						// Sets attack, hold, decay and release durations for each zone.
						// The duration values are set to increase logarithmically per pitchIndex
						// from the ..Low value at pitchIndex 0 to the ..High value at pitchIndex 127.
						// The values per zone are then related to the pitchIndex of zone.keyRangeLow,
						function setCustomLONGEnvData(zones, aLow, aHigh, hLow, hHigh, dLow, dHigh, rLow, rHigh)
						{
							let aFactor = (aHigh === 0 || aLow === 0) ? 1 : Math.pow(aHigh / aLow, 1 / 127),
								hFactor = (hHigh === 0 || hLow === 0) ? 1 : Math.pow(hHigh / hLow, 1 / 127),
								dFactor = (dHigh === 0 || dLow === 0) ? 1 : Math.pow(dHigh / dLow, 1 / 127),
								rFactor = (rHigh === 0 || rLow === 0) ? 1 : Math.pow(rHigh / rLow, 1 / 127);

							for(var i = 0; i < zones.length; i++)
							{
								let zone = zones[i],
									keyLow = zone.keyRangeLow,
									a = aLow * Math.pow(aFactor, keyLow),
									h = hLow * Math.pow(hFactor, keyLow),
									d = dLow * Math.pow(dFactor, keyLow),
									r = rLow * Math.pow(rFactor, keyLow);

								let vEnvData = { attack: a, hold: h, decay: d, release: r };
								vEnvData.envelopeDuration = a + h + d; // zoneVEnvData.attack + zoneVEnvData.hold + zoneVEnvData.decay;
								vEnvData.noteOffReleaseDuration = r; // zoneVEnvData.release;
								checkDurations(vEnvData);
								zone.vEnvData = vEnvData;
							}
						}

						// The following presetIndices have LONG envelopes:
						// 0, 1, 2, 3, 4, 5, 6, 7,
						// 8, 9, 10, 11, 12, 14, 15,
						// 24, 25, 26, 27, 28, 29, 30, 31,
						// 32, 33, 34, 35, 36, 37, 38, 39,
						// 46 (Harp)
						// 104, 105, 106, 107, 108, 109, 110, 111
						//
						// 02.2020: Except for Harpsichord, the following presetIndices
						// are all those used by the AssistantPerformer(GrandPiano + Study2)
						switch(presetIndex)
						{
							case 0: // Grand Piano						
								setCustomLONGEnvData(zones, 0, 0, 0, 0, 25, 5, 1, 0.5);
								break;
							case 6: // Harpsichord -- not used by AssistantPerformer 02.2020
								setCustomLONGEnvData(zones, 0, 0, 0, 0, 15, 1, 0.5, 0.1);
								break;
							case 8: // Celesta
								setCustomLONGEnvData(zones, 0, 0, 0, 0, 8, 4, 0.5, 0.1);
								break;
							case 9: // Glockenspiel
								setCustomLONGEnvData(zones, 0, 0, 0.002, 0.002, 6, 1.5, 0.4, 0.1);
								break;
							case 10: // MusicBox
								setCustomLONGEnvData(zones, 0, 0, 0, 0, 8, 0.5, 0.5, 0.1);
								break;
							case 11: // Vibraphone
								setCustomLONGEnvData(zones, 0, 0, 0.4, 0.4, 10, 3, 0.5, 0.1);
								break;
							case 12: // Marimba
								setCustomLONGEnvData(zones, 0, 0, 0, 0, 9.5, 0.6, 0.5, 0.1);
								break;
							//case 13: // Xylophone -- used by AssistantPerformer, but does not have a LONG envelope.
							//	break;
							case 14: // Tubular Bells
								setCustomLONGEnvData(zones, 0, 0, 0.5, 0.5, 20, 5, 0.5, 0.1);
								break;
							case 15: // Dulcimer
								setCustomLONGEnvData(zones, 0, 0, 0.5, 0.5, 10, 0.4, 0.4, 0.04);
								break;
							case 24: // NylonGuitar
								setCustomLONGEnvData(zones, 0, 0, 0.5, 0.5, 7, 0.3, 0.3, 0.05);
								break;
							case 25: // AcousticGuitar (steel)
								setCustomLONGEnvData(zones, 0, 0, 0.5, 0.5, 7, 0.3, 0.3, 0.05);
								break;
							case 26: // ElectricGuitar (Jazz)
								setCustomLONGEnvData(zones, 0, 0, 0.5, 0.5, 7, 0.3, 0.3, 0.05);
								break;
							case 27: // ElectricGuitar (clean)
								setCustomLONGEnvData(zones, 0, 0, 0.5, 0.5, 7, 0.3, 0.3, 0.05);
								break;
							case 46: // Harp
								setCustomLONGEnvData(zones, 0, 0, 0.5, 0.5, 10, 0.4, 0.4, 0.04);
								break;
							default:
								console.warn("Volume envelope data has not been defined for preset " + presetIndex.toString() + " (" + presetName + ").");
						}
					}

					function setUNENDING_vEnvData(zones)
					{
						// Sets attack, hold, decay and release durations for each zone.
						for(var i = 0; i < zones.length; i++)
						{
							let vEnvData = { attack: 0, hold: MAX_DURATION, decay: 0, release: DEFAULT_NOTEOFF_RELEASE_DURATION }; // Surikov envelope
							vEnvData.envelopeDuration = MAX_DURATION; // zoneVEnvData.attack + zoneVEnvData.hold + zoneVEnvData.decay;
							vEnvData.noteOffReleaseDuration = DEFAULT_NOTEOFF_RELEASE_DURATION; // zoneVEnvData.release;
							zones[i].vEnvData = vEnvData;
						}
						checkDurations(zones[0].vEnvData);
					}

					let isPercussion = presetName.includes("percussion"),
						envType = presetEnvType(isPercussion, zones[0].midi);

					// envTypes:
					// 0: short envelope (e.g. drum, xylophone, percussion)
					// 1: long envelope (e.g. piano)
					// 2: unending envelope (e.g. wind instrument, organ)
					switch(envType)
					{
						case PRESET_ENVTYPE.SHORT:
							setSHORT_vEnvData(zones);
							break;
						case PRESET_ENVTYPE.LONG:
							setLONG_vEnvData(presetName, presetIndex, zones);
							break;
						case PRESET_ENVTYPE.UNENDING:
							setUNENDING_vEnvData(zones);
							break;
					}
				}

				let banks = webAudioFont.banks;

				for(var i = 0; i < banks.length; i++)
				{
					let presets = banks[i];
					for(var j = 0; j < presets.length; j++)
					{
						let preset = presets[j],
							presetName = preset.name,
							presetGMIndex = preset.presetIndex,
							zones = preset.zones;

						setZonesToMaximumRange(presetName, presetGMIndex, zones);
						// The residentWAFSynth is going to use the zone.vEnvData attributes
						//(which are set below) instead of the original zone.ahdsr attributes.
						// The zone.ahdsr attributes are deleted here to avoid confusion.
						deleteZoneAHDSRs(zones);
						setZoneVEnvData(presetName, presetGMIndex, zones);
					}
				}

				return webAudioFont;
			}

			// See: https://stackoverflow.com/questions/758688/sleep-in-javascript-delay-between-actions
			function sleepUntilAllFontsAreReady(webAudioFonts)
			{
				function sleep(ms)
				{
					return new Promise(res => setTimeout(res, ms));
				}

				async function waitUntilWebAudioFontIsReady(webAudioFont)
				{
					while(!webAudioFont.isReady())
					{
						console.log('Sleeping');
						await sleep(100);
						console.log('Done sleeping');
					}
				}

				for(var i = 0; i < webAudioFonts.length; i++)
				{
					let webAudioFont = webAudioFonts[i];
					if(webAudioFont.isReady() === false)
					{
						waitUntilWebAudioFontIsReady(webAudioFont);
					}
				}
			}

			let webAudioFontDefs = WebMIDI.webAudioFontDefs, // defined in webAudioFonts/webAudioFonts.js
				webAudioFonts = [],
				percussionPresets = getPercussionPresets(); // undefined if there are no percussion presets

			adjustAllPresetVariables();

			for(let wafIndex = 0; wafIndex < webAudioFontDefs.length; ++wafIndex)
			{
				let webAudioFontDef = webAudioFontDefs[wafIndex],
					name = webAudioFontDef.name,
					allPresetsPerBank = finalizeAllPresetsPerWAFBank(webAudioFontDef, percussionPresets),
					presetNamesPerBank = webAudioFontDef.presetNamesPerBank,
					webAudioFont = new WebMIDI.webAudioFont.WebAudioFont(name, allPresetsPerBank, presetNamesPerBank);

				// The webAudioFont's zone.file attributes need not have been completely adjusted (=unpacked) when
				// this function is called since neither the zone.file nor the binary zone.buffer attributes are accessed.
				let adjustedWebAudioFont = adjustForWAFSynth(webAudioFont);

				webAudioFonts.push(adjustedWebAudioFont);
			}

			sleepUntilAllFontsAreReady(webAudioFonts);

			return webAudioFonts;
		},

		getDefaultTuning = function()
		{
			let defaultTuning = []; // standard MIDI (i.e. equal temperament) tuning
			defaultTuning.name = "Equal Temperament (default)";
			for(var key = 0; key < 128; key++)
			{
				defaultTuning.push(key);
			}

			return defaultTuning;
		},

		getTuningGroups = function()
		{
			let tuningGroupDefs = WebMIDI.tuningDefs,
				tuningGroups = [],
				wmgc = WebMIDI.gamutConstructors;

			if(tuningGroupDefs === undefined || tuningGroupDefs.length === 0)
			{
				// default tuning
				let tuningGroup = [],
					gamut = tuningsFactory.getEqualTemperamentGamut();

				gamut.name = "Equal Temperament";
				tuningGroup.push(gamut);
				tuningGroups.push(tuningGroup);
			}
			else
			{
				for(var i = 0; i < tuningGroupDefs.length; i++)
				{
					let tuningGroupDef = tuningGroupDefs[i],
						tuningDefs = tuningGroupDef.tunings,
						tuningGroup = [];

					tuningGroup.name = tuningGroupDef.name;

					switch(tuningGroupDef.ctor)
					{
						case wmgc.FUNCTION_GET_GAMUT_FROM_CONSTANT_FACTOR:
							{
								for(let k = 0; k < tuningDefs.length; k++)
								{
									let tuningDef = tuningDefs[k],
										rootIndex = tuningDef.rootIndex,
										factor = tuningDef.factor,
										gamut = tuningsFactory.getGamutFromConstantFactor(rootIndex, factor);

									gamut.name = tuningDef.name;
									tuningGroup.push(gamut);
								}
								break;
							}
						case wmgc.FUNCTION_GET_PARTCH_GAMUT:
							{
								for(let k = 0; k < tuningDefs.length; k++)
								{
									let tuningDef = tuningDefs[k],
										rootIndex = tuningDef.rootIndex,
										gamut = tuningsFactory.getPartchGamut(rootIndex);

									gamut.name = tuningDef.name;
									tuningGroup.push(gamut);
								}
								break;
							}
						case wmgc.FUNCTION_GET_REPEATING_WARPED_OCTAVES_GAMUT:
							{
								for(let k = 0; k < tuningDefs.length; k++)
								{
									let tuningDef = tuningDefs[k],
										keyValuesArray = tuningDef.keyValuesArray,
										gamut = tuningsFactory.getRepeatingWarpedOctavesGamut(keyValuesArray);

									gamut.name = tuningDef.name;
									tuningGroup.push(gamut);
								}
								break;
							}
						case wmgc.FUNCTION_GET_FREE_KEYBOARD_GAMUT:
							{
								for(let k = 0; k < tuningDefs.length; k++)
								{
									let tuningDef = tuningDefs[k],
										keyValuesArray = tuningDef.keyValuesArray,
										gamut = tuningsFactory.getFreeKeyboardGamut(keyValuesArray);

									gamut.name = tuningDef.name;
									tuningGroup.push(gamut);
								}
								break;
							}
						default:
							console.assert(false, "Unknown tuning type.");
					}

					tuningGroups.push(tuningGroup);
				}
			}

			return tuningGroups;
		},

		getMixtures = function()
		{
			// There can be at most 256 [keyIncrement, velocityFactor] components.
			// KeyIncrement components must be integers in range [-127..127].
			// VelocityFactor components are usually floats > 0 and < 1, but can be <= 100.0.
			function checkMixtures(mixtures)
			{
				let nIncrVels = 0;
				for(var i = 0; i < mixtures.length; i++)
				{
					let mixture = mixtures[i];
					for(var k = 0; k < mixture.length; k++)
					{
						let keyVel = mixture[k],
							keyIncr = keyVel[0],
							velFac = keyVel[1];

						console.assert(keyVel.length === 2);
						console.assert(Number.isInteger(keyIncr) && keyIncr >= -127 && keyIncr <= 127);
						console.assert(velFac > 0 && velFac <= 100.0);

						nIncrVels++;
					}
				}

				console.assert(nIncrVels <= 256);
			}

			let mixtures = [];

			if(WebMIDI.mixtureDefs !== undefined)
			{
				mixtures = WebMIDI.mixtureDefs;
				checkMixtures(mixtures);
			}

			return mixtures; // can be empty
		},

		getPresetMixtures = function(that)
		{
			function checkPresetMixtureDefs(webAudioFonts, mixtures, presetMixtureDefs)
			{
				for(var i = 0; i < presetMixtureDefs.length; i++)
				{
					let pmd = presetMixtureDefs[i];

					console.assert(pmd.webAudioFontIndex !== undefined && pmd.webAudioFontIndex < webAudioFonts.length);
					let banks = webAudioFonts[pmd.webAudioFontIndex].banks;
					console.assert(pmd.basePresetBankIndex !== undefined && pmd.basePresetBankIndex < banks.length);
					console.assert(pmd.basePresetIndex !== undefined);
					let preset = banks[pmd.basePresetBankIndex].find(x => x.presetIndex === pmd.basePresetIndex);
					console.assert(preset !== undefined);
					console.assert(pmd.mixtureIndex !== undefined && pmd.mixtureIndex < mixtures.length);
				}
			}

			function getMixtureName(oldName, mixtureIndex)
			{
				let mixString = ":" + getIndexString(mixtureIndex),
					newName = oldName.slice(0, 7) + mixString + oldName.slice(7) + " mix";

				return newName;
			}

			let webAudioFonts = that.webAudioFonts,
				mixtures = that.mixtures,
				presetMixtureDefs = WebMIDI.presetMixtureDefs,
				presetMixtures = [];

			if(mixtures !== undefined && mixtures.length > 0 && presetMixtureDefs !== undefined && presetMixtureDefs.length > 0)
			{
				checkPresetMixtureDefs(webAudioFonts, mixtures, presetMixtureDefs);

				for(var i = 0; i < presetMixtureDefs.length; i++)
				{
					let pmd = presetMixtureDefs[i],
						banks = webAudioFonts[pmd.webAudioFontIndex].banks,
						bank = banks[pmd.basePresetBankIndex],
						basePreset = bank.find(x => x.presetIndex === pmd.basePresetIndex),
						presetMixture = {};

					presetMixture.name = getMixtureName(basePreset.name, pmd.mixtureIndex);
					presetMixture.bankIndex = basePreset.bankIndex;
					presetMixture.presetIndex = basePreset.presetIndex;
					presetMixture.mixtureIndex = pmd.mixtureIndex;

					presetMixtures.push(presetMixture);
				}
			}

			return presetMixtures; // can be empty
		},

		getTriggerStacks = function()
		{
			function checkTriggerStacks(triggerStacks)
			{
				for(var i = 0; i < triggerStacks.length; i++)
				{
					let triggerType = WebMIDI.triggerType,
						triggerDefs = triggerStacks[i].triggerDefs,
						triggerDefsLength = triggerDefs.length;
					console.assert(triggerDefsLength > 0);
					for(var k = 0; k < triggerDefsLength; k++)
					{
						let triggerDef = triggerDefs[k],
							name = triggerDef.name,
							key = triggerDef.key,
							fireOnHitNumber = triggerDef.fireOnHitNumber,
							result = triggerDef.result;

						console.assert((typeof name === "string") && name.length > 0);
						console.assert(Number.isInteger(key) && key >= 0 && key <= 127);
						console.assert(Number.isInteger(fireOnHitNumber) && fireOnHitNumber > 0);
						console.assert(Array.isArray(result) && result.length > 0 && result.length <= 3);

						let presetExists = false,
							tuningExists = false,
							tuningOverlayExists = false;
						for(var m = 0; m < result.length; m++)
						{
							let type = result[m].type;

							console.assert(type === triggerType.TRIGGER_TYPE_PRESET
								|| type === triggerType.TRIGGER_TYPE_TUNING
								|| type === triggerType.TRIGGER_TYPE_TUNING_OVERLAY);

							if(type === triggerType.TRIGGER_TYPE_PRESET)
							{
								console.assert(presetExists === false);
								presetExists = true;
							}
							else if(type === triggerType.TRIGGER_TYPE_TUNING)
							{
								// If it exists, tuningOverlay must come after tuning.
								console.assert(tuningExists === false);
								console.assert(tuningOverlayExists === false);
								tuningExists = true;
							}
							else if(type === triggerType.TRIGGER_TYPE_TUNING_OVERLAY)
							{
								console.assert(tuningOverlayExists === false);
								tuningOverlayExists = true;
							}
						}
					}
				}
			}

			let triggerStacks = [];

			if(WebMIDI.triggerStackDefs !== undefined)
			{
				triggerStacks = WebMIDI.triggerStackDefs;
				checkTriggerStacks(triggerStacks);
            }

			return triggerStacks;
        },

        // This command resets the pitchWheel and all CC controllers to their default values,
        // but does *not* reset the current bank or preset.
        // CMD.AFTERTOUCH is set to its default value (= no aftertouch) per note, when each note is created. 
		// (CMD.CHANNEL_PRESSURE should also be reset here if/when it is implemented.) 
        setCCDefaults = function(that, channel)
        {
            let controlDefaultValue = WebMIDI.constants.controlDefaultValue;

			that.registeredParameterCoarse(channel, controlDefaultValue(CTL.REGISTERED_PARAMETER_COARSE));

			that.updateReverberation(channel, controlDefaultValue(CTL.REVERBERATION));
			that.updateModWheel(channel, controlDefaultValue(CTL.MODWHEEL));
			that.updateVolume(channel, controlDefaultValue(CTL.VOLUME));
            that.updatePan(channel, controlDefaultValue(CTL.PAN));
        },

		CMD = WebMIDI.constants.COMMAND,
		CTL = WebMIDI.constants.CONTROL,

		// The commands and controls arrays are part of a standard WebMIDI synth's interface.
		commands =
			[
				CMD.NOTE_OFF,
				CMD.NOTE_ON,
				CMD.AFTERTOUCH,
				CMD.CONTROL_CHANGE,
				CMD.PRESET,
				//CMD.CHANNEL_PRESSURE,
				// It is very unlikely that this synth will ever need to implement CHANNEL_PRESSURE, so
                // CHANNEL_PRESSURE has been eliminated from the ResidentWAFSynthHost development environment.
				CMD.PITCHWHEEL
				//CMD.SYSEX
				// This synth does not use any SysEx commands
			],

		controls =
			[
				// standard 3-byte controllers.

				// The WebMIDISynthHost GUI manages banks using the preset selector, so it does not provide a separate banks
				// control in the controls section of its GUI.
				// ResidentWAFSynth.prototype.send(message, ignoredTimestamp) _does_, however, use the
				// WebMIDI.constants.CONTROL.BANK definition to call setBank(channel, data2) via handleControl(channel, data1, data2).
				// The bank can be set by other applications by sending the appropriate message.
				CTL.BANK,
				CTL.MODWHEEL,
				CTL.VOLUME,
				CTL.PAN,
				CTL.REVERBERATION,

				// CTL.REGISTERED_PARAMETER_COARSE is set by this synthesizer to its defaultValue 0.
				// This synth prevents it being set to any other value (an exception is thrown if such an attempt is made),
				// so the WebMidiSynthHost does not provide a control for it in the controls section of its GUI.
				CTL.REGISTERED_PARAMETER_COARSE,
				CTL.DATA_ENTRY_COARSE,

				// standard 2-byte controllers.
				CTL.ALL_CONTROLLERS_OFF,
				CTL.ALL_SOUND_OFF
			],

		ResidentWAFSynth = function()
		{
			if(!(this instanceof ResidentWAFSynth))
			{
				return new ResidentWAFSynth();
			}

			// WebMIDIAPI §4.6 -- MIDIPort interface
			// See https://github.com/notator/WebMIDISynthHost/issues/23
			// and https://github.com/notator/WebMIDISynthHost/issues/24
			Object.defineProperty(this, "id", { value: "ResidentWAFSynth_v1", writable: false });
			Object.defineProperty(this, "manufacturer", { value: "james ingram (with thanks to sergey surikov)", writable: false });
			Object.defineProperty(this, "name", { value: "ResidentWAFSynth", writable: false });
			Object.defineProperty(this, "type", { value: "output", writable: false });
			Object.defineProperty(this, "version", { value: "1", writable: false });
			Object.defineProperty(this, "ondisconnect", { value: null, writable: false }); // Do we need this at all? Is it correct to set it to null?

			/*** Is this necessary? See https://github.com/WebAudio/web-midi-api/issues/110 ***/
			/*** See also: disconnect() function below ***/
			Object.defineProperty(this, "removable", { value: true, writable: false });

			/*** Extensions for software synths ***/
			// The synth author's webpage hosting the synth. 
			Object.defineProperty(this, "url", { value: "https://github.com/notator/WebMIDISynthHost", writable: false });
			// The commands supported by this synth (see above).
			Object.defineProperty(this, "commands", { value: commands, writable: false });
			// The controls supported by this synth (see above).
			Object.defineProperty(this, "controls", { value: controls, writable: false });
			// If isMultiChannel is false or undefined, the synth ignores the channel nibble in MIDI messages
			Object.defineProperty(this, "isMultiChannel", { value: true, writable: false });
			// If isPolyphonic is false or undefined, the synth can only play one note at a time
			Object.defineProperty(this, "isPolyphonic", { value: true, writable: false });
			// If supportsGeneralMIDI is defined, and is true, then
			// 1. both COMMAND.PRESET and CONTROL.BANK MUST be defined.
			// 2. the presets can be usefully named using GM preset names.
			//    (GM preset names are returned by WebMIDI.constants.generalMIDIPresetName(presetIndex). )
			// 3. in a percussion font, notes can be usefully named using the GM percussion names.
			//    (GM percussion names are returned by WebMIDI.constants.generalMIDIPercussionName(noteIndex). )
			// 4. the synth MAY define the function:
			//        void setSoundFont(soundFont)
			//    It is possible for a synth to support GM without using soundfonts.
			// 5. Clients should be sure that a preset is available before setting it.
			//    Whichever way it is set, the banks variable will contain all available banks and presets.
			Object.defineProperty(this, "supportsGeneralMIDI", { value: true, writable: false });

			/**********************************************************************************************/
			// attributes specific to this ResidentWAFSynth
			let AudioContextFunc = (window.AudioContext || window.webkitAudioContext); 
			Object.defineProperty(this, "audioContext", { value: new AudioContextFunc(), writable: false });
			Object.defineProperty(this, "webAudioFonts", { value: getWebAudioFonts(this.audioContext), writable: false });
			Object.defineProperty(this, "defaultTuning", { value: getDefaultTuning(), writable: false });
			Object.defineProperty(this, "tuningGroups", { value: getTuningGroups(), writable: false });
			Object.defineProperty(this, "mixtures", { value: getMixtures(), writable: false }); // can be empty
			Object.defineProperty(this, "presetMixtures", { value: getPresetMixtures(this), writable: false }); // can be empty
			Object.defineProperty(this, "triggerStacks", { value: getTriggerStacks(), writable: false }); // can be empty
		},

		API =
		{
			ResidentWAFSynth: ResidentWAFSynth // constructor
		};
	// end var

	// WebMIDIAPI §4.6 -- MIDIPort interface
	// See https://github.com/notator/WebMIDISynthHost/issues/24
	// This is called after user interaction with the page.
	ResidentWAFSynth.prototype.open = function()
    {
        function audioNodesConfig(audioContext, finalGainNode)
        {
            // Create and connect the channel AudioNodes:
			let channelInfo = {};			
			
			channelInfo.panNode = audioContext.createStereoPanner();
			channelInfo.reverberator = new WebMIDI.wafReverberator.WAFReverberator(audioContext);				
			channelInfo.gainNode = audioContext.createGain();
			channelInfo.inputNode = channelInfo.panNode;

			channelInfo.panNode.connect(channelInfo.reverberator.input);
			channelInfo.reverberator.output.connect(channelInfo.gainNode);
			channelInfo.gainNode.connect(finalGainNode);

            return channelInfo;
		}

        function initialControlsState(defaultTuning)
        {
            let constants = WebMIDI.constants,
                CTL = constants.CONTROL,
                controlDefaultValue = constants.controlDefaultValue,
                controlState = {};

            controlState.bankIndex = -1; // These are set to the first preset in a font, when the font is loaded
			controlState.presetIndex = -1;

			controlState.tuning = [...defaultTuning]; // shallow clone of the default tuning (without name, bankIndex or presetIndex attributes)

			controlState.pitchWheel = constants.commandDefaultValue(CMD.PITCHWHEEL);
			controlState.pitchWheel14Bit = 0;
			controlState.pitchWheelSensitivity = 2;

			controlState.registeredParameterCoarse = controlDefaultValue(CTL.REGISTERED_PARAMETER_COARSE);
			 
			controlState.modWheel = controlDefaultValue(CTL.MODWHEEL);
            controlState.volume = controlDefaultValue(CTL.VOLUME);
            controlState.pan = controlDefaultValue(CTL.PAN);
            controlState.reverberation = controlDefaultValue(CTL.REVERBERATION);

			controlState.currentNoteOns = [];			

            return controlState;
        }

		let audioContext = this.audioContext; 

		audioContext.resume().then(() => { console.log('AudioContext resumed successfully'); });

        channelAudioNodes.finalGainNode = audioContext.createGain();
        channelAudioNodes.finalGainNode.connect(audioContext.destination);

		for(var i = 0; i < 16; i++)
		{
			channelAudioNodes.push(audioNodesConfig(audioContext, channelAudioNodes.finalGainNode));
			channelControls.push(initialControlsState(this.defaultTuning));
		}
		console.log("residentWAFSynth opened.");
	};

	// WebMIDIAPI §4.6 -- MIDIPort interface
	// See https://github.com/notator/WebMIDISynthHost/issues/24
	ResidentWAFSynth.prototype.close = function()
    {
        if(channelAudioNodes.length > 0)
        {
            for(var i = 0; i < 16; i++)
            {
                channelAudioNodes[i].panNode.disconnect();
                channelAudioNodes[i].reverberator.disconnect();
                channelAudioNodes[i].gainNode.disconnect();
            }
            channelAudioNodes.finalGainNode.disconnect();
            channelAudioNodes.length = 0;
            console.log("residentWAFSynth closed.");
        }
	};

	// WebMIDIAPI MIDIOutput send()
	// This synth does not yet support timestamps (05.11.2015)
	ResidentWAFSynth.prototype.send = function(message, ignoredTimestamp)
	{
		var
			command = message[0] & 0xF0,
			channel = message[0] & 0xF,
			data1 = message[1],
			data2 = message[2],
			that = this;

		function checkCommandExport(checkCommand)
		{
			if(checkCommand === undefined)
			{
                console.warn("Illegal command");
			}
			else
			{
				let cmd = commands.find(cmd => cmd === checkCommand);
				if(cmd === undefined)
				{
					console.warn("Command " + checkCommand.toString(10) + " (0x" + checkCommand.toString(16) + ") is not supported.");
				}
			}
		}
		function handleNoteOff(channel, data1, data2)
		{
			checkCommandExport(CMD.NOTE_OFF);
			// console.log("residentWAFSynth NoteOff: channel:" + channel + " note:" + data1 + " velocity:" + data2);
			that.noteOff(channel, data1, data2);
		}
		function handleNoteOn(channel, data1, data2)
		{
			checkCommandExport(CMD.NOTE_ON);
			// console.log("residentWAFSynth NoteOn: channel:" + channel + " note:" + data1 + " velocity:" + data2);
            if(data2 === 0)
            {
                that.noteOff(channel, data1, 100);
            }
            else
            {
                that.noteOn(channel, data1, data2);
            }
		}
		// The AFTERTOUCH command can be sent from the ResidentWAFSynthHost's GUI and, potentially,
		// from the AssistantPerformer, but it is never sent from my EMU keyboard.
		// It is implemented as a (single note) pitch bend parallel to the normal (channel) pitchWheel.
		function handleAftertouch(channel, key, value)
		{
			checkCommandExport(CMD.AFTERTOUCH);
			//console.log("residentWAFSynth Aftertouch: channel:" + channel + " key:" + key + " value:" + value);
			that.updateAftertouch(channel, key, value);
        }
		function handleControl(channel, data1, data2)
		{
			function checkControlExport(control)
			{
				if(control === undefined)
				{
                    console.warn("Illegal control");
				}
				else
				{
					let ctl = controls.find(ctl => ctl === control);
					if(ctl === undefined)
					{
                        console.warn("Controller " + control.toString(10) + " (0x" + control.toString(16) + ") is not supported.");
					}
				}
			}
			function setBank(channel, value)
			{
				// The exported controls are the ones that appear in the GUI.
				// There should be no bank control in the list of this synths visible controls, so 
				// checkControlExport(CTL.BANK) is not called here.
                channelControls[channel].bankIndex = value; // this is the complete implementation!

				// console.log("residentWAFSynth Bank: channel:" + channel + " value:" + value);
			}
			function setModwheel(channel, value)
			{
				checkControlExport(CTL.MODWHEEL);
				// console.log("residentWAFSynth ModWheel: channel:" + channel + " value:" + value);
				that.updateModWheel(channel, value);
			}
			function setVolume(channel, value)
			{
				checkControlExport(CTL.VOLUME);
				// console.log("residentWAFSynth Volume: channel:" + channel + " value:" + value);
				that.updateVolume(channel, value);
			}
			function setPan(channel, value)
			{
				checkControlExport(CTL.PAN);
				// console.log("residentWAFSynth Pan: channel:" + channel + " value:" + value);
				that.updatePan(channel, value);
			}

			function setReverberation(channel, value)
			{
				checkControlExport(CTL.REVERBERATION);
				// console.log("residentWAFSynth Reverberation: channel:" + channel + " value:" + value);
				that.updateReverberation(channel, value);
			}

			function allControllersOff(channel)
			{
				checkControlExport(CTL.ALL_CONTROLLERS_OFF);
				// console.log("residentWAFSynth AllControllersOff: channel:" + channel);
				that.allControllersOff(channel);
			}
			function setAllSoundOff(channel)
			{
				checkControlExport(CTL.ALL_SOUND_OFF);
				// console.log("residentWAFSynth AllSoundOff: channel:" + channel);
				that.allSoundOff(channel);
			}

			// This function must always be called immediately before calling setDataEntryCoarse(...).
			function setRegisteredParameterCoarse(channel, value)
			{
				checkControlExport(CTL.REGISTERED_PARAMETER_COARSE);
				// console.log("residentWAFSynth RegisteredParameterCoarse: channel:" + channel + " value:" + value);
				that.registeredParameterCoarse(channel, value);
			}
			// setRegisteredParameterCoarse(...) must always be called immediately before calling this function.
			function setDataEntryCoarse(channel, value)
			{
				checkControlExport(CTL.DATA_ENTRY_COARSE);
				// console.log("residentWAFSynth DataEntryCoarse: channel:" + channel + " value:" + semitones);
				that.dataEntryCoarse(channel, value);
			}

			checkCommandExport(CMD.CONTROL_CHANGE);

			switch(data1)
			{
				case CTL.BANK: // N.B. This is implemented for send, but is not an independent control in the WebMIDISynthHost's GUI
					setBank(channel, data2);
					break;
				case CTL.MODWHEEL:
					setModwheel(channel, data2);
					break;
				case CTL.VOLUME:
					setVolume(channel, data2);
					break;
				case CTL.PAN:
					setPan(channel, data2);
					break;
				case CTL.REVERBERATION:
					setReverberation(channel, data2);
					break;
				case CTL.ALL_CONTROLLERS_OFF:
					allControllersOff(channel);
					break;
				case CTL.ALL_SOUND_OFF:
					setAllSoundOff(channel);
					break;
				// CTL.REGISTERED_PARAMETER_FINE and CTL.DATA_ENTRY_FINE are not supported (i.e. are ignored by) this synth.
				case CTL.REGISTERED_PARAMETER_COARSE:
					setRegisteredParameterCoarse(channel, data2);
					break;
				// CTL.REGISTERED_PARAMETER_COARSE is always set immediately before setting CTL.DATA_ENTRY_COARSE.
				case CTL.DATA_ENTRY_COARSE:
					setDataEntryCoarse(channel, data2);
					break;

				default:
                    console.warn(`Controller ${data1.toString(10)} (0x${data1.toString(16)}) is not supported.`);
			}
		}
		function handlePreset(channel, data1)
		{
			checkCommandExport(CMD.PRESET);
			// console.log("residentWAFSynth Preset: channel:" + channel, " value:" + data1);
			that.updatePreset(channel, data1);
		}
		// The CHANNEL_PRESSURE command can be sent from my EMU keyboard, but is never sent from the ResidentWAFSynthHost GUI.
		// It could be implemented later, to do something different from the other controls.
		function handleChannelPressure(channel, data1)
		{
			//let warnMessage = "Channel pressure: channel:" + channel + " pressure:" + data1 +
			//	" (The ResidentWAFSynth does not implement the channelPressure (0x" + CMD.CHANNEL_PRESSURE.toString(16) + ") command.)";
			//console.warn(warnMessage);
		}
		function handlePitchWheel(channel, data1, data2)
		{
			checkCommandExport(CMD.PITCHWHEEL);
			//console.log("residentWAFSynth PitchWheel: channel:" + channel + " data1:" + data1 + " data2:" + data2);
			that.updatePitchWheel(channel, data1, data2);
		}

		switch(command)
		{
			case CMD.NOTE_OFF:
				handleNoteOff(channel, data1, data2);
				break;
			case CMD.NOTE_ON:
				handleNoteOn(channel, data1, data2);
				break;
			case CMD.AFTERTOUCH:
				handleAftertouch(channel, data1, data2);
				break;
			case CMD.CONTROL_CHANGE:
				handleControl(channel, data1, data2);
				break;
			case CMD.PRESET:
				handlePreset(channel, data1);
				break;
			case CMD.CHANNEL_PRESSURE:
				handleChannelPressure(channel, data1);
				break;
			case CMD.PITCHWHEEL:
				handlePitchWheel(channel, data1, data2);
				break;
			default:
				console.assert(false, "Illegal command.");
				break;
		}
    };

	// Used to reset the GUI controls when changing channels
    ResidentWAFSynth.prototype.channelControlsState = function(channel)
    {
        let controlsInfo = channelControls[channel],
            state = [];

        state.push({ cmdIndex: CMD.PRESET, cmdValue: controlsInfo.presetIndex });
		state.push({ cmdIndex: CMD.PITCHWHEEL, cmdValue: controlsInfo.pitchWheel });

		state.push({ ccIndex: CTL.BANK, ccValue: controlsInfo.bankIndex });
		state.push({ ccIndex: CTL.MODWHEEL, ccValue: controlsInfo.modWheel });
        state.push({ ccIndex: CTL.VOLUME, ccValue: controlsInfo.volume });
        state.push({ ccIndex: CTL.PAN, ccValue: controlsInfo.pan });
		state.push({ ccIndex: CTL.REVERBERATION, ccValue: controlsInfo.reverberation });
		// Repeat the following two lines for each registered parameter
		state.push({ ccIndex: CTL.REGISTERED_PARAMETER_COARSE, ccValue: 0 }); // 0 is pitchWheelSensitivity
		state.push({ ccIndex: CTL.DATA_ENTRY_COARSE, ccValue: controlsInfo.pitchWheelSensitivity });

        return state;
    };

	ResidentWAFSynth.prototype.setSoundFont = function(webAudioFont)
    {
		if(!webAudioFont.isReady())
		{
			throw "This function should not be called before the webAudioFont is ready!";
		}

		banks = [];
		for(var i = 0; i < webAudioFont.banks.length; i++)
		{
			let wafBank = webAudioFont.banks[i],
				bank = [];

			for(var j = 0; j < wafBank.length; j++)	
			{
				let preset = wafBank[j];
				bank[preset.presetIndex] = preset;
			}
			banks.push(bank);
        }

        let defaultBankIndex = 0,
			defaultPresetIndex = webAudioFont.banks[0][0].presetIndex,
			defaultMixtureIndex = undefined; // = no mixture
        
		for(let i = 0; i < 16; ++i)
        {
            // set default bank and preset.
            // N.B. In the ResidentWAFSynthHost application, the bank and preset defaults are
            // overridden so that each channel is given its own preset when the app initializes.
			this.setPresetInChannel(i, defaultBankIndex, defaultPresetIndex, defaultMixtureIndex);
			setCCDefaults(this, i);
        }

		console.log("residentWAFSynth WebAudioFont set.");
	};

	// see close() above...
	ResidentWAFSynth.prototype.disconnect = function()
	{
		throw "Not implemented error.";
	};

	ResidentWAFSynth.prototype.setPresetTrigger = function(message)
	{
		let channel = message[5],
			chanControls = channelControls[channel];

		chanControls.pushPresetKey = message[6];
		chanControls.pushBankIndex = message[7];
		chanControls.pushPresetIndex = message[8];
		chanControls.pushMixtureIndex = message[9];
	};

	ResidentWAFSynth.prototype.setTuningTrigger = function(message)
	{
		let channel = message[5],
			chanControls = channelControls[channel];

		chanControls.pushTuningKey = message[6];
		chanControls.pushTuningBankIndex = message[7];
		chanControls.pushTuningPresetIndex = message[8];
	};

	ResidentWAFSynth.prototype.setTriggerStack = function(triggerDefs)
	{
		if(triggerDefs === undefined)
		{
			triggerStack = undefined;
			return;
		}

		triggerStack = [];
		triggerStackIndex = 0;

		let hitIndex = -1;
        for(var i = 0; i < triggerDefs.length; i++)
		{
			let trigger = triggerDefs[i];

			hitIndex += trigger.fireOnHitNumber;
			triggerStack[hitIndex] = trigger.result;
			triggerStack[hitIndex].triggerKey = trigger.key;
			triggerStack.maxIndex = hitIndex;
		}

		currentTriggerKey = getCurrentTriggerKey(triggerStack, triggerStackIndex);
	};

	// The bank argument is in range [0..127].
	ResidentWAFSynth.prototype.updateBank = function(channel, bankIndex)
	{
        channelControls[channel].bankIndex = bankIndex;
	};
	// N.B. the presetIndex argument is the General MIDI presetIndex
	ResidentWAFSynth.prototype.updatePreset = function(channel, presetIndex)
	{
		channelControls[channel].presetIndex = presetIndex;
	};
	ResidentWAFSynth.prototype.setPresetInChannel = function(channel, bankIndex, presetIndex, mixtureIndex)
	{
		channelControls[channel].bankIndex = bankIndex;
		channelControls[channel].presetIndex = presetIndex;
		channelControls[channel].mixtureIndex = mixtureIndex;
	};
	ResidentWAFSynth.prototype.setTuningInChannel = function(channel, tuningGroupIndex, tuningIndex)
	{
		channelControls[channel].tuning = [...this.tuningGroups[tuningGroupIndex][tuningIndex]];
	};

	ResidentWAFSynth.prototype.updateAftertouch = function(channel, key, value)
	{
		let currentNoteOns = channelControls[channel].currentNoteOns,
			noteIndex = currentNoteOns.findIndex(obj => obj.keyPitch === key),
			aftertouch14Bit = "undefined"; // will be set in range -8192..8191;

		if(noteIndex !== undefined)
		{
			if(value <= 64)
			{
				aftertouch14Bit = (128 * (value - 64)); // valueRange(0..64): -> range: 128*-64 (= -8192) .. 0
			}
			else
			{
				aftertouch14Bit = Math.floor((8191 / 63) * (value - 64)); // valueRange(65..127): -> range: 127..8191
            }
			
			currentNoteOns[noteIndex].updateAftertouch(aftertouch14Bit);
		}

		console.log("updateAftertouch() key: " + key + " value:" + value + " aftertouch14Bit=" + aftertouch14Bit);
	};

	ResidentWAFSynth.prototype.updatePitchWheel = function(channel, data1, data2)
	{
		var pitchWheel14Bit = (((data2 & 0x7f) << 7) | (data1 & 0x7f)) - 8192,
			currentNoteOns = channelControls[channel].currentNoteOns;

		// data2 is the MSB, data1 is LSB.
		console.log("updatePitchWheel() data1: " + data1 + " data2:" + data2 + " pitchWheel14Bit=" + pitchWheel14Bit + " (should be in range -8192..+8191)");

		if(currentNoteOns !== undefined && currentNoteOns.length > 0)
		{
			let nNoteOns = currentNoteOns.length;
			for(let i = 0; i < nNoteOns; ++i)
			{
				currentNoteOns[i].updatePitchWheel(pitchWheel14Bit);
			}
		}

		channelControls[channel].pitchWheel14Bit = pitchWheel14Bit; // for new noteOns
		channelControls[channel].pitchWheel = data2; // for GUI
	};
	// The value argument is in range [0..127], meaning not modulated to as modulated as possible.
	// The frequency of the modMode depends on the frequency of the note...
	ResidentWAFSynth.prototype.updateModWheel = function(channel, value)
	{
		console.log("ResidentWAFSynth: ModWheel channel:" + channel + " value:" + value );

		channelControls[channel].modWheel = value;

		if(channelAudioNodes[channel].modNode === undefined)
		{
			if(value > 0)
			{
				let modNode = this.audioContext.createOscillator(),
					modGainNode = this.audioContext.createGain();

				modNode.type = 'sine';
				modNode.connect(modGainNode);
				modGainNode.connect(channelAudioNodes[channel].gainNode.gain);
				modNode.start();

				channelAudioNodes[channel].modNode = modNode;
				channelAudioNodes[channel].modGainNode = modGainNode;
			}
		}
		else
		{
			if(value === 0)
			{
				channelAudioNodes[channel].modNode.stop();
				channelAudioNodes[channel].modNode = undefined;
				channelAudioNodes[channel].modGainNode = undefined;
			}
			else
			{
				let currentNoteOns = channelControls[channel].currentNoteOns;
				if(currentNoteOns !== undefined && currentNoteOns.length > 0)
				{
					let nNoteOns = currentNoteOns.length;
					for(let i = 0; i < nNoteOns; ++i)
					{
						currentNoteOns[i].updateModWheel(channelAudioNodes[channel].modNode, channelAudioNodes[channel].modGainNode, value);
					}
				}
            }
		}		
	};
	// The volume argument is in range [0..127], meaning muted to as loud as possible.
	ResidentWAFSynth.prototype.updateVolume = function(channel, volume)
	{
		let volumeFactor = volume / 127;
		channelAudioNodes[channel].gainNode.gain.setValueAtTime(volumeFactor, this.audioContext.currentTime);
		channelControls[channel].volume = volume;
	};
	// The pan argument is in range [0..127], meaning completely left to completely right.
	ResidentWAFSynth.prototype.updatePan = function(channel, pan)
	{
		let panValue = ((pan / 127) * 2) - 1; // panValue is in range [-1..1]
        channelAudioNodes[channel].panNode.pan.setValueAtTime(panValue, this.audioContext.currentTime);
        channelControls[channel].pan = pan;
	};
	// The reverberation argument is in range [0..127], meaning completely dry to completely wet.
	ResidentWAFSynth.prototype.updateReverberation = function(channel, reverberation)
	{
		channelAudioNodes[channel].reverberator.setValueAtTime(reverberation, this.audioContext.currentTime);
		channelControls[channel].reverberation = reverberation;
	};

	// This function must always be called immediately before calling ResidentWAFSynth.prototype.dataEntryCoarse(...)
	ResidentWAFSynth.prototype.registeredParameterCoarse = function(channel, value)
	{
		channelControls[channel].registeredParameterCoarse = value;
	};
	// ResidentWAFSynth.prototype.registeredParameterCoarse must always be called immediately before calling this function.
	ResidentWAFSynth.prototype.dataEntryCoarse = function(channel, value)
	{
		function updatePitchWheelSensitivity(controls, semitones)
		{
			controls.pitchWheelSensitivity = semitones; // required for GUI

			let currentNoteOns = controls.currentNoteOns;
			if(currentNoteOns !== undefined && currentNoteOns.length > 0) // required for sounding notes
			{
				let pitchWheel14Bit = controls.pitchWheel14Bit,
					nNoteOns = currentNoteOns.length;

				for(let i = 0; i < nNoteOns; ++i)
				{
					currentNoteOns[i].pitchWheelSensitivity = semitones;
					currentNoteOns[i].updatePitchWheel(pitchWheel14Bit);
				}
			}
		}

		// The channel.tuning is set to a shallow clone of a tuning stored in the synth.
		// Its important that the tunings stored in the synth are never changed, and that they can be used
		// to reset the channel.tuning at any time.
		function updateChannelTuning(that, channel, tuningGroupIndex, tuningIndex)
		{
			let chanControls = channelControls[channel];
			if(that.tuningGroups[tuningGroupIndex] !== undefined && that.tuningGroups[tuningGroupIndex][tuningIndex] !== undefined)
			{
				chanControls.tuning = [...that.tuningGroups[tuningGroupIndex][tuningIndex]];
			}
			else
			{
				chanControls.tuning = [...that.defaultTuning];
            }
		}

		let control = WebMIDI.constants.CONTROL;

		switch(channelControls[channel].registeredParameterCoarse)
		{
			case control.INGRAM_REGPARAM_SET_PITCHWHEEL_SENSITIVITY:
				let semitones = value;
				updatePitchWheelSensitivity(channelControls[channel], semitones);
				break;
			case control.INGRAM_REGPARAM_SELECT_TUNING_PRESET:
				let tuningIndex = value;
				updateChannelTuning(this, channel, tuningGroupIndex, tuningIndex);
				break;
			case control.INGRAM_REGPARAM_SELECT_TUNING_BANK:
				tuningGroupIndex = value;
				break;
			default:
				console.assert(false, "Unknown registered parameter.");
				break;
        }
	};

	ResidentWAFSynth.prototype.allControllersOff = function(channel)
	{
		var currentNoteOns = channelControls[channel].currentNoteOns;

		while(currentNoteOns.length > 0)
		{
			this.noteOff(channel, currentNoteOns[0].keyPitch, 0);
		}

		setCCDefaults(this, channel);
	};

	ResidentWAFSynth.prototype.allSoundOff = function(channel)
	{
		var currentNoteOns = channelControls[channel].currentNoteOns;

		while(currentNoteOns.length > 0)
		{
			this.noteOff(channel, currentNoteOns[0].keyPitch, 0);
		}
	};

	ResidentWAFSynth.prototype.noteOn = function(channel, key, velocity)
	{
		function doNoteOn(midi)
		{
			let zone, note,
				preset = midi.preset,
				keyPitchBase = Math.floor(midi.keyPitch),
				keyPitchBaseStr, bankIndexStr, presetIndexStr, channelStr;

			zone = preset.zones.find(obj => (obj.keyRangeHigh >= keyPitchBase && obj.keyRangeLow <= keyPitchBase));
			if(!zone)
			{
				bankIndexStr = chanControls.bankIndex.toString(10);
				presetIndexStr = (chanControls.presetIndex).toString(10);
				channelStr = channel.toString(10);
				keyPitchBaseStr = keyPitchBase.toString(10);
				let warnString = "zone not found: bank=" + bankIndexStr + " presetIndex=" + presetIndexStr + " channel=" + channelStr + " key=" + keyPitchBaseStr;
				if(preset.name.includes("percussion"))
				{
					warnString += "\nThis is a percussion preset containing the following instrument indices:";
					for(var i = 0; i < preset.zones.length; i++)
					{
						warnString += " " + preset.zones[i].keyRangeLow.toString() + ",";
					}
					warnString = warnString.slice(0, -1);
				}
				console.warn(warnString);
				return;
			}

			let noteGainNode = audioContext.createGain();
			noteGainNode.connect(channelAudioNodes[channel].inputNode);

			// note on
			note = new WebMIDI.residentWAFSynthNote.ResidentWAFSynthNote(audioContext, noteGainNode, zone, midi, chanControls, channelAudioNodes[channel]);
			note.noteOn();
			chanControls.currentNoteOns.push(note);
		}

		let audioContext = this.audioContext,
			chanControls = channelControls[channel],
			bank,
			preset,
			midi = {};

		if(triggerStack !== undefined && key === currentTriggerKey)
		{
			let triggerResult = triggerStack[triggerStackIndex];
			if(triggerResult !== undefined)
			{
				let tt = WebMIDI.triggerType;

				for(var i = 0; i < triggerResult.length; i++)
				{
					let result = triggerResult[i];
					switch(result.type)
					{
						case tt.TRIGGER_TYPE_PRESET:
							chanControls.bankIndex = result.presetBankIndex;
							chanControls.presetIndex = result.presetIndex;
							chanControls.mixtureIndex = result.mixtureIndex;
							break;
						case tt.TRIGGER_TYPE_TUNING:
							chanControls.tuning = [...this.tuningGroups[result.tuningGroupIndex][result.tuningIndex]];
							break;
						case tt.TRIGGER_TYPE_TUNING_OVERLAY:
							let tuning = chanControls.tuning,
								gamutSeg = tuningsFactory.getGamutSegment(result.overlayDef),
								startIndex = gamutSeg.rootKey,
								endIndex = startIndex + gamutSeg.length;
							for(let overrideKey = startIndex; overrideKey < endIndex; overrideKey++)
							{
								tuning[overrideKey] = gamutSeg[overrideKey - startIndex];
							}
							break;
					}
				}
			}
			triggerStackIndex++;
			if(triggerStackIndex > triggerStack.maxIndex)
			{
				triggerStack = undefined;
			}
			else
			{
				currentTriggerKey = getCurrentTriggerKey(triggerStack, triggerStackIndex);
			}
		}

		bank = banks[chanControls.bankIndex];
		preset = bank[chanControls.presetIndex];

		console.assert(bank !== undefined);
		console.assert(preset !== undefined);

		if(velocity === 0)
		{
			let currentNoteOns = chanControls.currentNoteOns;
			let note = currentNoteOns.find(note => note.keyPitch === key);
			if(note !== undefined)
			{
				note.noteOff();
			}
			return;
		}

		midi.preset = preset;
		midi.offKey = key; // the note stops when the offKey's noteOff arrives
		midi.keyPitch = chanControls.tuning[key];
		midi.velocity = velocity;

		doNoteOn(midi);

		if(chanControls.mixtureIndex !== undefined)
		{
			console.assert(chanControls.mixtureIndex < this.mixtures.length);

			let mixture = this.mixtures[chanControls.mixtureIndex];
			for(var i = 0; i < mixture.length; i++)
			{
				let keyVel = mixture[i],
					newKey = key + keyVel[0],
					newVelocity = Math.floor(velocity * keyVel[1]);

				newKey = (newKey > 127) ? 127 : newKey;
				newKey = (newKey < 0) ? 0 : newKey;
				newVelocity = (newVelocity > 127) ? 127 : newVelocity;
				newVelocity = (newVelocity < 1) ? 1 : newVelocity;

				// midi.preset is unchanged
				midi.offKey = key; // the key that turns this note off (unchanged in mix)
				midi.keyPitch = chanControls.tuning[newKey];
				midi.velocity = newVelocity;
				
				doNoteOn(midi);
			}
        }
	};

	ResidentWAFSynth.prototype.noteOff = function(channel, key, unusedVelocity)
	{
		let currentNoteOns = channelControls[channel].currentNoteOns;
		
		for(var index = currentNoteOns.length - 1; index >= 0; index--)
		{
			if(currentNoteOns[index].offKey === key)
			{
				currentNoteOns[index].noteOff();
				currentNoteOns.splice(index, 1);
            }
		}
	};

	return API;

}(window));

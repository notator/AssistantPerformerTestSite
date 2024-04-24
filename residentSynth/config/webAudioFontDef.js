console.log('load webAudioFontDef.js');

// This webAudioFontDef contains an array of banks containing the instrument presets.
// Each bank should be given a descriptive name.
// Presets are given names automatically, using their source and General MIDI name.
// (The sources used here are either FluidR3 or GeneralUserGS. The GeneralMIDI name is found
// using the original presetIndex -- the number part of Surikov's file name.)
// The MIDI BANK control message sets the current bank using its index in this array.
// The MIDI PRESET command message will set the preset using the index in the bank's presets array.

var ResSynth = ResSynth || {};

ResSynth.webAudioFontDef =
    [
        // A single Bank containing presets at their original standard MIDI locations.
        {
            name: "Assistant Performer",
            presets:
                [
                    // Study 1, Pianola Music etc.
                    "_tone_0000_FluidR3_GM_sf2_file", // instr: 0, piano -- old presetIndex:0
                    , , , , , , ,	                  // instr: 1,2,3,4,5,6,7, -- undefined 
                    // The rest are used in Study 2 and Study 3
                    "_tone_0080_FluidR3_GM_sf2_file", // instr: 8,  celesta      -- old presetIndex:8,  
                    "_tone_0090_FluidR3_GM_sf2_file", // instr: 9,  glockenspiel -- old presetIndex:9,  
                    "_tone_0100_FluidR3_GM_sf2_file", // instr: 10,  musicBox     -- old presetIndex:10, 
                    "_tone_0110_FluidR3_GM_sf2_file", // instr: 11,  vibraphone   -- old presetIndex:11, 
                    "_tone_0120_FluidR3_GM_sf2_file", // instr: 12,  marimba      -- old presetIndex:12, 
                    "_tone_0130_FluidR3_GM_sf2_file", // instr: 13,  xylophone    -- old presetIndex:13, 
                    "_tone_0140_FluidR3_GM_sf2_file", // instr: 14,  tubularBells -- old presetIndex:14, 
                    "_tone_0150_FluidR3_GM_sf2_file", // instr: 15,  dulcimer     -- old presetIndex:15,
                    , , , , , , , ,	                  // instr: 16,17,18,19,20,21,22,23, -- undefined
                    "_tone_0240_FluidR3_GM_sf2_file", // instr: 24,  nylonGuitar  -- old presetIndex:24, 
                    "_tone_0250_FluidR3_GM_sf2_file", // instr: 25,  steelGuitar  -- old presetIndex:25, 
                    "_tone_0260_FluidR3_GM_sf2_file", // instr: 26, electricGuitarJazz  -- old presetIndex:26, 
                    "_tone_0270_FluidR3_GM_sf2_file", // instr: 27, electricGuitarClean -- old presetIndex:27,
                    ,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,, // instr: 28-71  -- undefined 
                    "_tone_0720_FluidR3_GM_sf2_file",  // instr: 72, piccolo     -- old presetIndex:72,
                    ,,,,,                              // instr: 73,74,75,76,77,  -- undefined
                    "_tone_0780_FluidR3_GM_sf2_file",  // instr: 78, whistle   -- old presetIndex:78,
                    "_tone_0790_FluidR3_GM_sf2_file",  // instr: 79, ocarina      -- old presetIndex:79,
                    ,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,  // instr: 80-112           -- undefined 
                    "_tone_1130_FluidR3_GM_sf2_file",  // instr: 113, agogo   -- old presetIndex:113,
                    ,                                  // instr: 114              -- undefined 
                    "_tone_1150_FluidR3_GM_sf2_file",  // instr: 115, woodblock   -- old presetIndex:115,
                    ,                                  // instr: 116              -- undefined
                    "_tone_1170_FluidR3_GM_sf2_file",  // instr: 117, melodic tom  -- old presetIndex:117,
                    "_tone_1180_FluidR3_GM_sf2_file"   // instr: 118, synth drum -- old presetIndex:118,
                ]
        }
    ];

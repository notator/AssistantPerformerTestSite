/* Copyright 2020 James Ingram
 * https://james-ingram-act-two.de
 * 
 * All the code in this project is covered by an MIT license.
 * https://github.com/surikov/webaudiofont/blob/master/LICENSE.md
 * https://github.com/notator/WebMIDISynthHost/blob/master/License.md
 */

/* WebMIDI.tuningsFactory namespace containing a TuningsFactory constructor. */

WebMIDI.namespace('tuningsFactory');

WebMIDI.tuningsFactory = (function()
{
    "use strict";
    let
        checkArrayParameters = function(keyValuesArray)
        {
            console.assert(Array.isArray(keyValuesArray) && keyValuesArray.length > 1);
            for(var i = 0; i < keyValuesArray.length; i++)
            {
                let keyValuePair = keyValuesArray[i];
                console.assert(Array.isArray(keyValuePair));
                console.assert(keyValuePair.length === 2);
                console.assert(Number.isInteger(keyValuePair[0]) && (!Number.isNaN(keyValuePair[1])));
            }
        },

        checkLongKeyValueParameters = function (keyValuesArray)
        {
            checkArrayParameters(keyValuesArray); // keyValuesArray.length > 1

            console.assert((0 <= keyValuesArray[0][0] && keyValuesArray[0][0] < 128) && (0.0 <= keyValuesArray[0][1] && keyValuesArray[0][1] < 128.0));

            let previousKey = keyValuesArray[0][0],
                previousValue = keyValuesArray[0][1];
            for(var i = 1; i < keyValuesArray.length; i++)
            {
                let key = keyValuesArray[i][0],
                    value = keyValuesArray[i][1];

                console.assert(Number.isInteger(key) && (!(Number.isNaN(value))));
                console.assert((0 <= key && key < 128) && (0.0 <= value && value < 128.0));
                console.assert(previousKey >= 0 && key > previousKey);
                console.assert(previousValue >= 0.0 && value > previousValue);
                previousKey = key;
                previousValue = value;
            }
        },

        // A gamut is an array of 128 floating point numbers (indexed 0..127) each of which is >= 0 and < 128,
        // representing the number of (floating point) semitones above MIDI C0 for each MIDI key (=index).
        // This format is called 'MidiCent' format: <midiVal>.<cents>, where
        //     <midiVal> is in range 0..127, and
        //     <cents> is truncated to 4 significant figures by this function to avoid insignificant rounding errors.
        // Values are always greater than their predecessor in the gamut, except at the beginning and end of the gamut.
        // At the beginning and end of the gamut, values may repeat.
        finalizeGamut = function(gamut)
        {
            console.assert(gamut.length === 128);

            // truncate the values to avoid insignificant rounding errors below
            for(let i = 0; i < gamut.length; i++)
            {
                gamut[i] = Math.floor(gamut[i] * 10000) / 10000;
            }

            // now check for errors
            for(var key = 0; key < 128; key++)
            {
                console.assert(gamut[key] >= 0.0 && gamut[key] < 128.0);
            }
            let i = 1;
            while(i < 128 && gamut[i - 1] === gamut[i])
            {
                i++;
            }
            while(i < 128 && gamut[i - 1] !== gamut[i])
            {
                console.assert(gamut[i] > gamut[i - 1]);
                i++;
            }
            while(i < 128)
            {
                console.assert(gamut[i] === gamut[i - 1]);
                i++;
            }
        },

        // rootMidiCents must be >= 0 && < 12
        // factors must be an array containing 128 floating point numbers in ascending order.
        // The rootKey of the returned gamut is set to Math.round(rootMidiCents).
        // (The rootMidiCents frequency is allocated to the rootKey)
        getGamutUsingFactors = function(rootMidiCents, factors)
        {
            // Converts a frequency in Hertz to a MidiCent value
            function frequencyToMidiCents(frequency)
            {
                const etFactor = Math.pow(2.0, 1.0 / 12);

                let midi0frequency = WebMIDI.constants.MIDI_0_FREQUENCY,
                    midiCentsKeyValue,
                    midiETFreq;

                for(var key = 0; key < 128; key++)
                {
                    let etFreq = midi0frequency * Math.pow(etFactor, key);
                    if(etFreq <= frequency)
                    {
                        midiCentsKeyValue = key;
                        midiETFreq = etFreq;
                    }
                    else
                    {
                        break;
                    }
                }

                let centsDiff = 1200 * Math.log2(frequency / midiETFreq),
                    midiCents;

                console.assert(centsDiff >= 0);

                midiCents = midiCentsKeyValue + (centsDiff / 100);

                return midiCents;
            }

            console.assert(rootMidiCents >= 0 && rootMidiCents < 12);
            console.assert(factors.length === 128);
            for(var i = 1; i < 128; i++)
            {
                console.assert(factors[i] >= factors[i - 1]);
            }

            let rootKey = Math.round(rootMidiCents); // note that rootKey can be 12

            let gamut = [];
            for(var midiKey = 0; midiKey < rootKey; midiKey++)
            {
                gamut.push(rootMidiCents);
            }


            let midi0frequency = WebMIDI.constants.MIDI_0_FREQUENCY,
                nRemainingFactors = factors.length - rootKey;
            for(var factorIndex = 0; factorIndex < nRemainingFactors; factorIndex++)
            {
                var frequency = factors[factorIndex] * midi0frequency,
                    midiCents = frequencyToMidiCents(frequency);

                gamut.push(midiCents + rootMidiCents);
            }

            finalizeGamut(gamut);

            return gamut;
        },

        // This function is called by both getRepeatingOctavesGamut() and getNonRepeatingGamut().
        // The argument array contains only the significant key-value pairs for the returned gamut. 
        getGamutFromKeyValuesArray = function(keyValuesArray)
        {
            let rGamut = [];

            for(let i = 0; i < keyValuesArray[0][0]; i++)
            {
                rGamut.push(keyValuesArray[0][1]);
            }
            let gamutSegment = getGamutSegment(keyValuesArray);
            for(let i = 0; i < gamutSegment.length; i++)
            {
                rGamut.push(gamutSegment[i]);
            }
            while(rGamut.length < 128)
            {
                rGamut.push(keyValuesArray[keyValuesArray.length - 1][1]);
            }

            finalizeGamut(rGamut);

            return rGamut;
        },

        // Returns a gamutSegment, calculated from the keyValuesArray, having a .rootKey attribute that determines the key for the first value.
        // A gamutSegment is a contiguous array of increasing MidiCent values, one per key in range.
        // The keyValuesArray is an array containing only the [key,pitch] arrays that define fixed points in the (warped) gamut.
        // The returned values do not exceed the range of the values in the keyValuesArray argument.
        // The returned values have been interpolated (per key) between those in the keyValuesArray argument.
        getGamutSegment = function(keyValuesArray)
        {
            checkLongKeyValueParameters(keyValuesArray);

            let gamutSegment = [];

            gamutSegment.rootKey = keyValuesArray[0][0];

            gamutSegment.push(keyValuesArray[0][1]);
            for(var j = 1; j < keyValuesArray.length; j++)
            {
                let prevValue = keyValuesArray[j - 1][1],
                    nKeys = keyValuesArray[j][0] - keyValuesArray[j - 1][0],
                    vIncr = ((keyValuesArray[j][1] - keyValuesArray[j - 1][1]) / nKeys);
                for(var k = 0; k < nKeys; k++)
                {
                    let value = prevValue + vIncr;
                    gamutSegment.push(value);
                    prevValue = value;
                }
            }

            return gamutSegment;

        },

		TuningsFactory = function()
		{
			if(!(this instanceof TuningsFactory))
			{
				return new TuningsFactory();
            }
		},

		API =
		{
            TuningsFactory: TuningsFactory // constructor
        };

	// end let

    // Returns a new gamut by shifting the argument gamut up or down
    // so that midiKey points at the nearest midiCentValue.
    // The highest or lowest values in the gamut are shifted in as necessary. 
    TuningsFactory.prototype.getAlignedGamut = function(gamut, midiKey)
    {
        let currentNearestIndex = 0,
            diff = Number.MAX_VALUE;

        for(var i = 0; i < 128; i++)
        {
            let newDiff = Math.abs(midiKey - gamut[i]);
            if(diff > newDiff)
            {
                diff = newDiff;
                currentNearestIndex = i;
            }
            else
            {
                break;
            }
        }

        let returnGamut = [],
            shift = midiKey - currentNearestIndex;

        if(shift < 0) // shift the gamut down
        {
            shift *= -1;
            for(var i = shift; i < 128; i++)
            {
                returnGamut.push(gamut[i]);
            }
            let hiMidiCents = gamut[gamut.length - 1];
            while(returnGamut.length < 128)
            {
                returnGamut.push(hiMidiCents);
            }
        }
        else if(shift > 0) // shift the gamut up
        {
            let loMidiCents = gamut[0];
            while(returnGamut.length < shift)
            {
                returnGamut.push(loMidiCents);
            }
            let remainingValues = 128 - shift;
            for(var i = 0; i < remainingValues; i++)
            {
                returnGamut.push(gamut[i]);
            }
        }
        else // copy the gamut in place
        {
            for(var i = 0; i < gamut.length; i++)
            {
                returnGamut.push(gamut[i]);
            }

        }

        finalizeGamut(returnGamut);

        return returnGamut;
    };

    // Returns a 128-note gamut containing values equal to the index in the gamut.
    TuningsFactory.prototype.getEqualTemperamentGamut = function()
    {
        let etGamut = [];

        for(var i = 0; i < 128; i++)
        {
            etGamut.push(i);
        }

        finalizeGamut(etGamut);

        return etGamut;
    };

    // Returns a 128-note gamut (containing octave tunings) tuned according to Harry Partch's scale.
    // The rootKey (to which rootMidiCents is allocated) is rootMidiCents rounded to the nearest integer.
    // rootMidiCents must be >= 0 && < 12
    // Keys below the rootKey are allocated rootMidiCents values.
    TuningsFactory.prototype.getPartchGamut = function(rootMidiCents)
    {
        function getPartchFactors()
        {
            const partchFundamentals = [
                1.0 / 1,
                16.0 / 15,
                9.0 / 8,
                6.0 / 5,
                5.0 / 4,
                4.0 / 3,
                7.0 / 5,
                3.0 / 2,
                8.0 / 5,
                5.0 / 3,
                16.0 / 9,
                15.0 / 8
            ];

            let factors = [];
            for(var octave = 0; octave < 11; octave++)
            {
                for(var y = 0; y < 12; ++y)
                {
                    if(octave === 10 && y > 7)
                    {
                        break;
                    }
                    factors.push(partchFundamentals[y] * Math.pow(2, octave));
                }
            }
            return factors;
        }

        let factors = getPartchFactors(),
            partchGamut = getGamutUsingFactors(rootMidiCents, factors); // checks partchGamut

        return partchGamut;
    };

    // Returns a 128-note gamut containing octave tunings.
    // Argument restrictions:
    //     rootMidiCents must be a floating point number >= 0.0 and < 12.0
    //     factorBase is a floating point number > 1 and !== a power of 2.
    // The rootMidiCents frequency is allocated to the closest rootKey (= Math.round(rootMidiCents)).
    // Keys are numbered, according to the MIDI convention:
    //     C = 0, C# = 1, D = 2, D# = 3, E = 4, F = 5, F# = 6, G = 7, G# = 8, A = 9, A# = 10, B = 11.
    // with their respective octave transpositions:
    //     C0 = 12, C1 = 24, C2 = 36, C3 = 48, C4 = 60, C5 = 72, C6 = 84, C7 = 96, C8 = 108, C9 = 120
    TuningsFactory.prototype.getGamutFromConstantFactor = function(rootMidiCents, factorBase)
    {
        function getFactors(factorBase)
        {
            let factors = [];

            for(var i = 0; i < 7; i++)
            {
                let factor = Math.pow(factorBase, i);
                while(!(factor < 2))
                {
                    factor /= 2;
                }
                factors.push(factor);
                if(i !== 0)
                {
                    factor = 1 / factor;
                    factors.push(factor);
                }
            }

            factors.length -= 1;

            factors.sort();

            // rotate the factors until factor[0] is the rootFactor (=1)
            while(factors[0] < 1)
            {
                let fac = factors[0] * 2;
                factors.splice(0, 1);
                factors.push(fac);
            }

            factors.sort();

            for(var octave = 1; octave < 11; octave++)
            {
                for(var y = 0; y < 12; ++y)
                {
                    if(octave === 10 && y > 7)
                    {
                        break;
                    }
                    factors.push(factors[y] * Math.pow(2, (octave)));
                }
            }

            return factors;

        }

        while(!(factorBase < 2))
        {
            factorBase /= 2;
        }
        console.assert(factorBase > 1);
        console.assert(0.0 <= rootMidiCents && rootMidiCents < 12.0);

        let factors = getFactors(factorBase),
            gamut = getGamutUsingFactors(rootMidiCents, factors); // checks gamut

        return gamut;
    };

    // Returns a new 128-note gamut containing octave tunings.
    // The keyValuesArray is an array of arrays, each of which contains a [key, value] pair.
    // There must be more than 1 [key, value] array in the keyValuesArray.
    // Both the keys and tha values must be strictly in ascending order in the keyValuesArray.
    // The keys must be integers.
    // The values are floating point (Midi.Cent above C0).
    // Both key and value values must:
    //     1. have a span that is less than an octave
    //     2. be unique
    //     3. be in ascending order.
    // Key-values below the lowest defined key (=keyValuesArray[0][0]) are set to keyValuesArray[0][1].
    // Key-value pairs for the lowest octave of the gamut are created by interpolation.
    // Higher octaves are created by adding octave transpositions.
    TuningsFactory.prototype.getRepeatingWarpedOctavesGamut = function(keyValuesArray)
    {
        function checkParameters(keyValuesArray)
        {
            checkArrayParameters(keyValuesArray); // keyValuesArray.length > 1

            let lowKey = keyValuesArray[0][0],
                highKeyLimit = lowKey + 12,
                lowValue = keyValuesArray[0][1],
                highValueLimit = lowValue + 12;

            console.assert((0 <= lowKey && lowKey < 12) && (0.0 <= lowValue && lowValue < 12.0));

            let previousKey = keyValuesArray[0][0],
                previousValue = keyValuesArray[0][1];
            for(var i = 1; i < keyValuesArray.length; i++)
            {
                let key = keyValuesArray[i][0],
                    value = keyValuesArray[i][1];

                console.assert(Number.isInteger(key) && (!(Number.isNaN(value))));
                console.assert((previousKey < key && key < highKeyLimit) && (previousValue < value && value < highValueLimit));
                previousKey = key;
                previousValue = value;
            }
        }

        checkParameters(keyValuesArray);

        let longKeyValuesArray = [],
            complete = false;
        for(var octaveIncr = 0; octaveIncr < 127; octaveIncr += 12)
        {
            for(var i = 0; i < keyValuesArray.length; i++)
            {
                let key = keyValuesArray[i][0] + octaveIncr,
                    value = keyValuesArray[i][1] + octaveIncr;

                if(key <= 127 && value < 128)
                {
                    longKeyValuesArray.push([key, value]);
                }
                else
                {
                    complete = true;
                    break;
                }
            }
            if(complete)
            {
                break;
            }
        }

        let rGamut = getGamutFromKeyValuesArray(longKeyValuesArray);

        return rGamut;
    };

    // Returns a gamut in which octaves dont necessarily repeat.
    // The keyValuesArray is an array of arrays, each of which contains a [key, value] pair.
    // Keys (integers in range 0..127) are given the corresponding (floating point) values (0.0 <= value < 128.0),
    // and the values for intermediate keys are interpolated linearly.
    // Both the keys and values must be strictly in ascending order in the keyValuesArray.
    // Keys below keyValuesArray[0][0] are given the value keyValuesArray[0][1].
    // Keys above the last key in the keyValuesArray are given the last value in the keyValuesArray.
    TuningsFactory.prototype.getFreeKeyboardGamut = function(keyValuesArray)
    {        
        checkLongKeyValueParameters(keyValuesArray);

        let rGamut = getGamutFromKeyValuesArray(keyValuesArray);

        return rGamut;
    };

    // Returns a gamutSegment, calculated from the keyValuesArray, having a .rootKey attribute that determines the key for the first value.
    // A gamutSegment is a contiguous array of increasing MidiCent values, one per key in range.
    // The keyValuesArray is an array containing only the [key,pitch] arrays that define fixed points in the (warped) gamut.
    // The returned values do not exceed the range of the values in the keyValuesArray argument.
    // The returned values have been interpolated (per key) between those in the keyValuesArray argument.
    TuningsFactory.prototype.getGamutSegment = function(keyValuesArray)
    {
        return getGamutSegment(keyValuesArray);
    };

	return API;

}());

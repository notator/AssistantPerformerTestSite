/*
* Copyright 2015 James Ingram
* http://james-ingram-act-two.de/
*
* This code is based on the gree soundFont synthesizer at
* https://github.com/gree/sf2synth.js
*
* All this code is licensed under MIT
*
* The WebMIDI.soundFontSynthNote namespace containing the following constructor:
*
*        SoundFontSynthNote(ctx, gainMaster, keyLayers) 
*/

WebMIDI.namespace('WebMIDI.soundFontSynthNote');

WebMIDI.soundFontSynthNote = (function()
{
    "use strict";

	var
	SoundFontSynthNote = function(ctx, gainMaster, keyLayers, midi)
	{
		this.ctx = ctx;
		this.gainMaster = gainMaster;
		this.keyLayers = keyLayers;

		this.channel = midi.channel;
		this.key = midi.key;
		this.velocity = midi.velocity;
		this.pan = midi.pan;
		this.volume = midi.volume;
		this.pitchBend = midi.pitchBend;
		this.pitchBendSensitivity = midi.pitchBendSensitivity;

		this.buffer = keyLayers[0].sample;

		// state
		this.startTime = ctx.currentTime;

	    // audio node
		this.audioBuffer = null;
		this.bufferSource = null;
		this.panner = null;
		this.gainOutput = null;	
	},

	API =
	{
		SoundFontSynthNote: SoundFontSynthNote // constructor
	};

	SoundFontSynthNote.prototype.noteOn = function()
	{
	    // KeyLayers are "subChannels" associated with a particular key in this preset,
	    // i.e. they are "subChannels" associated with this particular Note.
	    // All the keyLayers have been read correctly (as far as I know) from the SoundFont file,
	    // but this file ignores all but the first (keyLayers[0]).
	    // (The Arachno SoundFont's preset 0 -- Grand Piano -- has two layers, in which
	    // keyLayer[0].pan is always -500 and keylayer[1].pan is always 500.)
	    // This version of soundFontSynthNote.js:
	    //    1) ignores all but the first keyLayer, and
	    //    2) ignores the first keyLayer's *pan* attribute.
	    //    3) plays the layer at the position set by the value of *this.pan* (see midi.pan above).
	    // TODO 1: Implement the playing of stereo samples, using stereo Web Audio buffers.
	    // 
	    // Each keyLayer has an entry for every soundFont "generator" in the spec, except those
	    // whose value has been used to calculate the values of the other "generator"s and should
	    // no longer be needed.
	    // If a soundFont "generator" was not present in the soundFont, it will have its default
	    // value in the keyLayer.
	    //
	    // The following "generator"s are present in the Arachno Grand Piano preset, and are
	    // the same for every key in the preset, but are not used by this file:
	    //    chorusEffectsSend (soundfile amount: 50, value here: 0.05)
	    //    reverbEffectsSend (soundfile amount: 200, value here: 0.20)
	    //    pan (layer 0 (left) soundfile amount: -500, value here: 0 -- completely left
	    //         layer 1 (right)soundfile amount: 500,  value here: 1 -- completely right)
	    //    delayModLFO (soundfile amount: -7973, value here: 0.01)
	    //    delayVibLFO (soundfile amount: -7973, value here: 0.01)
	    // TODO 2: Implement the playing of *all* the soundFont "generator"s, especially these five.
	    // N.B. the returned value of such unused generators is probably correct, but should be checked
	    // in soundFont.js. The position of the decimal point should be specially carefully checked.

	    let
		buffer, channelData, bufferSource, filter, panner,
		output, outputGain, baseFreq, peekFreq, sustainFreq,
		ctx = this.ctx,
		keyLayers = this.keyLayers,
		sample = this.buffer,
		now = this.ctx.currentTime,
        doLoop = (keyLayers[0].loopFlags === 1 || keyLayers[0].loopFlags === 3),
        // All keyLayer attributes should have directly usable values here in this (runtime) file.
        // The conversions from the integer amounts in the soundFont have been done earlier (at load time).
        volDelayEndtime = now + keyLayers[0].volDelayDuration_sec,
		volAttackEndtime = volDelayEndtime + keyLayers[0].volAttackDuration_sec,
        volHoldEndtime = volAttackEndtime + keyLayers[0].volHoldDuration_sec,
        volDecayEndtime = volHoldEndtime + keyLayers[0].volDecayDuration_sec,

        modDelayEndtime = now + keyLayers[0].modDelayDuration_sec,
		modAttackEndtime = modDelayEndtime + keyLayers[0].modAttackDuration_sec,
        modHoldEndtime = modAttackEndtime + keyLayers[0].modHoldDuration_sec,
        modDecayEndtime = modHoldEndtime + keyLayers[0].modDecayDuration_sec,

        volLevel = this.volume * Math.pow((this.velocity / 127), 2), // ji 21.08.2017

		loopStart = 0,
		loopEnd = 0,
		startTime = keyLayers[0].startTime; // keyLayers[0].startTime is keyLayers[0].startAddressOffset / keyLayers[0].sampleRate;

		if(doLoop === true)
		{
		    loopStart = keyLayers[0].loopStart_sec; // = loopStart_samplePos / sampleRate;
		    loopEnd = keyLayers[0].loopEnd_sec; // loopEnd_samplePos / sampleRate;
		}
		sample = sample.subarray(0, sample.length + keyLayers[0].endAddressOffset);
		this.audioBuffer = ctx.createBuffer(1, sample.length, keyLayers[0].sampleRate);
		buffer = this.audioBuffer;
		channelData = buffer.getChannelData(0);
		channelData.set(sample);

		// buffer source
		this.bufferSource = ctx.createBufferSource();
		bufferSource = this.bufferSource;
		bufferSource.buffer = buffer;
		// The original gree code here was:
		//    bufferSource.loop = (this.channel !== 9);
		bufferSource.loop = (this.channel !== 9 && doLoop ); // if there are any channel 9 instruments that loop, delete that condition!
		bufferSource.loopStart = loopStart;
		bufferSource.loopEnd = loopEnd;
		this.updatePitchbend(this.pitchBend);

		// audio node
		this.panner = ctx.createPanner();
		panner = this.panner;
		this.gainOutput = ctx.createGain();
		output = this.gainOutput;
		outputGain = output.gain;

		// filter
		this.filter = ctx.createBiquadFilter();
		filter = this.filter;
		filter.type = 'lowpass';

		// pan
		panner.panningModel = 'HRTF';
		panner.setPosition(
		  Math.sin(this.pan * Math.PI / 2),
		  0,
		  Math.cos(this.pan * Math.PI / 2)
		);

		//---------------------------------------------------------------------------
		// Attack, Decay, Sustain
		//---------------------------------------------------------------------------

		outputGain.setValueAtTime(0, now);
		if(volDelayEndtime > now)
		{
		    outputGain.linearRampToValueAtTime(0, volDelayEndtime);
		}
		outputGain.linearRampToValueAtTime(volLevel, volAttackEndtime);
	    outputGain.linearRampToValueAtTime(volLevel, volHoldEndtime);
	    outputGain.linearRampToValueAtTime((volLevel * keyLayers[0].volSustainLevel_factor), volDecayEndtime);

		// ji: The following original gree line was a (deliberate, forgotten?) gree bug that threw an out-of-range
		// exception when keyLayers[0]['initialFilterQ'] > 0:
		//     filter.Q.setValueAtTime(keyLayers[0]['initialFilterQ'] * Math.pow(10, 200), now);
        //
	    // https://www.w3.org/TR/webaudio/#the-biquadfilternode-interface
	    // says that the Q value is a resonance frequency in decibels.
	    // But is this what the soundFont spec is defining?
	    // The following line seems to work, but is it really correct?
		filter.Q.setValueAtTime(keyLayers[0].initialFilterQ_dB, now);

		baseFreq = keyLayers[0].initialFilterFc_Hz;
		peekFreq = keyLayers[0].initialFilterFc_Hz + keyLayers[0].modEnvToFilterFc_Hz;
		sustainFreq = baseFreq + ((peekFreq - baseFreq) * (1 - keyLayers[0].sustainModEnv_factor));

		filter.frequency.setValueAtTime(baseFreq, now);
		if(modDelayEndtime > now)
		{
		    filter.frequency.linearRampToValueAtTime(baseFreq, modDelayEndtime);
		}
		filter.frequency.linearRampToValueAtTime(peekFreq, modAttackEndtime);
		filter.frequency.linearRampToValueAtTime(peekFreq, modHoldEndtime);
		filter.frequency.linearRampToValueAtTime(sustainFreq, modDecayEndtime);

		// connect
		bufferSource.connect(filter);
		filter.connect(panner);
		panner.connect(output);
		output.connect(this.gainMaster);

		// fire
		bufferSource.start(0, startTime);
	};
    // current ji noteOff function
	SoundFontSynthNote.prototype.noteOff = function()
	{
	    var
		keyLayers = this.keyLayers,
		bufferSource = this.bufferSource,
		output = this.gainOutput,
		now = this.ctx.currentTime,
        volRelease = keyLayers[0].volReleaseDuration_sec,
        modRelease = keyLayers[0].modReleaseDuration_sec,
		volEndTime = now + volRelease,
		modEndTime = now + modRelease;

		if(!this.audioBuffer)
		{
			return;
		}

		//---------------------------------------------------------------------------
		// Release
		//---------------------------------------------------------------------------
		// begin original gree
		output.gain.cancelScheduledValues(0);
		output.gain.linearRampToValueAtTime(0, volEndTime);
		bufferSource.playbackRate.cancelScheduledValues(0);
		bufferSource.playbackRate.linearRampToValueAtTime(this.computedPlaybackRate, modEndTime);
		// end original gree

		// begin ji
	    // 1. use setTargetAtTime() instead of linearRampToValueAtTime(0, volEndTime). (Suggested by Timothée Jourde on GitHub).
	    // 2. call cancelScheduledValues(...) _after_ setting the envelopes, not before.
		//output.gain.setTargetAtTime(0, now, volRelease);
		//output.gain.cancelScheduledValues(volEndTime);
		//bufferSource.playbackRate.linearRampToValueAtTime(this.computedPlaybackRate, modEndTime);
		//bufferSource.playbackRate.cancelScheduledValues(modEndTime);
		// end ji

		bufferSource.loop = false;
		bufferSource.stop(volEndTime);

		// disconnect
		setTimeout(
		  (function(note)
			{
		  		return function()
		  		{
		  			note.bufferSource.disconnect(0);
		  			note.panner.disconnect(0);
		  			note.filter.disconnect(0);
		  			note.gainOutput.disconnect(0);
		  		};
			}(this)), volRelease + 0.1);
	};

    // This function can be called by a note while it is playing.
    // The pitchBend argument is a 14-bit int value (in range [-8192..+8191]). 
	SoundFontSynthNote.prototype.updatePitchbend = function(pitchBend)
	{
	    let
        playbackRate = this.bufferSource.playbackRate,
        start = this.startTime,
        keyLayer = this.keyLayers[0],
        modAttackEndtime = start + keyLayer.modDelayDuration_sec + keyLayer.modAttackDuration_sec,
        computedPlaybackRate = keyLayer.basePlaybackRate * Math.pow(Math.pow(2, 1 / 12),
            (this.pitchBendSensitivity * (pitchBend / (pitchBend < 0 ? 8192 : 8191))) * keyLayer.scaleTuning_factor);

	    if(pitchBend < -8192 || pitchBend > 8191)
	    {
	        throw "Illegal pitchBend value.";
	    }

	    this.pitchBend = pitchBend;

	    playbackRate.setValueAtTime(computedPlaybackRate, modAttackEndtime);
	};

	return API;

}());

import {Interpretation} from "./Interpretation.js";

export class Track
{
	constructor()
	{
		// Information from the score is going to be loaded into each midiObjectSequence.
		this.midiObjectSequences = [];
	}

	setRuntimeInterpretation(trackIsOn, regionSequence, currentRegionIndex)
	{
		function getMidiObjectIndexRangesPerRegion(that, regionSequence)
		{
			let midiObjects = that.interpretations[0].midiObjects,
				midiObjectIndexRangesPerRegion = [];

			for(let i = 0; i < regionSequence.length; i++)
			{
				let region = regionSequence[i],
					regionStartMsPos = region.startMsPosInScore,
					regionEndMsPos = region.endMsPosInScore,
					regionRange = {};

				regionRange.firstMidiObjectIndex = midiObjects.findIndex(x => (x.msPosInScore >= regionStartMsPos && x.msPosInScore < regionEndMsPos));
				regionRange.lastMidiObjectIndex = midiObjects.findLastIndex(x => (x.msPosInScore >= regionStartMsPos && x.msPosInScore < regionEndMsPos));

				midiObjectIndexRangesPerRegion.push(regionRange);
			}

			return midiObjectIndexRangesPerRegion;
		}

		function getCurrentInterpretation(that, regionSequence, currentRegionIndex, midiObjectIndexRangesPerRegion)
		{
			console.assert(regionSequence.hasConsecutiveRegions === false);

			let interpretation = new Interpretation(),
				region = regionSequence[currentRegionIndex],
				indexRange = midiObjectIndexRangesPerRegion[currentRegionIndex],
				firstIndex = indexRange.firstMidiObjectIndex,
				lastIndex = indexRange.lastMidiObjectIndex,
				midiObjects = that.interpretations[region.midiObjectIndex].midiObjects,
				msPosInPerf = 0;

			for(let midiObjIndex = firstIndex; midiObjIndex <= lastIndex; midiObjIndex++)
			{
				if(midiObjIndex === firstIndex)
				{
					// This function is called for multiple tracks.
					// The following assertion ensures that all tracks agree with where the regions start in performance.
					console.assert(region.startMsPosInPerf === msPosInPerf);
				}

				let midiObj = midiObjects[midiObjIndex];

				midiObj.msPosInPerf = msPosInPerf;
				msPosInPerf += midiObj.msDuration;

				midiObj.moments[0].msPosInScore = midiObj.msPosInScore; // used to update the cursor when performing

				// MidiRest.moments contains a single Moment having an msPosInChord attribute that is set to 0.
				for(let moment of midiObj.moments)
				{					
					if(moment.msPosInChord === midiObj.msDuration)
					{
						moment.msPosInScore = midiObj.msPosInScore + midiObj.msDuration;
					}
					moment.msPosInPerf = midiObj.msPosInPerf + moment.msPosInChord;
					console.assert(! isNaN(moment.msPosInPerf));
				}

				interpretation.midiObjects.push(midiObj);

				if(midiObjIndex === lastIndex)
				{
					// This function is called for multiple tracks.
					// The following assertion ensures that all tracks agree with where the regions end in performance.
					console.assert(region.endMsPosInPerf === msPosInPerf);
				}
			}
			return interpretation;
		}

		function getSequentialRegionsInterpretation(that, regionSequence, midiObjectIndexRangesPerRegion)
		{
			let interpretation = new Interpretation();				

			for(let regionIndex = 0; regionIndex < regionSequence.length; regionIndex++)
			{
				let region = regionSequence[regionIndex],
					indexRange = midiObjectIndexRangesPerRegion[regionIndex],
					firstIndex = indexRange.firstMidiObjectIndex,
					lastIndex = indexRange.lastMidiObjectIndex,
					midiObjectsInScore = that.interpretations[region.midiObjectIndex].midiObjects,
					msPosInPerf = region.startMsPosInPerf;

				for(let midiObjIndex = firstIndex; midiObjIndex <= lastIndex; midiObjIndex++)
				{
					let midiObjectInScore = midiObjectsInScore[midiObjIndex];					

					midiObjectInScore.msPosInPerf = msPosInPerf;
					msPosInPerf += midiObjectInScore.msDuration;

					midiObjectInScore.moments[0].msPosInScore = midiObjectInScore.msPosInScore; // used to update the cursor when performing

					// MidiRest.moments contains a single Moment having an msPosInChord attribute that is set to 0.
					for(let moment of midiObjectInScore.moments)
					{
						if(moment.msPosInChord === midiObjectInScore.msDuration)
						{
							moment.msPosInScore = midiObjectInScore.msPosInScore + midiObjectInScore.msDuration;
						}						
						moment.msPosInPerf = midiObjectInScore.msPosInPerf + moment.msPosInChord;
						console.assert(Number.isNaN(moment.msPosInPerf) === false);
					}

					interpretation.midiObjects.push(midiObjectInScore);

					if(midiObjIndex === lastIndex)
					{
						// This function is called for multiple tracks.
						// The following assertion ensures that all tracks agree with where the regions end in performance.
						console.assert(region.endMsPosInPerf === msPosInPerf);
					}
				}
				if(regionIndex > 0)
				{
					console.assert(region.startMsPosInPerf === regionSequence[regionIndex - 1].endMsPosInPerf);
				}
			}

			return interpretation;
		}			

		if(trackIsOn)
		{
			let midiObjectIndexRangesPerRegion = getMidiObjectIndexRangesPerRegion(this, regionSequence);
			if(regionSequence.hasConsecutiveRegions === false)
			{
				this.runtimeInterpretation = getCurrentInterpretation(this, regionSequence, currentRegionIndex, midiObjectIndexRangesPerRegion);
				if(regionSequence[0].endMsPosInPerf === 0)
				{
					for(let region of regionSequence)
					{
						region.endMsPosInPerf = region.endMsPosInScore;
					}
				}
			}
			else if(this.runtimeInterpretation === undefined)
			{
				this.runtimeInterpretation = getSequentialRegionsInterpretation(this, regionSequence, midiObjectIndexRangesPerRegion);
			}
		}
		else
		{
			this.runtimeInterpretation = undefined;
		}
	}
}

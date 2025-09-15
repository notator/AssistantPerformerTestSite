
import { constants } from "./Constants.js";
import { MidiRest, MidiChord } from "./MidiObject.js";
import {Interpretation} from "./Interpretation.js";
import {RegionControls} from "./RegionControls.js";

export class Track
{
	constructor(nInterpretations)
	{
		// Information from the score is going to be loaded into each Interpretation.midiObjects array.
		this.interpretations = [];
		for (let i = 0; i < nInterpretations; ++i)
		{
			this.interpretations.push(new Interpretation());
		}
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
			console.assert(regionSequence[0].isSimpleInterpretation());

			let interpretation = new Interpretation(),
				region = regionSequence[currentRegionIndex],
				indexRange = midiObjectIndexRangesPerRegion[currentRegionIndex],
				firstIndex = indexRange.firstMidiObjectIndex,
				lastIndex = indexRange.lastMidiObjectIndex,
				interpIndex = region.interpIndex,
				midiObjects = that.interpretations[interpIndex].midiObjects,
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
				midiObj.msDurInPerf = midiObj.msDurInScore;
				msPosInPerf += midiObj.msDurInPerf;

				for(let moment of midiObj.moments)
				{
					// MidiRest.moments contains a single Moment having an msPosInChord attribute that is set to 0.
					moment.msPosInPerf = midiObj.msPosInPerf + moment.msPosInChord;
					delete moment.msPosInChord;
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
			let interpretation = new Interpretation(),
				msPosInPerf = 0;

			for(let regionIndex = 0; regionIndex < regionSequence.length; regionIndex++)
			{
				let region = regionSequence[regionIndex],
					indexRange = midiObjectIndexRangesPerRegion[regionIndex],
					firstIndex = indexRange.firstMidiObjectIndex,
					lastIndex = indexRange.lastMidiObjectIndex,
					midiObjects = that.interpretations[region.interpIndex].midiObjects;

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
					midiObj.msDurInPerf = midiObj.msDurInScore;
					msPosInPerf += midiObj.msDurInPerf;

					for(let moment of midiObj.moments)
					{
						// MidiRest.moments contains a single Moment having an msPosInChord attribute that is set to 0.
						moment.msPosInPerf = midiObj.msPosInPerf + moment.msPosInChord;
						delete moment.msPosInChord;
					}

					interpretation.midiObjects.push(midiObj);

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

			if(regionSequence[0].isSimpleInterpretation())
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

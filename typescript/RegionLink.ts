
/// <reference path="Interface.ts" />

namespace _AP
{
	export class RegionLink
	{
		constructor(track:Track, regionDef: RegionDef, prevRegionLink: RegionLink | undefined)
		{
			this.endOfRegionMsPositionInScore = regionDef.endMsPositionInScore;

			let startMsPos = regionDef.startMsPositionInScore;
			let midiObjects = track.midiObjects;
			let startMidiObjectIndex = -1;
			let startMidiObjectMomentIndex = 0;
			for(let midiObjectIndex = 0; midiObjectIndex < midiObjects.length; ++midiObjectIndex)
			{
				let midiObject = midiObjects[midiObjectIndex] as MidiObject;
				let moments = midiObject.moments;
				for(let momentIndex = 0; momentIndex < moments.length; ++momentIndex)
				{
					let moment = moments[momentIndex];
					if((midiObject.msPositionInScore + moment.msPositionInChord) >= startMsPos)
					{
						startMidiObjectIndex = midiObjectIndex;
						startMidiObjectMomentIndex = momentIndex;
						break;
					}
				}
				if(startMidiObjectIndex >= 0)
				{
					break;
				}
			}

			let midiObjectsCount = 0
			for(let midiObjectIndex = startMidiObjectIndex; midiObjectIndex < midiObjects.length; ++midiObjectIndex)
			{
				let midiObject = midiObjects[midiObjectIndex] as MidiObject;
				if(midiObject.msPositionInScore < regionDef.endMsPositionInScore)
				{
					midiObjectsCount++;
				}
				else
				{
					break;
				}
			}

			if(prevRegionLink !== undefined)
			{
				prevRegionLink.nextRegionMidiObjectIndex = startMidiObjectIndex;
				prevRegionLink.nextRegionMomentIndex = startMidiObjectMomentIndex;
				prevRegionLink.nextRegionMidiObjectsCount = midiObjectsCount;
			}
		}

		public readonly endOfRegionMsPositionInScore: number;

		// These will be undefined for the final RegionLink in the track.
		public nextRegionMidiObjectIndex: number | undefined; // the index of the midiObject containing the first moment at or after the startMsPositionInScore of the nextRegion.
		public nextRegionMomentIndex: number | undefined; // the index (in midiObject.moments) of the first moment at or after the startMsPositionInScore of the nextRegion
		public nextRegionMidiObjectsCount: number | undefined; // includes midiObjects that straddle the region boundaries. 
	}
}
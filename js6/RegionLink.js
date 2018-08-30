
export class RegionLink
{
	constructor(track, regionDef, prevRegionLink)
	{
		this.endOfRegionMsPositionInScore = regionDef.endMsPositionInScore;

		let startMsPos = regionDef.startMsPositionInScore;
		let midiObjects = track.midiObjects;
		let startMidiObjectIndex = -1;
		let startMidiObjectMomentIndex = 0;
		for(let midiObjectIndex = 0; midiObjectIndex < midiObjects.length; ++midiObjectIndex)
		{
			let midiObject = midiObjects[midiObjectIndex];
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
		let midiObjectsCount = 0;
		for(let midiObjectIndex = startMidiObjectIndex; midiObjectIndex < midiObjects.length; ++midiObjectIndex)
		{
			let midiObject = midiObjects[midiObjectIndex];
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
}


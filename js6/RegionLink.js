
export class RegionLink
{
	constructor(trackMidiObjects, regionDef, prevRegionLink)
	{
		this.endOfRegionMsPositionInScore = regionDef.endMsPositionInScore;

		this.nextRegionMidiObjectIndex = null;
		this.nextRegionMomentIndex = null;
		this.nextRegionMidiObjectsCount = null;

		let startMsPos = (prevRegionLink === undefined) ? 0 : regionDef.startMsPositionInScore;

		let startMidiObjectIndex = -1;
		let startMidiObjectMomentIndex = 0;
		for(let midiObjectIndex = 0; midiObjectIndex < trackMidiObjects.length; ++midiObjectIndex)
		{
			let midiObject = trackMidiObjects[midiObjectIndex];
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
		for(let midiObjectIndex = startMidiObjectIndex; midiObjectIndex < trackMidiObjects.length; ++midiObjectIndex)
		{
			let midiObject = trackMidiObjects[midiObjectIndex];
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


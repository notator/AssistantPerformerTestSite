
export class RunningMarker
{
	/**
	 * This class will be deleted, when it has been made redundant.
	 * @param {SvgSystem} system
	 * @param {number} systemIndexInScore
	 * @param {SVGGElement} svgRunningMarkerGroup
	 * @param {number} vbScale
	 */
	constructor(system, systemIndexInScore, svgRunningMarkerGroup, vbScale)
	{
		this.positionIndex = 0;
		this.nextMsPosition = 0;
		const EXTRA_TOP_AND_BOTTOM = 45; // user html pixels
		let top = (system.markersTop - EXTRA_TOP_AND_BOTTOM).toString();
		let bottom = (system.markersBottom + EXTRA_TOP_AND_BOTTOM).toString();
		this.systemIndexInScore = systemIndexInScore;
		this.line = this._getLine(svgRunningMarkerGroup, top, bottom);
		this.viewBoxScale = vbScale;
		this.yCoordinates = this._getYCoordinates(top, bottom, vbScale);
		this.timeObjects = [];
		this.setVisible(false);
	}
	/* begin constructor helper functions */
	_getLine(svgRunningMarkerGroup, top, bottom)
	{
		function setLine(line, top, bottom)
		{
			const strokeWidth = 8, // 1 pixel
				color = '#999999';
			line.setAttribute('x1', '0');
			line.setAttribute('y1', top);
			line.setAttribute('x2', '0');
			line.setAttribute('y2', bottom);
			line.style.strokeWidth = strokeWidth.toString(10);
			line.style.stroke = color;
		}
		let node = undefined;
		for(node of svgRunningMarkerGroup.childNodes)
		{
			if(node instanceof SVGLineElement)
			{
				break;
			}
		}
		let line = node;
		setLine(line, top, bottom);
		return line;
	}
	_getYCoordinates(top, bottom, vbScale)
	{
		return { top: Math.round(parseFloat(top) / vbScale), bottom: Math.round(parseFloat(bottom) / vbScale) };
	}
	/* end constructor helper functions */
	_moveLineToAlignment(alignment)
	{
		var x = alignment * this.viewBoxScale;
		this.line.setAttribute('x1', x.toString());
		this.line.setAttribute('x2', x.toString());
	}

	// public functions
	setVisible(setToVisible)
	{
		if(setToVisible)
		{
			this.line.style.visibility = 'visible';
		}
		else
		{
			this.line.style.visibility = 'hidden';
		}
	}
	// This function is called when the Go button is clicked, immediately before the score starts playing.
	// The timeObjects array contains one timeObject per msPositionInScore in the system.
	// It is ordered according to each timeObject msPositionInScore.
	// If isLivePerformance === true, the timeObjects are inputObjects from inputVoices,
	// otherwise the timeObjects are midiObjects from outputVoices.
	setTimeObjects(system, isLivePerformance, trackIsOnArray)
	{
		var timeObject;
		function findFollowingTimeObject(system, msPositionInScore, isLivePerformance, trackIsOnArray)
		{
			var nextTimeObject, staff, voice, i, k, voiceIndex, trackIndex = 0, voiceTimeObjects = [];
			for(i = 0; i < system.staves.length; ++i)
			{
				staff = system.staves[i];
				for(voiceIndex = 0; voiceIndex < staff.voices.length; ++voiceIndex)
				{
					if(staff.topLineY !== undefined)
					{
						if(trackIsOnArray[trackIndex] === true)
						{
							voice = staff.voices[voiceIndex];
							if(voice.isOutput === true && isLivePerformance === false)
							{
								for(k = 0; k < voice.timeObjects.length; ++k)
								{
									if(voice.timeObjects[k].msPositionInScore > msPositionInScore)
									{
										voiceTimeObjects.push(voice.timeObjects[k]);
										break;
									}
								}
							}
							else if(voice.isOutput === false && isLivePerformance === true)
							{
								for(k = 0; k < voice.timeObjects.length; ++k)
								{
									if(voice.timeObjects[k].msPositionInScore > msPositionInScore)
									{
										voiceTimeObjects.push(voice.timeObjects[k]);
										break;
									}
								}
							}
						}
					}
					trackIndex++;
				}
			}
			// voiceTimeObjects now contains the next timeObject in each active, visible voice.
			// Now find the one having the minimum msPositionInScore.
			nextTimeObject = voiceTimeObjects[0];
			if(voiceTimeObjects.length > 1)
			{
				for(i = 1; i < voiceTimeObjects.length; ++i)
				{
					if(voiceTimeObjects[i].msPositionInScore < nextTimeObject.msPositionInScore)
					{
						nextTimeObject = voiceTimeObjects[i];
					}
				}
			}
			return nextTimeObject;
		}
		timeObject = findFollowingTimeObject(system, -1, isLivePerformance, trackIsOnArray);
		while(timeObject !== undefined)
		{
			this.timeObjects.push(timeObject);
			timeObject = findFollowingTimeObject(system, timeObject.msPositionInScore, isLivePerformance, trackIsOnArray);
		}
	}
	// This function is necessary after changing systems, where the first position of the system needs to be skipped.
	// msPositionInScore must be in the current system
	moveTo(msPosInScore)
	{
		var positionIndex = 0, timeObjects = this.timeObjects, timeObject;
		while(positionIndex < (timeObjects.length - 1) && timeObjects[positionIndex].msPositionInScore < msPosInScore)
		{
			positionIndex++;
		}
		timeObject = timeObjects[positionIndex];
		this._moveLineToAlignment(timeObject.alignment);
		if(positionIndex === (timeObjects.length - 1))
		{
			this.nextMsPosition = timeObject.msPositionInScore + timeObject.msDurationInScore;
		}
		else
		{
			this.nextMsPosition = timeObjects[positionIndex + 1].msPositionInScore; // may be system's end msPosition
		}
		this.positionIndex = positionIndex;
	}
	incrementPosition()
	{
		var timeObjects = this.timeObjects;
		this.positionIndex++;
		if(this.positionIndex < (timeObjects.length - 1))
		{
			this.nextMsPosition = timeObjects[this.positionIndex + 1].msPositionInScore;
		}
		else
		{
			// was this.nextMsPosition = undefined;
			this.nextMsPosition = -1;
		}
		this._moveLineToAlignment(this.timeObjects[this.positionIndex].alignment);
	}
}



/// <reference path="Context.ts" />

namespace _AP
{
	export class RunningMarker
	{
		constructor(
			system: SvgSystem,
			systemIndexInScore: number,
			svgRunningMarkerGroup: CursorGroupElem,
			vbScale: number)
		{
			const EXTRA_TOP_AND_BOTTOM = 45; // user html pixels
			let top:string = (system.markersTop - EXTRA_TOP_AND_BOTTOM).toString();
			let bottom:string = (system.markersBottom + EXTRA_TOP_AND_BOTTOM).toString();

			this.systemIndexInScore = systemIndexInScore;

			this.line = this._getLine(svgRunningMarkerGroup, top, bottom);
			this.viewBoxScale = vbScale;
			this.yCoordinates = this._getYCoordinates(top, bottom, vbScale);
			this.timeObjects = [];

			this.setVisible(false);
		}

		/* begin constructor helper functions */
		private _getLine(svgRunningMarkerGroup: SVGGElement, top:string, bottom:string): SVGLineElement
		{
			function setLine(line: SVGLineElement, top:string, bottom:string): void
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

			let node: any = undefined;
			for(node of svgRunningMarkerGroup.childNodes)
			{
				if(node instanceof SVGLineElement)
				{
					break;
				}
			}
			let line = node as SVGLineElement;
			setLine(line, top, bottom);
			return line;
		}
		private _getYCoordinates(top: string, bottom:string, vbScale:number): YCoordinates
		{
			return { top: Math.round(parseFloat(top) / vbScale), bottom: Math.round(parseFloat(bottom) / vbScale) };
		}
		/* end constructor helper functions */

		private _moveLineToAlignment(alignment: number): void
		{
			var x = alignment * this.viewBoxScale;
			this.line.setAttribute('x1', x.toString());
			this.line.setAttribute('x2', x.toString());
		}

		/** public functions **/

		public setVisible(setToVisible: boolean): void
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
		public setTimeObjects(system: SvgSystem, isLivePerformance: boolean, trackIsOnArray: boolean[]): void
		{
			var
				MidiChord = _AP.midiObject.MidiChord,
				MidiRest = _AP.midiObject.MidiRest,
				InputChordDef = _AP.inputObjectDef.InputChordDef,
				InputRestDef = _AP.inputObjectDef.InputRestDef,
				timeObject;

			function findFollowingTimeObject(system: SvgSystem, msPositionInScore: number, isLivePerformance: boolean, trackIsOnArray: boolean[]) : any
			{
				var nextTimeObject, staff, voice, i, k, voiceIndex, trackIndex = 0,
					voiceTimeObjects = [];

				for(i = 0; i < system.staves.length; ++i)
				{
					staff = system.staves[i];
					for(voiceIndex = 0; voiceIndex < staff.voices.length; ++voiceIndex)
					{
						if(staff.isVisible && staff.topLineY !== undefined)
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
			while(timeObject instanceof MidiChord || timeObject instanceof MidiRest || timeObject instanceof InputChordDef || timeObject instanceof InputRestDef)
			{
				this.timeObjects.push(timeObject);
				timeObject = findFollowingTimeObject(system, timeObject.msPositionInScore, isLivePerformance, trackIsOnArray);
			}
		}

		// This function is necessary after changing systems, where the first position of the system needs to be skipped.
		// msPositionInScore must be in the current system
		public moveTo(msPosInScore: number)
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

		public incrementPosition()
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

		readonly systemIndexInScore: number;
		readonly line: SVGLineElement;
		readonly viewBoxScale: number;
		readonly yCoordinates: YCoordinates;
		readonly timeObjects: any[];
		positionIndex: number = 0;
		nextMsPosition: number = 0;
	}
}
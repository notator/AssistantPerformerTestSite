
/// <reference path="Context.ts" />

namespace _AP
{
	export class CursorYAttributes
	{
		readonly markersTop: number;
		readonly markersBottom: number;
		readonly pageOffsetTop: number;
		constructor(markersTop: number, markersBottom: number, pageOffsetTop: number)
		{
			this.markersTop = markersTop;
			this.markersBottom = markersBottom;
			this.pageOffsetTop = pageOffsetTop;
		}
	}

	export class SimData
	{
		readonly msPositionInScore: number;
		readonly cursorYAttributes: CursorYAttributes;
		isFunctional: boolean = true; // is set to false, if the sim has no performing midiObjects

		constructor(msPosInScore: number, cursorYAttributes: CursorYAttributes)
		{
			this.msPositionInScore = msPosInScore;
			this.cursorYAttributes = cursorYAttributes;
		}
	}

	/* Includes SimData for the final barline. */
	export class ScoreSimDatas
	{
		// Checks the following:
		// Each system has the following attributes:
		//     .markersTop
		//     .markersBottom
		//     .staves
		// Each system.staff has voices
		// Each voices has voice
		// Each voice has
		//     .isOutput
		//     .timeObjects
		// Each timeObject has
		//     .msPositionInScore
		//
		// Each timeObject is either a:
		//     MidiChord, MidiRest, InputChordDef or InputRestDef
		// and also has other attributes, including .alignment and .msDurationInScore, but these are not checked.
		private checkArgument(systems: any): any
		{
			if(systems.length === 0)
			{
				throw "No systems!"
			}
			for(let system of systems)
			{
				if(system.markersTop === undefined || system.markersBottom === undefined
					|| system.staves === undefined || system.pageOffsetTop === undefined)
				{
					throw "not a system";
				}
				for(let staff of system.staves)
				{
					if(staff.voices === undefined || staff.isOutput === undefined)
					{
						throw "not a staff";
					}
					for(let voice of staff.voices)
					{
						if(voice.isOutput === undefined || (voice.isOutput === true && voice.timeObjects === undefined))
						{
							throw "not a voice";
						}
						// voice.timeObjects can be undefined if this is an input voice and the input device is not selected
						if(voice.timeObjects !== undefined)
						{
							for(let timeObject of voice.timeObjects)
							{
								if(timeObject.msPositionInScore === undefined)
								{
									throw "neither a MidiChord nor a MidiRest nor an InputChordDef nor an InputRestDef";
								}
							}
						}
					}
				}
			}
		}

		private getSystemSimData(system: any): SimData[]
		{
			let systemSimsData: SimData[] = [],
				cursorYAttributes = new CursorYAttributes(system.markersTop, system.markersBottom, system.pageOffsetTop),
				nStaves = system.staves.length;

			for(let staffIndex = 0; staffIndex < nStaves; ++staffIndex)
			{
				let staff = system.staves[staffIndex],
					nVoices = staff.voices.length;

				for(let voiceIndex = 0; voiceIndex < nVoices; ++voiceIndex)
				{
					if(staff.voices[voiceIndex].timeObjects === undefined)
					{
						// this can happen if the voice is an InputVoice, and the input device is not selected.
						break
					}

					let timeObjects = staff.voices[voiceIndex].timeObjects,
						nTimeObjects = timeObjects.length - 1; // timeObjects includes the final barline (don't use it here)

					if(staffIndex === 0 && voiceIndex === 0)
					{
						for(let ti = 0; ti < nTimeObjects; ++ti)
						{
							let simData = new SimData(timeObjects[ti].msPositionInScore, cursorYAttributes);
							systemSimsData.push(simData);
						}
					}
					else
					{
						let maxPos = Number.MAX_VALUE,
							simIndex = systemSimsData.length - 1;
						for(let ti = nTimeObjects - 1; ti >= 0; --ti)
						{
							let tObjPos = timeObjects[ti].msPositionInScore,
								simPos = systemSimsData[simIndex].msPositionInScore;

							while(simPos >= tObjPos && simIndex > 0)
							{
								maxPos = simPos;
								simIndex--;
								simPos = systemSimsData[simIndex].msPositionInScore;
							}

							if(maxPos > tObjPos)
							{
								maxPos = tObjPos;
								if(simPos < tObjPos)
								{
									let sim = new SimData(tObjPos, cursorYAttributes);
									systemSimsData.splice(simIndex + 1, 0, sim);
								}
								else if(simPos > tObjPos)
								{
									let sim = new SimData(tObjPos, cursorYAttributes);
									systemSimsData.splice(0, 0, sim);
								}
							}
						}
					}
				}
			}
			return systemSimsData;
		}

		private getFinalBarlineSimData(systems: any[]): SimData
		{
			let system = systems[systems.length - 1],
				cursorYAttributes = new CursorYAttributes(system.markersTop, system.markersBottom, system.pageOffsetTop),
				timeObjects = system.staves[0].voices[0].timeObjects,
				msPos: number = timeObjects[timeObjects.length - 1].msPositionInScore,
				finalBarlineSimData = new SimData(msPos, cursorYAttributes);

			return finalBarlineSimData;
		}

		scoreSimDatas: SimData[] = [];

		/**
		 * The .scoreSimData attribute will include SimData for the final barline.
		 * Each system is checked that it has the following attributes:
		 *     .markersTop
		 *     .markersBottom
		 *     .staves
		 * Each system.staff has voices
		 * Each voices has voice
		 * Each voice has
		 *     .isOutput
		 *     .timeObjects
		 * Each timeObject has
		 *     .msPositionInScore
		 *
		 * Each timeObject is either a:
		 *     MidiChord, MidiRest, InputChordDef or InputRestDef
		 * and also has other attributes, including .alignment and .msDurationInScore, but these are not checked.
		 * @param systems
		 */
		constructor(systems: any[]) // an array of systems
		{
			this.checkArgument(systems);

			for(let system of systems)
			{
				let systemSimData: SimData[] = this.getSystemSimData(system);

				for(let sim of systemSimData)
				{
					this.scoreSimDatas.push(sim);
				}
			}
			let finalBarlineSimData: SimData = this.getFinalBarlineSimData(systems); 
			this.scoreSimDatas.push(finalBarlineSimData);

			//let c: CursorYAttributes = this.sims[0].cursorYAttributes;
			//let a: number = 0;
			//for(let i = 0; i < this.sims.length; ++i)
			//{
			//	if(this.sims[i].cursorYAttributes !== c)
			//	{
			//		a = 1;
			//	}
		}
	}
}
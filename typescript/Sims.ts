
/// <reference path="Context.ts" />

namespace _AP
{
	export class YCoordinates
	{
		readonly top: number;
		readonly bottom: number;
		constructor(startMarker: StartMarker)
		{
			let line = startMarker.line;

			this.top = line.y1.baseVal.value;
			this.bottom = line.y2.baseVal.value;
		}
	}

	export class Sim
	{
		readonly msPositionInScore: number;
		readonly yCoordinates: YCoordinates;
		isOn: boolean = true; // is set to false, if the sim has no performing midiObjects

		private readonly timeObjects: TimeObject[] = []; // This array is accessed by trackIndex, and may contain undefined members.

		constructor(msPosInScore: number, yCoordinates: YCoordinates)
		{
			this.msPositionInScore = msPosInScore;
			this.yCoordinates = yCoordinates;
		}

		push(timeObject: TimeObject, trackIndex: number): void
		{
			timeObject.isOn = true;
			this.timeObjects[trackIndex] = timeObject;
		}
	}

	/* Includes Sim for the final barline. */
	export class ScoreSims
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

		private getSystemSims(system: SvgSystem): Sim[]
		{
			function getEmptySims(system: SvgSystem): Sim[]
			{
				let systemSims: Sim[] = [],
					yCoordinates = new YCoordinates(system.startMarker),
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
								let sim = new Sim(timeObjects[ti].msPositionInScore, yCoordinates);
								systemSims.push(sim);
							}
						}
						else
						{
							let maxPos = Number.MAX_VALUE,
								simIndex = systemSims.length - 1;
							for(let ti = nTimeObjects - 1; ti >= 0; --ti)
							{
								let tObjPos = timeObjects[ti].msPositionInScore,
									simPos = systemSims[simIndex].msPositionInScore;

								while(simPos >= tObjPos && simIndex > 0)
								{
									maxPos = simPos;
									simIndex--;
									simPos = systemSims[simIndex].msPositionInScore;
								}

								if(maxPos > tObjPos)
								{
									maxPos = tObjPos;
									if(simPos < tObjPos)
									{
										let sim = new Sim(tObjPos, yCoordinates);
										systemSims.splice(simIndex + 1, 0, sim);
									}
									else if(simPos > tObjPos)
									{
										let sim = new Sim(tObjPos, yCoordinates);
										systemSims.splice(0, 0, sim);
									}
								}
							}
						}
					}
				}

				return systemSims;
			}
			function addTimeObjectsToSims(system: SvgSystem, systemSims: Sim[]) : void
			{
				let nStaves = system.staves.length,
					trackIndex: number = 0;

				for(let staffIndex = 0; staffIndex < nStaves; ++staffIndex)
				{
					let staff = system.staves[staffIndex],
						nVoices = staff.voices.length;

					for(let voiceIndex = 0; voiceIndex < nVoices; ++voiceIndex, ++trackIndex)
					{
						let simIndex: number = 0;

						if(staff.voices[voiceIndex].timeObjects === undefined)
						{
							// this can happen if the voice is an InputVoice, and the input device is not selected.
							break
						}

						let timeObjects = staff.voices[voiceIndex].timeObjects;

						for(let tObjIndex = 0; tObjIndex < timeObjects.length - 1; ++tObjIndex) // (dont look at final barline)
						{
							let timeObject = timeObjects[tObjIndex]; 
							while(timeObject.msPositionInScore > systemSims[simIndex].msPositionInScore)
							{
								simIndex++;
								if(simIndex >= systemSims.length)
								{
									throw "error";
								}
							}

							systemSims[simIndex].push(timeObject, trackIndex); // undefined array elements can be added...
						}
					}
				}
			}

			let systemSims = getEmptySims(system);

			addTimeObjectsToSims(system, systemSims);

			return systemSims;
		}

		private getFinalBarlineSim(systems: SvgSystem[]): Sim
		{
			let system = systems[systems.length - 1],
				yCoordinates = new YCoordinates(system.startMarker),
				timeObjects = system.staves[0].voices[0].timeObjects,
				msPos: number = timeObjects[timeObjects.length - 1].msPositionInScore,
				finalBarlineSim = new Sim(msPos, yCoordinates);

			return finalBarlineSim;
		}

		scoreSims: Sim[] = [];

		/**
		 * The .scoreSims attribute includes a Sim for the final barline.
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
		constructor(systems: SvgSystem[]) // an array of systems
		{
			this.checkArgument(systems);

			for(let system of systems)
			{
				let systemSim: Sim[] = this.getSystemSims(system);

				for(let sim of systemSim)
				{
					this.scoreSims.push(sim);
				}
			}
			let finalBarlineSim: Sim = this.getFinalBarlineSim(systems); 
			this.scoreSims.push(finalBarlineSim);

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
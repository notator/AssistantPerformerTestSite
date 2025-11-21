class Barline
{
	constructor(alignment, msPosInScore)
	{
		Object.defineProperty(this, "alignment", {value: alignment, writable: false});
		Object.defineProperty(this, "msPosInScore", {value: msPosInScore, writable: false});
		Object.defineProperty(this, "msPosInPerfPerRegion", {value: [], writable: true});
	}
}

export class NormalBarline extends Barline
{
	constructor(alignment, msPosInScore)
	{
		super(alignment, msPosInScore);
	}
}
export class StartRegionBarline extends Barline
{
	constructor(alignment, msPosInScore)
	{
		super(alignment, msPosInScore);
	}
}

export class EndAndStartRegionBarline extends Barline
{
	constructor(alignment, msPosInScore)
	{
		super(alignment, msPosInScore);
	}
}

export class EndRegionBarline extends Barline
{
	constructor(alignment, msPosInScore)
	{
		super(alignment, msPosInScore);
	}
}

export class EndOfScoreBarline extends Barline
{
	constructor(alignment, msPosInScore)
	{
		super(alignment, msPosInScore);
	}
}

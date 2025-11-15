class Barline
{
	constructor(alignment)
	{
		Object.defineProperty(this, "alignment", {value: alignment, writable: false});
		Object.defineProperty(this, "msPosInScore", {value: -1, writable: true}); // Is set and frozen later
		Object.defineProperty(this, "msPosInPerfPerRegion", {value: [], writable: true});
	}
}

export class NormalBarline extends Barline
{
	constructor(alignment)
	{
		super(alignment);
	}
}
export class StartRegionBarline extends Barline
{
	constructor(alignment)
	{
		super(alignment);
	}
}

export class EndAndStartRegionBarline extends Barline
{
	constructor(alignment)
	{
		super(alignment);
	}
}

export class EndRegionBarline extends Barline
{
	constructor(alignment)
	{
		super(alignment);
	}
}

export class EndOfScoreBarline extends Barline
{
	constructor(alignment)
	{
		super(alignment);
	}
}

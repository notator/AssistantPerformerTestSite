
export class RegionDef
{
	constructor(regionDefElem)
	{
		var
			name = regionDefElem.getAttribute("name"),
			fromStartOfBar = parseInt(regionDefElem.getAttribute("fromStartOfBar"), 10),
			startMsPosInScore = parseInt(regionDefElem.getAttribute("startMsPosInScore"), 10),
			toEndOfBarAttr = regionDefElem.getAttribute("toEndOfBar"),
			toEndOfBar = (toEndOfBarAttr === "final") ? "final" : parseInt(toEndOfBarAttr, 10),
			endMsPosAttr = regionDefElem.getAttribute("endMsPosInScore"),
			endMsPosInScore = (toEndOfBarAttr === "final") ? Number.MAX_VALUE : parseInt(endMsPosAttr, 10);

		//Each name must be a (any) single character.
		console.assert(name.length === 1);
		console.assert(!isNaN(startMsPosInScore));
		console.assert(!isNaN(endMsPosInScore));

		// fromStartOfBar and toEndOfBar correspond correctly to the msPos values,
		// but they are currently just used as comments while debugging.
		Object.defineProperty(this, "name", { value: name, writable: false });
		Object.defineProperty(this, "fromStartOfBar", { value: fromStartOfBar, writable: false });
		Object.defineProperty(this, "startMsPosInScore", { value: startMsPosInScore, writable: false });
		Object.defineProperty(this, "toEndOfBar", { value: toEndOfBar, writable: false });
		Object.defineProperty(this, "endMsPosInScore", { value: endMsPosInScore, writable: false });
	}
}



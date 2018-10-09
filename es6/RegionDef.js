
export class RegionDef
{
	constructor(regionDefElem, regionInfoStringElems)
	{
		var
			name = regionDefElem.getAttribute("name"),
			fromStartOfBar = parseInt(regionDefElem.getAttribute("fromStartOfBar"), 10),
			startMsPosInScore = parseInt(regionDefElem.getAttribute("startMsPosInScore"), 10),
			toEndOfBarAttr = regionDefElem.getAttribute("toEndOfBar"),
			toEndOfBar = (toEndOfBarAttr === "final") ? "final" : parseInt(toEndOfBarAttr, 10),
			endMsPosAttr = regionDefElem.getAttribute("endMsPosInScore"),
			endMsPosInScore = (toEndOfBarAttr === "final") ? Number.MAX_VALUE : parseInt(endMsPosAttr, 10),
			_startRegionInfoStringElem,
			_endRegionInfoStringElem;

		console.assert(!isNaN(startMsPosInScore));
		console.assert(!isNaN(endMsPosInScore));

		for(let textElem of regionInfoStringElems)
		{
			let t = textElem.innerHTML;
			if(t.localeCompare(name) === 0)
			{
				_startRegionInfoStringElem = textElem;
				break;
			}
		}
		for(let textElem of regionInfoStringElems)
		{
			let t = textElem.innerHTML;
			if(t.indexOf(name) === 0 && t.length > name.length)
			{
				let char = t.slice(name.length, name.length + 1);
				if(isNaN(char))
				{
					_endRegionInfoStringElem = textElem;
					break;
				}
			}
		}

		function setInfoStringsColor(colorString)
		{
			_startRegionInfoStringElem.setAttribute('fill', colorString);
			_endRegionInfoStringElem.setAttribute('fill', colorString);
		}

		// fromStartOfBar and toEndOfBar correspond correctly to the msPos values,
		// but they are currently just used as comments while debugging.		
		Object.defineProperty(this, "name", { value: name, writable: false });
		Object.defineProperty(this, "fromStartOfBar", { value: fromStartOfBar, writable: false });
		Object.defineProperty(this, "startMsPosInScore", { value: startMsPosInScore, writable: false });
		Object.defineProperty(this, "toEndOfBar", { value: toEndOfBar, writable: false });
		Object.defineProperty(this, "endMsPosInScore", { value: endMsPosInScore, writable: false });
		Object.defineProperty(this, "setInfoStringsColor", { value: setInfoStringsColor, writable: false });

		// startMarkerMsPosInScore can be different from startMsPosInScore only in the first regionDef that is going to be performed.
		Object.defineProperty(this, "startMarkerMsPosInScore", { value: startMsPosInScore, writable: true });
		// endMarkerMsPosInScore can be different from endMsPosInScore only in the last regionDef that is going to be performed.
		Object.defineProperty(this, "endMarkerMsPosInScore", { value: endMsPosInScore, writable: true });
	}
}



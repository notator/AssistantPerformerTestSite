
export class RegionDef
{
	constructor(regionDefElem, regionInfoStringElems, scoreSpanRegionData)
	{
		// public function
		function setActiveInfoStringsStyle(isActive)
		{
			if(_startRegionInfoStringElem === undefined)
			{
				// is undefined when there is only one region (having no infoStrings in boxes)
				return; 
			}

			let startColorString, endColorString, weightString;
			if(isActive)
			{
				startColorString = '#EE0000'; //'#00CC00'; // marker is '#009900'
				endColorString = '#EE0000'; //'#DD0000'; // marker is '#EE0000'
				weightString = 'normal';
			}
			else
			{
				startColorString = 'black';
				endColorString = 'black';
				weightString = 'normal';
			}
			_startRegionInfoStringElem.setAttribute('fill', startColorString);
			_startRegionInfoStringElem.setAttribute('font-weight', weightString);
			_endRegionInfoStringElem.setAttribute('fill', endColorString);
			_endRegionInfoStringElem.setAttribute('font-weight', weightString);
		}

		let // static values, used by the public setActiveInfoStringsStyle function.
			// This function is only used when there is more than one region/interpretation.
			_startRegionInfoStringElem,
			_endRegionInfoStringElem,
			// public values (overridden when regionDefElem is defined)
			shortName = "",
			longName = "",
			interpIndex = 0,
			//fromStartOfBar = 1,
			//toEndOfBar = "last",
			startMsPosInScore = 0,
			endMsPosInScore = Number.MAX_VALUE;			
		
		if(scoreSpanRegionData !== undefined)
		{
			// scoreSpanRegionData is used when loading scores that have no defined regions in their SVG.
			// Such scores are given one or more parallel regions, one for each interpretation.
			shortName = scoreSpanRegionData.shortName;
			longName = scoreSpanRegionData.longName;
			interpIndex = scoreSpanRegionData.interpIndex;
			startMsPosInScore = scoreSpanRegionData.startMsPosInScore;
			endMsPosInScore = scoreSpanRegionData.endMsPosInScore;	
		}
		else if(regionDefElem !== undefined)
		{
			shortName = regionDefElem.getAttribute("name");
			longName = "region " + shortName;
			interpIndex = parseInt(regionDefElem.getAttribute("midiChordIndex"), 10);
			//fromStartOfBar = parseInt(regionDefElem.getAttribute("fromStartOfBar"), 10);
			//toEndOfBar = parseInt(regionDefElem.getAttribute("toEndOfBar"), 10);
			startMsPosInScore = parseInt(regionDefElem.getAttribute("startMsPosInScore"), 10);
			endMsPosInScore = parseInt(regionDefElem.getAttribute("endMsPosInScore"), 10);

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
					if(char.localeCompare(' ') === 0 || isNaN(char))
					{
						_endRegionInfoStringElem = textElem;
						break;
					}
				}
			}
		}

		Object.defineProperty(this, "shortName", {value: shortName, writable: false});
		Object.defineProperty(this, "longName", {value: longName, writable: false});
		Object.defineProperty(this, "interpIndex", {value: interpIndex, writable: false});
		Object.defineProperty(this, "startMsPosInScore", {value: startMsPosInScore, writable: false});
		Object.defineProperty(this, "endMsPosInScore", {value: endMsPosInScore, writable: false});		

		// fromStartOfBar and toEndOfBar are non-functional comments, defined by Moritz that can be used while debugging.
		// They could be deleted from both the SVG files and this region definition.
		//Object.defineProperty(this, "fromStartOfBar", {value: fromStartOfBar, writable: false});
		//Object.defineProperty(this, "toEndOfBar", {value: toEndOfBar, writable: false});				

		// The infoStrings are the region names (in boxes above the region start and ends) that change colour
		// to show which region is being performed. Such boxes only exist when two or more regions exist.
		Object.defineProperty(this, "setActiveInfoStringsStyle", { value: setActiveInfoStringsStyle, writable: false });
	}
}




export class RegionDef
{
	constructor(regionDefElem, regionInfoStringElems)
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

		let // static values, used by the above function (when regionDefElem is defined).
			_startRegionInfoStringElem,
			_endRegionInfoStringElem,
			// default values (overridden when regionDefElem is defined)
			endMsPosInScore = Number.MAX_VALUE,
			fromStartOfBar = 1,
			interpIndex = 0,
			name = "a",
			startMsPosInScore = 0,
			toEndOfBar = "last";

		if(regionDefElem !== undefined)
		{
			endMsPosInScore = parseInt(regionDefElem.getAttribute("endMsPosInScore"), 10);
			fromStartOfBar = parseInt(regionDefElem.getAttribute("fromStartOfBar"), 10);
			interpIndex = parseInt(regionDefElem.getAttribute("midiChordIndex"), 10);
			name = regionDefElem.getAttribute("name");
			startMsPosInScore = parseInt(regionDefElem.getAttribute("startMsPosInScore"), 10);
			toEndOfBar = parseInt(regionDefElem.getAttribute("toEndOfBar"), 10);

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

		Object.defineProperty(this, "name", {value: name, writable: false});
		Object.defineProperty(this, "startMsPosInScore", {value: startMsPosInScore, writable: false});
		Object.defineProperty(this, "endMsPosInScore", {value: endMsPosInScore, writable: true}); // is set while loading 1-region scores.		
		Object.defineProperty(this, "interpIndex", {value: interpIndex, writable: false});		

		// fromStartOfBar and toEndOfBar are non-functional comments, defined by Moritz and used while debugging.
		// They could be deleted from both the SVG files and this region definition. (Don't rely on them in active javascript!)
		Object.defineProperty(this, "fromStartOfBar", {value: fromStartOfBar, writable: false});
		Object.defineProperty(this, "toEndOfBar", {value: toEndOfBar, writable: false});				

		// The infoStrings are the region names (in boxes above the region start and ends) that change colour
		// to show which region is being performed. Such boxes only exist when two or more regions exist.
		Object.defineProperty(this, "setActiveInfoStringsStyle", { value: setActiveInfoStringsStyle, writable: false });
	}
}



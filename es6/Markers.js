
const GREEN = '#009900';
const RED = '#EE0000';
const CIRCLE_RADIUS = 5; // user html pixels;
const EXTRA_TOP_AND_BOTTOM = 45; // user html pixels

class Marker
{
	constructor(system, systemIndexInScore, regionSequence, vbScale)
	{
		let top, bottom;

		this.element = document.createElementNS("http://www.w3.org/2000/svg", "g");
		this.line = document.createElementNS("http://www.w3.org/2000/svg", 'line');
		this.circle = document.createElementNS("http://www.w3.org/2000/svg", 'circle');

		this.element.appendChild(this.line);
		this.element.appendChild(this.circle);
		if(regionSequence.length > 1)
		{
			this.text = document.createElementNS("http://www.w3.org/2000/svg", 'text');
			this.element.appendChild(this.text);
		}

		this.viewBoxScale = vbScale;

		top = (system.markersTop - EXTRA_TOP_AND_BOTTOM).toString();
		bottom = (system.markersBottom + EXTRA_TOP_AND_BOTTOM).toString();

		this.line.setAttribute('x1', '0');
		this.line.setAttribute('y1', top);
		this.line.setAttribute('x2', '0');
		this.line.setAttribute('y2', bottom);
		this.line.setAttribute("style", "stroke-width:1px");
		this.line.style.strokeWidth = 4; // 1/2 pixel

		this.circle.setAttribute('cx', '0');
		this.circle.setAttribute('cy', top);
		this.circle.setAttribute('r', (vbScale * CIRCLE_RADIUS).toString());
		this.circle.style.strokeWidth = 0;

		if(this.text !== undefined)
		{
			this.text.setAttribute("dy", (vbScale * CIRCLE_RADIUS * 0.8).toString()); // baseline will be below y
			this.text.setAttribute('x', '0'); // dx will be set, so origin will not be 0
			this.text.setAttribute('y', top); // dy will be set, so baseline will be below top
			this.text.setAttribute('display', 'none');
		}

		this.yCoordinates = {};
		this.yCoordinates.top = Math.round(parseFloat(top) / vbScale);
		this.yCoordinates.bottom = Math.round(parseFloat(bottom) / vbScale);

		Object.defineProperty(this, "systemIndexInScore", { value: systemIndexInScore, writable: false });

	}

	moveTo(timeObject)
	{
		var x = timeObject.alignment * this.viewBoxScale;

		this.alignment = timeObject.alignment;
		this.msPositionInScore = timeObject.msPositionInScore;

		this.line.setAttribute('x1', x.toString());
		this.line.setAttribute('x2', x.toString());
		this.circle.setAttribute('cx', x.toString());
		if(this.text !== undefined)
		{
			this.text.setAttribute('x', x.toString());
		}
	}

	setVisible(setToVisible)
	{
		if(setToVisible)
		{
			this.line.style.visibility = 'visible';
			this.circle.style.visibility = 'visible';
			if(this.text !== undefined)
			{
				this.text.setAttribute('display', 'display');
			}
		}
		else
		{
			this.line.style.visibility = 'hidden';
			this.circle.style.visibility = 'hidden';
			if(this.text !== undefined)
			{
				this.text.setAttribute('display', 'none');
			}
		}
	}

	setName(markerName)
	{
		if(this.text !== undefined)
		{
			this.text.textContent = markerName;
		}
	}
}

export class StartMarker extends Marker
{
	// It contains a line, a circle and (possibly) a text element.
	constructor(system, systemIndexInScore, regionSequence, vbScale)
	{
		super(system, systemIndexInScore, regionSequence, vbScale);

		/**** begin specific to startMarker */
		this.line.style.stroke = GREEN;
		this.circle.style.fill = GREEN;
		if(this.text !== undefined)
		{
			this.text.setAttribute("dx", (vbScale * CIRCLE_RADIUS * 1.25).toString()); // left edge will be right of x
			this.text.textContent = regionSequence[0].name;
			let styleString = 'fill:' + GREEN + '; font-size:' + (vbScale * CIRCLE_RADIUS * 2.4).toString() + '; font-family:sans-serif; font-weight:bold';
			this.text.setAttribute('style', styleString);
		}
		/**** end specific to startMarker */

		this.setVisible(false);
	}
}

export class EndMarker extends Marker
{
	// It contains a line, a circle and (possibly) a text element.
	constructor(system, systemIndexInScore, regionSequence, vbScale)
	{
		super(system, systemIndexInScore, regionSequence, vbScale);

		/**** begin specific to endMarker */
		this.line.style.stroke = RED;
		this.circle.style.fill = RED;
		if(this.text !== undefined)
		{
			this.text.setAttribute('text-anchor', 'end');
			this.text.setAttribute("dx", (vbScale * CIRCLE_RADIUS * -1.25).toString()); // right edge will be left of x
			this.text.textContent = regionSequence[regionSequence.length - 1].name;
			let styleString = 'fill:' + RED + '; font-size:' + (vbScale * CIRCLE_RADIUS * 2.4).toString() + '; font-family:sans-serif; font-weight:bold';
			this.text.setAttribute('style', styleString);
		}
		/**** end specific to endMarker */

		this.setVisible(false);
	}
}
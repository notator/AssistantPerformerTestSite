﻿const GREEN = '#009900';
const RED = '#EE0000';
const CIRCLE_RADIUS = 5; // user html pixels;

class Marker
{
	// Contains a line, a disk and (possibly) a text element.
	constructor(system, systemIndexInScore, regionSequence, vbScale)
	{
		let top = system.markersTop.toString(),
			bottom = system.markersBottom.toString(),
			element = document.createElementNS("http://www.w3.org/2000/svg", "g"),
			line = document.createElementNS("http://www.w3.org/2000/svg", 'line'),
			circle = document.createElementNS("http://www.w3.org/2000/svg", 'circle'),
			yCoordinates = {},
			text;

		element.appendChild(line);
		element.appendChild(circle);
		if(regionSequence.length > 1)
		{
			text = document.createElementNS("http://www.w3.org/2000/svg", 'text');
			element.appendChild(text);
		}

		line.setAttribute('x1', '0');
		line.setAttribute('y1', top);
		line.setAttribute('x2', '0');
		line.setAttribute('y2', bottom);
		line.setAttribute("style", "stroke-width:1px");
		line.style.strokeWidth = 4; // 1/2 pixel

		circle.setAttribute('cx', '0');
		circle.setAttribute('cy', top);
		circle.setAttribute('r', (vbScale * CIRCLE_RADIUS).toString());
		circle.style.strokeWidth = 0;

		if(text !== undefined)
		{
			text.setAttribute("dy", (vbScale * CIRCLE_RADIUS * 0.8).toString()); // baseline will be below y
			text.setAttribute('x', '0'); // dx will be set, so origin will not be 0
			text.setAttribute('y', top); // dy will be set, so baseline will be below top
			text.setAttribute('style', 'font-size: ' + (vbScale * CIRCLE_RADIUS * 2.4).toString() + '; font-family: sans-serif; font-weight: bold');
		}

		yCoordinates.top = Math.round(parseFloat(top) / vbScale);
		yCoordinates.bottom = Math.round(parseFloat(bottom) / vbScale);

		Object.defineProperty(this, "viewBoxScale", { value: vbScale, writable: false });
		Object.defineProperty(this, "element", { value: element, writable: false });
		Object.defineProperty(this, "line", { value: line, writable: false });
		Object.defineProperty(this, "circle", { value: circle, writable: false });
		if(text !== undefined)
		{
			Object.defineProperty(this, "text", { value: text, writable: false });
		}
		Object.defineProperty(this, "yCoordinates", { value: yCoordinates, writable: false });
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
	constructor(system, systemIndexInScore, regionSequence, vbScale)
	{
		super(system, systemIndexInScore, regionSequence, vbScale);

		this.line.style.stroke = GREEN;
		this.circle.style.fill = GREEN;
		if(this.text !== undefined)
		{
			this.text.setAttribute("dx", (vbScale * CIRCLE_RADIUS * 1.25).toString()); // left edge will be right of x
			this.text.textContent = regionSequence[0].name;
			this.text.style.fill = GREEN;
		}

		this.setVisible(false);
	}
}

export class EndMarker extends Marker
{
	constructor(system, systemIndexInScore, regionSequence, vbScale)
	{
		super(system, systemIndexInScore, regionSequence, vbScale);

		this.line.style.stroke = RED;
		this.circle.style.fill = RED;
		if(this.text !== undefined)
		{
			this.text.setAttribute('text-anchor', 'end'); // right edge will be left of x
			this.text.setAttribute("dx", (vbScale * CIRCLE_RADIUS * -1.25).toString()); // right edge will be left of x
			this.text.textContent = regionSequence[regionSequence.length - 1].name;
			this.text.style.fill = RED;
		}

		this.setVisible(false);
	}
}
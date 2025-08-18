const GREEN = '#009900';
const RED = '#EE0000';
const CIRCLE_RADIUS = 5; // user html pixels;

class Marker
{
	// Contains a line, a disk and (possibly) a text element.
	constructor(yCoordinates, systemIndex, vbScale)
	{
		let element = document.createElementNS("http://www.w3.org/2000/svg", "g"),
			line = document.createElementNS("http://www.w3.org/2000/svg", 'line'),
			circle = document.createElementNS("http://www.w3.org/2000/svg", 'circle'),
			text = document.createElementNS("http://www.w3.org/2000/svg", 'text'),
			svgTop, svgBottom;

		svgTop = (yCoordinates.top * vbScale).toString();
		svgBottom = (yCoordinates.bottom * vbScale).toString(); 

		element.appendChild(line);
		element.appendChild(circle);
		element.appendChild(text);

		line.setAttribute('x1', '0');
		line.setAttribute('y1', svgTop);
		line.setAttribute('x2', '0');
		line.setAttribute('y2', svgBottom);
		line.setAttribute("style", "stroke-width:1px");
		line.style.strokeWidth = 4; // 1/2 pixel

		circle.setAttribute('cx', '0');
		circle.setAttribute('cy', svgTop);
		circle.setAttribute('r', (vbScale * CIRCLE_RADIUS).toString());
		circle.style.strokeWidth = 0;

		let textBoxWidth = (vbScale * CIRCLE_RADIUS * 10);
		text.setAttribute("dy", (vbScale * CIRCLE_RADIUS * 0.8).toString()); // baseline will be below y
		text.setAttribute('x', '0'); // dx will be set, so origin will not be 0
		text.setAttribute('y', svgTop); // dy will be set, so baseline will be below top
		text.setAttribute('textLength', textBoxWidth.toString()); // constant width of the text element in pixels
		text.setAttribute('fontSize', (vbScale * CIRCLE_RADIUS * 2.4).toString());
		text.setAttribute('fontFamily', 'sans-serif');
		text.setAttribute('fontWeight', 'bold');
		text.setAttribute('fill', GREEN);
		text.setAttribute('textAnchor', 'end');// anchor position is the right edge of the text.
		text.setAttribute('dx', ((vbScale * CIRCLE_RADIUS * -1.4) - text.textLength.baseVal.value).toString()); // right edge of text will be left of x
		text.setAttribute('textContent', 'HHH'); // default for debugging - will be set using setLable(region.shortName) later

		Object.defineProperty(this, "viewBoxScale", { value: vbScale, writable: false });
		Object.defineProperty(this, "element", { value: element, writable: false });
		Object.defineProperty(this, "line", { value: line, writable: false });
		Object.defineProperty(this, "circle", {value: circle, writable: false});
		Object.defineProperty(this, "text", {value: text, writable: false});
		Object.defineProperty(this, "yCoordinates", { value: yCoordinates, writable: false });
		Object.defineProperty(this, "systemIndex", { value: systemIndex, writable: false });
	}

	// the top of the line (excluding the disk)
	top()
	{
		let top = parseFloat(this.line.getAttribute('y1')) / this.viewBoxScale;
		return top;
	}

	// the height of the line (excluding the disk)
	height()
	{
		let bottom = parseFloat(this.line.getAttribute('y2')) / this.viewBoxScale;
		return bottom - this.top();
	}

	moveTo(timeObject)
	{
		var x = timeObject.alignment * this.viewBoxScale;

		this.alignment = timeObject.alignment;
		this.msPositionInScore = timeObject.msPositionInScore;

		this.line.setAttribute('x1', x.toString());
		this.line.setAttribute('x2', x.toString());
		this.circle.setAttribute('cx', x.toString());
		this.text.setAttribute('x', x.toString());
	}

	setVisible(setToVisible)
	{
		if(setToVisible)
		{
			this.line.style.visibility = 'visible';
			this.circle.style.visibility = 'visible';
			this.text.style.visibility = 'visible';
		}
		else
		{
			this.line.style.visibility = 'hidden';
			this.circle.style.visibility = 'hidden';
			this.text.style.visibility = 'hidden';
		}
	}

	setLable(lableString)
	{
		this.text.textContent = lableString;
	}
}

export class StartMarker extends Marker
{

	constructor(yCoordinates, systemIndex, vbScale)
	{
		super(yCoordinates, systemIndex, vbScale);

		this.line.style.stroke = GREEN;
		this.circle.style.fill = GREEN;
		this.text.setAttribute('fill', GREEN);
		this.text.setAttribute('textAnchor', 'end');// anchor position is the right edge of the text.
		this.text.setAttribute('dx', ((vbScale * CIRCLE_RADIUS * -1.4) - this.text.textLength.baseVal.value).toString()); // right edge of text will be left of x
		this.text.setAttribute('textContent', 'HHH'); // default for debugging - will be set using setLable(region.shortName) later
		
		this.setVisible(false);
	}
}

export class EndMarker extends Marker
{
	constructor(yCoordinates, systemIndex, vbScale)
	{
		super(yCoordinates, systemIndex, vbScale);

		this.line.style.stroke = RED;
		this.circle.style.fill = RED;
		this.text.setAttribute('fill', RED);
		this.text.setAttribute('textAnchor', 'start'); // anchor position is the left edge of the text.
		this.text.setAttribute('dx', (vbScale * CIRCLE_RADIUS * 1.4).toString()); // left edge will be right of x
		this.text.setAttribute('textContent', 'HHH'); // default for debugging - will be set using setLable(region.shortName) later
		
		this.setVisible(false);
	}
}
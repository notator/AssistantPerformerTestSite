export class EndMarker
{
	// The svgEndMarkerGroup is an svg group with id='endMarker'.
	// It contains an svg line, rect and text element.
	constructor(system, systemIndexInScore, svgEndMarkerGroup, vbScale)
	{
		// returns an object having rect, line, halfRectWidth and viewBoxScale attributes;
		function getParams(system, svgEndMarkerGroup, vbScale)
		{
			var EXTRA_TOP_AND_BOTTOM = 45, // user html pixels
				RECT_WIDTH_AND_HEIGHT = 8, // user html pixels
				RED = '#EE0000',
				top, bottom, rectX, rectY, widthHeight,
				params = {};

			function getComponents(params, svgEndMarkerGroup)
			{
				var i, groupChildren = svgEndMarkerGroup.childNodes;

				for(i = 0; i < groupChildren.length; ++i)
				{
					if(groupChildren[i].nodeName === 'line')
					{
						params.line = groupChildren[i];
					}
					if(groupChildren[i].nodeName === 'rect')
					{
						params.rect = groupChildren[i];
					}
					if(groupChildren[i].nodeName === 'text')
					{
						params.text = groupChildren[i];
					}
				}
			}

			getComponents(params, svgEndMarkerGroup);

			params.viewBoxScale = vbScale;

			top = (system.markersTop - EXTRA_TOP_AND_BOTTOM).toString();
			bottom = (system.markersBottom + EXTRA_TOP_AND_BOTTOM).toString();

			rectX = (vbScale * (-RECT_WIDTH_AND_HEIGHT / 2)).toString(10);
			rectY = (top - (vbScale * (RECT_WIDTH_AND_HEIGHT / 2))).toString(10);

			params.halfRectWidth = (vbScale * RECT_WIDTH_AND_HEIGHT) / 2;
			widthHeight = (vbScale * RECT_WIDTH_AND_HEIGHT).toString(10);

			params.line.setAttribute('x1', '0');
			params.line.setAttribute('y1', top);
			params.line.setAttribute('x2', '0');
			params.line.setAttribute('y2', bottom);

			params.line.style.strokeWidth = 4;
			params.line.style.stroke = RED;

			params.rect.setAttribute('x', rectX);
			params.rect.setAttribute('y', rectY);
			params.rect.setAttribute('width', widthHeight);
			params.rect.setAttribute('height', widthHeight);

			if(params.text !== undefined)
			{
				params.text.setAttribute("dx", (vbScale * RECT_WIDTH_AND_HEIGHT * -0.7).toString()); // left edge will be right of x
				params.text.setAttribute("dy", (vbScale * RECT_WIDTH_AND_HEIGHT * 0.5).toString()); // baseline will be below y
				params.text.setAttribute('text-anchor', 'end');
				params.text.setAttribute('x', '0'); // dx has been set, so will be right of 0
				params.text.setAttribute('y', top); // dy has been set, so baseline will be below top
				let styleString = 'fill:' + RED + '; font-size:' + (vbScale * RECT_WIDTH_AND_HEIGHT * 1.5).toString() + '; font-family:sans-serif; font-weight:bold';
				params.text.setAttribute('style', styleString);
				params.text.setAttribute('display', 'none');
			}

			params.rect.style.strokeWidth = 0;
			params.rect.style.fill = RED;

			return params;
		}

		Object.defineProperty(this, "systemIndexInScore", { value: systemIndexInScore, writable: false });

		let p = getParams(system, svgEndMarkerGroup, vbScale);
		if(p.text !== undefined)
		{
			Object.defineProperty(this, "text", { value: p.text, writable: false });
		}
		Object.defineProperty(this, "rect", { value: p.rect, writable: false });
		Object.defineProperty(this, "halfRectWidth", { value: p.halfRectWidth, writable: false });
		Object.defineProperty(this, "line", { value: p.line, writable: false });
		Object.defineProperty(this, "viewBoxScale", { value: p.viewBoxScale, writable: false });

		Object.defineProperty(this, "msPositionInScore", { value: 0, writable: true });

		this.setVisible(false);
	}

	// the argument's alignment is in user html pixels
	moveTo(timeObject)
	{
		var x = timeObject.alignment * this.viewBoxScale;

		this.msPositionInScore = timeObject.msPositionInScore;

		this.line.setAttribute('x1', x.toString());
		this.line.setAttribute('x2', x.toString());
		this.rect.setAttribute('x', (x - this.halfRectWidth).toString());
		if(this.text !== undefined)
		{
			this.text.setAttribute('x', x.toString());
		}
	}

	setVisible(setToVisible)
	{
		if(setToVisible)
		{
			this.rect.style.visibility = 'visible';
			this.line.style.visibility = 'visible';
			if(this.text !== undefined)
			{
				this.text.setAttribute('display', 'display');
			}
		}
		else
		{
			this.rect.style.visibility = 'hidden';
			this.line.style.visibility = 'hidden';
			if(this.text !== undefined)
			{
				this.text.setAttribute('display', 'none');
			}
		}
	}

	setName(regionName)
	{
		if(this.text !== undefined)
		{
			this.text.textContent = regionName;
		}
	}
}

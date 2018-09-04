export class StartMarker
{
	// The svgStartMarkerGroup is an svg group with class='startMarker'.
	// It contains an svg line and an svg circle element.
	constructor(system, systemIndexInScore, svgStartMarkerGroup, vbScale)
	{
		// returns an object having circle, line, viewBoxScale and yCoordinates attributes;
		function getParams(system, svgStartMarkerGroup, vbScale)
		{
			var EXTRA_TOP_AND_BOTTOM = 45, // user html pixels
				CIRCLE_RADIUS = 5, // user html pixels
				GREEN = '#009900',
				top, bottom, params = {};

			function getComponents(params, svgStartMarkerGroup)
			{
				var i, groupChildren = svgStartMarkerGroup.childNodes;

				for(i = 0; i < groupChildren.length; ++i)
				{
					if(groupChildren[i].nodeName === 'line')
					{
						params.line = groupChildren[i];
					}
					if(groupChildren[i].nodeName === 'circle')
					{
						params.circle = groupChildren[i];
					}
				}
			}

			getComponents(params, svgStartMarkerGroup);

			params.viewBoxScale = vbScale;

			top = (system.markersTop - EXTRA_TOP_AND_BOTTOM).toString();
			bottom = (system.markersBottom + EXTRA_TOP_AND_BOTTOM).toString();

			params.line.setAttribute('x1', '0');
			params.line.setAttribute('y1', top);
			params.line.setAttribute('x2', '0');
			params.line.setAttribute('y2', bottom);

			params.line.style.strokeWidth = 4; // 1/2 pixel
			params.line.style.stroke = GREEN;

			params.circle.setAttribute('cy', top);
			params.circle.setAttribute('r', (vbScale * CIRCLE_RADIUS).toString());
			params.circle.style.strokeWidth = 0;
			params.circle.style.fill = GREEN;

			params.yCoordinates = {};
			params.yCoordinates.top = Math.round(parseFloat(top) / vbScale);
			params.yCoordinates.bottom = Math.round(parseFloat(bottom) / vbScale);

			return params;
		}

		Object.defineProperty(this, "systemIndexInScore", { value: systemIndexInScore, writable: false });

		let p = getParams(system, svgStartMarkerGroup, vbScale);
		Object.defineProperty(this, "circle", { value: p.circle, writable: false });
		Object.defineProperty(this, "line", { value: p.line, writable: false });
		Object.defineProperty(this, "viewBoxScale", { value: p.viewBoxScale, writable: false });
		Object.defineProperty(this, "yCoordinates", { value: p.yCoordinates, writable: false });
		
		Object.defineProperty(this, "alignment", { value: null, writable: true });
		Object.defineProperty(this, "msPositionInScore", { value: 0, writable: true });

		this.setVisible(false);
	}

	moveTo(timeObject)
	{
		var x = timeObject.alignment * this.viewBoxScale;

		this.alignment = timeObject.alignment;
		this.msPositionInScore = timeObject.msPositionInScore;

		this.line.setAttribute('x1', x.toString());
		this.line.setAttribute('x2', x.toString());
		this.circle.setAttribute('cx', x.toString());
	}

	setVisible(setToVisible)
	{
		if(setToVisible)
		{
			this.line.style.visibility = 'visible';
			this.circle.style.visibility = 'visible';
		}
		else
		{
			this.line.style.visibility = 'hidden';
			this.circle.style.visibility = 'hidden';
		}
	}
}
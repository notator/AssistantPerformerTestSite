
const
	DISABLED_FRAME_ID = "trackControlsFrameDisabled",

	// colours in this tracksControl
	BACKGROUND_GREEN = "#F5FFF5",
	TRACKOFF_FILLCOLOR = BACKGROUND_GREEN,
	DISABLED_BULLET_STROKECOLOR = "#FFFFFF", // used with opacity
	DISABLED_BULLET_FILLCOLOR = "#FFFFFF", // used with opacity

	TRACKNUMBER_COLOR = "#000000",
	BULLET_STROKECOLOR = "#000000",
	BULLET_FILLCOLOR = "#AAAAAA",
	OVERBULLET_STROKECOLOR = "#00CE00", // mouseover ring

	// constants for track control opacity values
	METAL = "1", // control layer is completely opaque
	SMOKE = "0.7", // control layer is fairly opaque
	GLASS = "0"; // control layer is completely transparent

let
	trackCtlElems = [], // the controls for individual tracks

	scoreRefresh = undefined, // a callback that tells the score to redraw itself

	setTrackCtlState = function(trackIndex, state)
	{
		var
			offLayer = document.getElementById("bullet" + (trackIndex + 1).toString() + "Off"),
			disabledLayer = document.getElementById("bullet" + (trackIndex + 1).toString() + "Disabled");
		trackCtlElems[trackIndex].previousState = trackCtlElems[trackIndex].state;

		switch(state)
		{
			case "on":
				offLayer.setAttribute("opacity", GLASS);
				disabledLayer.setAttribute("opacity", GLASS);
				trackCtlElems[trackIndex].state = "on";
				break;
			case "off":
				offLayer.setAttribute("opacity", METAL);
				disabledLayer.setAttribute("opacity", GLASS);
				trackCtlElems[trackIndex].state = "off";
				break;
			case "disabled":
				disabledLayer.setAttribute("opacity", SMOKE);
				trackCtlElems[trackIndex].state = "disabled";
				break;
		}
	},

	bbWidth = 0, // the width of the bounding box. Set in init()

	// Returns a new array containing the boolean values in the trackCtlElems.
	// The tracks' state cannot be set by changing values in the returned array.
	// This function is called by the trackOnOff function below.
	getCurrentReadOnlyTrackIsOnArray = function()
	{
		var i, readOnlyArray = [];
		for(i = 0; i < trackCtlElems.length; ++i)
		{
			readOnlyArray.push(trackCtlElems[i].state === "on"); // "disabled" and "off" are both "off" here
		}
		return readOnlyArray;
	};

export class TracksControl
{
	constructor()
	{
	}

	// Called after loading a particular score.
	init(nTrackControls)
	{
		let trackControlsMainElem, svgTrackControlsElem, trackCtlElem,
			controlPanel = document.getElementById("svgRuntimeControls"),
			firstControlPanelChild,
			i, parentElem,
			trackControlsWidth;

		function getTrackControlsMainElem(trackControlsWidth)
		{
			var trackControlsMainElem = document.getElementById("trackControlsMainElem");
			if(trackControlsMainElem !== null)
			{
				parentElem = trackControlsMainElem.parentNode;
				parentElem.removeChild(trackControlsMainElem);
			}
			bbWidth = parseInt(trackControlsWidth, 10) + 2;
			trackControlsMainElem = document.createElementNS("http://www.w3.org/2000/svg", 'svg');
			trackControlsMainElem.setAttribute("id", "trackControlsMainElem");
			trackControlsMainElem.setAttribute("width", bbWidth);
			trackControlsMainElem.setAttribute("height", "36px");
			trackControlsMainElem.style.position = "absolute";
			trackControlsMainElem.style.top = 0;
			trackControlsMainElem.style.left = 0;

			return trackControlsMainElem;
		}

		function svgElem(contentString)
		{
			var div = document.createElementNS('http://www.w3.org/1999/xhtml', 'div'),
				frag = document.createDocumentFragment();

			div.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg">' + contentString + '</svg>';
			frag.appendChild(div.firstChild.firstChild);

			return frag.firstChild;
		}

		// append the following child nodes to the trackControlsMainElem
		// <rect id="trackControlsFrame" x="0" y="0" width="' + width + '" height="30" stroke="#008000" stroke-width="1" fill="#F5FFF5" />
		// <rect id="trackControlsFrameDisabled" x="0" y="0" width="' + width + '" height="30" stroke="#FFFFFF" stroke-width="1" fill="#FFFFFF" opacity="0" />
		function addFrames(trackControlsMainElem, trackControlsWidth)
		{
			var frameElem, disabledFrameElem;

			frameElem = svgElem('<rect id="trackControlsFrame" x="0" y="0" width="' + trackControlsWidth + '" height="30" stroke="#008000" stroke-width="1" fill="#F5FFF5" />');
			disabledFrameElem = svgElem('<rect id="' + DISABLED_FRAME_ID + '" x="0" y="0" width="' + trackControlsWidth + '" height="30" stroke="#FFFFFF" stroke-width="1" fill="#FFFFFF" opacity=' + GLASS + ' />');

			trackControlsMainElem.appendChild(frameElem);
			trackControlsMainElem.appendChild(disabledFrameElem);
		}

		function trackControlElem(trackIndexStr)
		{
			var trackIndex = parseInt(trackIndexStr, 10),
				trackNumberColor = TRACKNUMBER_COLOR,
				overBulletStrokeColor = OVERBULLET_STROKECOLOR,
				bulletOnStrokeColor = BULLET_STROKECOLOR,
				bulletOnFillColor = BULLET_FILLCOLOR,
				bulletOffStrokeColor = BULLET_STROKECOLOR,
				bulletOffFillColor = TRACKOFF_FILLCOLOR,
				bulletDisabledStrokeColor = DISABLED_BULLET_STROKECOLOR,
				bulletDisabledFillColor = DISABLED_BULLET_FILLCOLOR,

				trackNumber = (trackIndex + 1).toString(),
				controlID = "track" + trackNumber + "Control",
				translateX = ((trackIndex * 16) + 6).toString(),

				overBulletID = 'overBullet' + trackNumber,
				bulletOnID = 'bullet' + trackNumber + 'On',
				bulletOffID = 'bullet' + trackNumber + 'Off',
				bulletDisabledID = 'bullet' + trackNumber + 'Disabled',

				textTranslateX = (trackIndex < 9) ? "2.0" : "-2.0",
				html = '<g id="' + controlID + '" transform="translate(' + translateX + ',1)"\n' +
					'onmouseover="_AP.controls.showOverRect(\'' + overBulletID + '\', \'' + bulletDisabledID + '\')"\n' +
					'onmouseout="_AP.controls.hideOverRect(\'' + overBulletID + '\')"\n' +
					'onmousedown="_AP.tracksControl.trackOnOff(\'' + trackIndex + '\', \'' + bulletOffID + '\')" >\n' +
					'    <text x="' + textTranslateX + '" y="10" font-size="10" font-family="Lucida Sans Unicode, Verdana, Arial, Geneva, Sans-Serif"' +
					'fill="' + trackNumberColor + '">\n' +
					trackNumber + '\n' +
					'    </text>\n' +
					'    <circle id="' + overBulletID + '" cx="5" cy="19" r="6.5" stroke="' + overBulletStrokeColor + '" stroke-width="2" opacity="' + GLASS + '"/> \n' +
					'    <circle id="' + bulletOnID + '" cx="5" cy="19" r="5" stroke="' + bulletOnStrokeColor + '" stroke-width="1" fill="' + bulletOnFillColor + '" opacity="' + METAL + '"/>\n' +
					'    <circle id="' + bulletOffID + '" cx="5" cy="19" r="5" stroke="' + bulletOffStrokeColor + '" stroke-width="1" fill="' + bulletOffFillColor + '" opacity="' + GLASS + '"/>\n' +
					'    <circle id="' + bulletDisabledID + '" cx="5" cy="19" r="5" stroke="' + bulletDisabledStrokeColor + '" stroke-width="1" fill="' + bulletDisabledFillColor + '" opacity="' + GLASS + '"/>\n' +
					'</g>\n';

			return svgElem(html);
		}

		trackControlsWidth = ((nTrackControls * 16) + 6).toString(); // individual controls are 10 pixels wide, with 6px between them.

		trackControlsMainElem = getTrackControlsMainElem(trackControlsWidth);

		firstControlPanelChild = controlPanel.firstChild;
		controlPanel.insertBefore(trackControlsMainElem, firstControlPanelChild);

		svgTrackControlsElem = svgElem('<g id="trackControls" transform="translate(0.5,0.5)" \\>');
		trackControlsMainElem.appendChild(svgTrackControlsElem);

		addFrames(svgTrackControlsElem, trackControlsWidth);

		trackCtlElems = [];

		for(i = 0; i < nTrackControls; ++i)
		{
			trackCtlElem = trackControlElem(i);

			svgTrackControlsElem.appendChild(trackCtlElem);

			trackCtlElems.push(trackCtlElem);

			setTrackCtlState(i, "on");
			trackCtlElems[i].previousState = "on";
		}
	}

	// the width of the bounding box (set by init())
	width()
	{
		return bbWidth;
	}

	// disable/re-enable the whole tracks control
	// used to disable the whole tracks control when changing it makes no sense.
	setDisabled(toDisabled)
	{
		var i,
			disabledFrame = document.getElementById(DISABLED_FRAME_ID),
			isCurrentlyDisabled = (disabledFrame.getAttribute("opacity") === SMOKE);

		if((toDisabled && (isCurrentlyDisabled === false)) || ((toDisabled === false) && isCurrentlyDisabled))
		{
			if(toDisabled)
			{
				disabledFrame.setAttribute("opacity", SMOKE);
			}
			else
			{
				disabledFrame.setAttribute("opacity", GLASS);
			}

			for(i = 0; i < trackCtlElems.length; ++i)
			{
				if(toDisabled)
				{
					setTrackCtlState(i, "disabled");
				}
				else if(isCurrentlyDisabled)
				{
					setTrackCtlState(i, trackCtlElems[i].previousState);
				}
			}
		}
	}

	setOnChangeCallbacks(scoreRefreshDisplayCallback)
	{
		scoreRefresh = scoreRefreshDisplayCallback;
	}	

	// Called if the user clicks a trackControl.
	// This function calls the scoreRefresh(isLivePerformance, trackIsOnArray)
	// callback which tells the score to redraw itself.
	trackOnOff(trackNumberStr, bulletOffID)
	{
		var
			trackIndex = parseInt(trackNumberStr, 10),
			bulletOffLayer = document.getElementById(bulletOffID),
			thisIsTheLastPlayingInputOrOutputTrack,
			disabledFrame = document.getElementById(DISABLED_FRAME_ID),
			isCurrentlyDisabled = (disabledFrame.getAttribute("opacity") === SMOKE);

		function isTheLastPlayingTrack(trackIndex)
		{
			var i, rVal = true;

			if(trackCtlElems[trackIndex].state === "on") // about to toggle it off
			{
				for(i = 0; i < trackCtlElems.length; ++i)
				{

					if(i !== trackIndex && trackCtlElems[i].state === "on")
					{
						rVal = false;
						break;
					}
				}
			}
			else // about to toggle it on
			{
				rVal = false;
			}

			if(rVal === true)
			{
				if(trackCtlElems[trackIndex])
				{
					alert("Can't turn off the last track!");
				}
			}

			return rVal;
		}

		if(!isCurrentlyDisabled)
		{
			thisIsTheLastPlayingInputOrOutputTrack = isTheLastPlayingTrack(trackIndex);

			if(!thisIsTheLastPlayingInputOrOutputTrack)
			{
				if(trackCtlElems[trackIndex].state === "on")
				{
					bulletOffLayer.setAttribute("opacity", METAL);
					trackCtlElems[trackIndex].state = "off";
				}
				else if(trackCtlElems[trackIndex].state === "off")
				{
					bulletOffLayer.setAttribute("opacity", GLASS);
					trackCtlElems[trackIndex].state = "on";
				}
				
				if(scoreRefresh !== undefined)
				{
					let currentReadOnlyTrackIsOnArray = getCurrentReadOnlyTrackIsOnArray();
					// scoreRefresh is a callback that tells the score to redraw itself
					scoreRefresh(currentReadOnlyTrackIsOnArray);
                }
			}
		}
	}
}


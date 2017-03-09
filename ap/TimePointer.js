/*
 *  copyright 2017 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  ap/TimePointer.js
 */

/*jslint white:true */
/*global _AP,  window,  document */

_AP.namespace('_AP.timePointer');

_AP.timePointer = (function()
{
    "use strict";

    var
    TimePointer = function (originY, viewBoxScale)
    {
        if (!(this instanceof TimePointer))
        {
            return new TimePointer(originY, viewBoxScale);
        }

        Object.defineProperty(this, "graphicElem", { value: this._graphicElem(this, viewBoxScale), writable: false });
        Object.defineProperty(this, "viewBoxScale", { value: viewBoxScale, writable: false });

        // will be set to the system's runningMarker
        Object.defineProperty(this, "runningMarker", { value: null, writable: true });
        Object.defineProperty(this, "msPositionInScore", { value: 0, writable: true });

        // private constant
        Object.defineProperty(this, "_originYinViewBox", { value: originY * viewBoxScale, writable: false });

        return this;
    },

    // public API
    publicAPI =
    {
        TimePointer: TimePointer
    };

    TimePointer.prototype._graphicElem = function(that, viewBoxScale)
    {
        var pointerElem = document.createElementNS("http://www.w3.org/2000/svg", "g"),
        hLine = document.createElementNS("http://www.w3.org/2000/svg", "line"),
        topDiagLine = document.createElementNS("http://www.w3.org/2000/svg", "line"),
        bottomDiagLine = document.createElementNS("http://www.w3.org/2000/svg", "line"),
        vLine = document.createElementNS("http://www.w3.org/2000/svg", "line");

        hLine.setAttribute("x1", (-13.9 * viewBoxScale).toString(10));
        hLine.setAttribute("y1", (-10 * viewBoxScale).toString(10));
        hLine.setAttribute("x2", (-1.7 * viewBoxScale).toString(10));
        hLine.setAttribute("y2", (-10 * viewBoxScale).toString(10));
        hLine.setAttribute("stroke", "#5555FF");
        hLine.setAttribute("stroke-width", (1.5 * viewBoxScale).toString(10));

        topDiagLine.setAttribute("x1", (-1.6 * viewBoxScale).toString(10));
        topDiagLine.setAttribute("y1", (-10 * viewBoxScale).toString(10));
        topDiagLine.setAttribute("x2", (-5.4 * viewBoxScale).toString(10));
        topDiagLine.setAttribute("y2", (-14 * viewBoxScale).toString(10));
        topDiagLine.setAttribute("stroke", "#5555FF");
        topDiagLine.setAttribute("stroke-width", (1.5 * viewBoxScale).toString(10));
        topDiagLine.setAttribute("stroke-linecap", "square");

        bottomDiagLine.setAttribute("x1", (-1.6 * viewBoxScale).toString(10));
        bottomDiagLine.setAttribute("y1", (-10 * viewBoxScale).toString(10));
        bottomDiagLine.setAttribute("x2", (-5.4 * viewBoxScale).toString(10));
        bottomDiagLine.setAttribute("y2", (-6 * viewBoxScale).toString(10));
        bottomDiagLine.setAttribute("stroke", "#5555FF");
        bottomDiagLine.setAttribute("stroke-width", (1.5 * viewBoxScale).toString(10));
        bottomDiagLine.setAttribute("stroke-linecap", "square");

        vLine.setAttribute("x1", "0");
        vLine.setAttribute("y1", (-20 * viewBoxScale).toString(10));
        vLine.setAttribute("x2", "0");
        vLine.setAttribute("y2", "0");
        vLine.setAttribute("stroke", "#5555FF");
        vLine.setAttribute("stroke-width", (1 * viewBoxScale).toString(10));

        pointerElem.appendChild(hLine);
        pointerElem.appendChild(topDiagLine);
        pointerElem.appendChild(bottomDiagLine);
        pointerElem.appendChild(vLine);

        return pointerElem;
    };

    TimePointer.prototype.init = function(runningMarker)
    {
        this.runningMarker = runningMarker;
        this.moveToRunningMarker();
    };

    // moves the graphicElem, and sets this.msPositionInScore
    // to an alignment between two runningMarker positions.
    TimePointer.prototype.moveTo = function(alignment)
    {
        var rmIndex = this.runningMarker.positionIndex,
        leftTimeObject = this.runningMarker.timeObjects[rmIndex],
        rightTimeObject = this.runningMarker.timeObjects[rmIndex + 1],
        leftMsPos = leftTimeObject.msPositionInScore,
        rightMsPos = rightTimeObject.msPositionInScore,
        duration = rightMsPos - leftMsPos, 
        scale = (alignment - leftTimeObject.aligment) / duration,
        localAlignment;

        if(alignment < leftTimeObject.aligment)
        {
            throw "alignment must be >= leftTimeObject.aligment";
        }

        localAlignment = alignment * this.viewBoxScale;
 
        this.graphicElem.setAttribute('transform', 'translate(' + localAlignment + ',' + this._originYinViewBox + ')');
        this.msPositionInScore = leftMsPos + (duration * scale);
    };

    TimePointer.prototype.moveToRunningMarker = function()
    {
        var timeObject = this.runningMarker.timeObjects[this.runningMarker.positionIndex];

        this.graphicElem.setAttribute('transform', 'translate(' + (timeObject.alignment * this.viewBoxScale) + ',' + this._originYinViewBox + ')');
        this.msPositionInScore = timeObject.msPositionInScore;
    };

    TimePointer.prototype.setVisible = function(setToVisible)
    {
        if(setToVisible)
        {
            this.graphicElem.setAttribute('opacity', '1');
        }
        else
        {
            this.graphicElem.setAttribute('opacity', '0');
        }
    };

    TimePointer.prototype.now = function()
    {
        return this.msPositionInScore;
    };

    return publicAPI;

} ());


/*
 *  copyright 2017 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  ap/Time.js
 */

/*jslint white:true */
/*global _AP,  window,  document */

_AP.namespace('_AP.time');

_AP.time = (function()
{
    "use strict";

    var
    Time = function()
    {
        if(!(this instanceof Time))
        {
            return new Time();
        }

        Object.defineProperty(this, "msPositionInScore", { value: 0, writable: true });

        return this;
    },

    // public API
    publicAPI =
    {
        Time: Time
    };

    Time.prototype.now = function()
    {
        return this.msPositionInScore;
    };

    return publicAPI;

} ());


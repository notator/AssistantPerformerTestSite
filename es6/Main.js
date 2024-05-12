/*
 *  copyright 2012 James Ingram
 *  https://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  es6/Main.js
 *  This function
 *  1. Adds a new Controls object to the global _AP object defined earlier.
 *  2. Retrieves the midiAccess object by calling
 *       window.navigator.requestMIDIAccess(onSuccessCallback, onErrorCallback);
 *  3. onSuccessCallback calls _AP.controls.init(midiAccess) which saves the
 *     midiAccess object and sets the contents of the device selector menus in
 *     the Assistant Performer's user interface.
 */

import { Controls } from "./Controls.js";
import { TracksControl } from "./TracksControl.js";

window.addEventListener("load", function ()
{
    "use strict";

	_AP.controls = new Controls();
	_AP.tracksControl = new TracksControl();

	_AP.controls.init();

}, false);



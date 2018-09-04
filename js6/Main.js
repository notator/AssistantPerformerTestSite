/*
 *  copyright 2012 James Ingram
 *  https://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  ap/Main.js
 *  Chris Wilson's ap/WebMIDIAPI.js has been included as a script in
 *  ../assistantPerformer.html, so the Web MIDI API is available.
 *  When browsers implement the Web MIDI API natively, the code in
 *  ap/WebMIDIAPI.js is ignored (does nothing). In this function,
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

	let
		onSuccessCallback = function (midiAccess)
		{
			// Save the midiAccess object and set
			// the contents of the device selector menus.
			_AP.controls.init(midiAccess);
		},
		onErrorCallback = function ()
		{
			_AP.controls.init(null);
		};

	_AP.controls = new Controls();
	_AP.tracksControl = new TracksControl();
	
    navigator.requestMIDIAccess().then(onSuccessCallback, onErrorCallback);

}, false);



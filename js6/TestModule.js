 
import { constants as consts } from "./Constants.js";
console.log("constants.COMMAND.NOTE_OFF= " + consts.COMMAND.NOTE_OFF);
console.log("isRealTimeStatus(100)= " + consts.isRealTimeStatus(100));

import { utilities } from "./Utilities.js";
let numArray = utilities.numberArray("1 2 3 4 5 6");
console.log("numberArray('1 2 3 4 5 6')= " + numArray);
console.log("numberArray('6 5 4 3 2 1')= " + utilities.numberArray('6 5 4 3 2 1'));

import { test } from "./test.js";
console.log("test= ", test);

import { Message } from "./Message.js";
let message = new Message(consts.COMMAND.NOTE_ON, 64, 64);
console.log("message= ", message.toString());

//import { RegionLink } from "./RegionLink.js";
//let regionLink = new RegionLink("track", "regionDef", "prevRegionLink"); // dummy args!!
//console.log("regionLink= ", regionLink.toString()); // wont work!

import { MidiControls } from "./MidiControls.js";
let midiControls = new MidiControls(2);
let defaultProgramChangeMessage = midiControls.defaultProgramChangeMessage(2);
console.log("defaultProgramChangeMessage= ", defaultProgramChangeMessage.toString());

import { Track } from "./Track.js";
let track = new Track(); // empty track!
console.log("track= ", track.toString()); // [object Object]

//import { RunningMarker } from "./RunningMarker.js";
//let runningMarker = new RunningMarker("system", 0, "svgGroup", 8.0); // empty runningMarker!
//console.log("runningMarker= ", runningMarker.toString()); // [object Object]

//import { YCoordinates } from "./YCoordinates.js";
//let yCoordinates = new YCoordinates("startMarker"); // dummy arg!
//console.log("yCoordinates= ", yCoordinates.toString()); // [object Object]

import { CursorCoordinates } from "./CursorCoordinates.js";
let cursorCoordinates = new CursorCoordinates("yCoordinates", 3.7); // dummy args!
console.log("cursorCoordinates= ", cursorCoordinates.toString()); // [object Object]

import { Cursor } from "./Cursor.js";
let cursor = new Cursor("",56.8,"",8.0,true); // dummy args!
console.log("cursor= ", cursor.toString()); // [object Object]

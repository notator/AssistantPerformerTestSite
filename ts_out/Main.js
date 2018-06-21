"use strict";
/// <reference path="Utilities.ts" />
/// <reference path="Message.ts" />
function Main() {
    console.log("test");
    let m = new AP.Message(4, 5, 6);
    let u = new AP.Utilities();
    let a = u.numberArray("4 6 8 90");
    console.log(m.data[0].toString(10) + " " + m.data[1].toString(10) + " " + m.data[2].toString(10));
}
window.addEventListener("load", Main);

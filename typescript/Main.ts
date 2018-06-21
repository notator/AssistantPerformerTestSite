
/// <reference path="Utilities.ts" />
/// <reference path="Message.ts" />

function Main(): void
{
	console.log("test");

	let m: AP.Message = new AP.Message(4, 5, 6);

	let u = new AP.Utilities();
	let a: number[] = u.numberArray("4 6 8 90");

	console.log(m.data[0].toString(10) + " " + m.data[1].toString(10) + " " + m.data[2].toString(10));
}

window.addEventListener("load", Main);
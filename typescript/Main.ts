
/// <reference path="CursorGroupElem.ts" />
/// <reference path="SvgSystem.ts" />
/// <reference path="Cursor.ts" />

function Main(): void
{
	let cGroupElem = new _AP.CursorGroupElem();
	let system = new _AP.SvgSystem(0, 100);

	let c: _AP.Cursor = new _AP.Cursor(system, 0, cGroupElem, 8);
}

window.addEventListener("load", Main);
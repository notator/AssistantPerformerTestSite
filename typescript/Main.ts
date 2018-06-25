
/// <reference path="Context.ts" />
/// <reference path="RunningMarker.ts" />

function Main(): void
{
	let cGroupElem = new _AP.CursorGroupElem();
	let system = new _AP.SvgSystem(0, 100);

	let c: _AP.RunningMarker = new _AP.RunningMarker(system, 0, cGroupElem, 8);
}

window.addEventListener("load", Main);
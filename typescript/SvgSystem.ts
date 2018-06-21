
namespace _AP
{
	export interface ISvgSystem
	{
		markersTop: number;
		markersBottom: number;
	}

	export class SvgSystem
	{
		constructor(public markersTop: number, public markersBottom: number)
		{
		}
	}
}


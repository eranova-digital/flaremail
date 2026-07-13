declare class ImageData {
	constructor(sw: number, sh: number);
	constructor(data: Uint8ClampedArray, sw: number, sh?: number);
	readonly data: Uint8ClampedArray;
	readonly height: number;
	readonly width: number;
}

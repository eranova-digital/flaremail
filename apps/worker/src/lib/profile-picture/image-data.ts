export function createImageData(width: number, height: number): ImageData {
	return new ImageData(
		new Uint8ClampedArray(width * height * 4),
		width,
		height,
	);
}

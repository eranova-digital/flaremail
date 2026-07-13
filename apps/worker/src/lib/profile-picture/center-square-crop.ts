import { createImageData } from "./image-data";

export function centerSquareCrop(data: ImageData): ImageData {
	const side = Math.min(data.width, data.height);
	const sx = Math.floor((data.width - side) / 2);
	const sy = Math.floor((data.height - side) / 2);
	const cropped = createImageData(side, side);

	for (let y = 0; y < side; y += 1) {
		for (let x = 0; x < side; x += 1) {
			const sourceIndex = ((y + sy) * data.width + (x + sx)) * 4;
			const targetIndex = (y * side + x) * 4;
			cropped.data[targetIndex] = data.data[sourceIndex];
			cropped.data[targetIndex + 1] = data.data[sourceIndex + 1];
			cropped.data[targetIndex + 2] = data.data[sourceIndex + 2];
			cropped.data[targetIndex + 3] = data.data[sourceIndex + 3];
		}
	}

	return cropped;
}

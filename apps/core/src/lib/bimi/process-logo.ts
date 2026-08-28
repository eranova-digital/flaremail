import decodePng from "@jsquash/png/decode";
import encodeWebp from "@jsquash/webp/encode";
import resize from "@jsquash/resize";
import { Resvg } from "@cf-wasm/resvg/workerd";

import { centerSquareCrop } from "../profile-picture/center-square-crop";
import { ensureJsquashInitialized } from "../profile-picture/init-jsquash";
import {
	BIMI_LOGO_LARGE_SIZE,
	BIMI_LOGO_SMALL_SIZE,
} from "./constants";

export type ProcessedBimiLogo = {
	small: Uint8Array;
	large: Uint8Array;
};

async function encodeSquareWebp(
	data: ImageData,
	size: number,
): Promise<Uint8Array> {
	const resized = await resize(data, {
		width: size,
		height: size,
		method: "lanczos3",
		fitMethod: "stretch",
	});
	const encoded = await encodeWebp(resized, { quality: 85 });
	return new Uint8Array(encoded);
}

/**
 * Rasterize a BIMI SVG to square WebP variants (small + large).
 */
export async function processBimiLogoSvg(
	svg: string,
): Promise<ProcessedBimiLogo> {
	await ensureJsquashInitialized();

	const resvg = await Resvg.async(svg, {
		fitTo: { mode: "width", value: BIMI_LOGO_LARGE_SIZE },
	});
	const pngBytes = resvg.render().asPng();
	const pngBuffer = pngBytes.buffer.slice(
		pngBytes.byteOffset,
		pngBytes.byteOffset + pngBytes.byteLength,
	) as ArrayBuffer;

	const decoded = await decodePng(pngBuffer);
	const cropped = centerSquareCrop(decoded);

	const [small, large] = await Promise.all([
		encodeSquareWebp(cropped, BIMI_LOGO_SMALL_SIZE),
		encodeSquareWebp(cropped, BIMI_LOGO_LARGE_SIZE),
	]);

	return { small, large };
}

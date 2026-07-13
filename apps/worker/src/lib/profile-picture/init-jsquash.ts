import { init as initJpegDecode } from "@jsquash/jpeg/decode";
import { init as initPngDecode } from "@jsquash/png/decode";
import { init as initWebpDecode } from "@jsquash/webp/decode";
import { init as initWebpEncode } from "@jsquash/webp/encode";
import { initResize } from "@jsquash/resize";
import { simd } from "wasm-feature-detect";

import jpegDecWasm from "@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm";
import pngDecWasm from "@jsquash/png/codec/pkg/squoosh_png_bg.wasm";
import webpDecWasm from "@jsquash/webp/codec/dec/webp_dec.wasm";
import webpEncWasm from "@jsquash/webp/codec/enc/webp_enc.wasm";
import webpEncSimdWasm from "@jsquash/webp/codec/enc/webp_enc_simd.wasm";
import resizeWasm from "@jsquash/resize/lib/resize/pkg/squoosh_resize_bg.wasm";

let initPromise: Promise<void> | null = null;

async function initJsquash(): Promise<void> {
	const webpEncModule = (await simd()) ? webpEncSimdWasm : webpEncWasm;

	await Promise.all([
		initJpegDecode(jpegDecWasm),
		initPngDecode(pngDecWasm),
		initWebpDecode(webpDecWasm),
		initWebpEncode(webpEncModule),
		initResize(resizeWasm),
	]);
}

export function ensureJsquashInitialized(): Promise<void> {
	if (!initPromise) {
		initPromise = initJsquash();
	}
	return initPromise;
}

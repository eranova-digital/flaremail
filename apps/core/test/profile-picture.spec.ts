import { describe, expect, it } from "vitest";

import { createImageData } from "../src/lib/profile-picture/image-data";
import { centerSquareCrop } from "../src/lib/profile-picture/center-square-crop";
import {
	allProfilePictureKeys,
	parseProfilePictureSize,
	profilePictureStorageKey,
} from "../src/lib/profile-picture/keys";

if (typeof ImageData === "undefined") {
	globalThis.ImageData = class {
		data: Uint8ClampedArray;
		constructor(
			dataOrWidth: Uint8ClampedArray | number,
			widthOrHeight?: number,
			height?: number,
		) {
			if (typeof dataOrWidth === "number") {
				this.width = dataOrWidth;
				this.height = widthOrHeight ?? dataOrWidth;
				this.data = new Uint8ClampedArray(this.width * this.height * 4);
				return;
			}
			this.data = dataOrWidth;
			this.width = widthOrHeight ?? 0;
			this.height = height ?? 0;
		}
		width: number;
		height: number;
	} as typeof ImageData;
}

describe("profilePictureStorageKey", () => {
	it("stores variants under profile/{accountId}/{size}.webp", () => {
		const accountId = "550e8400-e29b-41d4-a716-446655440000";
		expect(profilePictureStorageKey(accountId, "small")).toBe(
			"profile/550e8400-e29b-41d4-a716-446655440000/small.webp",
		);
		expect(profilePictureStorageKey(accountId, "large")).toBe(
			"profile/550e8400-e29b-41d4-a716-446655440000/large.webp",
		);
		expect(allProfilePictureKeys(accountId)).toEqual([
			"profile/550e8400-e29b-41d4-a716-446655440000/small.webp",
			"profile/550e8400-e29b-41d4-a716-446655440000/large.webp",
		]);
	});
});

describe("parseProfilePictureSize", () => {
	it("accepts small and large only", () => {
		expect(parseProfilePictureSize("small")).toBe("small");
		expect(parseProfilePictureSize("large")).toBe("large");
		expect(parseProfilePictureSize("medium")).toBeNull();
		expect(parseProfilePictureSize(null)).toBeNull();
	});
});

describe("centerSquareCrop", () => {
	it("crops a wide image from the horizontal center", () => {
		const source = createImageData(4, 2);
		for (let i = 0; i < source.data.length; i += 4) {
			source.data[i] = 255;
			source.data[i + 1] = 0;
			source.data[i + 2] = 0;
			source.data[i + 3] = 255;
		}

		const cropped = centerSquareCrop(source);
		expect(cropped.width).toBe(2);
		expect(cropped.height).toBe(2);
		expect(cropped.data[0]).toBe(255);
	});

	it("crops a tall image from the vertical center", () => {
		const source = createImageData(2, 4);
		for (let i = 0; i < source.data.length; i += 4) {
			source.data[i] = 0;
			source.data[i + 1] = 255;
			source.data[i + 2] = 0;
			source.data[i + 3] = 255;
		}

		const cropped = centerSquareCrop(source);
		expect(cropped.width).toBe(2);
		expect(cropped.height).toBe(2);
	});

	it("works with the jsquash ImageData constructor shape", () => {
		const JsquashImageData = class {
			data: Uint8ClampedArray;
			width: number;
			height: number;
			constructor(data: Uint8ClampedArray, width: number, height: number) {
				this.data = data;
				this.width = width;
				this.height = height;
			}
		};
		const previous = globalThis.ImageData;
		globalThis.ImageData = JsquashImageData as typeof ImageData;

		try {
			const source = createImageData(1000, 800);
			const cropped = centerSquareCrop(source);
			expect(cropped.width).toBe(800);
			expect(cropped.height).toBe(800);
			expect(cropped.data).toBeInstanceOf(Uint8ClampedArray);
			expect(cropped.data.length).toBe(800 * 800 * 4);
		} finally {
			globalThis.ImageData = previous;
		}
	});
});

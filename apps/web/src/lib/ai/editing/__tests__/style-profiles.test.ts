import { describe, expect, it } from "bun:test";
import {
	getStyleProfile,
	getStyleProfileNames,
	getStyleProfileSummary,
} from "../style-profiles";

describe("frontend style-profiles", () => {
	it("all 6 profiles exist", () => {
		const names = getStyleProfileNames();
		expect(names).toHaveLength(6);
		expect(new Set(names)).toEqual(
			new Set([
				"reel",
				"youtube",
				"podcast",
				"documentary",
				"corporate",
				"cinematic",
			]),
		);
	});

	it("each profile has correct structure", () => {
		for (const name of getStyleProfileNames()) {
			const profile = getStyleProfile(name);
			expect(profile.name).toBe(name);
			expect(typeof profile.description).toBe("string");
			expect(typeof profile.targetAvgClipLength).toBe("number");
			expect(profile.pacingCutsPerMinute).toHaveLength(2);
			expect(typeof profile.musicVolume).toBe("number");
			expect(typeof profile.targetAspectRatio).toBe("string");
			expect(typeof profile.targetFps).toBe("number");
		}
	});

	it("getStyleProfile falls back to youtube", () => {
		const profile = getStyleProfile("nonexistent");
		expect(profile.name).toBe("youtube");
	});

	it("reel profile has fast pacing", () => {
		const reel = getStyleProfile("reel");
		expect(reel.pacingCutsPerMinute[0]).toBeGreaterThanOrEqual(15);
		expect(reel.targetAspectRatio).toBe("9:16");
	});

	it("podcast profile has slow pacing", () => {
		const podcast = getStyleProfile("podcast");
		expect(podcast.pacingCutsPerMinute[0]).toBeLessThanOrEqual(3);
		expect(podcast.targetAvgClipLength).toBeGreaterThanOrEqual(10);
	});

	it("getStyleProfileSummary returns formatted string", () => {
		const summary = getStyleProfileSummary();
		expect(summary).toContain("reel:");
		expect(summary).toContain("youtube:");
		expect(summary).toContain("cuts/min:");
	});
});

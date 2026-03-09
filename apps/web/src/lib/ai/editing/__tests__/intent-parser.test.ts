import { describe, expect, it } from "bun:test";
import { parseIntent } from "../intent-parser";

describe("intent-parser", () => {
	it("parses trim_silence intent", () => {
		const result = parseIntent("remove silence from this video");
		expect(result.type).toBe("trim_silence");
		expect(result.confidence).toBeGreaterThan(0.4);
	});

	it("parses reduce_clip_length intent", () => {
		const result = parseIntent("make the cuts faster and snappy");
		expect(result.type).toBe("reduce_clip_length");
	});

	it("parses increase_engagement intent", () => {
		const result = parseIntent("make it more engaging and dynamic");
		expect(result.type).toBe("increase_engagement");
	});

	it("parses apply_style_profile with style extraction", () => {
		const result = parseIntent("make it like a TikTok reel style");
		expect(result.type).toBe("apply_style_profile");
		expect(result.style).toBe("reel");
	});

	it("parses duration_constraint with seconds", () => {
		const result = parseIntent("shorten to 30 seconds");
		expect(result.type).toBe("duration_constraint");
		expect(result.parameters.targetDuration).toBe(30);
	});

	it("parses duration_constraint with minutes", () => {
		const result = parseIntent("make it 2 minutes long");
		expect(result.type).toBe("duration_constraint");
		expect(result.parameters.targetDuration).toBe(120);
	});

	it("returns custom for unknown prompts", () => {
		const result = parseIntent("do something completely unique");
		expect(result.type).toBe("custom");
		expect(result.confidence).toBeLessThan(0.5);
	});

	it("boosts aggressiveness with qualifier words", () => {
		const normal = parseIntent("cut silence");
		const aggressive = parseIntent("very aggressively cut silence");

		expect(aggressive.aggressiveness ?? 0).toBeGreaterThan(
			normal.aggressiveness ?? 0,
		);
	});

	it("reduces aggressiveness with soft qualifiers", () => {
		const normal = parseIntent("cut silence");
		const gentle = parseIntent("slightly cut silence");

		expect(gentle.aggressiveness ?? 0).toBeLessThan(normal.aggressiveness ?? 0);
	});

	it("parses cinematic style profile", () => {
		const result = parseIntent("make it cinematic");
		expect(result.type).toBe("apply_style_profile");
		expect(result.style).toBe("cinematic");
	});

	it("confidence scales with keyword match length", () => {
		const short = parseIntent("tighten");
		const long = parseIntent("remove silence and trim gaps");

		expect(long.confidence).toBeGreaterThan(short.confidence);
	});
});

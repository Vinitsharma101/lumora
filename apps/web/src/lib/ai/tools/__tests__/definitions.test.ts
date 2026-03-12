import { describe, expect, it } from "bun:test";
import { AI_TOOLS, getToolDescriptions } from "../definitions";

describe("AI_TOOLS definitions", () => {
	it("all tools have required fields", () => {
		for (const tool of AI_TOOLS) {
			expect(tool.name).toBeTruthy();
			expect(typeof tool.name).toBe("string");
			expect(tool.description).toBeTruthy();
			expect(typeof tool.description).toBe("string");
			expect(tool.parameters).toBeTruthy();
			expect(tool.parameters.type).toBe("object");
		}
	});

	it("no duplicate tool names", () => {
		const names = AI_TOOLS.map((tool) => tool.name);
		const unique = new Set(names);
		expect(unique.size).toBe(names.length);
	});

	it("getToolDescriptions returns non-empty record", () => {
		const descriptions = getToolDescriptions();
		const keys = Object.keys(descriptions);

		expect(keys.length).toBe(AI_TOOLS.length);
		for (const key of keys) {
			expect(descriptions[key]).toBeTruthy();
		}
	});

	it("poll_job_status tool exists", () => {
		const tool = AI_TOOLS.find((t) => t.name === "poll_job_status");
		expect(tool).toBeDefined();
		if (tool) {
			expect(tool.parameters.required).toContain("jobId");
		}
	});

	it("import_generated_asset tool exists", () => {
		const tool = AI_TOOLS.find((t) => t.name === "import_generated_asset");
		expect(tool).toBeDefined();
		if (tool) {
			expect(tool.parameters.required).toContain("url");
			expect(tool.parameters.required).toContain("type");
		}
	});

	it("ai_edit_rollback uses sessionId param", () => {
		const tool = AI_TOOLS.find((t) => t.name === "ai_edit_rollback");
		expect(tool).toBeDefined();
		if (tool) {
			expect(tool.parameters.properties).toHaveProperty("sessionId");
			expect(tool.parameters.required).toContain("sessionId");
		}
	});
});

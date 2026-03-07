import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function testRender() {
	try {
		console.log("Bundling...");
		const bundled = await bundle({
			entryPoint: join(process.cwd(), "src/lib/remotion/root.tsx"),
            webpackOverride: (config) => config,
		});
		console.log("Bundled at:", bundled);

		const compositionId = "lower-third";
		const props = {};
		const width = 1920;
		const height = 1080;
		const fps = 30;
		const durationInFrames = 150;

		console.log("Selecting composition:", compositionId);
		const composition = await selectComposition({
			serveUrl: bundled,
			id: compositionId,
			inputProps: props,
		});

		// Route.ts does this:
		composition.width = width;
		composition.height = height;
		composition.fps = fps;
		if (durationInFrames) {
			composition.durationInFrames = durationInFrames;
		}

		const outputPath = join(tmpdir(), `test-remotion-${Date.now()}.mp4`);
		console.log("Rendering to:", outputPath);

		await renderMedia({
			composition,
			serveUrl: bundled,
			codec: "h264",
			outputLocation: outputPath,
			inputProps: props,
		});

		console.log("Render complete!");
	} catch (error) {
		console.error("Error:", error);
	}
}

testRender();

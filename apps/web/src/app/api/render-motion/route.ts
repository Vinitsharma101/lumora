import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextResponse } from "next/server";

/**
 * Cached bundle path — Remotion bundling is expensive, so we cache the
 * webpack bundle for the lifetime of the server process.
 */
let cachedBundlePath: string | null = null;

async function getBundle(): Promise<string> {
	if (cachedBundlePath) {
		return cachedBundlePath;
	}

	const bundled = await bundle({
		entryPoint: join(process.cwd(), "src/lib/remotion/root.tsx"),
		// Disable the webpack dev server since we only need static rendering
		webpackOverride: (config) => config,
	});

	cachedBundlePath = bundled;
	return bundled;
}

interface RenderMotionRequest {
	compositionId: string;
	props?: Record<string, unknown>;
	width?: number;
	height?: number;
	fps?: number;
	durationInFrames?: number;
}

export async function POST(request: Request): Promise<NextResponse> {
	try {
		const body = (await request.json()) as RenderMotionRequest;
		const {
			compositionId,
			props = {},
			width = 1920,
			height = 1080,
			fps = 30,
			durationInFrames,
		} = body;

		if (!compositionId) {
			return NextResponse.json(
				{ error: "compositionId is required" },
				{ status: 400 },
			);
		}

		// Bundle the Remotion project (cached after first call)
		const bundlePath = await getBundle();

		// Select the composition and override its config
		const composition = await selectComposition({
			serveUrl: bundlePath,
			id: compositionId,
			inputProps: props,
		});

		// Override dimensions and duration if provided
		composition.width = width;
		composition.height = height;
		composition.fps = fps;
		if (durationInFrames) {
			composition.durationInFrames = durationInFrames;
		}

		// Render to a temporary file
		const outputPath = join(
			tmpdir(),
			`opencut-motion-${compositionId}-${Date.now()}.mp4`,
		);

		await renderMedia({
			composition,
			serveUrl: bundlePath,
			codec: "h264",
			outputLocation: outputPath,
			inputProps: props,
		});

		// Read the rendered file and return it
		const videoBuffer = await readFile(outputPath);

		// Clean up the temporary file
		unlink(outputPath).catch(() => {
			// Ignore cleanup errors
		});

		return new NextResponse(new Uint8Array(videoBuffer), {
			status: 200,
			headers: {
				"Content-Type": "video/mp4",
				"Content-Disposition": `attachment; filename="${compositionId}.mp4"`,
				"Content-Length": String(videoBuffer.length),
			},
		});
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Unknown rendering error";
		console.error("Motion graphic render failed:", error);
		return NextResponse.json(
			{ error: `Rendering failed: ${message}` },
			{ status: 500 },
		);
	}
}

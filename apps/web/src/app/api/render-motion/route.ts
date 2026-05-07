import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextResponse } from "next/server";
import {
	getCompositionEntry,
	resolveCompositionRenderConfig,
} from "@/lib/remotion/compositions";

/**
 * Cached bundle path — Remotion bundling is expensive, so we cache the
 * webpack bundle for the lifetime of the server process.
 */
let cachedBundlePath: string | null = null;

const RENDER_TIMEOUT_MS = 120_000;

async function getBundle(): Promise<string> {
	if (cachedBundlePath) {
		console.log("[render-motion] Using cached bundle:", cachedBundlePath);
		return cachedBundlePath;
	}

	console.log("[render-motion] Bundling Remotion project...");
	try {
		const bundled = await bundle({
			entryPoint: join(process.cwd(), "src/lib/remotion/root.tsx"),
			webpackOverride: (config) => config,
		});

		console.log("[render-motion] Bundle created:", bundled);
		cachedBundlePath = bundled;
		return bundled;
	} catch (error) {
		cachedBundlePath = null;
		throw error;
	}
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

		const compositionEntry = getCompositionEntry(compositionId);
		if (!compositionEntry) {
			return NextResponse.json(
				{ error: `Unknown compositionId: ${compositionId}` },
				{ status: 400 },
			);
		}

		const renderConfig = resolveCompositionRenderConfig(compositionId, {
			width,
			height,
			fps,
			durationInFrames,
			props,
		});

		// Bundle the Remotion project (cached after first call)
		const bundlePath = await getBundle();

		// Select the composition and override its config
		console.log("[render-motion] Selecting composition:", compositionId);
		const composition = await selectComposition({
			serveUrl: bundlePath,
			id: compositionId,
			inputProps: renderConfig.props,
		});

		// Override dimensions and duration if provided
		composition.width = renderConfig.width;
		composition.height = renderConfig.height;
		composition.fps = renderConfig.fps;
		composition.durationInFrames = renderConfig.durationInFrames;

		// Render to a temporary file
		const outputPath = join(
			tmpdir(),
			`grace-studio-motion-${compositionId}-${Date.now()}.webm`,
		);

		console.log("[render-motion] Rendering to:", outputPath);
		const renderPromise = renderMedia({
			composition,
			serveUrl: bundlePath,
			codec: "vp8",
			outputLocation: outputPath,
			inputProps: renderConfig.props,
		});

		const timeoutPromise = new Promise<never>((_, reject) => {
			setTimeout(
				() => reject(new Error("Render timed out after 120s")),
				RENDER_TIMEOUT_MS,
			);
		});

		await Promise.race([renderPromise, timeoutPromise]);
		console.log("[render-motion] Render complete");

		// Read the rendered file and return it
		const videoBuffer = await readFile(outputPath);

		// Clean up the temporary file
		unlink(outputPath).catch(() => {
			// Ignore cleanup errors
		});

		return new NextResponse(new Uint8Array(videoBuffer), {
			status: 200,
			headers: {
				"Content-Type": "video/webm",
				"Content-Disposition": `attachment; filename="${compositionId}.webm"`,
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

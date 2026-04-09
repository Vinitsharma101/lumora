import { NextResponse } from "next/server";

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const REPLICATE_API_URL = "https://api.replicate.com/v1/predictions";

// FLUX Schnell — fast, high quality image generation
const FLUX_MODEL_VERSION =
	"c846a69991daf4c0e5d016514849d14ee5b2e6846ce6b9d6f21369e564cfe51e";

/**
 * Generate an image via Replicate's FLUX model.
 * Returns { jobId, status } — poll /api/ai/jobs/{jobId} for completion.
 */
export async function POST(request: Request) {
	const body = await request.json();
	const prompt = body.prompt as string;

	if (!prompt) {
		return NextResponse.json({ error: "prompt is required" }, { status: 400 });
	}

	if (!REPLICATE_API_TOKEN) {
		return NextResponse.json(
			{ error: "Replicate token missing" },
			{ status: 503 },
		);
	}

	try {
		const response = await fetch(REPLICATE_API_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
				Prefer: "wait",
			},
			body: JSON.stringify({
				version: FLUX_MODEL_VERSION,
				input: {
					prompt,
					num_outputs: body.numImages ?? 1,
					aspect_ratio: body.aspectRatio ?? "4:3",
					output_format: "webp",
					output_quality: 90,
				},
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error("Replicate API error:", errorText);
			return NextResponse.json(
				{ error: errorText },
				{ status: response.status },
			);
		}

		const prediction = await response.json();

		if (prediction.status === "succeeded" && prediction.output) {
			const imageUrls = Array.isArray(prediction.output)
				? prediction.output
				: [prediction.output];

			return NextResponse.json({
				jobId: prediction.id,
				job_id: prediction.id,
				status: "completed",
				imageUrl: imageUrls[0],
				allUrls: imageUrls,
			});
		}

		return NextResponse.json({
			jobId: prediction.id,
			job_id: prediction.id,
			status: prediction.status ?? "processing",
		});
	} catch (error) {
		console.error("Image generation error:", error);
		return NextResponse.json({ error: "API unavailable" }, { status: 503 });
	}
}

import { NextResponse } from "next/server";

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const REPLICATE_API_URL = "https://api.replicate.com/v1/predictions";

// FLUX Schnell — fast, high quality image generation
const FLUX_MODEL_VERSION =
	"black-forest-labs/flux-schnell";

/**
 * Generate an image via Replicate's FLUX model.
 * Returns { jobId, status } — poll /api/ai/jobs/{jobId} for completion.
 */
export async function POST(request: Request) {
	const body = await request.json();
	const prompt = body.prompt as string;

	if (!prompt) {
		return NextResponse.json(
			{ error: "prompt is required" },
			{ status: 400 },
		);
	}

	if (!REPLICATE_API_TOKEN) {
		// No token — return mock that resolves instantly
		const mockId = `mock-${crypto.randomUUID()}`;
		return NextResponse.json({
			jobId: mockId,
			status: "mock",
			mockImageUrl: `https://picsum.photos/seed/${Math.random().toString(36).slice(2, 8)}/1024/768`,
		});
	}

	try {
		// Create a prediction via Replicate's API
		const response = await fetch(REPLICATE_API_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
				Prefer: "wait",
			},
			body: JSON.stringify({
				model: FLUX_MODEL_VERSION,
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

			// Fallback to mock on API error
			const mockId = `mock-${crypto.randomUUID()}`;
			return NextResponse.json({
				jobId: mockId,
				status: "mock",
				mockImageUrl: `https://picsum.photos/seed/${Math.random().toString(36).slice(2, 8)}/1024/768`,
			});
		}

		const prediction = await response.json();

		// FLUX Schnell with Prefer: wait returns completed predictions directly
		if (prediction.status === "succeeded" && prediction.output) {
			const imageUrls = Array.isArray(prediction.output)
				? prediction.output
				: [prediction.output];

			return NextResponse.json({
				jobId: prediction.id,
				status: "completed",
				imageUrl: imageUrls[0],
				allUrls: imageUrls,
			});
		}

		// If still processing (shouldn't happen with Prefer: wait, but handle it)
		return NextResponse.json({
			jobId: prediction.id,
			status: prediction.status ?? "processing",
		});
	} catch (error) {
		console.error("Image generation error:", error);

		// Network error — mock fallback
		const mockId = `mock-${crypto.randomUUID()}`;
		return NextResponse.json({
			jobId: mockId,
			status: "mock",
			mockImageUrl: `https://picsum.photos/seed/${Math.random().toString(36).slice(2, 8)}/1024/768`,
		});
	}
}

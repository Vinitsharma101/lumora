import { type NextRequest, NextResponse } from "next/server";

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

/**
 * Poll a Replicate prediction for completion status.
 * Mock jobs (prefixed "mock-") complete instantly with a placeholder.
 */
export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ jobId: string }> },
) {
	const { jobId } = await params;

	if (jobId.startsWith("mock-")) {
		return NextResponse.json({
			id: jobId,
			status: "completed",
			progress: 1,
			output_data: {
				output: [`https://picsum.photos/seed/${jobId.slice(5, 13)}/1024/768`],
			},
		});
	}

	if (!REPLICATE_API_TOKEN) {
		return NextResponse.json(
			{ error: "No API token configured" },
			{ status: 503 },
		);
	}

	try {
		const response = await fetch(
			`https://api.replicate.com/v1/predictions/${jobId}`,
			{
				headers: {
					Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
				},
			},
		);

		if (!response.ok) {
			return NextResponse.json(
				{ error: "Job not found" },
				{ status: response.status },
			);
		}

		const prediction = await response.json();

		if (prediction.status === "succeeded") {
			const urls = Array.isArray(prediction.output)
				? prediction.output
				: prediction.output
					? [prediction.output]
					: [];

			return NextResponse.json({
				id: prediction.id,
				status: "completed",
				progress: 1,
				output_data: { output: urls },
			});
		}

		if (prediction.status === "failed" || prediction.status === "canceled") {
			return NextResponse.json({
				id: prediction.id,
				status: "failed",
				error_message: prediction.error ?? "Generation failed",
			});
		}

		const logs = prediction.logs ?? "";
		const progressMatch = logs.match(/(\d+)%/);
		const progress = progressMatch
			? Number.parseInt(progressMatch[1]) / 100
			: 0;

		return NextResponse.json({
			id: prediction.id,
			status: "processing",
			progress,
		});
	} catch {
		return NextResponse.json({ error: "API unavailable" }, { status: 503 });
	}
}

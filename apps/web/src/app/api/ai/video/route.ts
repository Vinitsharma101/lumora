import { NextResponse } from "next/server";

/**
 * Handle AI video generation operations.
 * Returns mock job responses when no real backend is available.
 */
export async function POST(request: Request) {
	const body = await request.json();
	const action = (body.action as string) ?? "text-to-video";
	const prompt = (body.prompt as string) ?? "";

	// Generate a mock job ID
	const mockJobId = `mock-${crypto.randomUUID()}`;

	// All video operations return a job that can be polled via /api/ai/jobs/[jobId]
	return NextResponse.json({
		jobId: mockJobId,
		job_id: mockJobId,
		status: "mock",
		progress: 0,
		job_type: action,
		message: `${action} job created (mock mode — no backend configured)`,
		input: { prompt, action, ...body },
	});
}

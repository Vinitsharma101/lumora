import { NextResponse } from "next/server";

/**
 * Handle auto-edit operations (silence removal, captions, shorts, beat-sync, analyze).
 * Returns mock job responses when no real backend is available.
 */
export async function POST(request: Request) {
	const body = await request.json();
	const action = (body.action as string) ?? "silence-remove";

	const mockJobId = `mock-${crypto.randomUUID()}`;

	return NextResponse.json({
		jobId: mockJobId,
		job_id: mockJobId,
		status: "mock",
		progress: 0,
		job_type: `auto-edit-${action}`,
		message: `Auto-edit ${action} job created (mock mode — no backend configured)`,
		input: body,
	});
}

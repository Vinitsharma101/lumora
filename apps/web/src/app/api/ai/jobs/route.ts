import { NextResponse } from "next/server";

/**
 * List all AI jobs. Returns an empty list when no backend is available.
 */
export async function GET() {
	// Return empty jobs list — there's no persistent job store yet
	return NextResponse.json([]);
}

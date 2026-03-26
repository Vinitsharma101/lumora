import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function GET() {
	return NextResponse.json({ projects: [], source: "cloud" });
}

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { id, name } = body;

		if (!id || !name) {
			return NextResponse.json(
				{ error: "Missing required fields: id, name" },
				{ status: 400 },
			);
		}

		return NextResponse.json({
			id,
			name,
			type: (body.type as string) ?? "video",
			synced: true,
			savedAt: new Date().toISOString(),
		});
	} catch (error) {
		return NextResponse.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Failed to save project",
			},
			{ status: 500 },
		);
	}
}

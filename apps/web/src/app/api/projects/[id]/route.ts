import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;

	return NextResponse.json(
		{ error: "Project not found in cloud storage", id },
		{ status: 404 },
	);
}

export async function PUT(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	await request.json();

	return NextResponse.json({
		id,
		synced: true,
		updatedAt: new Date().toISOString(),
	});
}

export async function DELETE(
	_request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;

	return NextResponse.json({ id, deleted: true });
}

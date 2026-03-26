import { NextResponse } from "next/server";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

export async function POST(request: Request) {
	const body = await request.json();
	const messages = (body.messages ?? []) as Array<{
		role: string;
		content: string;
	}>;

	// Separate system prompt from messages
	const systemMessages = messages.filter((m) => m.role === "system");
	const chatMessages = messages.filter((m) => m.role !== "system");
	const systemPrompt = body.systemPrompt ?? systemMessages[0]?.content ?? "";

	if (!ANTHROPIC_API_KEY) {
		// No API key — return mock response
		return NextResponse.json({
			content: getMockResponse(chatMessages),
		});
	}

	try {
		const response = await fetch(ANTHROPIC_API_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-api-key": ANTHROPIC_API_KEY,
				"anthropic-version": "2023-06-01",
			},
			body: JSON.stringify({
				model: "claude-sonnet-4-20250514",
				max_tokens: 2048,
				system: systemPrompt,
				messages: chatMessages.map((m) => ({
					role: m.role === "user" ? "user" : "assistant",
					content: m.content,
				})),
			}),
		});

		if (!response.ok) {
			const errorData = await response.text();
			console.error("Anthropic API error:", errorData);
			return NextResponse.json({
				content: getMockResponse(chatMessages),
			});
		}

		const data = await response.json();
		const content =
			data.content?.[0]?.text ?? "I couldn't generate a response.";

		return NextResponse.json({ content });
	} catch (error) {
		console.error("Chat API error:", error);
		return NextResponse.json({
			content: getMockResponse(chatMessages),
		});
	}
}

function getMockResponse(
	messages: Array<{ role: string; content: string }>,
): string {
	const lastUserMsg =
		messages.filter((m) => m.role === "user").pop()?.content ?? "";

	const responses = [
		`Great concept! For "${lastUserMsg}", I'd suggest:\n\n1. Use dramatic lighting with strong shadows\n2. A minimalist composition focusing on the subject\n3. Warm color palette with golden tones\n\nWould you like me to generate this?`,
		`I love that idea! Here are some creative directions:\n\n1. Cinematic wide shot with depth of field\n2. Abstract interpretation with geometric patterns\n3. Photorealistic render with natural textures\n\nWhich approach resonates with you?`,
		`That's an interesting prompt! Let me break down how I'd approach it:\n\n1. Start with a strong focal point\n2. Add environmental context for storytelling\n3. Use complementary colors for visual harmony\n\nShall I create variations?`,
	];

	return responses[Math.floor(Math.random() * responses.length)];
}

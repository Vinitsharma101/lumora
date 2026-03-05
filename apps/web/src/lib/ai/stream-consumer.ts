import type { StreamChunk } from "./providers/types";

export async function* consumeSSEStream(
	response: Response,
): AsyncGenerator<StreamChunk> {
	const reader = response.body?.getReader();
	if (!reader) throw new Error("No response body");

	const decoder = new TextDecoder();
	let buffer = "";

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split("\n");
			buffer = lines.pop() || "";

			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed || !trimmed.startsWith("data: ")) continue;

				const data = trimmed.slice(6);
				try {
					const chunk = JSON.parse(data) as StreamChunk;
					yield chunk;
				} catch {
					// skip malformed chunks
				}
			}
		}
	} finally {
		reader.releaseLock();
	}
}

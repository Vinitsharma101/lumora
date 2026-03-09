import type { CaptionChunk } from "@/types/transcription";

function formatSRTTime({ seconds }: { seconds: number }): string {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);
	const ms = Math.round((seconds % 1) * 1000);
	return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

function formatVTTTime({ seconds }: { seconds: number }): string {
	return formatSRTTime({ seconds }).replace(",", ".");
}

export function exportSRT({
	chunks,
}: {
	chunks: CaptionChunk[];
}): string {
	return chunks
		.map((chunk, index) => {
			const start = formatSRTTime({ seconds: chunk.startTime });
			const end = formatSRTTime({ seconds: chunk.startTime + chunk.duration });
			return `${index + 1}\n${start} --> ${end}\n${chunk.text}\n`;
		})
		.join("\n");
}

export function exportVTT({
	chunks,
}: {
	chunks: CaptionChunk[];
}): string {
	const cues = chunks
		.map((chunk) => {
			const start = formatVTTTime({ seconds: chunk.startTime });
			const end = formatVTTTime({ seconds: chunk.startTime + chunk.duration });
			return `${start} --> ${end}\n${chunk.text}\n`;
		})
		.join("\n");
	return `WEBVTT\n\n${cues}`;
}

function parseSRTTimestamp({ timestamp }: { timestamp: string }): number {
	const parts = timestamp.trim().replace(",", ".").split(":");
	const hours = Number.parseFloat(parts[0]);
	const minutes = Number.parseFloat(parts[1]);
	const seconds = Number.parseFloat(parts[2]);
	return hours * 3600 + minutes * 60 + seconds;
}

export function importSRT({
	content,
}: {
	content: string;
}): CaptionChunk[] {
	const blocks = content.trim().split(/\n\n+/);
	const chunks: CaptionChunk[] = [];

	for (const block of blocks) {
		const lines = block.split("\n");
		if (lines.length < 3) continue;

		const timeLine = lines[1];
		const timeMatch = timeLine.match(
			/(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})/,
		);
		if (!timeMatch) continue;

		const startTime = parseSRTTimestamp({ timestamp: timeMatch[1] });
		const endTime = parseSRTTimestamp({ timestamp: timeMatch[2] });
		const text = lines.slice(2).join("\n").trim();

		chunks.push({
			text,
			startTime,
			duration: endTime - startTime,
		});
	}

	return chunks;
}

export function importVTT({
	content,
}: {
	content: string;
}): CaptionChunk[] {
	const withoutHeader = content.replace(/^WEBVTT[^\n]*\n\n?/, "");
	return importSRT({ content: withoutHeader });
}

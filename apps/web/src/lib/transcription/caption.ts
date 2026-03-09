import type {
	TranscriptionSegment,
	TranscriptionWordTiming,
	CaptionChunk,
} from "@/types/transcription";
import {
	DEFAULT_WORDS_PER_CAPTION,
	MIN_CAPTION_DURATION_SECONDS,
} from "@/constants/transcription-constants";

function interpolateWordTimings({
	words,
	segmentStart,
	segmentEnd,
}: {
	words: string[];
	segmentStart: number;
	segmentEnd: number;
}): TranscriptionWordTiming[] {
	const duration = segmentEnd - segmentStart;
	const wordDuration = duration / words.length;
	return words.map((word, index) => ({
		word,
		start: segmentStart + index * wordDuration,
		end: segmentStart + (index + 1) * wordDuration,
	}));
}

export function buildCaptionChunks({
	segments,
	wordsPerChunk = DEFAULT_WORDS_PER_CAPTION,
	minDuration = MIN_CAPTION_DURATION_SECONDS,
}: {
	segments: TranscriptionSegment[];
	wordsPerChunk?: number;
	minDuration?: number;
}): CaptionChunk[] {
	const captions: CaptionChunk[] = [];
	let globalEndTime = 0;

	for (const segment of segments) {
		const textWords = segment.text.trim().split(/\s+/);
		if (textWords.length === 0 || (textWords.length === 1 && textWords[0] === "")) continue;

		const segmentDuration = segment.end - segment.start;
		const wordsPerSecond = textWords.length / segmentDuration;

		const wordTimings: TranscriptionWordTiming[] =
			segment.words && segment.words.length > 0
				? segment.words
				: interpolateWordTimings({
						words: textWords,
						segmentStart: segment.start,
						segmentEnd: segment.end,
					});

		for (let i = 0; i < textWords.length; i += wordsPerChunk) {
			const chunkTextWords = textWords.slice(i, i + wordsPerChunk);
			const chunkWordTimings = wordTimings.slice(i, i + wordsPerChunk);
			const chunkDuration = Math.max(minDuration, chunkTextWords.length / wordsPerSecond);
			const adjustedStartTime = Math.max(
				chunkWordTimings[0]?.start ?? segment.start,
				globalEndTime,
			);

			const relativeWordTimings = chunkWordTimings.map((wt) => ({
				word: wt.word,
				start: wt.start - adjustedStartTime,
				end: wt.end - adjustedStartTime,
			}));

			captions.push({
				text: chunkTextWords.join(" "),
				startTime: adjustedStartTime,
				duration: chunkDuration,
				words: relativeWordTimings,
			});

			globalEndTime = adjustedStartTime + chunkDuration;
		}
	}

	return captions;
}

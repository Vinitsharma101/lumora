/**
 * Tick-based time system for frame-accurate editing.
 *
 * All internal timeline operations use integer ticks.
 * One tick = 1/48000 second (audio-sample precision).
 * Floating-point seconds are only used at the UI boundary.
 */

const TICKS_PER_SECOND = 48_000;

/** Convert floating-point seconds to integer ticks. */
export function secondsToTicks(seconds: number): number {
	return Math.round(seconds * TICKS_PER_SECOND);
}

/** Convert integer ticks to floating-point seconds. */
export function ticksToSeconds(ticks: number): number {
	return ticks / TICKS_PER_SECOND;
}

/** Convert ticks to a frame index at the given frame rate. */
export function ticksToFrame(ticks: number, fps: number): number {
	return Math.floor((ticks * fps) / TICKS_PER_SECOND);
}

/** Convert a frame index to ticks at the given frame rate. */
export function frameToTicks(frame: number, fps: number): number {
	return Math.round((frame * TICKS_PER_SECOND) / fps);
}

/** Snap ticks to the nearest frame boundary at the given fps. */
export function snapTicksToFrame(ticks: number, fps: number): number {
	const frame = ticksToFrame(ticks, fps);
	return frameToTicks(frame, fps);
}

/** Format ticks as timecode string HH:MM:SS:FF */
export function ticksToTimecode(ticks: number, fps: number): string {
	const totalFrames = ticksToFrame(ticks, fps);
	const ff = totalFrames % fps;
	const totalSeconds = Math.floor(totalFrames / fps);
	const ss = totalSeconds % 60;
	const totalMinutes = Math.floor(totalSeconds / 60);
	const mm = totalMinutes % 60;
	const hh = Math.floor(totalMinutes / 60);

	const pad2 = (n: number) => String(n).padStart(2, "0");
	return `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}:${pad2(ff)}`;
}

/** Parse a timecode string back to ticks. */
export function timecodeToTicks(timecode: string, fps: number): number {
	const parts = timecode.split(":");
	if (parts.length !== 4) {
		throw new Error(`Invalid timecode format: ${timecode}`);
	}
	const [hh, mm, ss, ff] = parts.map(Number);
	const totalFrames = ((hh * 60 + mm) * 60 + ss) * fps + ff;
	return frameToTicks(totalFrames, fps);
}

export { TICKS_PER_SECOND };

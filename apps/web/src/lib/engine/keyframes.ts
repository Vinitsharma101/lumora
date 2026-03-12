/**
 * Keyframe engine — property animation system for timeline elements.
 *
 * Every element can hold an array of Keyframe objects. At render time
 * the engine interpolates between the surrounding keyframes to produce
 * the current value for each animated property.
 *
 * Supported interpolation: linear, ease-in, ease-out, ease-in-out,
 * cubic-bezier (custom control points), hold (step).
 */

export type EasingType =
	| "linear"
	| "ease-in"
	| "ease-out"
	| "ease-in-out"
	| "hold"
	| "cubic-bezier";

export interface Keyframe {
	/** Which property this keyframe targets (e.g. "scale", "opacity", "position.x"). */
	property: string;
	/** Time relative to the element's startTime (in seconds). */
	time: number;
	/** The value at this keyframe. Numeric for interpolatable props. */
	value: number;
	/** Easing function applied between this keyframe and the next. */
	easing: EasingType;
	/** Control points for cubic-bezier [x1, y1, x2, y2]. Only used when easing = "cubic-bezier". */
	bezierPoints?: [number, number, number, number];
}

/**
 * Resolve the interpolated value of a property at a given element-local time.
 * Returns undefined if no keyframes exist for the property.
 */
export function interpolateKeyframes(
	keyframes: Keyframe[],
	property: string,
	time: number,
): number | undefined {
	// Filter to only keyframes for this property, sorted by time
	const propFrames = keyframes
		.filter((kf) => kf.property === property)
		.sort((a, b) => a.time - b.time);

	if (propFrames.length === 0) return undefined;

	// Before first keyframe → use first value
	if (time <= propFrames[0].time) return propFrames[0].value;

	// After last keyframe → use last value
	const last = propFrames[propFrames.length - 1];
	if (time >= last.time) return last.value;

	// Find surrounding keyframes
	let prevIdx = 0;
	for (let i = 1; i < propFrames.length; i++) {
		if (propFrames[i].time > time) break;
		prevIdx = i;
	}

	const prev = propFrames[prevIdx];
	const next = propFrames[prevIdx + 1];

	// Normalised progress [0, 1] between the two keyframes
	const span = next.time - prev.time;
	if (span <= 0) return prev.value;
	const t = (time - prev.time) / span;

	// Apply easing and interpolate
	const easedT = applyEasing(t, prev.easing, prev.bezierPoints);
	return prev.value + (next.value - prev.value) * easedT;
}

/**
 * Resolve all animated properties at a given time.
 * Returns a map of property → interpolated value.
 */
export function resolveKeyframesAt(
	keyframes: Keyframe[],
	time: number,
): Map<string, number> {
	const properties = new Set(keyframes.map((kf) => kf.property));
	const result = new Map<string, number>();

	for (const prop of properties) {
		const value = interpolateKeyframes(keyframes, prop, time);
		if (value !== undefined) {
			result.set(prop, value);
		}
	}

	return result;
}

/**
 * Apply easing function to a linear progress value t ∈ [0, 1].
 */
function applyEasing(
	t: number,
	easing: EasingType,
	bezierPoints?: [number, number, number, number],
): number {
	switch (easing) {
		case "linear":
			return t;

		case "ease-in":
			return t * t;

		case "ease-out":
			return 1 - (1 - t) * (1 - t);

		case "ease-in-out":
			return t < 0.5
				? 2 * t * t
				: 1 - (-2 * t + 2) ** 2 / 2;

		case "hold":
			return 0; // Step function: hold previous value until next keyframe

		case "cubic-bezier": {
			if (!bezierPoints) return t;
			return solveCubicBezier(t, bezierPoints);
		}

		default:
			return t;
	}
}

/**
 * Solve cubic bezier curve for CSS-style control points.
 * Points: P0=(0,0), P1=(x1,y1), P2=(x2,y2), P3=(1,1)
 * Given an x value (progress), find the corresponding y (eased value).
 */
function solveCubicBezier(
	x: number,
	[x1, y1, x2, y2]: [number, number, number, number],
): number {
	// Newton's method to find t for given x
	let t = x;
	for (let i = 0; i < 8; i++) {
		const currentX = cubicBezierSample(t, x1, x2);
		const dx = currentX - x;
		if (Math.abs(dx) < 1e-6) break;
		const derivative = cubicBezierDerivative(t, x1, x2);
		if (Math.abs(derivative) < 1e-6) break;
		t -= dx / derivative;
	}
	t = Math.max(0, Math.min(1, t));
	return cubicBezierSample(t, y1, y2);
}

function cubicBezierSample(t: number, p1: number, p2: number): number {
	// B(t) = 3(1-t)²t·p1 + 3(1-t)t²·p2 + t³
	return 3 * (1 - t) * (1 - t) * t * p1 + 3 * (1 - t) * t * t * p2 + t * t * t;
}

function cubicBezierDerivative(t: number, p1: number, p2: number): number {
	// B'(t) = 3(1-t)²·p1 + 6(1-t)t·(p2-p1) + 3t²·(1-p2)
	return (
		3 * (1 - t) * (1 - t) * p1 +
		6 * (1 - t) * t * (p2 - p1) +
		3 * t * t * (1 - p2)
	);
}

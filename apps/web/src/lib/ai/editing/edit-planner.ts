/**
 * Edit Planner — Converts parsed intents + timeline metrics into structured edit plans.
 *
 * Planning ≠ executing. The planner generates a plan of atomic actions
 * that the Command Mapper will translate into timeline commands.
 * Plans are deterministic given the same intent + metrics.
 */

import { generateUUID } from "@/utils/id";
import type {
	ParsedIntent,
	TimelineMetrics,
	EditPlan,
	PlanAction,
	FrontendStyleProfile,
} from "./types";
import { getStyleProfile } from "./style-profiles";

/**
 * Generate an edit plan for trimming silence from the timeline.
 */
function planTrimSilence(
	intent: ParsedIntent,
	metrics: TimelineMetrics,
): PlanAction[] {
	const threshold =
		(intent.parameters.threshold as number | undefined) ?? 0.3;
	const actions: PlanAction[] = [];

	for (const segment of metrics.silenceSegments) {
		if (segment.duration > threshold) {
			actions.push({
				type: "trim_silence",
				priority: 1,
				parameters: {
					start: segment.start,
					end: segment.end,
					duration: segment.duration,
					trackId: segment.trackId,
					elementId: segment.elementId,
					threshold,
				},
				reasoning: `Silence of ${segment.duration.toFixed(1)}s exceeds ${threshold}s threshold`,
			});
		}
	}

	return actions;
}

/**
 * Generate an edit plan for reducing average clip length.
 */
function planReduceClipLength(
	intent: ParsedIntent,
	metrics: TimelineMetrics,
): PlanAction[] {
	const target =
		(intent.parameters.targetAvgLength as number | undefined) ?? 2.5;
	const actions: PlanAction[] = [];

	if (metrics.avgClipLength <= target) return actions;

	// Only cut clips that exceed the target
	const cutThreshold = target * 1.5;

	actions.push({
		type: "reduce_avg_clip_length",
		priority: 2,
		parameters: {
			targetAvgLength: target,
			cutThreshold,
			currentAvg: metrics.avgClipLength,
		},
		reasoning: `Average clip length ${metrics.avgClipLength.toFixed(1)}s → target ${target}s`,
	});

	return actions;
}

/**
 * Generate an edit plan for adding punch zoom effects.
 */
function planPunchZoom(
	intent: ParsedIntent,
	metrics: TimelineMetrics,
): PlanAction[] {
	const count = (intent.parameters.count as number | undefined) ?? 5;
	const scale = (intent.parameters.scale as number | undefined) ?? 1.05;
	const aggressiveness = intent.aggressiveness ?? 0.5;

	// Distribute zooms evenly across the timeline
	const effectiveCount = Math.min(
		count,
		Math.ceil(metrics.duration / 5),
	);

	const actions: PlanAction[] = [];
	const interval = metrics.duration / (effectiveCount + 1);

	for (let index = 1; index <= effectiveCount; index++) {
		const time = interval * index;
		actions.push({
			type: "add_punch_zoom",
			priority: 3,
			parameters: {
				time,
				scale: 1 + (scale - 1) * aggressiveness,
				duration: 0.3,
			},
			reasoning: `Punch zoom #${index} at ${time.toFixed(1)}s`,
		});
	}

	return actions;
}

/**
 * Generate an edit plan for inserting background music.
 */
function planInsertMusic(
	intent: ParsedIntent,
	metrics: TimelineMetrics,
): PlanAction[] {
	if (metrics.hasMusic) return [];

	return [
		{
			type: "insert_music",
			priority: 4,
			parameters: {
				style:
					(intent.parameters.style as string | undefined) ?? "upbeat",
				duration: metrics.duration,
				startTime: 0,
			},
			reasoning: "No background music detected",
		},
	];
}

/**
 * Generate an edit plan for constraining total duration.
 */
function planDurationConstraint(
	intent: ParsedIntent,
	metrics: TimelineMetrics,
): PlanAction[] {
	const targetDuration = intent.parameters.targetDuration as
		| number
		| undefined;
	if (!targetDuration || metrics.duration <= targetDuration) return [];

	const excessDuration = metrics.duration - targetDuration;
	const actions: PlanAction[] = [];

	// Strategy: trim silence first, then shorten longest clips
	if (metrics.totalSilenceDuration > 0) {
		actions.push({
			type: "trim_silence",
			priority: 1,
			parameters: {
				threshold: 0.2,
				maxTrimTotal: Math.min(
					excessDuration,
					metrics.totalSilenceDuration,
				),
			},
			reasoning: `Remove up to ${Math.min(excessDuration, metrics.totalSilenceDuration).toFixed(1)}s of silence`,
		});
	}

	actions.push({
		type: "constrain_duration",
		priority: 2,
		parameters: {
			targetDuration,
			currentDuration: metrics.duration,
			excessDuration,
		},
		reasoning: `Reduce from ${metrics.duration.toFixed(1)}s to ${targetDuration}s`,
	});

	return actions;
}

/**
 * Generate an edit plan for increasing engagement.
 * This is a composite intent that combines multiple strategies.
 */
function planIncreaseEngagement(
	intent: ParsedIntent,
	metrics: TimelineMetrics,
): PlanAction[] {
	const aggressiveness = intent.aggressiveness ?? 0.7;
	const actions: PlanAction[] = [];

	// Trim silence if there's significant dead air
	if (metrics.totalSilenceDuration > metrics.duration * 0.1) {
		actions.push(
			...planTrimSilence(
				{ ...intent, parameters: { threshold: 0.3 } },
				metrics,
			),
		);
	}

	// Shorten clips if pacing is slow
	if (metrics.avgClipLength > 5) {
		actions.push(
			...planReduceClipLength(
				{
					...intent,
					parameters: {
						targetAvgLength: Math.max(
							2.0,
							metrics.avgClipLength * (1 - aggressiveness * 0.4),
						),
					},
				},
				metrics,
			),
		);
	}

	// Add punch zooms to boost visual energy
	if (metrics.energyScore < 0.5) {
		const zoomCount = Math.ceil(metrics.duration / 10 * aggressiveness);
		actions.push(
			...planPunchZoom(
				{
					...intent,
					parameters: { count: zoomCount, scale: 1.05 },
				},
				metrics,
			),
		);
	}

	// Add music if absent
	if (!metrics.hasMusic) {
		actions.push(...planInsertMusic(intent, metrics));
	}

	return actions;
}

/**
 * Generate an edit plan based on a style profile.
 */
function planApplyStyleProfile(
	intent: ParsedIntent,
	metrics: TimelineMetrics,
): PlanAction[] {
	const profileName =
		(intent.parameters.profileName as string | undefined) ?? "youtube";
	const profile = getStyleProfile(profileName);
	if (!profile) return [];

	const actions: PlanAction[] = [];

	// Adjust pacing to match profile
	if (metrics.avgClipLength > profile.targetAvgClipLength * 1.5) {
		actions.push({
			type: "reduce_avg_clip_length",
			priority: 1,
			parameters: {
				targetAvgLength: profile.targetAvgClipLength,
				cutThreshold: profile.targetAvgClipLength * 2,
				currentAvg: metrics.avgClipLength,
			},
			reasoning: `Match ${profile.name} pacing: ${metrics.avgClipLength.toFixed(1)}s → ${profile.targetAvgClipLength}s avg`,
		});
	}

	// Trim silence to match profile threshold
	if (metrics.totalSilenceDuration > 0) {
		actions.push(
			...planTrimSilence(
				{
					...intent,
					parameters: { threshold: profile.silenceThreshold },
				},
				metrics,
			),
		);
	}

	// Add zoom effects if profile calls for them
	if (profile.zoomFrequency > 0 && metrics.energyScore < 0.6) {
		const count = Math.ceil(
			(metrics.duration / 60) *
				profile.pacingCutsPerMinute[0] *
				profile.zoomFrequency,
		);
		actions.push(
			...planPunchZoom(
				{
					...intent,
					parameters: { count, scale: profile.punchZoomScale },
				},
				metrics,
			),
		);
	}

	// Add music if the profile expects it and none present
	if (!metrics.hasMusic && profile.musicVolume > 0) {
		actions.push(...planInsertMusic(intent, metrics));
	}

	return actions;
}

/**
 * Generate a complete edit plan from a parsed intent and timeline metrics.
 */
export function generateEditPlan(
	intent: ParsedIntent,
	metrics: TimelineMetrics,
): EditPlan {
	let actions: PlanAction[];

	switch (intent.type) {
		case "trim_silence": {
			actions = planTrimSilence(intent, metrics);
			break;
		}
		case "reduce_clip_length": {
			actions = planReduceClipLength(intent, metrics);
			break;
		}
		case "increase_engagement": {
			actions = planIncreaseEngagement(intent, metrics);
			break;
		}
		case "add_punch_zoom": {
			actions = planPunchZoom(intent, metrics);
			break;
		}
		case "insert_music": {
			actions = planInsertMusic(intent, metrics);
			break;
		}
		case "duration_constraint": {
			actions = planDurationConstraint(intent, metrics);
			break;
		}
		case "apply_style_profile": {
			actions = planApplyStyleProfile(intent, metrics);
			break;
		}
		case "kinetic_captions": {
			actions = [
				{
					type: "add_caption",
					priority: 2,
					parameters: {
						style: (intent.parameters.style as string | undefined) ?? "kinetic",
						wordByWord: true,
						highlightKeywords: true,
					},
					reasoning: "Apply kinetic caption styling",
				},
			];
			break;
		}
		case "add_transitions": {
			actions = [
				{
					type: "add_transition",
					priority: 3,
					parameters: {
						style:
							(intent.parameters.style as string | undefined) ?? "dissolve",
						duration:
							(intent.parameters.duration as number | undefined) ?? 0.5,
					},
					reasoning: "Add transitions between clips",
				},
			];
			break;
		}
		case "add_text_overlay": {
			actions = [
				{
					type: "add_text_overlay",
					priority: 3,
					parameters: { ...intent.parameters },
					reasoning: "Add text overlay to timeline",
				},
			];
			break;
		}
		case "adjust_audio_levels": {
			actions = [
				{
					type: "adjust_volume",
					priority: 2,
					parameters: { ...intent.parameters },
					reasoning: "Adjust audio levels across tracks",
				},
			];
			break;
		}
		case "speed_ramp": {
			actions = [
				{
					type: "adjust_speed",
					priority: 3,
					parameters: { ...intent.parameters },
					reasoning: "Apply speed ramp effect",
				},
			];
			break;
		}
		default: {
			actions = [];
			break;
		}
	}

	// Sort by priority (lower number = higher priority)
	actions.sort((a, b) => a.priority - b.priority);

	return {
		id: generateUUID(),
		intent,
		actions,
		estimatedChanges: actions.length,
		metrics,
		createdAt: Date.now(),
	};
}

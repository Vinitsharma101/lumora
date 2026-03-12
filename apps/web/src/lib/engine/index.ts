/**
 * Timeline Engine — barrel export.
 *
 * The engine is the core IP layer of Grace Studio:
 *   - Tick-based time system (frame-accurate)
 *   - Interval-tree clip resolver (O(log n))
 *   - Keyframe animation engine
 *   - Pacing analysis engine
 *   - Event-sourced edit history
 *   - Magnetic / ripple snap system
 *   - Agent-editable API
 *   - Multi-format serialization
 */

// Time system
export {
	TICKS_PER_SECOND,
	secondsToTicks,
	ticksToSeconds,
	ticksToFrame,
	frameToTicks,
	snapTicksToFrame,
	ticksToTimecode,
	timecodeToTicks,
} from "./time";

// Interval tree (data structure)
export { IntervalTree, type TimeInterval } from "./interval-tree";

// Time resolver
export { TimeResolver, type ResolvedClip } from "./time-resolver";

// Keyframe engine
export {
	interpolateKeyframes,
	resolveKeyframesAt,
	type Keyframe,
	type EasingType,
} from "./keyframes";

// Pacing engine
export {
	analyzePacing,
	suggestPacingFixes,
	type PacingMetrics,
	type PacingSuggestion,
	type WindowMetric,
} from "./pacing";

// Event log
export {
	EventLog,
	type EditEvent,
	type EditEventType,
} from "./event-log";

// Snap engine
export {
	collectSnapPoints,
	magneticSnap,
	rippleInsert,
	rippleDelete,
	closeGaps,
	DEFAULT_SNAP_CONFIG,
	type SnapConfig,
	type MagneticSnapPoint,
	type MagneticSnapResult,
} from "./snap";

// Timeline engine (compositing graph)
export {
	TimelineEngine,
	type ResolvedFrame,
	type ResolvedFrameClip,
} from "./timeline-engine";

// Agent API
export { AgentTimelineAPI, type AgentEditResult } from "./agent-api";

// Serialization
export {
	serializeToJSON,
	deserializeFromJSON,
	exportToEDL,
	type TimelineJSON,
} from "./serialization";

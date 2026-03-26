/**
 * Granular editor hooks for fine-grained subscriptions.
 *
 * Problem: `useEditor()` subscribes to ALL 7 managers so any change (even
 * a playback timer tick) causes every consumer to re-render.
 *
 * Solution: domain-specific hooks that subscribe only to the manager they
 * care about, preventing unrelated manager changes from causing extra renders.
 *
 * Usage:
 *   const editor = usePlaybackEditor();  // re-renders on playback changes only
 *   const editor = useTimelineEditor();  // re-renders on timeline changes only
 *   etc.
 */
import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import { EditorCore } from "@/core";

type ManagerKey =
	| "playback"
	| "timeline"
	| "scenes"
	| "project"
	| "media"
	| "renderer"
	| "selection";

function useEditorWithManagers(managers: ManagerKey[]): EditorCore {
	const editor = useMemo(() => EditorCore.getInstance(), []);
	const versionRef = useRef(0);

	const subscribe = useCallback(
		(onStoreChange: () => void) => {
			const handleStoreChange = () => {
				versionRef.current += 1;
				onStoreChange();
			};

			const unsubscribers = managers.map((key) =>
				editor[key].subscribe(handleStoreChange),
			);

			return () => {
				for (const unsubscribe of unsubscribers) {
					unsubscribe();
				}
			};
		},
		[editor, ...managers, managers.map],
	);

	const getSnapshot = useCallback(() => versionRef.current, []);
	useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

	return editor;
}

/**
 * Subscribes to playback changes only.
 * Use in components that need to respond to play/pause/seek/time updates.
 */
export function usePlaybackEditor(): EditorCore {
	return useEditorWithManagers(["playback"]);
}

/**
 * Subscribes to timeline and scenes changes only.
 * Use in panels that render timeline elements (effects, transitions, etc.).
 */
export function useTimelineEditor(): EditorCore {
	return useEditorWithManagers(["timeline", "scenes"]);
}

/**
 * Subscribes to media asset changes only.
 * Use in the media browser / assets panel.
 */
export function useMediaEditor(): EditorCore {
	return useEditorWithManagers(["media"]);
}

/**
 * Subscribes to selection changes only.
 * Use in properties panels that respond to element selection.
 */
export function useSelectionEditor(): EditorCore {
	return useEditorWithManagers(["selection", "timeline", "scenes"]);
}

/**
 * Subscribes to project settings changes only.
 * Use in settings panels.
 */
export function useProjectEditor(): EditorCore {
	return useEditorWithManagers(["project"]);
}

/**
 * Subscribes to all managers — same as the original `useEditor()`.
 * Only use this when the component genuinely needs to react to any change.
 * Prefer the specific hooks above for panels that have a narrower concern.
 */
export function useAllManagersEditor(): EditorCore {
	return useEditorWithManagers([
		"playback",
		"timeline",
		"scenes",
		"project",
		"media",
		"renderer",
		"selection",
	]);
}

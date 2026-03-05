import { useEditor } from "@/hooks/use-editor";
import { useAssetsPanelStore } from "@/stores/assets-panel-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowRightDoubleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

const TRANSITIONS = [
	{ id: "fade-in", type: "fade", name: "Fade In", duration: 1.0, direction: "in" },
	{ id: "fade-out", type: "fade", name: "Fade Out", duration: 1.0, direction: "out" },
];

export function TransitionsView() {
	const editor = useEditor();
	const activeElements = editor.selection.getSelectedElements();

	const handleApplyTransition = (transition: (typeof TRANSITIONS)[number]) => {
		if (activeElements.length === 0) return;

		editor.timeline.updateElements({
			updates: activeElements.map((el) => {
				const track = editor.timeline.getTrackById({ trackId: el.trackId });
				const element = track?.elements.find((e) => e.id === el.elementId) as any;
				const existingTransitions: Array<{ id: string; type: string; duration: number; direction: "in" | "out" }> =
					element?.transitions || [];

				if (existingTransitions.some((t: any) => t.id === transition.id)) {
					return {
						trackId: el.trackId,
						elementId: el.elementId,
						updates: {}
					};
				}

				return {
					trackId: el.trackId,
					elementId: el.elementId,
					updates: {
						transitions: [...existingTransitions, { id: transition.id, type: transition.type, duration: transition.duration, direction: transition.direction }],
					},
				};
			}),
		});
	};

	const handleRemoveTransition = (transitionId: string) => {
		if (activeElements.length === 0) return;

		editor.timeline.updateElements({
			updates: activeElements.map((el) => {
				const track = editor.timeline.getTrackById({ trackId: el.trackId });
				const element = track?.elements.find((e) => e.id === el.elementId) as any;
				const existingTransitions: Array<{ id: string; type: string; duration: number; direction: "in" | "out" }> =
					element?.transitions || [];

				return {
					trackId: el.trackId,
					elementId: el.elementId,
					updates: {
						transitions: existingTransitions.filter((t) => t.id !== transitionId),
					},
				};
			}),
		});
	};

	return (
		<div className="flex h-full flex-col">
			<div className="border-b p-4">
				<h2 className="font-semibold flex items-center gap-2 text-sm">
					<HugeiconsIcon icon={ArrowRightDoubleIcon} className="size-4" />
					Transitions
				</h2>
				<p className="text-muted-foreground mt-1 text-xs">
					Select a clip in the timeline to apply transitions.
				</p>
			</div>

			<ScrollArea className="flex-1">
				<div className="p-4 grid grid-cols-2 gap-2">
					{TRANSITIONS.map((transition) => (
						<button
							key={transition.id}
							onClick={() => handleApplyTransition(transition)}
							className="bg-muted/50 hover:bg-muted focus-visible:ring-ring flex flex-col items-center justify-center gap-2 rounded-md border p-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2"
						>
							<div className="bg-background/50 flex size-10 items-center justify-center rounded-full">
								<HugeiconsIcon icon={ArrowRightDoubleIcon} className="size-5" />
							</div>
							<span className="text-center text-xs font-medium">
								{transition.name}
							</span>
						</button>
					))}
				</div>

				{activeElements.length > 0 && (
					<div className="p-4 border-t">
						<h3 className="text-xs font-medium mb-2">Applied Transitions (First Selected Clip)</h3>
						{(() => {
							const track = editor.timeline.getTrackById({ trackId: activeElements[0].trackId });
							const element = track?.elements.find((e) => e.id === activeElements[0].elementId) as any;
							const transitions: Array<{ id: string; type: string; duration: number; direction: "in" | "out" }> =
								element?.transitions || [];
							
							if (transitions.length === 0) {
								return <p className="text-xs text-muted-foreground">No transitions applied.</p>;
							}

							return (
								<div className="flex flex-col gap-2">
									{transitions.map((t) => (
										<div key={t.id} className="flex items-center justify-between bg-muted/30 p-2 rounded text-xs border">
											<span>{TRANSITIONS.find(preset => preset.id === t.id)?.name || t.type}</span>
											<button 
												onClick={() => handleRemoveTransition(t.id)}
												className="text-destructive hover:underline"
											>
												Remove
											</button>
										</div>
									))}
								</div>
							);
						})()}
					</div>
				)}
			</ScrollArea>
		</div>
	);
}

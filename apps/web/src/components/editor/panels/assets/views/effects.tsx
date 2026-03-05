import { useEditor } from "@/hooks/use-editor";
import { useAssetsPanelStore } from "@/stores/assets-panel-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MagicWand05Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

const EFFECTS = [
	{ id: "blur-sm", type: "blur", name: "Slight Blur", intensity: 0.2 },
	{ id: "blur-lg", type: "blur", name: "Heavy Blur", intensity: 0.8 },
	{ id: "grayscale", type: "grayscale", name: "Black & White", intensity: 1.0 },
	{ id: "sepia", type: "sepia", name: "Sepia Vintage", intensity: 1.0 },
	{ id: "brightness-up", type: "brightness", name: "Brighten", intensity: 0.75 }, // base is 0.5
	{ id: "contrast-up", type: "contrast", name: "High Contrast", intensity: 0.75 },
];

export function EffectsView() {
	const editor = useEditor();
	const activeElements = editor.selection.getSelectedElements();

	const handleApplyEffect = (effect: (typeof EFFECTS)[number]) => {
		if (activeElements.length === 0) return;

		editor.timeline.updateElements({
			updates: activeElements.map((el) => {
				const track = editor.timeline.getTrackById({ trackId: el.trackId });
				const element = track?.elements.find((e) => e.id === el.elementId) as any;
				const existingEffects = element?.effects || [];

				// Check if effect already exists
				if (existingEffects.some((e: any) => e.id === effect.id)) {
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
						effects: [...existingEffects, { id: effect.id, type: effect.type, intensity: effect.intensity }],
					},
				};
			}),
		});
	};

	const handleRemoveEffect = (effectId: string) => {
		if (activeElements.length === 0) return;

		editor.timeline.updateElements({
			updates: activeElements.map((el) => {
				const track = editor.timeline.getTrackById({ trackId: el.trackId });
				const element = track?.elements.find((e) => e.id === el.elementId) as any;
				const existingEffects: Array<{ id: string; type: string; intensity: number }> =
					element?.effects || [];

				return {
					trackId: el.trackId,
					elementId: el.elementId,
					updates: {
						effects: existingEffects.filter((e) => e.id !== effectId),
					},
				};
			}),
		});
	};

	return (
		<div className="flex h-full flex-col">
			<div className="border-b p-4">
				<h2 className="font-semibold flex items-center gap-2 text-sm">
					<HugeiconsIcon icon={MagicWand05Icon} className="size-4" />
					Effects
				</h2>
				<p className="text-muted-foreground mt-1 text-xs">
					Select a clip in the timeline to apply effects.
				</p>
			</div>

			<ScrollArea className="flex-1">
				<div className="p-4 grid grid-cols-2 gap-2">
					{EFFECTS.map((effect) => (
						<button
							key={effect.id}
							onClick={() => handleApplyEffect(effect)}
							className="bg-muted/50 hover:bg-muted focus-visible:ring-ring flex flex-col items-center justify-center gap-2 rounded-md border p-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2"
						>
							<div className="bg-background/50 flex size-10 items-center justify-center rounded-full">
								<HugeiconsIcon icon={MagicWand05Icon} className="size-5" />
							</div>
							<span className="text-center text-xs font-medium">
								{effect.name}
							</span>
						</button>
					))}
				</div>

				{activeElements.length > 0 && (
					<div className="p-4 border-t">
						<h3 className="text-xs font-medium mb-2">Applied Effects (First Selected Clip)</h3>
						{(() => {
							const track = editor.timeline.getTrackById({ trackId: activeElements[0].trackId });
							const element = track?.elements.find((e) => e.id === activeElements[0].elementId) as any;
							const effects: Array<{ id: string; type: string; intensity: number }> =
								element?.effects || [];
							
							if (effects.length === 0) {
								return <p className="text-xs text-muted-foreground">No effects applied.</p>;
							}

							return (
								<div className="flex flex-col gap-2">
									{effects.map((e) => (
										<div key={e.id} className="flex items-center justify-between bg-muted/30 p-2 rounded text-xs border">
											<span>{EFFECTS.find(preset => preset.id === e.id)?.name || e.type}</span>
											<button 
												onClick={() => handleRemoveEffect(e.id)}
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

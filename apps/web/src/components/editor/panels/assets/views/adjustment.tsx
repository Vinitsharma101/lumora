import { useState, useMemo } from "react";
import { useEditor } from "@/hooks/use-editor";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { SlidersHorizontalIcon, ArrowTurnBackwardIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	ALL_ADJUSTMENTS,
	ADJUSTMENT_CATEGORIES,
	getAdjustmentsByCategory,
	type AdjustmentCategory,
	type AdjustmentDefinition,
} from "@/lib/effects/adjustment-definitions";
import { cn } from "@/utils/ui";

const CATEGORY_ICONS: Record<AdjustmentCategory, string> = {
	light: "☀️",
	color: "🌈",
	detail: "🔍",
};

export function AdjustmentView() {
	const editor = useEditor();
	const activeElements = editor.selection.getSelectedElements();
	const [selectedCategory, setSelectedCategory] = useState<AdjustmentCategory | "all">("all");

	const displayedAdjustments = useMemo(() => {
		return selectedCategory === "all"
			? ALL_ADJUSTMENTS
			: getAdjustmentsByCategory(selectedCategory);
	}, [selectedCategory]);

	// Get current adjustment values from the first selected element
	const getAdjustmentValue = (adjustId: string): number => {
		if (activeElements.length === 0) return 0;
		const track = editor.timeline.getTrackById({ trackId: activeElements[0].trackId });
		const element = track?.elements.find((e) => e.id === activeElements[0].elementId) as any;
		const effects: Array<{ id: string; type: string; intensity: number }> =
			element?.effects || [];
		const found = effects.find((e) => e.id === adjustId);
		return found?.intensity ?? 0;
	};

	const handleSetValue = (adjustment: AdjustmentDefinition, value: number) => {
		if (activeElements.length === 0) return;

		editor.timeline.updateElements({
			updates: activeElements.map((el) => {
				const track = editor.timeline.getTrackById({ trackId: el.trackId });
				const element = track?.elements.find((e) => e.id === el.elementId) as any;
				const existingEffects: Array<{ id: string; type: string; intensity: number }> =
					element?.effects || [];

				// If value is the default (neutral), remove the adjustment effect
				if (value === adjustment.defaultValue) {
					return {
						trackId: el.trackId,
						elementId: el.elementId,
						updates: {
							effects: existingEffects.filter((e) => e.id !== adjustment.id),
						},
					};
				}

				// Upsert: find existing or add new
				const hasExisting = existingEffects.some((e) => e.id === adjustment.id);

				if (hasExisting) {
					return {
						trackId: el.trackId,
						elementId: el.elementId,
						updates: {
							effects: existingEffects.map((e) =>
								e.id === adjustment.id ? { ...e, intensity: value } : e,
							),
						},
					};
				}

				return {
					trackId: el.trackId,
					elementId: el.elementId,
					updates: {
						effects: [
							...existingEffects,
							{
								id: adjustment.id,
								type: adjustment.type,
								intensity: value,
							},
						],
					},
				};
			}),
		});
	};

	const handleResetAll = () => {
		if (activeElements.length === 0) return;

		const adjustmentIds = new Set(ALL_ADJUSTMENTS.map((a) => a.id));

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
						effects: existingEffects.filter((e) => !adjustmentIds.has(e.id)),
					},
				};
			}),
		});
	};

	// Check if any adjustment is non-default
	const hasChanges = ALL_ADJUSTMENTS.some((adj) => {
		const val = getAdjustmentValue(adj.id);
		return val !== adj.defaultValue;
	});

	return (
		<div className="flex h-full flex-col">
			{/* Header */}
			<div className="border-b p-4">
				<div className="flex items-center justify-between">
					<h2 className="font-semibold flex items-center gap-2 text-sm">
						<HugeiconsIcon icon={SlidersHorizontalIcon} className="size-4" />
						Adjustment
					</h2>
					{hasChanges && (
						<Button
							variant="ghost"
							size="sm"
							className="h-6 text-[10px] px-2 text-muted-foreground hover:text-foreground"
							onClick={handleResetAll}
						>
							<HugeiconsIcon icon={ArrowTurnBackwardIcon} className="size-3 mr-1" />
							Reset All
						</Button>
					)}
				</div>
				<p className="text-muted-foreground mt-1 text-xs">
					Select a clip to make adjustments.
				</p>
			</div>

			{/* Category Tabs */}
			<div className="px-4 pt-3 pb-2 flex gap-1 flex-wrap">
				<button
					onClick={() => setSelectedCategory("all")}
					className={cn(
						"px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
						selectedCategory === "all"
							? "bg-primary text-primary-foreground"
							: "bg-muted/50 text-muted-foreground hover:bg-muted",
					)}
				>
					All
				</button>
				{(Object.entries(ADJUSTMENT_CATEGORIES) as [AdjustmentCategory, string][]).map(
					([key, label]) => (
						<button
							key={key}
							onClick={() => setSelectedCategory(key)}
							className={cn(
								"px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
								selectedCategory === key
									? "bg-primary text-primary-foreground"
									: "bg-muted/50 text-muted-foreground hover:bg-muted",
							)}
						>
							{CATEGORY_ICONS[key]} {label}
						</button>
					),
				)}
			</div>

			<ScrollArea className="flex-1">
				<div className="px-4 pb-4 flex flex-col gap-1">
					{displayedAdjustments.map((adj) => {
						const currentValue = getAdjustmentValue(adj.id);
						const isModified = currentValue !== adj.defaultValue;

						return (
							<div
								key={adj.id}
								className={cn(
									"rounded-lg border p-3 transition-all",
									isModified
										? "bg-primary/5 border-primary/20"
										: "bg-muted/20 border-transparent",
								)}
							>
								<div className="flex items-center justify-between mb-2">
									<span className="text-xs font-medium flex items-center gap-1.5">
										<span className="text-sm leading-none">{adj.icon}</span>
										{adj.name}
									</span>
									<div className="flex items-center gap-1.5">
										<span
											className={cn(
												"text-[10px] font-mono tabular-nums min-w-[2rem] text-right",
												isModified
													? "text-foreground"
													: "text-muted-foreground",
											)}
										>
											{currentValue > 0 && adj.min < 0 ? "+" : ""}
											{currentValue}
										</span>
										{isModified && (
											<button
												onClick={() =>
													handleSetValue(adj, adj.defaultValue)
												}
												className="text-muted-foreground hover:text-foreground transition-colors"
												title="Reset"
											>
												<HugeiconsIcon
													icon={ArrowTurnBackwardIcon}
													className="size-3"
												/>
											</button>
										)}
									</div>
								</div>
								<Slider
									min={adj.min}
									max={adj.max}
									step={adj.step}
									value={[currentValue]}
									onValueChange={([val]) => handleSetValue(adj, val)}
									className="w-full"
								/>
							</div>
						);
					})}
				</div>

				{activeElements.length === 0 && (
					<div className="px-4 pb-4">
						<p className="text-muted-foreground text-xs text-center py-8">
							Select a clip on the timeline to adjust its properties.
						</p>
					</div>
				)}
			</ScrollArea>
		</div>
	);
}

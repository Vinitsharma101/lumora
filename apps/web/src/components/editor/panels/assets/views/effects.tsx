import { useState, useMemo } from "react";
import { useEditor } from "@/hooks/use-editor";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { MagicWand05Icon, Search01Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	ALL_EFFECTS,
	getEffectsByCategory,
} from "@/lib/effects/effect-definitions";
import { EFFECT_CATEGORIES, type EffectCategory } from "@/types/effects";
import { cn } from "@/utils/ui";

const CATEGORY_ICONS: Record<EffectCategory, string> = {
	color: "🎨",
	vfx: "✨",
	motion: "🎬",
	ai: "🧠",
	pro: "⚡",
};

export function EffectsView() {
	const editor = useEditor();
	const activeElements = editor.selection.getSelectedElements();
	const [selectedCategory, setSelectedCategory] = useState<EffectCategory | "all">("all");
	const [searchQuery, setSearchQuery] = useState("");

	const filteredEffects = useMemo(() => {
		let effects = selectedCategory === "all"
			? ALL_EFFECTS
			: getEffectsByCategory(selectedCategory);

		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			effects = effects.filter(
				(e) =>
					e.name.toLowerCase().includes(query) ||
					e.description.toLowerCase().includes(query),
			);
		}

		return effects;
	}, [selectedCategory, searchQuery]);

	const handleApplyEffect = (effect: (typeof ALL_EFFECTS)[number]) => {
		if (activeElements.length === 0) return;

		editor.timeline.updateElements({
			updates: activeElements.map((el) => {
				const track = editor.timeline.getTrackById({ trackId: el.trackId });
				const element = track?.elements.find((e) => e.id === el.elementId) as any;
				const existingEffects = element?.effects || [];

				if (existingEffects.some((e: any) => e.id === effect.id)) {
					return {
						trackId: el.trackId,
						elementId: el.elementId,
						updates: {},
					};
				}

				return {
					trackId: el.trackId,
					elementId: el.elementId,
					updates: {
						effects: [
							...existingEffects,
							{
								id: effect.id,
								type: effect.type,
								intensity: effect.defaultIntensity,
								...(effect.parameters && {
									parameters: Object.fromEntries(
										effect.parameters.map((p) => [p.key, p.defaultValue]),
									),
								}),
							},
						],
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

	const handleUpdateIntensity = (effectId: string, intensity: number) => {
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
						effects: existingEffects.map((e) =>
							e.id === effectId ? { ...e, intensity } : e,
						),
					},
				};
			}),
		});
	};

	// Get applied effects from first selected element
	const getAppliedEffects = () => {
		if (activeElements.length === 0) return [];
		const track = editor.timeline.getTrackById({ trackId: activeElements[0].trackId });
		const element = track?.elements.find((e) => e.id === activeElements[0].elementId) as any;
		return (element?.effects || []) as Array<{
			id: string;
			type: string;
			intensity: number;
			parameters?: Record<string, number | string>;
		}>;
	};

	const appliedEffects = getAppliedEffects();

	return (
		<div className="flex h-full flex-col">
			{/* Header */}
			<div className="border-b p-4">
				<h2 className="font-semibold flex items-center gap-2 text-sm">
					<HugeiconsIcon icon={MagicWand05Icon} className="size-4" />
					Effects
				</h2>
				<p className="text-muted-foreground mt-1 text-xs">
					Select a clip to apply effects.
				</p>
			</div>

			{/* Search */}
			<div className="px-4 pt-3 pb-2">
				<div className="relative">
					<HugeiconsIcon
						icon={Search01Icon}
						className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2"
					/>
					<Input
						placeholder="Search effects..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-8 h-8 text-xs"
					/>
				</div>
			</div>

			{/* Category Tabs */}
			<div className="px-4 pb-2 flex gap-1 flex-wrap">
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
				{(Object.entries(EFFECT_CATEGORIES) as [EffectCategory, string][]).map(
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
				{/* Effects Grid */}
				<div className="px-4 pb-2 grid grid-cols-2 gap-2">
					{filteredEffects.map((effect) => {
						const isApplied = appliedEffects.some((e) => e.id === effect.id);
						return (
							<button
								key={effect.id}
								onClick={() => handleApplyEffect(effect)}
								title={effect.description}
								className={cn(
									"flex flex-col items-center justify-center gap-1.5 rounded-lg border p-3 text-xs transition-all",
									"hover:bg-muted focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2",
									isApplied
										? "bg-primary/10 border-primary/30 ring-1 ring-primary/20"
										: "bg-muted/30",
								)}
							>
								<span className="text-lg leading-none">{effect.icon}</span>
								<span className="text-center text-[11px] font-medium leading-tight">
									{effect.name}
								</span>
							</button>
						);
					})}
					{filteredEffects.length === 0 && (
						<p className="text-muted-foreground text-xs col-span-2 text-center py-8">
							No effects found.
						</p>
					)}
				</div>

				{/* Applied Effects */}
				{activeElements.length > 0 && appliedEffects.length > 0 && (
					<div className="p-4 border-t">
						<h3 className="text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
							Applied Effects
						</h3>
						<div className="flex flex-col gap-3">
							{appliedEffects.map((e) => {
								const def = ALL_EFFECTS.find((d) => d.id === e.id);
								return (
									<div
										key={e.id}
										className="bg-muted/30 rounded-lg border p-3"
									>
										<div className="flex items-center justify-between mb-2">
											<span className="text-xs font-medium flex items-center gap-1.5">
												<span className="text-sm">{def?.icon ?? "✨"}</span>
												{def?.name ?? e.type}
											</span>
											<Button
												variant="ghost"
												size="icon"
												className="size-6"
												onClick={() => handleRemoveEffect(e.id)}
											>
												<HugeiconsIcon icon={Delete02Icon} className="size-3.5 text-destructive" />
											</Button>
										</div>
										<div className="flex items-center gap-2">
											<span className="text-[10px] text-muted-foreground w-12">
												{Math.round((e.intensity ?? 0) * 100)}%
											</span>
											<Slider
												min={0}
												max={100}
												step={1}
												value={[Math.round((e.intensity ?? 0) * 100)]}
												onValueChange={([val]) =>
													handleUpdateIntensity(e.id, val / 100)
												}
												className="flex-1"
											/>
										</div>
									</div>
								);
							})}
						</div>
					</div>
				)}
			</ScrollArea>
		</div>
	);
}

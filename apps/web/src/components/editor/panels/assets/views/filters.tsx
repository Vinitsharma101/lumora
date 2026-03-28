import type { TimelineElement } from "@/types/timeline";
import { useState, useMemo } from "react";
import { useSelectionEditor } from "@/hooks/use-editor-domain";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { ColorsIcon, Search01Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	ALL_FILTERS,
	FILTER_CATEGORIES,
	getFiltersByCategory,
	type FilterCategory,
	type FilterDefinition,
} from "@/lib/effects/filter-definitions";
import { cn } from "@/utils/ui";

const CATEGORY_ICONS: Record<FilterCategory, string> = {
	cinematic: "🎬",
	color: "🌈",
	camera: "📷",
	artistic: "🎨",
};

export function FiltersView() {
	const editor = useSelectionEditor();
	const activeElements = editor.selection.getSelectedElements();
	const [selectedCategory, setSelectedCategory] = useState<FilterCategory | "all">("all");
	const [searchQuery, setSearchQuery] = useState("");

	const filteredFilters = useMemo(() => {
		let filters = selectedCategory === "all"
			? ALL_FILTERS
			: getFiltersByCategory(selectedCategory);

		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filters = filters.filter(
				(f) =>
					f.name.toLowerCase().includes(query) ||
					f.description.toLowerCase().includes(query),
			);
		}

		return filters;
	}, [selectedCategory, searchQuery]);

	const handleApplyFilter = (filter: FilterDefinition) => {
		if (activeElements.length === 0) return;

		editor.timeline.updateElements({
			updates: activeElements.map((el) => {
				const track = editor.timeline.getTrackById({ trackId: el.trackId });
				const element = track?.elements.find((e) => e.id === el.elementId) as TimelineElement | undefined;
				const existingEffects: Array<{ id: string; type: string; intensity?: number }> =
					element?.effects || [];

				// Keep non-filter effects, replace any existing filter with the new one
				const nonFilterEffects = existingEffects.filter((e) => !e.type.startsWith("filter-"));

				return {
					trackId: el.trackId,
					elementId: el.elementId,
					updates: {
						effects: [
							...nonFilterEffects,
							{
								id: filter.id,
								type: filter.type,
								intensity: filter.defaultIntensity,
							},
						],
					},
				};
			}),
		});
	};

	const handleRemoveFilter = (filterId: string) => {
		if (activeElements.length === 0) return;

		editor.timeline.updateElements({
			updates: activeElements.map((el) => {
				const track = editor.timeline.getTrackById({ trackId: el.trackId });
				const element = track?.elements.find((e) => e.id === el.elementId) as TimelineElement | undefined;
				const existingEffects: Array<{ id: string; type: string; intensity?: number }> =
					element?.effects || [];

				return {
					trackId: el.trackId,
					elementId: el.elementId,
					updates: {
						effects: existingEffects.filter((e) => e.id !== filterId),
					},
				};
			}),
		});
	};

	const handleUpdateIntensity = (filterId: string, intensity: number) => {
		if (activeElements.length === 0) return;

		editor.timeline.updateElements({
			updates: activeElements.map((el) => {
				const track = editor.timeline.getTrackById({ trackId: el.trackId });
				const element = track?.elements.find((e) => e.id === el.elementId) as TimelineElement | undefined;
				const existingEffects: Array<{ id: string; type: string; intensity?: number }> =
					element?.effects || [];

				return {
					trackId: el.trackId,
					elementId: el.elementId,
					updates: {
						effects: existingEffects.map((e) =>
							e.id === filterId ? { ...e, intensity } : e,
						),
					},
				};
			}),
		});
	};

	// Get applied filters (filter-* type effects) from first selected element
	const getAppliedFilters = () => {
		if (activeElements.length === 0) return [];
		const track = editor.timeline.getTrackById({ trackId: activeElements[0].trackId });
		const element = track?.elements.find((e) => e.id === activeElements[0].elementId) as TimelineElement | undefined;
		const effects: Array<{ id: string; type: string; intensity?: number }> = element?.effects || [];
		return effects.filter((e) => e.type.startsWith("filter-"));
	};

	const appliedFilters = getAppliedFilters();

	const hasSelection = activeElements.length > 0;

	return (
		<div className="flex h-full flex-col">
			{/* Header */}
			<div className="border-b p-4">
				<h2 className="font-semibold flex items-center gap-2 text-sm">
					<HugeiconsIcon icon={ColorsIcon} className="size-4" />
					Filters
				</h2>
				<p className="text-muted-foreground mt-1 text-xs">
					{hasSelection
						? "Click a filter to apply it to the selected clip."
						: "Select a clip on the timeline to apply filters."}
				</p>
			</div>

			{!hasSelection && (
				<div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
					<HugeiconsIcon icon={ColorsIcon} className="text-muted-foreground size-10" />
					<p className="text-muted-foreground text-center text-sm">
						No clip selected. Click a clip on the timeline first.
					</p>
				</div>
			)}

			{hasSelection && (<>
			{/* Search */}
			<div className="px-4 pt-3 pb-2">
				<div className="relative">
					<HugeiconsIcon
						icon={Search01Icon}
						className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2"
					/>
					<Input
						placeholder="Search filters..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-8 h-8 text-xs"
					/>
				</div>
			</div>

			{/* Category Tabs */}
			<div className="px-4 pb-2 flex gap-1 flex-wrap">
				<button type="button"
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
				{(Object.entries(FILTER_CATEGORIES) as [FilterCategory, string][]).map(
					([key, label]) => (
						<button type="button"
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
				{/* Filters Grid */}
				<div className="px-4 pb-2 grid grid-cols-2 gap-2">
					{filteredFilters.map((filter) => {
						const isApplied = appliedFilters.some((f) => f.id === filter.id);
						return (
							<button type="button"
								key={filter.id}
								onClick={() => handleApplyFilter(filter)}
								title={filter.description}
								className={cn(
									"relative flex flex-col items-center justify-center gap-1.5 rounded-lg border p-3 text-xs transition-all overflow-hidden",
									"hover:bg-muted focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2",
									isApplied
										? "bg-primary/10 border-primary/30 ring-1 ring-primary/20"
										: "bg-muted/30",
								)}
							>
								{/* Filter preview gradient strip */}
								<div
									className="absolute inset-x-0 top-0 h-1 rounded-t-lg"
									style={{
										background: getFilterPreviewGradient(filter.category),
									}}
								/>
								<span className="text-lg leading-none mt-1">{filter.icon}</span>
								<span className="text-center text-[11px] font-medium leading-tight">
									{filter.name}
								</span>
								{isApplied && (
									<span className="text-[9px] text-primary font-semibold">
										Applied
									</span>
								)}
							</button>
						);
					})}
					{filteredFilters.length === 0 && (
						<p className="text-muted-foreground text-xs col-span-2 text-center py-8">
							No filters found.
						</p>
					)}
				</div>

				{/* Applied Filters */}
				{activeElements.length > 0 && appliedFilters.length > 0 && (
					<div className="p-4 border-t">
						<h3 className="text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
							Applied Filters
						</h3>
						<div className="flex flex-col gap-3">
							{appliedFilters.map((f) => {
								const def = ALL_FILTERS.find((d) => d.id === f.id);
								return (
									<div
										key={f.id}
										className="bg-muted/30 rounded-lg border p-3"
									>
										<div className="flex items-center justify-between mb-2">
											<span className="text-xs font-medium flex items-center gap-1.5">
												<span className="text-sm">{def?.icon ?? "🎨"}</span>
												{def?.name ?? f.type}
											</span>
											<Button
												variant="ghost"
												size="icon"
												className="size-6"
												onClick={() => handleRemoveFilter(f.id)}
											>
												<HugeiconsIcon icon={Delete02Icon} className="size-3.5 text-destructive" />
											</Button>
										</div>
										<div className="flex items-center gap-2">
											<span className="text-[10px] text-muted-foreground w-12">
												{Math.round((f.intensity ?? 0) * 100)}%
											</span>
											<Slider
												min={0}
												max={100}
												step={1}
												value={[Math.round((f.intensity ?? 0) * 100)]}
												onValueChange={([val]) =>
													handleUpdateIntensity(f.id, val / 100)
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
			</>)}
		</div>
	);
}

function getFilterPreviewGradient(category: FilterCategory): string {
	switch (category) {
		case "cinematic":
			return "linear-gradient(90deg, #1a3a4a, #e87743, #d4a574)";
		case "color":
			return "linear-gradient(90deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3)";
		case "camera":
			return "linear-gradient(90deg, #786fa6, #cf6a87, #e77f67)";
		case "artistic":
			return "linear-gradient(90deg, #6c5ce7, #fd79a8, #00cec9)";
	}
}

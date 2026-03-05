import { useState, useMemo } from "react";
import { useEditor } from "@/hooks/use-editor";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { ArrowRightDoubleIcon, Search01Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	ALL_TRANSITIONS,
	getTransitionsByCategory,
} from "@/lib/effects/transition-definitions";
import { TRANSITION_CATEGORIES, EASING_TYPES, type TransitionCategory, type EasingType } from "@/types/effects";
import { cn } from "@/utils/ui";

const CATEGORY_ICONS: Record<TransitionCategory, string> = {
	basic: "🎬",
	cinematic: "🎥",
	viral: "⚡",
	beat: "🎶",
};

type Direction = "in" | "out";

export function TransitionsView() {
	const editor = useEditor();
	const activeElements = editor.selection.getSelectedElements();
	const [selectedCategory, setSelectedCategory] = useState<TransitionCategory | "all">("all");
	const [searchQuery, setSearchQuery] = useState("");
	const [direction, setDirection] = useState<Direction>("in");

	const filteredTransitions = useMemo(() => {
		let transitions = selectedCategory === "all"
			? ALL_TRANSITIONS
			: getTransitionsByCategory(selectedCategory);

		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			transitions = transitions.filter(
				(t) =>
					t.name.toLowerCase().includes(query) ||
					t.description.toLowerCase().includes(query),
			);
		}

		return transitions;
	}, [selectedCategory, searchQuery]);

	const handleApplyTransition = (transition: (typeof ALL_TRANSITIONS)[number]) => {
		if (activeElements.length === 0) return;

		editor.timeline.updateElements({
			updates: activeElements.map((el) => {
				const track = editor.timeline.getTrackById({ trackId: el.trackId });
				const element = track?.elements.find((e) => e.id === el.elementId) as any;
				const existingTransitions: Array<{ id: string; type: string; duration: number; direction: Direction }> =
					element?.transitions || [];

				// Create a unique id combining transition type and direction
				const transitionId = `${transition.id}-${direction}`;

				if (existingTransitions.some((t) => t.id === transitionId)) {
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
						transitions: [
							...existingTransitions,
							{
								id: transitionId,
								type: transition.type,
								duration: transition.defaultDuration,
								direction,
								easing: "easeInOut" as EasingType,
							},
						],
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
				const existingTransitions: Array<{ id: string; type: string; duration: number; direction: Direction }> =
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

	const handleUpdateDuration = (transitionId: string, duration: number) => {
		if (activeElements.length === 0) return;

		editor.timeline.updateElements({
			updates: activeElements.map((el) => {
				const track = editor.timeline.getTrackById({ trackId: el.trackId });
				const element = track?.elements.find((e) => e.id === el.elementId) as any;
				const existingTransitions: Array<{ id: string; type: string; duration: number; direction: Direction }> =
					element?.transitions || [];

				return {
					trackId: el.trackId,
					elementId: el.elementId,
					updates: {
						transitions: existingTransitions.map((t) =>
							t.id === transitionId ? { ...t, duration } : t,
						),
					},
				};
			}),
		});
	};

	const handleUpdateEasing = (transitionId: string, easing: EasingType) => {
		if (activeElements.length === 0) return;

		editor.timeline.updateElements({
			updates: activeElements.map((el) => {
				const track = editor.timeline.getTrackById({ trackId: el.trackId });
				const element = track?.elements.find((e) => e.id === el.elementId) as any;
				const existingTransitions: Array<{ id: string; type: string; duration: number; direction: Direction; easing?: string }> =
					element?.transitions || [];

				return {
					trackId: el.trackId,
					elementId: el.elementId,
					updates: {
						transitions: existingTransitions.map((t) =>
							t.id === transitionId ? { ...t, easing } : t,
						),
					},
				};
			}),
		});
	};

	// Get applied transitions from first selected element
	const getAppliedTransitions = () => {
		if (activeElements.length === 0) return [];
		const track = editor.timeline.getTrackById({ trackId: activeElements[0].trackId });
		const element = track?.elements.find((e) => e.id === activeElements[0].elementId) as any;
		return (element?.transitions || []) as Array<{
			id: string;
			type: string;
			duration: number;
			direction: Direction;
			easing?: EasingType;
		}>;
	};

	const appliedTransitions = getAppliedTransitions();

	return (
		<div className="flex h-full flex-col">
			{/* Header */}
			<div className="border-b p-4">
				<h2 className="font-semibold flex items-center gap-2 text-sm">
					<HugeiconsIcon icon={ArrowRightDoubleIcon} className="size-4" />
					Transitions
				</h2>
				<p className="text-muted-foreground mt-1 text-xs">
					Select a clip to apply transitions.
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
						placeholder="Search transitions..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-8 h-8 text-xs"
					/>
				</div>
			</div>

			{/* Direction Toggle */}
			<div className="px-4 pb-2 flex gap-1">
				<button
					onClick={() => setDirection("in")}
					className={cn(
						"flex-1 py-1.5 rounded-md text-xs font-medium transition-colors",
						direction === "in"
							? "bg-primary text-primary-foreground"
							: "bg-muted/50 text-muted-foreground hover:bg-muted",
					)}
				>
					↗ In
				</button>
				<button
					onClick={() => setDirection("out")}
					className={cn(
						"flex-1 py-1.5 rounded-md text-xs font-medium transition-colors",
						direction === "out"
							? "bg-primary text-primary-foreground"
							: "bg-muted/50 text-muted-foreground hover:bg-muted",
					)}
				>
					↘ Out
				</button>
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
				{(Object.entries(TRANSITION_CATEGORIES) as [TransitionCategory, string][]).map(
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
				{/* Transitions Grid */}
				<div className="px-4 pb-2 grid grid-cols-2 gap-2">
					{filteredTransitions.map((transition) => {
						const isApplied = appliedTransitions.some(
							(t) => t.id === `${transition.id}-${direction}`,
						);
						return (
							<button
								key={transition.id}
								onClick={() => handleApplyTransition(transition)}
								title={transition.description}
								className={cn(
									"flex flex-col items-center justify-center gap-1.5 rounded-lg border p-3 text-xs transition-all",
									"hover:bg-muted focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2",
									isApplied
										? "bg-primary/10 border-primary/30 ring-1 ring-primary/20"
										: "bg-muted/30",
								)}
							>
								<span className="text-lg leading-none">{transition.icon}</span>
								<span className="text-center text-[11px] font-medium leading-tight">
									{transition.name}
								</span>
							</button>
						);
					})}
					{filteredTransitions.length === 0 && (
						<p className="text-muted-foreground text-xs col-span-2 text-center py-8">
							No transitions found.
						</p>
					)}
				</div>

				{/* Applied Transitions */}
				{activeElements.length > 0 && appliedTransitions.length > 0 && (
					<div className="p-4 border-t">
						<h3 className="text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
							Applied Transitions
						</h3>
						<div className="flex flex-col gap-3">
							{appliedTransitions.map((t) => {
								const def = ALL_TRANSITIONS.find(
									(d) => d.type === t.type,
								);
								return (
									<div
										key={t.id}
										className="bg-muted/30 rounded-lg border p-3"
									>
										<div className="flex items-center justify-between mb-2">
											<span className="text-xs font-medium flex items-center gap-1.5">
												<span className="text-sm">{def?.icon ?? "✨"}</span>
												{def?.name ?? t.type}
												<span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
													{t.direction}
												</span>
											</span>
											<Button
												variant="ghost"
												size="icon"
												className="size-6"
												onClick={() => handleRemoveTransition(t.id)}
											>
												<HugeiconsIcon icon={Delete02Icon} className="size-3.5 text-destructive" />
											</Button>
										</div>

										{/* Duration slider */}
										<div className="flex items-center gap-2 mb-2">
											<span className="text-[10px] text-muted-foreground w-12">
												{t.duration.toFixed(1)}s
											</span>
											<Slider
												min={(def?.minDuration ?? 0.1) * 100}
												max={(def?.maxDuration ?? 3) * 100}
												step={5}
												value={[t.duration * 100]}
												onValueChange={([val]) =>
													handleUpdateDuration(t.id, val / 100)
												}
												className="flex-1"
											/>
										</div>

										{/* Easing selector */}
										<div className="flex items-center gap-2">
											<span className="text-[10px] text-muted-foreground w-12">
												Easing
											</span>
											<select
												value={t.easing ?? "easeInOut"}
												onChange={(e) =>
													handleUpdateEasing(t.id, e.target.value as EasingType)
												}
												className="flex-1 bg-muted/50 border border-border rounded px-2 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-primary"
											>
												{Object.entries(EASING_TYPES).map(([key, label]) => (
													<option key={key} value={key}>
														{label}
													</option>
												))}
											</select>
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

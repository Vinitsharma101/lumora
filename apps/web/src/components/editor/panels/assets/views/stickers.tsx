"use client";

import Image from "next/image";
import { ChevronRight, Plus } from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PanelView } from "@/components/editor/panels/assets/views/base-view";
import { DraggableItem } from "@/components/editor/panels/assets/draggable-item";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	resolveStickerId,
	type StickerItem as StickerData,
} from "@/lib/stickers";
import { useStickersStore } from "@/stores/stickers-store";
import type { StickerCollection } from "@/stores/stickers-store";
import { cn } from "@/utils/ui";
import {
	HappyIcon,
	ClockIcon,
	MultiplicationSignIcon,
	Search01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Spinner } from "@/components/ui/spinner";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { OcSlidersVerticalIcon } from "@grace-studio/ui/icons";
import type { StickerCategory } from "@/types/stickers";
import { STICKER_CATEGORIES } from "@/constants/sticker-constants";
import { parseStickerId } from "@/lib/stickers/sticker-id";

export function StickersView() {
	const { selectedCategory, setSelectedCategory } = useStickersStore();

	return (
		<PanelView
			title="Stickers"
			actions={
				<div className="flex items-center">
					<Select
						value={selectedCategory}
						onValueChange={(value: StickerCategory) =>
							setSelectedCategory({ category: value })
						}
					>
						<SelectTrigger variant="outline" size="sm" className="mr-1.5">
							<SelectValue placeholder="All" />
						</SelectTrigger>
						<SelectContent>
							{Object.entries(STICKER_CATEGORIES).map(([category, label]) => (
								<SelectItem key={category} value={category}>
									{label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<Button variant="ghost" size="icon">
						<HugeiconsIcon icon={Search01Icon} className="!size-3.5" />
					</Button>

					<Button variant="ghost" size="icon">
						<OcSlidersVerticalIcon className="!size-3.5" />
					</Button>
				</div>
			}
		>
			<StickersContentView />
		</PanelView>
	);
}

function StickerGrid({ items }: { items: StickerData[] }) {
	return (
		<div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
			{items.map((item) => (
				<StickerItem key={item.id} item={item} />
			))}
		</div>
	);
}

function EmptyView({ message }: { message: string }) {
	return (
		<div className="bg-background flex h-full flex-col items-center justify-center gap-3 p-4">
			<HugeiconsIcon
				icon={HappyIcon}
				className="text-muted-foreground size-10"
			/>
			<div className="flex flex-col gap-2 text-center">
				<p className="text-lg font-medium">No stickers found</p>
				<p className="text-muted-foreground text-sm text-balance">{message}</p>
			</div>
		</div>
	);
}

function CollectionSection({
	collection,
	onSeeAll,
}: {
	collection: StickerCollection;
	onSeeAll: ({ categoryId }: { categoryId: string }) => void;
}) {
	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center justify-between">
				<span className="text-sm font-medium">{collection.label}</span>
				<button
					type="button"
					onClick={() => onSeeAll({ categoryId: collection.id })}
					className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors"
				>
					See all
					<ChevronRight className="size-3" />
				</button>
			</div>
			<StickerGrid items={collection.items} />
		</div>
	);
}

function StickersContentView() {
	const {
		searchQuery,
		viewMode,
		searchResults,
		recentStickers,
		isSearching,
		clearRecentStickers,
		collections,
		isBrowseLoading,
		loadCollections,
		selectedCategory,
		setSelectedCategory,
	} = useStickersStore();

	// biome-ignore lint/correctness/useExhaustiveDependencies: selectedCategory triggers collection reload
	useEffect(() => {
		loadCollections();
	}, [loadCollections, selectedCategory]);

	const itemsToDisplay = useMemo(() => {
		if (viewMode === "search" && searchResults) {
			return searchResults.items;
		}

		return [];
	}, [viewMode, searchResults]);

	const recentStickerItems = useMemo(() => {
		const items: StickerData[] = [];
		for (const stickerId of recentStickers) {
			const recentStickerItem = toRecentStickerItem({ stickerId });
			if (recentStickerItem) {
				items.push(recentStickerItem);
			}
		}
		return items;
	}, [recentStickers]);

	const handleSeeAll = ({ categoryId }: { categoryId: string }) => {
		setSelectedCategory({ category: categoryId as StickerCategory });
	};

	return (
		<div className="flex h-full flex-col gap-4">
			{recentStickerItems.length > 0 && viewMode === "browse" && (
				<div className="flex flex-col gap-2">
					<div className="flex items-center gap-2">
						<HugeiconsIcon
							icon={ClockIcon}
							className="text-muted-foreground size-4"
						/>
						<span className="text-sm font-medium">Recent</span>
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<button
										type="button"
										onClick={clearRecentStickers}
										className="hover:bg-accent ml-auto flex size-5 items-center justify-center rounded p-0"
									>
										<HugeiconsIcon
											icon={MultiplicationSignIcon}
											className="text-muted-foreground size-3"
										/>
									</button>
								</TooltipTrigger>
								<TooltipContent>
									<p>Clear recent stickers</p>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					</div>
					<StickerGrid items={recentStickerItems.slice(0, 12)} />
				</div>
			)}

			{viewMode === "browse" &&
				(isBrowseLoading && collections.length === 0 ? (
					<div className="flex items-center justify-center py-8">
						<Spinner className="text-muted-foreground size-6" />
					</div>
				) : collections.length > 0 ? (
					<div className="flex flex-col gap-5">
						{collections.map((collection) => (
							<CollectionSection
								key={collection.id}
								collection={collection}
								onSeeAll={handleSeeAll}
							/>
						))}
					</div>
				) : (
					!isBrowseLoading &&
					recentStickerItems.length === 0 && (
						<EmptyView message="Browse stickers by selecting a category above" />
					)
				))}

			{viewMode === "search" && (
				<div className="h-full">
					{isSearching ? (
						<div className="flex items-center justify-center py-8">
							<Spinner className="text-muted-foreground size-6" />
						</div>
					) : searchResults?.items.length ? (
						<div className="flex flex-col gap-3">
							<div className="flex items-center justify-between">
								<span className="text-muted-foreground text-sm">
									{searchResults.total} results
								</span>
							</div>
							<StickerGrid items={itemsToDisplay} />
						</div>
					) : searchQuery ? (
						<EmptyView message={`No stickers found for "${searchQuery}"`} />
					) : null}
				</div>
			)}
		</div>
	);
}

interface StickerItemProps {
	item: StickerData;
}

function StickerItem({ item }: StickerItemProps) {
	const { addingSticker, addStickerToTimeline } = useStickersStore();
	const isAdding = addingSticker === item.id;
	const [hasImageError, setHasImageError] = useState(false);

	useEffect(() => {
		if (!item.id) {
			return;
		}
		setHasImageError(false);
	}, [item.id]);

	const displayName = item.name;

	const handleAdd = async () => {
		try {
			await addStickerToTimeline({
				stickerId: item.id,
				name: item.name,
			});
		} catch (error) {
			console.error("Failed to add sticker:", error);
			toast.error("Failed to add sticker to timeline");
		}
	};

	const preview = hasImageError ? (
		<div className="flex size-full items-center justify-center p-1">
			<span className="text-muted-foreground text-center text-[0.6rem] break-all">
				{displayName}
			</span>
		</div>
	) : (
		<div className="flex size-full items-center justify-center p-2">
			<Image
				src={item.previewUrl}
				alt={displayName}
				width={48}
				height={48}
				className="size-full object-contain transition-transform duration-150 group-hover:scale-110"
				onError={() => {
					setHasImageError(true);
				}}
				loading="lazy"
				unoptimized
			/>
		</div>
	);

	return (
		<div
			className={cn(
				"group/sticker relative",
				isAdding && "pointer-events-none opacity-50",
			)}
		>
			<DraggableItem
				name={displayName}
				preview={preview}
				dragData={{
					id: item.id,
					type: "sticker",
					name: displayName,
					stickerId: item.id,
				}}
				onAddToTimeline={handleAdd}
				aspectRatio={1}
				shouldShowLabel={false}
				isRounded
				variant="card"
				containerClassName="w-full"
			/>
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<button
							type="button"
							onClick={(event) => {
								event.stopPropagation();
								handleAdd();
							}}
							className="bg-primary text-primary-foreground absolute right-0.5 bottom-0.5 z-20 flex size-5 items-center justify-center rounded-full opacity-0 shadow-md transition-opacity group-hover/sticker:opacity-100"
						>
							<Plus className="size-3" />
						</button>
					</TooltipTrigger>
					<TooltipContent side="top">
						<p>Add to timeline</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
			{isAdding && (
				<div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-black/60">
					<Spinner className="size-6 text-white" />
				</div>
			)}
		</div>
	);
}

function getStickerNameFromId({ stickerId }: { stickerId: string }): string {
	const stickerIdParts = stickerId.split(":");
	if (stickerIdParts.length <= 1) {
		return stickerId;
	}
	return (
		stickerIdParts.slice(1).join(":").split(":").pop()?.replaceAll("-", " ") ??
		stickerId
	);
}

function toRecentStickerItem({
	stickerId,
}: {
	stickerId: string;
}): StickerData | null {
	try {
		const { providerId } = parseStickerId({ stickerId });
		return {
			id: stickerId,
			provider: providerId,
			name: getStickerNameFromId({ stickerId }),
			previewUrl: resolveStickerId({
				stickerId,
				options: { width: 64, height: 64 },
			}),
			metadata: {},
		};
	} catch {
		return null;
	}
}

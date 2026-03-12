"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { useEditor } from "@/hooks/use-editor";
import { processMediaAssets } from "@/lib/media/processing";
import {
	Image02Icon,
	Video01Icon,
	PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

interface StockMediaItem {
	id: string;
	source: string;
	type: "photo" | "video";
	url: string;
	previewUrl: string;
	downloadUrl: string;
	width: number;
	height: number;
	duration?: number;
	photographer?: string;
	description?: string;
}

type MediaType = "photo" | "video";

export function StockMediaView() {
	const [searchQuery, setSearchQuery] = useState("");
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const [mediaType, setMediaType] = useState<MediaType>("photo");
	const [results, setResults] = useState<StockMediaItem[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [page, setPage] = useState(1);
	const [hasMore, setHasMore] = useState(false);
	const [isLoadingMore, setIsLoadingMore] = useState(false);

	useEffect(() => {
		const timeoutId = setTimeout(() => {
			setDebouncedQuery(searchQuery);
		}, 300);
		return () => clearTimeout(timeoutId);
	}, [searchQuery]);

	const fetchResults = useCallback(
		async ({
			query,
			type,
			pageNum,
			append,
		}: {
			query: string;
			type: MediaType;
			pageNum: number;
			append: boolean;
		}) => {
			if (!query.trim()) {
				if (!append) {
					setResults([]);
					setHasMore(false);
				}
				return;
			}

			if (append) {
				setIsLoadingMore(true);
			} else {
				setIsLoading(true);
			}
			setError(null);

			try {
				const params = new URLSearchParams({
					query: query,
					type: type,
					per_page: "20",
				});

				const response = await apiFetch(
					`/api/ai/stock?${params.toString()}`,
				);

				if (!response.ok) {
					const errorBody = await response.json().catch(() => null);
					throw new Error(
						errorBody?.error ?? `Failed to fetch: ${response.status}`,
					);
				}

				const data = await response.json();
				const items = data.results || [];

				if (append) {
					setResults((previous) => [...previous, ...items]);
				} else {
					setResults(items);
				}

				setHasMore(items.length >= 20);
				setPage(pageNum);
			} catch (fetchError) {
				setError(
					fetchError instanceof Error
						? fetchError.message
						: "Failed to load stock media",
				);
			} finally {
				setIsLoading(false);
				setIsLoadingMore(false);
			}
		},
		[],
	);

	useEffect(() => {
		fetchResults({
			query: debouncedQuery,
			type: mediaType,
			pageNum: 1,
			append: false,
		});
	}, [debouncedQuery, mediaType, fetchResults]);

	const loadMore = useCallback(() => {
		if (isLoadingMore || !hasMore) return;
		fetchResults({
			query: debouncedQuery,
			type: mediaType,
			pageNum: page + 1,
			append: true,
		});
	}, [isLoadingMore, hasMore, debouncedQuery, mediaType, page, fetchResults]);

	const { scrollAreaRef, handleScroll } = useInfiniteScroll({
		onLoadMore: loadMore,
		hasMore,
		isLoading: isLoadingMore || isLoading,
	});

	return (
		<div className="flex h-full flex-col">
			<div className="flex flex-col gap-3 px-3 pt-4 pb-3">
				<Input
					placeholder="Search stock media..."
					className="w-full"
					containerClassName="w-full"
					value={searchQuery}
					onChange={({ currentTarget }) =>
						setSearchQuery(currentTarget.value)
					}
					showClearIcon
					onClear={() => setSearchQuery("")}
				/>
				<div className="flex gap-2">
					<Button
						variant={mediaType === "photo" ? "default" : "outline"}
						size="sm"
						onClick={() => setMediaType("photo")}
					>
						<HugeiconsIcon icon={Image02Icon} className="mr-1.5 size-4" />
						Photos
					</Button>
					<Button
						variant={mediaType === "video" ? "default" : "outline"}
						size="sm"
						onClick={() => setMediaType("video")}
					>
						<HugeiconsIcon icon={Video01Icon} className="mr-1.5 size-4" />
						Videos
					</Button>
				</div>
			</div>

			<div className="relative min-h-0 flex-1 overflow-hidden px-3 pb-3">
				<ScrollArea
					className="h-full"
					ref={scrollAreaRef}
					onScrollCapture={handleScroll}
				>
					{!debouncedQuery.trim() && !isLoading && results.length === 0 && (
						<div className="flex h-full flex-col items-center justify-center gap-2 pt-12">
							<HugeiconsIcon
								icon={Image02Icon}
								className="text-muted-foreground size-10"
							/>
							<p className="text-muted-foreground text-sm">
								Search for stock photos and videos
							</p>
						</div>
					)}

					{error && !isLoading && (
						<div className="text-muted-foreground text-sm">{error}</div>
					)}

					{isLoading && (
						<div className="flex items-center justify-center py-8">
							<Spinner className="text-muted-foreground size-6" />
						</div>
					)}

					{!isLoading && results.length > 0 && (
						<div className="grid grid-cols-2 gap-2">
							{results.map((item) => (
								<StockMediaCard key={item.id} item={item} />
							))}
						</div>
					)}

					{!isLoading &&
						debouncedQuery.trim() &&
						results.length === 0 &&
						!error && (
							<div className="text-muted-foreground pt-8 text-center text-sm">
								No results found for &quot;{debouncedQuery}&quot;
							</div>
						)}

					{isLoadingMore && (
						<div className="flex items-center justify-center py-4">
							<Spinner className="text-muted-foreground size-5" />
						</div>
					)}
				</ScrollArea>
			</div>
		</div>
	);
}

function StockMediaCard({ item }: { item: StockMediaItem }) {
	const editor = useEditor();
	const [isAdding, setIsAdding] = useState(false);

	const handleAdd = async () => {
		setIsAdding(true);
		try {
			const response = await apiFetch("/api/ai/stock/download", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					url: item.downloadUrl,
					type: item.type,
					source: item.source,
				}),
			});

			if (!response.ok) {
				throw new Error("Failed to download");
			}

			const blob = await response.blob();
			const mediaType = item.type === "video" ? "video" : "image";
			const ext = item.type === "video" ? "mp4" : "jpg";
			const mimeType = item.type === "video" ? "video/mp4" : "image/jpeg";
			const name = item.description || item.photographer || `Stock ${mediaType}`;
			const file = new File([blob], `${name}.${ext}`, { type: mimeType });

			const projectId = editor.project.getActive()?.metadata.id;
			if (!projectId) {
				throw new Error("No active project");
			}

			const processedAssets = await processMediaAssets({ files: [file] });
			if (processedAssets.length === 0) {
				throw new Error("Failed to process stock media");
			}
			const processed = processedAssets[0];

			await editor.media.addMediaAsset({
				projectId,
				asset: {
					file: processed.file,
					name: processed.name,
					type: processed.type,
					url: processed.url,
					thumbnailUrl: processed.thumbnailUrl,
					width: processed.width,
					height: processed.height,
					duration: processed.duration,
				},
			});

			toast.success(`Added ${mediaType} to media`);
		} catch {
			toast.error("Failed to add to media");
		} finally {
			setIsAdding(false);
		}
	};

	return (
		<div className="group relative overflow-hidden rounded-md">
			<div className="bg-accent relative aspect-video w-full overflow-hidden">
				{item.previewUrl ? (
					<Image
						src={item.previewUrl}
						alt={item.description || "Stock media"}
						fill
						className="object-cover"
						sizes="(max-width: 400px) 50vw, 200px"
						loading="lazy"
						unoptimized
					/>
				) : (
					<div className="flex size-full items-center justify-center">
						<HugeiconsIcon
							icon={item.type === "video" ? Video01Icon : Image02Icon}
							className="text-muted-foreground size-6"
						/>
					</div>
				)}

				{item.type === "video" && item.duration && (
					<div className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
						{Math.floor(item.duration / 60)}:
						{String(item.duration % 60).padStart(2, "0")}
					</div>
				)}

				<div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
					<Button
						variant="secondary"
						size="icon"
						className="size-8"
						onClick={handleAdd}
						disabled={isAdding}
					>
						{isAdding ? (
							<Spinner className="size-4" />
						) : (
							<HugeiconsIcon icon={PlusSignIcon} className="size-4" />
						)}
					</Button>
				</div>
			</div>
			{item.photographer && (
				<p className="text-muted-foreground mt-1 truncate text-[10px]">
					{item.photographer} &middot; {item.source}
				</p>
			)}
		</div>
	);
}

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { EditorCore } from "@/core";
import {
	searchStickers as searchStickersFromProviders,
	browseStickers,
} from "@/lib/stickers";
import type { StickerSearchResult } from "@/lib/stickers";
import type { StickerItem } from "@/lib/stickers";
import { buildStickerElement } from "@/lib/timeline/element-utils";
import { STICKER_CATEGORIES } from "@/constants/sticker-constants";
import type { StickerCategory } from "@/types/stickers";
import { registerDefaultStickerProviders } from "@/lib/stickers/providers";
import { hasProvider } from "@/lib/stickers/registry";
import { parseStickerId } from "@/lib/stickers/sticker-id";

const MAX_RECENT_STICKERS = 50;

export interface StickerCollection {
	id: string;
	label: string;
	items: StickerItem[];
}


function isValidStickerId(value: unknown): value is string {
	if (typeof value !== "string") {
		return false;
	}

	try {
		const parsed = parseStickerId({ stickerId: value });
		return hasProvider({ providerId: parsed.providerId });
	} catch {
		return false;
	}
}

function sanitizeRecentStickers({
	recentStickers,
}: {
	recentStickers: unknown;
}): string[] {
	registerDefaultStickerProviders({});

	if (!Array.isArray(recentStickers)) {
		return [];
	}

	const sanitized: string[] = [];
	for (const stickerId of recentStickers) {
		if (!isValidStickerId(stickerId)) {
			continue;
		}
		if (sanitized.includes(stickerId)) {
			continue;
		}
		sanitized.push(stickerId);
		if (sanitized.length >= MAX_RECENT_STICKERS) {
			break;
		}
	}

	return sanitized;
}

type ViewMode = "search" | "browse";

interface StickersStore {
	searchQuery: string;
	selectedCategory: StickerCategory;
	viewMode: ViewMode;
	searchResults: StickerSearchResult | null;
	recentStickers: string[];
	isSearching: boolean;
	addingSticker: string | null;
	collections: StickerCollection[];
	isBrowseLoading: boolean;

	setSearchQuery: ({ query }: { query: string }) => void;
	setSelectedCategory: ({ category }: { category: StickerCategory }) => void;
	searchStickers: ({ query }: { query: string }) => Promise<void>;
	loadCollections: () => Promise<void>;
	addStickerToTimeline: ({
		stickerId,
		name,
	}: {
		stickerId: string;
		name?: string;
	}) => void;
	addToRecentStickers: ({ stickerId }: { stickerId: string }) => void;
	clearRecentStickers: () => void;
}

export const useStickersStore = create<StickersStore>()(
	persist(
		(set, get) => ({
			searchQuery: "",
			selectedCategory: "all",
			viewMode: "browse",

			searchResults: null,
			recentStickers: [],

			isSearching: false,
			addingSticker: null,
			collections: [],
			isBrowseLoading: false,

			setSearchQuery: ({ query }) => set({ searchQuery: query }),

			setSelectedCategory: ({ category }) => {
				set({
					selectedCategory: category in STICKER_CATEGORIES ? category : "all",
					viewMode: "browse",
					collections: [],
				});
			},

			loadCollections: async () => {
				const { selectedCategory, isBrowseLoading } = get();
				if (isBrowseLoading) return;

				set({ isBrowseLoading: true });
				try {
					registerDefaultStickerProviders({});

					if (selectedCategory === "all") {
						const categories: Array<{
							id: StickerCategory;
							label: string;
						}> = [
							{ id: "emoji", label: "Emoji" },
							{ id: "icons", label: "Icons" },
							{ id: "shapes", label: "Shapes" },
							{ id: "flags", label: "Flags" },
						];

						const results = await Promise.allSettled(
							categories.map(({ id }) =>
								browseStickers({
									category: id,
									limit: 16,
								}),
							),
						);

						const loadedCollections: StickerCollection[] = [];
						for (const [index, result] of results.entries()) {
							if (
								result.status === "fulfilled" &&
								result.value.items.length > 0
							) {
								loadedCollections.push({
									id: categories[index].id,
									label: categories[index].label,
									items: result.value.items,
								});
							}
						}

						set({ collections: loadedCollections });
					} else {
						const result = await browseStickers({
							category: selectedCategory,
							limit: 48,
						});

						set({
							collections:
								result.items.length > 0
									? [
											{
												id: selectedCategory,
												label:
													STICKER_CATEGORIES[selectedCategory] ??
													selectedCategory,
												items: result.items,
											},
										]
									: [],
						});
					}
				} catch (error) {
					console.error("Failed to load collections:", error);
					set({ collections: [] });
				} finally {
					set({ isBrowseLoading: false });
				}
			},

			searchStickers: async ({ query }: { query: string }) => {
				if (!query.trim()) {
					set({ searchResults: null, viewMode: "browse" });
					return;
				}

				const category = get().selectedCategory;
				const selectedCategory =
					category in STICKER_CATEGORIES ? category : "all";

				set({ isSearching: true, viewMode: "search" });
				try {
					const results = await searchStickersFromProviders({
						query,
						category: selectedCategory,
						limit: 100,
					});
					set({ searchResults: results });
				} catch (error) {
					console.error("Search failed:", error);
					set({ searchResults: null });
				} finally {
					set({ isSearching: false });
				}
			},

			addStickerToTimeline: ({
				stickerId,
				name,
			}: {
				stickerId: string;
				name?: string;
			}) => {
				set({ addingSticker: stickerId });
				try {
					const editor = EditorCore.getInstance();
					const currentTime = editor.playback.getCurrentTime();
					const tracks = editor.timeline.getTracks();

					const stickerTrack = tracks.find((t) => t.type === "sticker");
					let trackId: string;

					if (stickerTrack) {
						trackId = stickerTrack.id;
					} else {
						trackId = editor.timeline.addTrack({ type: "sticker" });
					}

					const element = buildStickerElement({
						stickerId,
						name,
						startTime: currentTime,
					});
					editor.timeline.insertElement({
						placement: { mode: "explicit", trackId },
						element,
					});

					get().addToRecentStickers({ stickerId });
				} finally {
					set({ addingSticker: null });
				}
			},

			addToRecentStickers: ({ stickerId }: { stickerId: string }) => {
				const sanitizedStickerIds = sanitizeRecentStickers({
					recentStickers: [stickerId],
				});
				if (sanitizedStickerIds.length === 0) {
					return;
				}

				set((state) => {
					const recent = [
						sanitizedStickerIds[0],
						...state.recentStickers.filter((s) => s !== sanitizedStickerIds[0]),
					];
					return {
						recentStickers: recent.slice(0, MAX_RECENT_STICKERS),
					};
				});
			},

			clearRecentStickers: () => set({ recentStickers: [] }),
		}),
		{
			name: "stickers-settings",
			migrate: (persistedState) => {
				if (
					typeof persistedState === "object" &&
					persistedState !== null &&
					"selectedCategory" in persistedState
				) {
					const typedState = persistedState as {
						selectedCategory?: string;
						recentStickers?: string[];
					};
					const category = typedState.selectedCategory ?? "all";
					return {
						...typedState,
						selectedCategory:
							category in STICKER_CATEGORIES
								? (category as StickerCategory)
								: "all",
						recentStickers: sanitizeRecentStickers({
							recentStickers: typedState.recentStickers ?? [],
						}),
					};
				}
				return persistedState;
			},
			partialize: (state) => ({
				selectedCategory: state.selectedCategory,
				recentStickers: state.recentStickers,
			}),
		},
	),
);

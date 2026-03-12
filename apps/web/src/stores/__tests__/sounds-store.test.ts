import { describe, expect, it, beforeEach, mock } from "bun:test";

// Mock dependencies before importing the store
mock.module("@/services/storage/service", () => ({
	storageService: {
		loadSavedSounds: async () => ({ sounds: [] }),
		saveSoundEffect: async () => {},
		removeSavedSound: async () => {},
		clearSavedSounds: async () => {},
	},
}));

mock.module("sonner", () => ({
	toast: { error: () => {}, success: () => {} },
}));

mock.module("@/core", () => ({
	EditorCore: {
		getInstance: () => ({
			playback: { getCurrentTime: () => 0 },
			timeline: {
				getTracks: () => [],
				addTrack: () => "track-1",
				insertElement: () => {},
			},
		}),
	},
}));

mock.module("@/lib/timeline/element-utils", () => ({
	buildLibraryAudioElement: () => ({}),
}));

// Import after mocks
const { useSoundsStore } = await import("../../stores/sounds-store");

describe("sounds-store", () => {
	beforeEach(() => {
		useSoundsStore.setState({
			searchQuery: "",
			searchResults: [],
			currentPage: 1,
			hasNextPage: false,
			totalCount: 0,
			isLoadingMore: false,
			showCommercialOnly: true,
			savedSounds: [],
		});
	});

	it("has correct initial state", () => {
		const state = useSoundsStore.getState();
		expect(state.searchQuery).toBe("");
		expect(state.searchResults).toEqual([]);
		expect(state.isLoading).toBe(false);
		expect(state.showCommercialOnly).toBe(true);
		expect(state.currentPage).toBe(1);
	});

	it("setSearchQuery updates query", () => {
		useSoundsStore.getState().setSearchQuery({ query: "thunder" });
		expect(useSoundsStore.getState().searchQuery).toBe("thunder");
	});

	it("setSearchResults sets results and resets page", () => {
		useSoundsStore.getState().setCurrentPage({ page: 3 });
		useSoundsStore.getState().setSearchResults({
			results: [{ id: 1, name: "Test" }] as never[],
		});

		const state = useSoundsStore.getState();
		expect(state.searchResults).toHaveLength(1);
		expect(state.currentPage).toBe(1);
	});

	it("appendSearchResults adds to existing results", () => {
		useSoundsStore.getState().setSearchResults({
			results: [{ id: 1 }] as never[],
		});
		useSoundsStore.getState().appendSearchResults({
			results: [{ id: 2 }] as never[],
		});

		expect(useSoundsStore.getState().searchResults).toHaveLength(2);
	});

	it("resetPagination resets page state", () => {
		useSoundsStore.setState({
			currentPage: 5,
			hasNextPage: true,
			totalCount: 100,
			isLoadingMore: true,
		});

		useSoundsStore.getState().resetPagination();

		const state = useSoundsStore.getState();
		expect(state.currentPage).toBe(1);
		expect(state.hasNextPage).toBe(false);
		expect(state.totalCount).toBe(0);
		expect(state.isLoadingMore).toBe(false);
	});

	it("toggleCommercialFilter toggles the flag", () => {
		expect(useSoundsStore.getState().showCommercialOnly).toBe(true);
		useSoundsStore.getState().toggleCommercialFilter();
		expect(useSoundsStore.getState().showCommercialOnly).toBe(false);
		useSoundsStore.getState().toggleCommercialFilter();
		expect(useSoundsStore.getState().showCommercialOnly).toBe(true);
	});

	it("isSoundSaved returns false for unsaved sound", () => {
		const result = useSoundsStore.getState().isSoundSaved({ soundId: 999 });
		expect(result).toBe(false);
	});

	it("isSoundSaved returns true for saved sound", () => {
		useSoundsStore.setState({
			savedSounds: [{ id: 42, name: "Test" }] as never[],
		});
		const result = useSoundsStore.getState().isSoundSaved({ soundId: 42 });
		expect(result).toBe(true);
	});
});

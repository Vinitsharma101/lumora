import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ImageProvider = "replicate" | "google_imagen" | "openai";
export type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
export type ImageStatus = "generating" | "completed" | "failed";

export const STYLE_PRESETS = {
	photorealistic: { label: "Photo", suffix: "photorealistic, high detail" },
	illustration: {
		label: "Illustration",
		suffix: "digital illustration",
	},
	"3d-render": { label: "3D", suffix: "3D render, octane" },
	anime: { label: "Anime", suffix: "anime style" },
	watercolor: { label: "Watercolor", suffix: "watercolor painting" },
	cinematic: { label: "Cinematic", suffix: "cinematic, film still" },
	"pixel-art": { label: "Pixel Art", suffix: "pixel art, retro" },
	"oil-painting": {
		label: "Oil Paint",
		suffix: "oil painting, classical",
	},
} as const;

export type StylePresetKey = keyof typeof STYLE_PRESETS;

export interface StyleReferenceImage {
	id: string;
	url: string;
	file: File;
	name: string;
}

export interface GeneratedImage {
	id: string;
	prompt: string;
	provider: ImageProvider;
	status: ImageStatus;
	urls: string[];
	jobId: string | null;
	parentImageId: string | null;
	errorMessage: string | null;
	createdAt: number;
}

interface ImageGenState {
	images: GeneratedImage[];
	selectedImageId: string | null;
	activeProvider: ImageProvider;
	aspectRatio: AspectRatio;
	numImages: 1 | 2 | 3 | 4;
	isExpanded: boolean;
	promptHistory: string[];
	styleReferenceImages: StyleReferenceImage[];
	negativePrompt: string;
	stylePreset: StylePresetKey | null;
	seed: number | null;
	viewMode: "gallery" | "focus";
	focusedImageId: string | null;
}

interface ImageGenActions {
	addImage: (image: GeneratedImage) => void;
	updateImage: (id: string, updates: Partial<GeneratedImage>) => void;
	removeImage: (id: string) => void;
	selectImage: (id: string | null) => void;
	setProvider: (provider: ImageProvider) => void;
	setAspectRatio: (ratio: AspectRatio) => void;
	setNumImages: (count: 1 | 2 | 3 | 4) => void;
	setExpanded: (expanded: boolean) => void;
	addPromptToHistory: (prompt: string) => void;
	addStyleReference: (ref: StyleReferenceImage) => void;
	removeStyleReference: (id: string) => void;
	clearStyleReferences: () => void;
	setNegativePrompt: (prompt: string) => void;
	setStylePreset: (preset: StylePresetKey | null) => void;
	setSeed: (seed: number | null) => void;
	setViewMode: (mode: "gallery" | "focus") => void;
	setFocusedImageId: (id: string | null) => void;
}

export const useImageGenStore = create<ImageGenState & ImageGenActions>()(
	persist(
		(set) => ({
			images: [],
			selectedImageId: null,
			activeProvider: "replicate",
			aspectRatio: "1:1",
			numImages: 1,
			isExpanded: false,
			promptHistory: [],
			styleReferenceImages: [],
			negativePrompt: "",
			stylePreset: null,
			seed: null,
			viewMode: "gallery",
			focusedImageId: null,

			addImage: (image) =>
				set((state) => ({ images: [image, ...state.images] })),

			updateImage: (id, updates) =>
				set((state) => ({
					images: state.images.map((img) =>
						img.id === id ? { ...img, ...updates } : img,
					),
				})),

			removeImage: (id) =>
				set((state) => ({
					images: state.images.filter((img) => img.id !== id),
					selectedImageId:
						state.selectedImageId === id ? null : state.selectedImageId,
					focusedImageId:
						state.focusedImageId === id ? null : state.focusedImageId,
				})),

			selectImage: (id) => set({ selectedImageId: id }),

			setProvider: (provider) => set({ activeProvider: provider }),

			setAspectRatio: (ratio) => set({ aspectRatio: ratio }),

			setNumImages: (count) => set({ numImages: count }),

			setExpanded: (expanded) => set({ isExpanded: expanded }),

			addPromptToHistory: (prompt) =>
				set((state) => ({
					promptHistory: [
						prompt,
						...state.promptHistory.filter((p) => p !== prompt),
					].slice(0, 50),
				})),

			addStyleReference: (ref) =>
				set((state) => {
					if (state.styleReferenceImages.length >= 3) return state;
					return {
						styleReferenceImages: [...state.styleReferenceImages, ref],
					};
				}),

			removeStyleReference: (id) =>
				set((state) => ({
					styleReferenceImages: state.styleReferenceImages.filter(
						(ref) => ref.id !== id,
					),
				})),

			clearStyleReferences: () => set({ styleReferenceImages: [] }),

			setNegativePrompt: (prompt) => set({ negativePrompt: prompt }),

			setStylePreset: (preset) => set({ stylePreset: preset }),

			setSeed: (seed) => set({ seed }),

			setViewMode: (mode) => set({ viewMode: mode }),

			setFocusedImageId: (id) =>
				set({ focusedImageId: id, viewMode: id ? "focus" : "gallery" }),
		}),
		{
			name: "grace-studio-image-gen",
			partialize: (state) => ({
				activeProvider: state.activeProvider,
				aspectRatio: state.aspectRatio,
				numImages: state.numImages,
				promptHistory: state.promptHistory,
				negativePrompt: state.negativePrompt,
				stylePreset: state.stylePreset,
			}),
		},
	),
);

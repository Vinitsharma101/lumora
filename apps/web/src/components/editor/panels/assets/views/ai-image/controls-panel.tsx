"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Settings2 } from "lucide-react";
import {
	useImageGenStore,
	STYLE_PRESETS,
	type ImageProvider,
	type AspectRatio,
	type StylePresetKey,
} from "@/stores/image-gen-store";
import { StyleReferenceSection } from "./style-reference-section";

/** Call the Next.js generate-image API route directly */
async function generateImageViaNextAPI(params: {
	prompt: string;
	provider?: string;
	aspectRatio?: string;
	numImages?: number;
	negativePrompt?: string;
	stylePreset?: string;
	styleReferenceUrls?: string[];
	seed?: number;
}): Promise<{
	jobId: string;
	status: string;
	imageUrl?: string;
	mockImageUrl?: string;
}> {
	const response = await fetch("/api/ai/generate-image", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			prompt: params.prompt,
			provider: params.provider,
			aspectRatio: params.aspectRatio,
			numImages: params.numImages,
			negativePrompt: params.negativePrompt,
			stylePreset: params.stylePreset,
			styleReferenceUrls: params.styleReferenceUrls,
			seed: params.seed,
		}),
	});
	if (!response.ok) {
		throw new Error(`API error ${response.status}`);
	}
	return response.json();
}

const PROVIDERS: { value: ImageProvider; label: string }[] = [
	{ value: "replicate", label: "FLUX" },
	{ value: "google_imagen", label: "Imagen" },
	{ value: "openai", label: "DALL-E" },
];

const ASPECT_RATIOS: { value: AspectRatio; label: string }[] = [
	{ value: "1:1", label: "1:1" },
	{ value: "16:9", label: "16:9" },
	{ value: "9:16", label: "9:16" },
	{ value: "4:3", label: "4:3" },
	{ value: "3:4", label: "3:4" },
];

const NUM_IMAGE_OPTIONS = [1, 2, 4] as const;

const PRESET_KEYS = Object.keys(STYLE_PRESETS) as StylePresetKey[];

export function ControlsPanel() {
	const [prompt, setPrompt] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [advancedOpen, setAdvancedOpen] = useState(false);

	const {
		activeProvider,
		setProvider,
		aspectRatio,
		setAspectRatio,
		numImages,
		setNumImages,
		selectedImageId,
		images,
		addImage,
		addPromptToHistory,
		selectImage,
		stylePreset,
		setStylePreset,
		negativePrompt,
		setNegativePrompt,
		seed,
		setSeed,
		styleReferenceImages,
	} = useImageGenStore();

	const selectedImage = images.find((img) => img.id === selectedImageId);
	const isEditMode =
		selectedImage?.status === "completed" && selectedImage.urls.length > 0;

	async function handleSubmit() {
		if (!prompt.trim()) return;
		setIsSubmitting(true);

		try {
			addPromptToHistory(prompt.trim());

			if (isEditMode && selectedImage) {
				// Edit mode: send the source image URL along with the edit prompt
				const response = await generateImageViaNextAPI({
					prompt: `Edit: ${prompt.trim()} [source: ${selectedImage.urls[0]}]`,
					provider: activeProvider,
				});

				const imageId = crypto.randomUUID();
				const resolvedUrls =
					response.status === "completed" && response.imageUrl
						? [response.imageUrl]
						: response.status === "mock" && response.mockImageUrl
							? [response.mockImageUrl]
							: [];

				addImage({
					id: imageId,
					prompt: prompt.trim(),
					provider: activeProvider,
					status: resolvedUrls.length > 0 ? "completed" : "generating",
					urls: resolvedUrls,
					jobId: resolvedUrls.length > 0 ? null : response.jobId,
					parentImageId: selectedImage.id,
					errorMessage: null,
					createdAt: Date.now(),
				});
			} else {
				const styleRefUrls = styleReferenceImages.map((ref) => ref.url);
				const response = await generateImageViaNextAPI({
					prompt: prompt.trim(),
					provider: activeProvider,
					aspectRatio,
					numImages,
					negativePrompt: negativePrompt || undefined,
					stylePreset: stylePreset ?? undefined,
					styleReferenceUrls:
						styleRefUrls.length > 0 ? styleRefUrls : undefined,
					seed: seed ?? undefined,
				});

				const imageId = crypto.randomUUID();
				const resolvedUrls =
					response.status === "completed" && response.imageUrl
						? [response.imageUrl]
						: response.status === "mock" && response.mockImageUrl
							? [response.mockImageUrl]
							: [];

				addImage({
					id: imageId,
					prompt: prompt.trim(),
					provider: activeProvider,
					status: resolvedUrls.length > 0 ? "completed" : "generating",
					urls: resolvedUrls,
					jobId: resolvedUrls.length > 0 ? null : response.jobId,
					parentImageId: null,
					errorMessage: null,
					createdAt: Date.now(),
				});
			}

			setPrompt("");
			selectImage(null);
		} catch {
			// Error handled by the API client
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<div className="flex h-full flex-col">
			<div className="flex-1 overflow-y-auto p-3 space-y-4">
				{/* Prompt */}
				<div className="space-y-1.5">
					<label className="text-xs font-medium text-muted-foreground">
						Prompt
					</label>
					<Textarea
						value={prompt}
						onChange={(event) => setPrompt(event.target.value)}
						placeholder={
							isEditMode
								? "Describe how to change this image..."
								: "Describe the image you want to generate..."
						}
						className="min-h-[80px] max-h-[140px] resize-none text-sm"
						onKeyDown={(event) => {
							if (event.key === "Enter" && !event.shiftKey) {
								event.preventDefault();
								handleSubmit();
							}
						}}
					/>
				</div>

				{/* Aspect Ratio */}
				<div className="space-y-1.5">
					<label className="text-xs font-medium text-muted-foreground">
						Aspect Ratio
					</label>
					<div className="flex flex-wrap gap-1">
						{ASPECT_RATIOS.map((ratio) => (
							<Button
								key={ratio.value}
								variant={aspectRatio === ratio.value ? "default" : "outline"}
								size="sm"
								className="h-7 px-2.5 text-xs"
								onClick={() => setAspectRatio(ratio.value)}
								type="button"
							>
								{ratio.label}
							</Button>
						))}
					</div>
				</div>

				{/* Style Presets */}
				<div className="space-y-1.5">
					<label className="text-xs font-medium text-muted-foreground">
						Style
					</label>
					<div className="flex flex-wrap gap-1.5">
						<Button
							variant={stylePreset === null ? "default" : "outline"}
							size="sm"
							className="h-7 px-2.5 text-xs"
							onClick={() => setStylePreset(null)}
							type="button"
						>
							None
						</Button>
						{PRESET_KEYS.map((key) => (
							<Button
								key={key}
								variant={stylePreset === key ? "default" : "outline"}
								size="sm"
								className="h-7 px-2.5 text-xs"
								onClick={() => setStylePreset(key)}
								type="button"
							>
								{STYLE_PRESETS[key].label}
							</Button>
						))}
					</div>
				</div>

				{/* Style Reference */}
				<StyleReferenceSection />

				{/* Edit mode indicator */}
				{isEditMode && selectedImage && (
					<div className="flex items-center gap-2 rounded bg-muted/50 p-2">
						<img
							src={selectedImage.urls[0]}
							alt=""
							className="h-8 w-8 rounded object-cover"
						/>
						<span className="flex-1 truncate text-xs text-muted-foreground">
							Editing: {selectedImage.prompt.slice(0, 40)}
						</span>
						<Button
							variant="ghost"
							size="sm"
							className="h-5 px-1 text-xs"
							onClick={() => selectImage(null)}
							type="button"
						>
							Cancel
						</Button>
					</div>
				)}

				{/* Advanced Settings */}
				<Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
					<CollapsibleTrigger asChild>
						<button
							type="button"
							className="flex w-full items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
						>
							<Settings2 className="h-3.5 w-3.5" />
							Advanced
							<ChevronDown
								className={`ml-auto h-3.5 w-3.5 transition-transform ${advancedOpen ? "rotate-180" : ""}`}
							/>
						</button>
					</CollapsibleTrigger>
					<CollapsibleContent className="mt-2 space-y-3">
						{/* Negative Prompt */}
						<div className="space-y-1">
							<label className="text-xs text-muted-foreground">
								Negative prompt
							</label>
							<Textarea
								value={negativePrompt}
								onChange={(event) => setNegativePrompt(event.target.value)}
								placeholder="Things to avoid in the image..."
								className="min-h-[50px] max-h-[80px] resize-none text-xs"
							/>
						</div>

						{/* Seed */}
						<div className="space-y-1">
							<label className="text-xs text-muted-foreground">
								Seed (optional)
							</label>
							<Input
								type="number"
								value={seed ?? ""}
								onChange={(event) =>
									setSeed(
										event.target.value
											? Number.parseInt(event.target.value, 10)
											: null,
									)
								}
								placeholder="Random"
								className="h-8 text-xs"
							/>
						</div>

						{/* Provider */}
						<div className="space-y-1">
							<label className="text-xs text-muted-foreground">Provider</label>
							<div className="flex gap-1">
								{PROVIDERS.map((provider) => (
									<Button
										key={provider.value}
										variant={
											activeProvider === provider.value ? "default" : "outline"
										}
										size="sm"
										className="h-7 flex-1 text-xs"
										onClick={() => setProvider(provider.value)}
										type="button"
									>
										{provider.label}
									</Button>
								))}
							</div>
						</div>

						{/* Image Count */}
						<div className="space-y-1">
							<label className="text-xs text-muted-foreground">
								Number of images
							</label>
							<div className="flex gap-1">
								{NUM_IMAGE_OPTIONS.map((count) => (
									<Button
										key={count}
										variant={numImages === count ? "default" : "outline"}
										size="sm"
										className="h-7 w-8 p-0 text-xs"
										onClick={() => setNumImages(count)}
										type="button"
									>
										{count}
									</Button>
								))}
							</div>
						</div>
					</CollapsibleContent>
				</Collapsible>
			</div>

			{/* Sticky Generate Button */}
			<div className="border-t p-3">
				<Button
					className="w-full"
					onClick={handleSubmit}
					disabled={!prompt.trim() || isSubmitting}
					type="button"
				>
					{isSubmitting
						? "Generating..."
						: isEditMode
							? "Edit Image"
							: "Generate"}
				</Button>
			</div>
		</div>
	);
}

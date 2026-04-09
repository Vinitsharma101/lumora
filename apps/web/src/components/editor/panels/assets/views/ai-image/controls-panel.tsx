"use client";

import { useState } from "react";
import Image from "next/image";
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
import { apiFetch } from "@/lib/api-client";
import { StyleReferenceSection } from "./style-reference-section";

/** Call the real backend AI route directly */
async function generateImageViaNextAPI(params: {
	prompt: string;
	provider?: string;
	aspectRatio?: string;
	numImages?: number;
	negativePrompt?: string;
	stylePreset?: string;
	styleReferenceUrls?: string[];
	seed?: number;
	sourceImageUrl?: string;
}): Promise<{
	jobId: string;
	status: string;
	imageUrl?: string;
	mockImageUrl?: string;
}> {
	const response = await apiFetch(
		params.sourceImageUrl
			? "/api/ai/video/edit-image"
			: "/api/ai/video/text-to-image",
		{
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
				source_image_url: params.sourceImageUrl,
				edit_prompt: params.sourceImageUrl ? params.prompt : undefined,
			}),
		},
	);
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

const NUM_IMAGE_OPTIONS = [1, 2, 4, 5] as const;
const VARIANT_SUFFIXES = [
	"close-up composition",
	"wide scene",
	"alternate angle",
	"different lighting",
	"more dynamic framing",
] as const;

const PRESET_KEYS = Object.keys(STYLE_PRESETS) as StylePresetKey[];

function buildPromptVariants(prompt: string, count: number): string[] {
	if (count <= 1) return [prompt];
	return Array.from({ length: count }, (_, index) => {
		const suffix = VARIANT_SUFFIXES[index % VARIANT_SUFFIXES.length];
		return `${prompt}, ${suffix}`;
	});
}

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
			const promptVariants = buildPromptVariants(prompt.trim(), numImages);

			if (isEditMode && selectedImage) {
				const responses = await Promise.all(
					promptVariants.map((variantPrompt) =>
						generateImageViaNextAPI({
							prompt: variantPrompt,
							provider: activeProvider,
							sourceImageUrl: selectedImage.urls[0],
						}),
					),
				);

				responses.forEach((response, index) => {
					const imageId = crypto.randomUUID();
					const jobId =
						response.jobId ?? (response as { job_id?: string }).job_id ?? null;
					const resolvedUrls =
						response.status === "completed" && response.imageUrl
							? [response.imageUrl]
							: response.status === "mock" && response.mockImageUrl
								? [response.mockImageUrl]
								: [];

					addImage({
						id: imageId,
						prompt: promptVariants[index],
						provider: activeProvider,
						status: resolvedUrls.length > 0 ? "completed" : "generating",
						urls: resolvedUrls,
						jobId: resolvedUrls.length > 0 ? null : jobId,
						parentImageId: selectedImage.id,
						errorMessage: null,
						createdAt: Date.now(),
					});
				});
			} else {
				const styleRefUrls = styleReferenceImages.map((ref) => ref.url);
				const responses = await Promise.all(
					promptVariants.map((variantPrompt) =>
						generateImageViaNextAPI({
							prompt: variantPrompt,
							provider: activeProvider,
							aspectRatio,
							numImages: 1,
							negativePrompt: negativePrompt || undefined,
							stylePreset: stylePreset ?? undefined,
							styleReferenceUrls:
								styleRefUrls.length > 0 ? styleRefUrls : undefined,
							seed: seed ?? undefined,
						}),
					),
				);

				responses.forEach((response, index) => {
					const imageId = crypto.randomUUID();
					const jobId =
						response.jobId ?? (response as { job_id?: string }).job_id ?? null;
					const resolvedUrls =
						response.status === "completed" && response.imageUrl
							? [response.imageUrl]
							: response.status === "mock" && response.mockImageUrl
								? [response.mockImageUrl]
								: [];

					addImage({
						id: imageId,
						prompt: promptVariants[index],
						provider: activeProvider,
						status: resolvedUrls.length > 0 ? "completed" : "generating",
						urls: resolvedUrls,
						jobId: resolvedUrls.length > 0 ? null : jobId,
						parentImageId: null,
						errorMessage: null,
						createdAt: Date.now(),
					});
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
					<label
						htmlFor="ai-image-prompt"
						className="text-xs font-medium text-muted-foreground"
					>
						Prompt
					</label>
					<Textarea
						id="ai-image-prompt"
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
					<div className="text-xs font-medium text-muted-foreground">
						Aspect Ratio
					</div>
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
					<div className="text-xs font-medium text-muted-foreground">Style</div>
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
						<Image
							width={32}
							height={32}
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
							<label
								htmlFor="ai-image-negative"
								className="text-xs text-muted-foreground"
							>
								Negative prompt
							</label>
							<Textarea
								id="ai-image-negative"
								value={negativePrompt}
								onChange={(event) => setNegativePrompt(event.target.value)}
								placeholder="Things to avoid in the image..."
								className="min-h-[50px] max-h-[80px] resize-none text-xs"
							/>
						</div>

						{/* Seed */}
						<div className="space-y-1">
							<label
								htmlFor="ai-image-seed"
								className="text-xs text-muted-foreground"
							>
								Seed (optional)
							</label>
							<Input
								id="ai-image-seed"
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
							<div className="text-xs text-muted-foreground">Provider</div>
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
							<div className="text-xs text-muted-foreground">
								Number of images
							</div>
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

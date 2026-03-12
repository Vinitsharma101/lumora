"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EditorCore } from "@/core";
import { useImageGenStore, type GeneratedImage } from "@/stores/image-gen-store";

function downloadFile({ url, filename }: { url: string; filename: string }) {
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	anchor.click();
}

export function AIImageCard({ image }: { image: GeneratedImage }) {
	const { selectImage, removeImage, selectedImageId } = useImageGenStore();
	const [hovering, setHovering] = useState(false);
	const isSelected = selectedImageId === image.id;
	const imageUrl = image.urls[0];

	async function handleAddToTimeline() {
		if (!imageUrl) return;
		try {
			const response = await fetch(imageUrl);
			const blob = await response.blob();
			const name = `AI Image: ${image.prompt.slice(0, 30)}`;
			const file = new File([blob], `ai-image-${image.id}.png`, {
				type: "image/png",
			});
			const editor = EditorCore.getInstance();
			const projectId = editor.project.getActive()?.metadata.id;
			if (!projectId) return;
			await editor.media.addMediaAsset({
				projectId,
				asset: { file, name, type: "image" },
			});
		} catch {
			// Failed to add to timeline
		}
	}

	function handleDragStart(event: React.DragEvent) {
		if (!imageUrl) return;
		event.dataTransfer.setData(
			"application/json",
			JSON.stringify({
				type: "media-drag",
				mediaType: "image",
				url: imageUrl,
				name: `AI Image: ${image.prompt.slice(0, 30)}`,
			}),
		);
		event.dataTransfer.effectAllowed = "copy";
	}

	if (image.status === "generating") {
		return (
			<div className="relative aspect-square rounded-md overflow-hidden border">
				<Skeleton className="h-full w-full" />
				<div className="absolute inset-0 flex items-center justify-center">
					<div className="flex flex-col items-center gap-1">
						<div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
						<span className="text-xs text-muted-foreground">Generating...</span>
					</div>
				</div>
			</div>
		);
	}

	if (image.status === "failed") {
		return (
			<div className="relative aspect-square rounded-md overflow-hidden border border-destructive/50 bg-destructive/10">
				<div className="flex h-full items-center justify-center p-2">
					<div className="flex flex-col items-center gap-1 text-center">
						<span className="text-xs text-destructive">Failed</span>
						<span className="text-xs text-muted-foreground line-clamp-2">
							{image.errorMessage}
						</span>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div
			className={`relative aspect-square rounded-md overflow-hidden border cursor-pointer transition-all ${
				isSelected ? "ring-2 ring-primary" : "hover:ring-1 hover:ring-primary/50"
			}`}
			onMouseEnter={() => setHovering(true)}
			onMouseLeave={() => setHovering(false)}
			onClick={() => selectImage(isSelected ? null : image.id)}
			onKeyDown={(event) => {
				if (event.key === "Enter" || event.key === " ") {
					selectImage(isSelected ? null : image.id);
				}
			}}
			draggable
			onDragStart={handleDragStart}
		>
			{imageUrl && (
				<img
					src={imageUrl}
					alt={image.prompt}
					className="h-full w-full object-cover"
					loading="lazy"
				/>
			)}

			{hovering && (
				<div className="absolute inset-0 bg-black/50 flex items-end p-1.5 gap-1">
					<Button
						size="sm"
						variant="secondary"
						className="h-6 px-1.5 text-xs"
						onClick={(event) => {
							event.stopPropagation();
							handleAddToTimeline();
						}}
						type="button"
					>
						+ Timeline
					</Button>
					<Button
						size="sm"
						variant="secondary"
						className="h-6 px-1.5 text-xs"
						onClick={(event) => {
							event.stopPropagation();
							if (imageUrl) {
								downloadFile({
									url: imageUrl,
									filename: `ai-image-${image.id}.png`,
								});
							}
						}}
						type="button"
					>
						Save
					</Button>
					<Button
						size="sm"
						variant="destructive"
						className="h-6 px-1.5 text-xs ml-auto"
						onClick={(event) => {
							event.stopPropagation();
							removeImage(image.id);
						}}
						type="button"
					>
						Delete
					</Button>
				</div>
			)}
		</div>
	);
}

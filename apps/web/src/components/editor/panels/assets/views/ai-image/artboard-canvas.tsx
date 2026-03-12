"use client";

import { ImageIcon, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	useImageGenStore,
	type GeneratedImage,
} from "@/stores/image-gen-store";
import { AIImageCard } from "./ai-image-card";

function EmptyState() {
	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
			<div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-800">
				<ImageIcon className="h-8 w-8 text-neutral-500" />
			</div>
			<div className="text-center">
				<p className="text-sm font-medium text-neutral-400">
					No images generated yet
				</p>
				<p className="mt-1 text-xs text-neutral-500">
					Enter a prompt in the controls panel to get started
				</p>
			</div>
		</div>
	);
}

function GalleryView({ images }: { images: GeneratedImage[] }) {
	const setFocusedImageId = useImageGenStore(
		(state) => state.setFocusedImageId,
	);

	return (
		<div className="flex-1 overflow-y-auto p-4">
			<div className="grid grid-cols-2 gap-3 md:grid-cols-3">
				{images.map((image) => (
					<div
						key={image.id}
						onClick={() => {
							if (
								image.status === "completed" &&
								image.urls.length > 0
							) {
								setFocusedImageId(image.id);
							}
						}}
						onKeyDown={(event) => {
							if (
								(event.key === "Enter" || event.key === " ") &&
								image.status === "completed" &&
								image.urls.length > 0
							) {
								setFocusedImageId(image.id);
							}
						}}
					>
						<AIImageCard image={image} />
					</div>
				))}
			</div>
		</div>
	);
}

function FocusView({
	focusedImage,
	allImages,
}: {
	focusedImage: GeneratedImage;
	allImages: GeneratedImage[];
}) {
	const setFocusedImageId = useImageGenStore(
		(state) => state.setFocusedImageId,
	);
	const completedImages = allImages.filter(
		(img) => img.status === "completed" && img.urls.length > 0,
	);

	return (
		<div className="flex flex-1 flex-col">
			<div className="flex items-center gap-2 px-3 py-2">
				<Button
					variant="ghost"
					size="sm"
					className="h-7 gap-1 px-2 text-xs"
					onClick={() => setFocusedImageId(null)}
					type="button"
				>
					<ArrowLeft className="h-3.5 w-3.5" />
					Gallery
				</Button>
				<span className="truncate text-xs text-muted-foreground">
					{focusedImage.prompt.slice(0, 60)}
				</span>
			</div>
			<div className="flex flex-1 items-center justify-center p-6">
				{focusedImage.urls[0] && (
					<img
						src={focusedImage.urls[0]}
						alt={focusedImage.prompt}
						className="max-h-full max-w-full rounded-lg object-contain"
					/>
				)}
			</div>
			{completedImages.length > 1 && (
				<div className="border-t border-neutral-800 px-3 py-2">
					<div className="flex gap-2 overflow-x-auto">
						{completedImages.map((image) => (
							<button
								key={image.id}
								type="button"
								className={`h-12 w-12 shrink-0 overflow-hidden rounded-md border transition-all ${
									image.id === focusedImage.id
										? "border-primary ring-1 ring-primary"
										: "border-neutral-700 hover:border-neutral-500"
								}`}
								onClick={() => setFocusedImageId(image.id)}
							>
								{image.urls[0] && (
									<img
										src={image.urls[0]}
										alt=""
										className="h-full w-full object-cover"
									/>
								)}
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

export function ArtboardCanvas() {
	const { images, viewMode, focusedImageId } = useImageGenStore();
	const focusedImage = images.find((img) => img.id === focusedImageId);

	if (images.length === 0) {
		return <EmptyState />;
	}

	if (viewMode === "focus" && focusedImage) {
		return <FocusView focusedImage={focusedImage} allImages={images} />;
	}

	return <GalleryView images={images} />;
}

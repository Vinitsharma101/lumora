"use client";

import { useImageGenStore } from "@/stores/image-gen-store";
import { AIImageCard } from "./ai-image-card";

export function AIImageGallery({ columns = 2 }: { columns?: number }) {
	const images = useImageGenStore((state) => state.images);

	if (images.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center h-full p-4 text-center">
				<p className="text-sm text-muted-foreground">No images yet</p>
				<p className="text-xs text-muted-foreground mt-1">
					Enter a prompt below to generate your first image
				</p>
			</div>
		);
	}

	return (
		<div
			className="grid gap-2 p-2 overflow-y-auto"
			style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
		>
			{images.map((image) => (
				<AIImageCard key={image.id} image={image} />
			))}
		</div>
	);
}

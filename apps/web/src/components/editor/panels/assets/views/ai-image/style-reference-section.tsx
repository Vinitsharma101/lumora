"use client";

import { useRef } from "react";
import { Plus, X } from "lucide-react";
import { useImageGenStore } from "@/stores/image-gen-store";

export function StyleReferenceSection() {
	const inputRef = useRef<HTMLInputElement>(null);
	const { styleReferenceImages, addStyleReference, removeStyleReference } =
		useImageGenStore();

	function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
		const files = event.target.files;
		if (!files) return;

		for (const file of files) {
			if (styleReferenceImages.length >= 3) break;
			const url = URL.createObjectURL(file);
			addStyleReference({
				id: crypto.randomUUID(),
				url,
				file,
				name: file.name,
			});
		}

		if (inputRef.current) {
			inputRef.current.value = "";
		}
	}

	return (
		<div className="space-y-2">
			<label className="text-xs font-medium text-muted-foreground">
				Style Reference
			</label>
			<div className="flex flex-wrap gap-2">
				{styleReferenceImages.map((ref) => (
					<div
						key={ref.id}
						className="relative h-14 w-14 rounded-md overflow-hidden border"
					>
						<img
							src={ref.url}
							alt={ref.name}
							className="h-full w-full object-cover"
						/>
						<button
							type="button"
							className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
							onClick={() => removeStyleReference(ref.id)}
						>
							<X className="h-2.5 w-2.5" />
						</button>
					</div>
				))}
				{styleReferenceImages.length < 3 && (
					<button
						type="button"
						className="flex h-14 w-14 items-center justify-center rounded-md border border-dashed text-muted-foreground hover:border-primary hover:text-primary transition-colors"
						onClick={() => inputRef.current?.click()}
					>
						<Plus className="h-4 w-4" />
					</button>
				)}
			</div>
			<input
				ref={inputRef}
				type="file"
				accept="image/*"
				multiple
				className="hidden"
				onChange={handleFileSelect}
			/>
			{styleReferenceImages.length === 0 && (
				<p className="text-xs text-muted-foreground">
					Upload up to 3 reference images for style guidance
				</p>
			)}
		</div>
	);
}

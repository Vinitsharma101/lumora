import { useEffect, useRef } from "react";
import { getAIJobStatus } from "@/lib/cloud-api";
import { useImageGenStore } from "@/stores/image-gen-store";

const POLL_INTERVAL = 2000;

export function useImageGenPolling() {
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const images = useImageGenStore((state) => state.images);
	const updateImage = useImageGenStore((state) => state.updateImage);

	useEffect(() => {
		const pendingImages = images.filter(
			(img) => img.status === "generating" && img.jobId,
		);

		if (pendingImages.length === 0) {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
			return;
		}

		if (intervalRef.current) return;

		intervalRef.current = setInterval(async () => {
			const generating = useImageGenStore
				.getState()
				.images.filter((img) => img.status === "generating" && img.jobId);

			if (generating.length === 0) {
				if (intervalRef.current) {
					clearInterval(intervalRef.current);
					intervalRef.current = null;
				}
				return;
			}

			for (const img of generating) {
				try {
					const status = await getAIJobStatus({ jobId: img.jobId as string });

					if (status.status === "completed") {
						const outputData = status.output_data as Record<string, unknown> | null;
						const imageUrls =
							(outputData?.image_urls as string[]) ??
							(outputData?.output
								? Array.isArray(outputData.output)
									? (outputData.output as string[])
									: [outputData.output as string]
								: []);
						const outputUrl = status.output_url;
						const urls =
							imageUrls.length > 0
								? imageUrls
								: outputUrl
									? [outputUrl]
									: [];

						updateImage(img.id, {
							status: "completed",
							urls,
						});
					} else if (status.status === "failed") {
						updateImage(img.id, {
							status: "failed",
							errorMessage: status.error_message ?? "Generation failed",
						});
					}
				} catch {
					// Silently retry on next poll
				}
			}
		}, POLL_INTERVAL);

		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};
	}, [images, updateImage]);
}

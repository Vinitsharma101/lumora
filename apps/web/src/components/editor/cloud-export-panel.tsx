"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
	startRender,
	streamRenderProgress,
	type RenderJobResponse,
} from "@/lib/cloud-api";
import { useEditor } from "@/hooks/use-editor";

type RenderState = "idle" | "submitting" | "rendering" | "completed" | "failed";

export function CloudExportPanel() {
	const editor = useEditor();
	const [state, setState] = useState<RenderState>("idle");
	const [format, setFormat] = useState("mp4");
	const [quality, setQuality] = useState("high");
	const [progress, setProgress] = useState(0);
	const [outputUrl, setOutputUrl] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const cleanupRef = useRef<(() => void) | null>(null);

	const handleRender = useCallback(async () => {
		const project = editor.project.getActive();
		if (!project) return;

		setState("submitting");
		setProgress(0);
		setOutputUrl(null);
		setErrorMessage(null);

		try {
			const timelineData = {
				scenes: project.scenes,
				settings: project.settings,
			};

			const job = await startRender({
				projectId: project.metadata.id,
				timelineData: timelineData as Record<string, unknown>,
				format,
				quality,
				width: project.settings.canvasSize.width,
				height: project.settings.canvasSize.height,
				fps: project.settings.fps,
			});

			setState("rendering");

			// Stream progress via SSE
			cleanupRef.current = streamRenderProgress({
				jobId: job.job_id,
				onProgress: (data) => {
					setProgress(data.progress * 100);
				},
				onComplete: (data: RenderJobResponse) => {
					setState("completed");
					setProgress(100);
					setOutputUrl(data.output_url);
				},
				onError: (error) => {
					setState("failed");
					setErrorMessage(error.message);
				},
			});
		} catch (error) {
			setState("failed");
			setErrorMessage(
				error instanceof Error ? error.message : "Failed to start render",
			);
		}
	}, [editor, format, quality]);

	const handleDownload = useCallback(() => {
		if (!outputUrl) return;
		const link = document.createElement("a");
		link.href = outputUrl;
		link.download = `export.${format}`;
		link.click();
	}, [outputUrl, format]);

	const handleReset = useCallback(() => {
		if (cleanupRef.current) {
			cleanupRef.current();
			cleanupRef.current = null;
		}
		setState("idle");
		setProgress(0);
		setOutputUrl(null);
		setErrorMessage(null);
	}, []);

	return (
		<div className="space-y-4 p-4">
			<div>
				<h3 className="text-sm font-semibold">Cloud Export</h3>
				<p className="text-muted-foreground mt-1 text-xs">
					Render your project on the server for high-quality output
				</p>
			</div>

			{state === "idle" && (
				<>
					<div className="space-y-2">
						<Label className="text-xs">Format</Label>
						<div className="flex gap-1">
							{["mp4", "webm", "mov"].map((fmt) => (
								<Button
									key={fmt}
									variant={format === fmt ? "secondary" : "outline"}
									size="sm"
									className="h-7 flex-1 text-xs uppercase"
									onClick={() => setFormat(fmt)}
									type="button"
								>
									{fmt}
								</Button>
							))}
						</div>
					</div>

					<div className="space-y-2">
						<Label className="text-xs">Quality</Label>
						<div className="flex gap-1">
							{[
								{ value: "draft", label: "Draft" },
								{ value: "medium", label: "Medium" },
								{ value: "high", label: "High" },
								{ value: "ultra", label: "Ultra" },
							].map(({ value, label }) => (
								<Button
									key={value}
									variant={quality === value ? "secondary" : "outline"}
									size="sm"
									className="h-7 flex-1 text-xs"
									onClick={() => setQuality(value)}
									type="button"
								>
									{label}
								</Button>
							))}
						</div>
					</div>

					<Button
						onClick={handleRender}
						className="w-full"
						type="button"
					>
						Start Cloud Render
					</Button>
				</>
			)}

			{state === "submitting" && (
				<div className="text-muted-foreground py-8 text-center text-sm">
					Submitting render job...
				</div>
			)}

			{state === "rendering" && (
				<div className="space-y-3">
					<div className="text-center text-sm">Rendering...</div>
					<Progress value={progress} className="h-2" />
					<div className="text-muted-foreground text-center text-xs">
						{Math.round(progress)}%
					</div>
				</div>
			)}

			{state === "completed" && (
				<div className="space-y-3">
					<div className="text-center text-sm text-green-500">
						Render complete!
					</div>
					<div className="flex gap-2">
						<Button
							onClick={handleDownload}
							className="flex-1"
							type="button"
						>
							Download
						</Button>
						<Button
							onClick={handleReset}
							variant="outline"
							className="flex-1"
							type="button"
						>
							New Export
						</Button>
					</div>
				</div>
			)}

			{state === "failed" && (
				<div className="space-y-3">
					<div className="text-center text-sm text-red-500">
						Render failed
					</div>
					{errorMessage && (
						<p className="text-muted-foreground text-center text-xs">
							{errorMessage}
						</p>
					)}
					<Button
						onClick={handleReset}
						variant="outline"
						className="w-full"
						type="button"
					>
						Try Again
					</Button>
				</div>
			)}
		</div>
	);
}

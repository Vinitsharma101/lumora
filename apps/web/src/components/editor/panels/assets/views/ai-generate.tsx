"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	generateTextToVideo,
	generateImageToVideo,
	generateScriptToScenes,
	removeBackground,
	upscaleImage,
	styleTransfer,
	getAIJobStatus,
	type AIJobResponse,
} from "@/lib/cloud-api";

type AIMode =
	| "text-to-video"
	| "image-to-video"
	| "script-to-scenes"
	| "bg-remove"
	| "upscale"
	| "style-transfer";

interface JobTracker {
	jobId: string;
	type: string;
	status: string;
	progress: number;
	result: AIJobResponse | null;
}

export function AIGenerateView() {
	const [mode, setMode] = useState<AIMode>("text-to-video");
	const [prompt, setPrompt] = useState("");
	const [imageUrl, setImageUrl] = useState("");
	const [script, setScript] = useState("");
	const [provider, setProvider] = useState("google_veo");
	const [duration, setDuration] = useState(4);
	const [aspectRatio, setAspectRatio] = useState("16:9");
	const [stylePreset, setStylePreset] = useState("cinematic");
	const [scale, setScale] = useState(2);
	const [jobs, setJobs] = useState<JobTracker[]>([]);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const pollJob = useCallback(
		async ({ jobId, index }: { jobId: string; index: number }) => {
			const poll = async () => {
				try {
					const status = await getAIJobStatus({ jobId });
					setJobs((previous) =>
						previous.map((job, idx) =>
							idx === index
								? {
										...job,
										status: status.status,
										progress: status.progress,
										result: status,
									}
								: job,
						),
					);

					if (status.status !== "completed" && status.status !== "failed") {
						setTimeout(poll, 3000);
					}
				} catch {
					// Silently retry on network errors
					setTimeout(poll, 5000);
				}
			};
			poll();
		},
		[],
	);

	const handleSubmit = useCallback(async () => {
		setIsSubmitting(true);
		try {
			let response: AIJobResponse;

			if (mode === "text-to-video") {
				response = await generateTextToVideo({
					prompt,
					duration,
					aspectRatio,
					provider,
				});
			} else if (mode === "image-to-video") {
				response = await generateImageToVideo({
					imageUrl,
					prompt,
					duration,
					provider,
				});
			} else if (mode === "script-to-scenes") {
				response = await generateScriptToScenes({
					script,
					aspectRatio,
				});
			} else if (mode === "bg-remove") {
				response = await removeBackground({ imageUrl });
			} else if (mode === "upscale") {
				response = await upscaleImage({ imageUrl, scale });
			} else {
				response = await styleTransfer({
					imageUrl,
					stylePreset,
				});
			}

			const newIndex = jobs.length;
			const tracker: JobTracker = {
				jobId: response.job_id,
				type: mode,
				status: response.status,
				progress: response.progress,
				result: null,
			};
			setJobs((previous) => [...previous, tracker]);

			pollJob({ jobId: response.job_id, index: newIndex });
		} catch (error) {
			console.error("Failed to start AI job:", error);
		} finally {
			setIsSubmitting(false);
		}
	}, [
		mode,
		prompt,
		imageUrl,
		script,
		provider,
		duration,
		aspectRatio,
		stylePreset,
		scale,
		jobs.length,
		pollJob,
	]);

	const modes: Array<{ value: AIMode; label: string }> = [
		{ value: "text-to-video", label: "Text → Video" },
		{ value: "image-to-video", label: "Image → Video" },
		{ value: "script-to-scenes", label: "Script → Scenes" },
		{ value: "bg-remove", label: "Remove BG" },
		{ value: "upscale", label: "Upscale" },
		{ value: "style-transfer", label: "Style Transfer" },
	];

	return (
		<div className="flex h-full flex-col overflow-y-auto">
			<div className="border-b p-3">
				<h3 className="text-sm font-semibold">AI Generate</h3>
				<p className="text-muted-foreground mt-1 text-xs">
					Create videos, images, and effects with AI
				</p>
			</div>

			{/* Mode selector */}
			<div className="flex flex-wrap gap-1 border-b p-2">
				{modes.map(({ value, label }) => (
					<Button
						key={value}
						variant={mode === value ? "secondary" : "ghost"}
						size="sm"
						className="h-7 text-xs"
						onClick={() => setMode(value)}
						type="button"
					>
						{label}
					</Button>
				))}
			</div>

			{/* Form */}
			<div className="flex-1 space-y-3 p-3">
				{(mode === "text-to-video" ||
					mode === "image-to-video" ||
					mode === "script-to-scenes") && (
					<>
						{mode !== "script-to-scenes" && (
							<div className="space-y-1.5">
								<Label className="text-xs">Prompt</Label>
								<textarea
									className="border-input bg-background min-h-[80px] w-full rounded-md border px-3 py-2 text-sm"
									placeholder="Describe the video you want to create..."
									value={prompt}
									onChange={(event) => setPrompt(event.target.value)}
								/>
							</div>
						)}

						{mode === "script-to-scenes" && (
							<div className="space-y-1.5">
								<Label className="text-xs">Script</Label>
								<textarea
									className="border-input bg-background min-h-[120px] w-full rounded-md border px-3 py-2 text-sm"
									placeholder="Enter your full script. The AI will break it into scenes with visual descriptions..."
									value={script}
									onChange={(event) => setScript(event.target.value)}
								/>
							</div>
						)}

						{mode !== "script-to-scenes" && (
							<div className="space-y-1.5">
								<Label className="text-xs">Provider</Label>
								<div className="flex gap-1">
									{[
										{ value: "google_veo", label: "Veo" },
										{ value: "openai_sora", label: "Sora" },
										{ value: "replicate", label: "Replicate" },
									].map(({ value, label }) => (
										<Button
											key={value}
											variant={provider === value ? "secondary" : "outline"}
											size="sm"
											className="h-7 flex-1 text-xs"
											onClick={() => setProvider(value)}
											type="button"
										>
											{label}
										</Button>
									))}
								</div>
							</div>
						)}

						{mode !== "script-to-scenes" && (
							<div className="flex gap-3">
								<div className="flex-1 space-y-1.5">
									<Label className="text-xs">Duration (s)</Label>
									<Input
										type="number"
										min={1}
										max={60}
										value={duration}
										onChange={(event) =>
											setDuration(Number(event.target.value))
										}
										className="h-8"
									/>
								</div>
								<div className="flex-1 space-y-1.5">
									<Label className="text-xs">Aspect Ratio</Label>
									<div className="flex gap-1">
										{["16:9", "9:16", "1:1"].map((ratio) => (
											<Button
												key={ratio}
												variant={
													aspectRatio === ratio ? "secondary" : "outline"
												}
												size="sm"
												className="h-8 flex-1 text-xs"
												onClick={() => setAspectRatio(ratio)}
												type="button"
											>
												{ratio}
											</Button>
										))}
									</div>
								</div>
							</div>
						)}
					</>
				)}

				{(mode === "image-to-video" ||
					mode === "bg-remove" ||
					mode === "upscale" ||
					mode === "style-transfer") && (
					<div className="space-y-1.5">
						<Label className="text-xs">Image URL</Label>
						<Input
							placeholder="https://... or drag from media panel"
							value={imageUrl}
							onChange={(event) => setImageUrl(event.target.value)}
							className="h-8"
						/>
					</div>
				)}

				{mode === "upscale" && (
					<div className="space-y-1.5">
						<Label className="text-xs">Scale</Label>
						<div className="flex gap-1">
							{[2, 4].map((factor) => (
								<Button
									key={factor}
									variant={scale === factor ? "secondary" : "outline"}
									size="sm"
									className="h-8 flex-1"
									onClick={() => setScale(factor)}
									type="button"
								>
									{factor}x
								</Button>
							))}
						</div>
					</div>
				)}

				{mode === "style-transfer" && (
					<div className="space-y-1.5">
						<Label className="text-xs">Style</Label>
						<div className="flex flex-wrap gap-1">
							{[
								"cinematic",
								"anime",
								"watercolor",
								"oil-painting",
								"pencil-sketch",
								"neon",
							].map((style) => (
								<Button
									key={style}
									variant={stylePreset === style ? "secondary" : "outline"}
									size="sm"
									className="h-7 text-xs"
									onClick={() => setStylePreset(style)}
									type="button"
								>
									{style}
								</Button>
							))}
						</div>
					</div>
				)}

				<Button
					onClick={handleSubmit}
					disabled={isSubmitting}
					className="w-full"
					type="button"
				>
					{isSubmitting ? "Starting..." : "Generate"}
				</Button>
			</div>

			{/* Active jobs */}
			{jobs.length > 0 && (
				<div className="border-t p-3">
					<h4 className="mb-2 text-xs font-semibold">Jobs</h4>
					<div className="space-y-2">
						{jobs.map((job) => (
							<div
								key={job.jobId}
								className="bg-muted rounded-md p-2 text-xs"
							>
								<div className="flex items-center justify-between">
									<span className="font-medium">{job.type}</span>
									<span
										className={
											job.status === "completed"
												? "text-green-500"
												: job.status === "failed"
													? "text-red-500"
													: "text-muted-foreground"
										}
									>
										{job.status}
									</span>
								</div>
								{job.status === "processing" && (
									<div className="bg-background mt-1 h-1.5 overflow-hidden rounded-full">
										<div
											className="bg-primary h-full rounded-full transition-all"
											style={{ width: `${job.progress * 100}%` }}
										/>
									</div>
								)}
								{job.result?.output_data && (
									<div className="text-muted-foreground mt-1 truncate">
										{JSON.stringify(job.result.output_data).slice(0, 100)}
									</div>
								)}
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

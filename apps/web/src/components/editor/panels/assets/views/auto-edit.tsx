"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	removeSilence,
	generateCaptions,
	createShorts,
	beatSync,
	analyzeVideo,
	getAIJobStatus,
	type AIJobResponse,
} from "@/lib/cloud-api";

type AutoEditMode =
	| "analyze"
	| "silence-remove"
	| "captions"
	| "shorts"
	| "beat-sync";

interface JobTracker {
	jobId: string;
	type: string;
	status: string;
	progress: number;
	result: AIJobResponse | null;
}

export function AutoEditView() {
	const [mode, setMode] = useState<AutoEditMode>("silence-remove");
	const [videoUrl, setVideoUrl] = useState("");
	const [musicUrl, setMusicUrl] = useState("");
	const [captionStyle, setCaptionStyle] = useState("default");
	const [language, setLanguage] = useState("en");
	const [shortsCount, setShortsCount] = useState(3);
	const [maxDuration, setMaxDuration] = useState(60);
	const [minSilence, setMinSilence] = useState(0.5);
	const [jobs, setJobs] = useState<JobTracker[]>([]);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const pollJob = useCallback(
		({ jobId, index }: { jobId: string; index: number }) => {
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
					setTimeout(poll, 5000);
				}
			};
			poll();
		},
		[],
	);

	const handleSubmit = useCallback(async () => {
		if (!videoUrl) return;
		setIsSubmitting(true);

		try {
			let response: AIJobResponse;

			if (mode === "analyze") {
				response = await analyzeVideo({
					videoUrl,
					detectScenes: true,
					detectSilence: true,
					detectHighlights: true,
					transcribe: true,
				});
			} else if (mode === "silence-remove") {
				response = await removeSilence({
					videoUrl,
					minSilenceDuration: minSilence,
				});
			} else if (mode === "captions") {
				response = await generateCaptions({
					videoUrl,
					language,
					style: captionStyle,
				});
			} else if (mode === "shorts") {
				response = await createShorts({
					videoUrl,
					maxDuration,
					count: shortsCount,
					aspectRatio: "9:16",
				});
			} else {
				response = await beatSync({
					videoUrl,
					musicUrl,
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
			console.error("Auto-edit failed:", error);
		} finally {
			setIsSubmitting(false);
		}
	}, [
		mode,
		videoUrl,
		musicUrl,
		captionStyle,
		language,
		shortsCount,
		maxDuration,
		minSilence,
		jobs.length,
		pollJob,
	]);

	const modes: Array<{ value: AutoEditMode; label: string }> = [
		{ value: "silence-remove", label: "Remove Silence" },
		{ value: "captions", label: "Auto Captions" },
		{ value: "shorts", label: "Create Shorts" },
		{ value: "beat-sync", label: "Beat Sync" },
		{ value: "analyze", label: "Full Analyze" },
	];

	return (
		<div className="flex h-full flex-col overflow-y-auto">
			<div className="border-b p-3">
				<h3 className="text-sm font-semibold">Auto-Edit</h3>
				<p className="text-muted-foreground mt-1 text-xs">
					AI-powered automatic editing tools
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
				<div className="space-y-1.5">
					<Label className="text-xs">Video URL</Label>
					<Input
						placeholder="Video URL from your media..."
						value={videoUrl}
						onChange={(event) => setVideoUrl(event.target.value)}
						className="h-8"
					/>
					<p className="text-muted-foreground text-[10px]">
						Use a public URL from your uploaded media
					</p>
				</div>

				{mode === "silence-remove" && (
					<div className="space-y-1.5">
						<Label className="text-xs">Min Silence (seconds)</Label>
						<Input
							type="number"
							min={0.1}
							max={5}
							step={0.1}
							value={minSilence}
							onChange={(event) => setMinSilence(Number(event.target.value))}
							className="h-8"
						/>
					</div>
				)}

				{mode === "captions" && (
					<>
						<div className="space-y-1.5">
							<Label className="text-xs">Language</Label>
							<Input
								placeholder="en"
								value={language}
								onChange={(event) => setLanguage(event.target.value)}
								className="h-8"
							/>
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs">Caption Style</Label>
							<div className="flex flex-wrap gap-1">
								{["default", "viral", "karaoke", "minimal"].map((style) => (
									<Button
										key={style}
										variant={captionStyle === style ? "secondary" : "outline"}
										size="sm"
										className="h-7 text-xs"
										onClick={() => setCaptionStyle(style)}
										type="button"
									>
										{style}
									</Button>
								))}
							</div>
						</div>
					</>
				)}

				{mode === "shorts" && (
					<div className="flex gap-3">
						<div className="flex-1 space-y-1.5">
							<Label className="text-xs">Max Duration (s)</Label>
							<Input
								type="number"
								min={15}
								max={180}
								value={maxDuration}
								onChange={(event) => setMaxDuration(Number(event.target.value))}
								className="h-8"
							/>
						</div>
						<div className="flex-1 space-y-1.5">
							<Label className="text-xs">Count</Label>
							<Input
								type="number"
								min={1}
								max={10}
								value={shortsCount}
								onChange={(event) =>
									setShortsCount(Number(event.target.value))
								}
								className="h-8"
							/>
						</div>
					</div>
				)}

				{mode === "beat-sync" && (
					<div className="space-y-1.5">
						<Label className="text-xs">Music URL</Label>
						<Input
							placeholder="URL of the music track..."
							value={musicUrl}
							onChange={(event) => setMusicUrl(event.target.value)}
							className="h-8"
						/>
					</div>
				)}

				<Button
					onClick={handleSubmit}
					disabled={isSubmitting || !videoUrl}
					className="w-full"
					type="button"
				>
					{isSubmitting ? "Processing..." : "Start"}
				</Button>
			</div>

			{/* Active jobs */}
			{jobs.length > 0 && (
				<div className="border-t p-3">
					<h4 className="mb-2 text-xs font-semibold">Auto-Edit Jobs</h4>
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
										{JSON.stringify(job.result.output_data).slice(0, 120)}
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

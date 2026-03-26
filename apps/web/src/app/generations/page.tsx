"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { cn } from "@/utils/ui";
import {
	Clock,
	CheckCircle,
	XCircle,
	Loader2,
	Film,
	ImageIcon,
	Music,
	RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface AIJobStatusResponse {
	id: string;
	job_type: string;
	status: string;
	progress: number;
	error_message: string | null;
	input_data: Record<string, unknown> | null;
	output_data: Record<string, unknown> | null;
	provider: string | null;
	current_step: string | null;
	chunks_total: number;
	chunks_completed: number;
	output_url: string | null;
	created_at: string;
	completed_at: string | null;
}

/** Fetch all AI jobs from the Next.js API route */
async function listAIJobsFromAPI(): Promise<AIJobStatusResponse[]> {
	const response = await fetch("/api/ai/jobs");
	if (!response.ok) return [];
	return response.json();
}

type JobStatus = "queued" | "processing" | "completed" | "failed";
type JobType = "video" | "image" | "audio" | "render";

interface GenerationJob {
	id: string;
	type: JobType;
	prompt: string;
	status: JobStatus;
	progress: number;
	createdAt: string;
	completedAt: string | null;
	outputUrl: string | null;
	error: string | null;
}

const JOB_TYPE_CONFIG: Record<
	JobType,
	{ icon: typeof Film; label: string; color: string }
> = {
	video: { icon: Film, label: "Video", color: "text-blue-400" },
	image: { icon: ImageIcon, label: "Image", color: "text-amber-400" },
	audio: { icon: Music, label: "Audio", color: "text-green-400" },
	render: { icon: Film, label: "Render", color: "text-purple-400" },
};

const STATUS_CONFIG: Record<
	JobStatus,
	{ icon: typeof Clock; label: string; color: string; bgColor: string }
> = {
	queued: {
		icon: Clock,
		label: "Queued",
		color: "text-zinc-400",
		bgColor: "bg-zinc-500/10",
	},
	processing: {
		icon: Loader2,
		label: "Processing",
		color: "text-blue-400",
		bgColor: "bg-blue-500/10",
	},
	completed: {
		icon: CheckCircle,
		label: "Completed",
		color: "text-green-400",
		bgColor: "bg-green-500/10",
	},
	failed: {
		icon: XCircle,
		label: "Failed",
		color: "text-red-400",
		bgColor: "bg-red-500/10",
	},
};

export default function GenerationsPage() {
	const [jobs, setJobs] = useState<GenerationJob[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [filter, setFilter] = useState<JobStatus | "all">("all");

	const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const mapJobType = useCallback((jobType: string): JobType => {
		if (
			jobType.includes("video") ||
			jobType === "image_to_video" ||
			jobType === "text_to_video" ||
			jobType === "video_to_video" ||
			jobType === "style_transfer"
		)
			return "video";
		if (
			jobType.includes("image") ||
			jobType === "text_to_image" ||
			jobType === "edit_image" ||
			jobType === "upscale" ||
			jobType === "background_remove"
		)
			return "image";
		if (
			jobType === "tts" ||
			jobType === "sound_effect" ||
			jobType === "transcribe"
		)
			return "audio";
		if (jobType === "render") return "render";
		return "video";
	}, []);

	const mapStatus = useCallback((status: string): JobStatus => {
		if (status === "completed") return "completed";
		if (status === "failed") return "failed";
		if (status === "pending" || status === "queued") return "queued";
		return "processing";
	}, []);

	const extractOutputUrl = useCallback(
		(job: AIJobStatusResponse): string | null => {
			if (job.output_url) return job.output_url;
			const data = job.output_data;
			if (!data) return null;
			if (Array.isArray(data.image_urls) && data.image_urls.length > 0)
				return data.image_urls[0] as string;
			if (Array.isArray(data.output) && data.output.length > 0)
				return data.output[0] as string;
			if (typeof data.output === "string") return data.output;
			if (typeof data.video_url === "string") return data.video_url;
			return null;
		},
		[],
	);

	const loadJobs = useCallback(async () => {
		setIsLoading(true);
		try {
			const apiJobs = await listAIJobsFromAPI();
			const mapped: GenerationJob[] = apiJobs.map((job) => ({
				id: job.id,
				type: mapJobType(job.job_type),
				prompt:
					(job.input_data?.prompt as string) ??
					(job.input_data?.text as string) ??
					job.job_type,
				status: mapStatus(job.status),
				progress: job.progress,
				createdAt: job.created_at,
				completedAt: job.completed_at,
				outputUrl: extractOutputUrl(job),
				error: job.error_message,
			}));
			setJobs(mapped);
		} catch {
			// Auth error or network issue — show empty state
		} finally {
			setIsLoading(false);
		}
	}, [mapJobType, mapStatus, extractOutputUrl]);

	useEffect(() => {
		loadJobs();
	}, [loadJobs]);

	// Auto-poll when there are active jobs
	useEffect(() => {
		const hasActive = jobs.some(
			(job) => job.status === "queued" || job.status === "processing",
		);
		if (hasActive && !pollRef.current) {
			pollRef.current = setInterval(() => {
				loadJobs();
			}, 5000);
		} else if (!hasActive && pollRef.current) {
			clearInterval(pollRef.current);
			pollRef.current = null;
		}
		return () => {
			if (pollRef.current) {
				clearInterval(pollRef.current);
				pollRef.current = null;
			}
		};
	}, [jobs, loadJobs]);

	const filteredJobs =
		filter === "all" ? jobs : jobs.filter((job) => job.status === filter);

	const activeCount = jobs.filter(
		(job) => job.status === "queued" || job.status === "processing",
	).length;

	return (
		<div className="min-h-screen flex flex-col bg-background text-foreground">
			<Header />

			<main className="flex-1 w-full max-w-[1200px] mx-auto px-4 md:px-8 py-8">
				<div className="flex items-center justify-between mb-6">
					<div>
						<h1 className="text-2xl font-bold">Generations</h1>
						<p className="text-sm text-muted-foreground mt-1">
							{activeCount > 0
								? `${activeCount} active generation${activeCount > 1 ? "s" : ""}`
								: "No active generations"}
						</p>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={loadJobs}
						className="gap-2"
					>
						<RefreshCw className="size-3.5" />
						Refresh
					</Button>
				</div>

				{/* Filter tabs */}
				<div className="flex items-center gap-2 mb-6">
					{(
						["all", "processing", "queued", "completed", "failed"] as const
					).map((status) => (
						<button
							key={status}
							type="button"
							onClick={() => setFilter(status)}
							className={cn(
								"rounded-full px-3 py-1 text-xs font-medium transition-colors capitalize",
								filter === status
									? "bg-foreground text-background"
									: "bg-muted text-muted-foreground hover:bg-muted/80",
							)}
						>
							{status}
						</button>
					))}
				</div>

				{/* Job list */}
				{isLoading ? (
					<div className="flex items-center justify-center py-20">
						<Loader2 className="size-6 animate-spin text-muted-foreground" />
					</div>
				) : filteredJobs.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-20 text-center">
						<div className="size-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
							<Film className="size-7 text-muted-foreground/50" />
						</div>
						<h3 className="text-lg font-medium mb-1">No generations yet</h3>
						<p className="text-sm text-muted-foreground max-w-sm">
							Start creating videos, images, or audio from the{" "}
							<Link href="/home" className="text-primary hover:underline">
								home page
							</Link>{" "}
							or the editor&apos;s AI chat.
						</p>
					</div>
				) : (
					<div className="flex flex-col gap-3">
						{filteredJobs.map((job) => (
							<JobCard key={job.id} job={job} />
						))}
					</div>
				)}
			</main>

			<Footer />
		</div>
	);
}

function JobCard({ job }: { job: GenerationJob }) {
	const typeConfig = JOB_TYPE_CONFIG[job.type];
	const statusConfig = STATUS_CONFIG[job.status];
	const TypeIcon = typeConfig.icon;
	const StatusIcon = statusConfig.icon;

	return (
		<div className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-muted/10 hover:bg-muted/20 transition-colors">
			<div
				className={cn(
					"size-10 rounded-lg flex items-center justify-center",
					statusConfig.bgColor,
				)}
			>
				<TypeIcon className={cn("size-5", typeConfig.color)} />
			</div>

			<div className="flex-1 min-w-0">
				<p className="text-sm font-medium truncate">{job.prompt}</p>
				<div className="flex items-center gap-2 mt-1">
					<span
						className={cn(
							"flex items-center gap-1 text-xs",
							statusConfig.color,
						)}
					>
						<StatusIcon
							className={cn(
								"size-3",
								job.status === "processing" && "animate-spin",
							)}
						/>
						{statusConfig.label}
					</span>
					{job.status === "processing" && (
						<span className="text-xs text-muted-foreground">
							{Math.round(job.progress * 100)}%
						</span>
					)}
				</div>
			</div>

			{job.status === "processing" && (
				<div className="w-24">
					<div className="h-1.5 bg-muted rounded-full overflow-hidden">
						<div
							className="h-full bg-blue-500 rounded-full transition-all duration-500"
							style={{ width: `${Math.max(5, job.progress * 100)}%` }}
						/>
					</div>
				</div>
			)}

			{job.status === "completed" && job.outputUrl && (
				<a
					href={job.outputUrl}
					download
					className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-500"
				>
					Download
				</a>
			)}
		</div>
	);
}

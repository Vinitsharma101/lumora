"use client";

import { useState } from "react";
import { useMovieStore } from "@/stores/movie-store";
import { useAgentSession } from "@/hooks/use-agent-session";

export function PipelineDashboard() {
	const {
		status,
		messages,
		scenes,
		pendingQuestions,
		reviewScore,
		error,
		costEstimate,
		showBible,
		scenesCompleted,
		scenesTotal,
		submitAnswer,
		approveCheckpoint,
	} = useMovieStore();

	useAgentSession();

	const [isImporting, setIsImporting] = useState(false);

	const progressPercent =
		scenesTotal > 0
			? Math.round((scenesCompleted / scenesTotal) * 100)
			: 0;

	return (
		<div className="flex flex-col gap-4 p-4 max-w-3xl mx-auto">
			{/* Status header */}
			<div className="flex items-center justify-between">
				<h2 className="text-lg font-semibold text-white">
					Movie Generation Pipeline
				</h2>
				<StatusBadge status={status} />
			</div>

			{/* Progress bar */}
			{status === "processing" && scenesTotal > 0 && (
				<div className="flex flex-col gap-1">
					<div className="flex justify-between text-xs text-zinc-400">
						<span>Progress</span>
						<span>{progressPercent}%</span>
					</div>
					<div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
						<div
							className="h-full bg-blue-500 rounded-full transition-all duration-500"
							style={{
								width: `${Math.max(5, progressPercent)}%`,
							}}
						/>
					</div>
					<span className="text-xs text-zinc-500">
						{scenesCompleted}/{scenesTotal} scenes
					</span>
				</div>
			)}

			{/* Error display */}
			{error && (
				<div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
					<p className="text-sm text-red-400">{error}</p>
				</div>
			)}

			{/* Cost estimate */}
			{costEstimate && status === "waiting_approval" && (
				<div className="p-4 bg-zinc-900 border border-zinc-700 rounded-lg">
					<h3 className="text-sm font-medium text-white mb-2">
						Estimated Cost
					</h3>
					<p className="text-2xl font-bold text-white">
						${costEstimate.totalEstimatedUsd.toFixed(2)}
					</p>
					<div className="mt-2 grid grid-cols-2 gap-1">
						{Object.entries(costEstimate.breakdown).map(
							([key, value]) => (
								<div
									key={key}
									className="flex justify-between text-xs"
								>
									<span className="text-zinc-400">
										{key.replace(/_/g, " ")}
									</span>
									<span className="text-zinc-300">
										${(value as number).toFixed(2)}
									</span>
								</div>
							),
						)}
					</div>
					<button
						type="button"
						onClick={() =>
							useMovieStore.getState().approveCostEstimate()
						}
						className="mt-3 w-full px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-500"
					>
						Approve & Start Generation
					</button>
				</div>
			)}

			{/* Storyboard approval */}
			{status === "waiting_storyboard_approval" && showBible && (
				<div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
					<h3 className="text-sm font-medium text-purple-300 mb-1">
						Storyboard Ready
					</h3>
					<p className="text-xs text-zinc-400 mb-1">
						{showBible.title} — {showBible.genre},{" "}
						{showBible.contentType}
					</p>
					<p className="text-xs text-zinc-500 mb-3">
						{scenes.length} scenes planned. Review the storyboard
						tab for details.
					</p>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={() =>
								useMovieStore.getState().approveStoryboard()
							}
							className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-500"
						>
							Approve & Generate
						</button>
					</div>
				</div>
			)}

			{/* Pending questions */}
			{pendingQuestions.length > 0 && (
				<div className="flex flex-col gap-3">
					<h3 className="text-sm font-medium text-white">
						Questions from AI Director
					</h3>
					{pendingQuestions.map((question) => (
						<div
							key={question.id}
							className="p-3 bg-zinc-900 border border-zinc-700 rounded-lg"
						>
							<p className="text-sm text-white mb-2">
								{question.question}
							</p>
							<div className="flex flex-wrap gap-2">
								{question.options.map((option) => (
									<button
										key={option}
										type="button"
										onClick={() =>
											submitAnswer(question.id, option)
										}
										className="px-3 py-1 text-xs bg-zinc-800 border border-zinc-600 rounded hover:border-blue-500 text-zinc-300"
									>
										{option}
									</button>
								))}
							</div>
						</div>
					))}
				</div>
			)}

			{/* Review score */}
			{reviewScore !== null && (
				<div className="p-3 bg-zinc-900 border border-zinc-700 rounded-lg flex items-center justify-between">
					<div>
						<p className="text-sm font-medium text-white">
							Quality Score
						</p>
						<p className="text-xs text-zinc-400">
							AI review of assembled timeline
						</p>
					</div>
					<div
						className={`text-2xl font-bold ${
							reviewScore >= 80
								? "text-green-400"
								: reviewScore >= 60
									? "text-yellow-400"
									: "text-red-400"
						}`}
					>
						{reviewScore}/100
					</div>
				</div>
			)}

			{/* Completed — Download + Open in Editor */}
			{status === "completed" && (
				<div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex flex-col gap-3">
					<div>
						<p className="text-sm font-medium text-green-300">
							Movie Generation Complete
						</p>
						<p className="text-xs text-zinc-400 mt-1">
							{scenesTotal} scenes generated
							{reviewScore !== null &&
								` — Quality score: ${reviewScore}/100`}
						</p>
					</div>
					<div className="flex gap-2">
						<button
							type="button"
							disabled={isImporting}
							onClick={async () => {
								setIsImporting(true);
								try {
									await useMovieStore
										.getState()
										.importTimeline();
								} finally {
									setIsImporting(false);
								}
							}}
							className="flex-1 px-4 py-2.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{isImporting
								? "Importing assets..."
								: "Open in Editor"}
						</button>
						<button
							type="button"
							onClick={async () => {
								setIsImporting(true);
								try {
									await useMovieStore
										.getState()
										.importTimeline();
								} finally {
									setIsImporting(false);
								}
							}}
							disabled={isImporting}
							className="flex-1 px-4 py-2.5 text-sm font-medium bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
						>
							<svg
								className="size-4"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={2}
								role="img"
								aria-label="Download"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
								/>
							</svg>
							Download Video
						</button>
					</div>
				</div>
			)}

			{/* Agent messages log */}
			<div className="flex flex-col gap-2">
				<h3 className="text-sm font-medium text-zinc-400">
					Agent Activity
				</h3>
				<div className="max-h-64 overflow-y-auto flex flex-col gap-1">
					{messages.map((message, index) => (
						<div
							key={`msg-${index}-${message.role}`}
							className={`px-3 py-2 rounded text-xs ${
								message.role === "agent"
									? "bg-zinc-900 text-zinc-300"
									: "bg-blue-500/10 text-blue-300"
							}`}
						>
							{message.content}
						</div>
					))}
					{messages.length === 0 && (
						<p className="text-xs text-zinc-500 italic">
							Waiting for agent activity...
						</p>
					)}
				</div>
			</div>

			{/* Checkpoint approval */}
			{status === "paused_checkpoint" && !pendingQuestions.length && (
				<div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
					<p className="text-sm text-yellow-300 mb-3">
						Pipeline paused for your review. Approve to continue.
					</p>
					<button
						type="button"
						onClick={() => approveCheckpoint()}
						className="px-4 py-2 text-sm font-medium bg-yellow-600 text-white rounded-lg hover:bg-yellow-500"
					>
						Approve & Continue
					</button>
				</div>
			)}
		</div>
	);
}

function StatusBadge({ status }: { status: string }) {
	const config: Record<string, { label: string; color: string }> = {
		idle: { label: "Ready", color: "bg-zinc-600" },
		configuring: { label: "Configuring", color: "bg-zinc-600" },
		waiting_approval: {
			label: "Awaiting Approval",
			color: "bg-yellow-600",
		},
		waiting_storyboard_approval: {
			label: "Review Storyboard",
			color: "bg-purple-600",
		},
		processing: { label: "Processing", color: "bg-blue-600" },
		paused_checkpoint: { label: "Paused", color: "bg-yellow-600" },
		completed: { label: "Complete", color: "bg-green-600" },
		failed: { label: "Failed", color: "bg-red-600" },
	};

	const { label, color } = config[status] || config.idle;

	return (
		<span
			className={`px-2 py-1 text-xs font-medium text-white rounded ${color}`}
		>
			{label}
		</span>
	);
}

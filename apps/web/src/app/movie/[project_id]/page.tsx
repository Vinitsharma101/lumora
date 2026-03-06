"use client";

import { useParams } from "next/navigation";
import { useEffect } from "react";
import { useMovieStore } from "@/stores/movie-store";
import { MovieCreationWizard } from "@/components/movie/movie-creation-wizard";
import { PipelineDashboard } from "@/components/movie/pipeline-dashboard";
import { StoryboardView } from "@/components/movie/storyboard-view";
import { StoryArcEditor } from "@/components/movie/story-arc-editor";
import { CharacterGallery } from "@/components/movie/character-gallery";

export default function MoviePage() {
	const params = useParams();
	const projectId = params.project_id as string;
	const { status, setProjectId, scenes, reset } = useMovieStore();

	useEffect(() => {
		setProjectId(projectId);
		return () => {
			reset();
		};
	}, [projectId, setProjectId, reset]);

	const isIdle = status === "idle" || status === "configuring";
	const isActive =
		status === "processing" ||
		status === "waiting_approval" ||
		status === "paused_checkpoint";
	const isComplete = status === "completed";

	return (
		<div className="flex min-h-screen flex-col bg-zinc-950">
			<header className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
				<h1 className="text-lg font-semibold text-white">
					Movie Creator
				</h1>
				<a
					href={`/editor/${projectId}`}
					className="text-sm text-zinc-400 hover:text-white"
				>
					Back to Editor
				</a>
			</header>

			<main className="flex-1 overflow-y-auto">
				{isIdle && <MovieCreationWizard />}

				{(isActive || isComplete) && (
					<div className="flex flex-col gap-6 p-6">
						<PipelineDashboard />

						{scenes.length > 0 && (
							<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
								<StoryboardView />
								<div className="flex flex-col gap-6">
									<StoryArcEditor />
									<CharacterGallery />
								</div>
							</div>
						)}
					</div>
				)}

				{status === "failed" && (
					<div className="flex flex-col items-center gap-4 p-12">
						<p className="text-red-400">
							Pipeline failed. Check logs for details.
						</p>
						<button
							type="button"
							onClick={reset}
							className="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700"
						>
							Start Over
						</button>
					</div>
				)}
			</main>
		</div>
	);
}

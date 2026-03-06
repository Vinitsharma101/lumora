"use client";

import { useState } from "react";
import { useMovieStore } from "@/stores/movie-store";

export function StoryboardView() {
	const { scenes } = useMovieStore();
	const [expandedScene, setExpandedScene] = useState<number | null>(null);

	// Group scenes by act
	const acts = new Map<number, typeof scenes>();
	for (const scene of scenes) {
		const act = scene.actNumber || 1;
		if (!acts.has(act)) {
			acts.set(act, []);
		}
		acts.get(act)?.push(scene);
	}

	if (scenes.length === 0) {
		return (
			<div className="flex items-center justify-center h-48 text-zinc-500 text-sm">
				No scenes generated yet. Start the pipeline to see the
				storyboard.
			</div>
		);
	}

	const ACT_TITLES: Record<number, string> = {
		1: "Act 1: Setup",
		2: "Act 2: Confrontation",
		3: "Act 3: Resolution",
	};

	return (
		<div className="flex flex-col gap-6 p-4">
			<h2 className="text-lg font-semibold text-white">Storyboard</h2>

			{[...acts.entries()].map(([actNum, actScenes]) => (
				<div key={actNum} className="flex flex-col gap-3">
					<h3 className="text-sm font-medium text-zinc-300 uppercase tracking-wider">
						{ACT_TITLES[actNum] || `Act ${actNum}`}
					</h3>

					<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
						{actScenes.map((scene) => (
							<button
								key={scene.sceneNumber}
								type="button"
								onClick={() =>
									setExpandedScene(
										expandedScene === scene.sceneNumber
											? null
											: scene.sceneNumber,
									)
								}
								className={`flex flex-col gap-2 p-3 rounded-lg border text-left transition-colors ${
									expandedScene === scene.sceneNumber
										? "border-blue-500 bg-blue-500/5"
										: "border-zinc-700 bg-zinc-900 hover:border-zinc-600"
								}`}
							>
								{/* Thumbnail placeholder */}
								<div className="w-full aspect-video bg-zinc-800 rounded flex items-center justify-center">
									<span className="text-2xl text-zinc-600">
										{scene.sceneNumber}
									</span>
								</div>

								<div className="flex flex-col gap-1">
									<p className="text-xs text-white font-medium line-clamp-2">
										{scene.description}
									</p>
									<div className="flex items-center gap-2">
										<span className="text-[10px] text-zinc-500">
											{scene.estimatedDurationSeconds}s
										</span>
										<TensionBar
											level={scene.tensionLevel}
										/>
										{scene.mood && (
											<span className="text-[10px] text-zinc-500 capitalize">
												{scene.mood}
											</span>
										)}
									</div>
								</div>
							</button>
						))}
					</div>

					{/* Expanded scene detail */}
					{actScenes.map((scene) =>
						expandedScene === scene.sceneNumber ? (
							<div
								key={`expanded-${scene.sceneNumber}`}
								className="p-4 bg-zinc-900 border border-zinc-700 rounded-lg"
							>
								<div className="flex flex-col gap-3">
									<div className="flex justify-between items-start">
										<h4 className="text-sm font-medium text-white">
											Scene {scene.sceneNumber}
										</h4>
										<span className="text-xs text-zinc-400">
											{scene.estimatedDurationSeconds}s
										</span>
									</div>

									<p className="text-sm text-zinc-300">
										{scene.description}
									</p>

									{scene.location && (
										<div className="text-xs text-zinc-400">
											<span className="text-zinc-500">
												Location:
											</span>{" "}
											{scene.location}
										</div>
									)}

									{scene.charactersPresent.length > 0 && (
										<div className="flex gap-1">
											{scene.charactersPresent.map(
												(charId) => (
													<span
														key={charId}
														className="px-2 py-0.5 text-[10px] bg-zinc-800 border border-zinc-700 rounded-full text-zinc-300"
													>
														{charId}
													</span>
												),
											)}
										</div>
									)}
								</div>
							</div>
						) : null,
					)}
				</div>
			))}
		</div>
	);
}

function TensionBar({ level }: { level: number }) {
	const width = Math.max(1, Math.min(10, level));
	return (
		<div className="flex items-center gap-1" title={`Tension: ${level}/10`}>
			<div className="w-10 h-1 bg-zinc-700 rounded-full overflow-hidden">
				<div
					className={`h-full rounded-full ${
						level >= 8
							? "bg-red-500"
							: level >= 5
								? "bg-yellow-500"
								: "bg-green-500"
					}`}
					style={{ width: `${width * 10}%` }}
				/>
			</div>
		</div>
	);
}

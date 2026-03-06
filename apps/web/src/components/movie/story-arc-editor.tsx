"use client";

import { useMovieStore } from "@/stores/movie-store";

export function StoryArcEditor() {
	const { scenes } = useMovieStore();

	if (scenes.length === 0) {
		return (
			<div className="flex items-center justify-center h-48 text-zinc-500 text-sm">
				Generate a storyboard first to see the story arc.
			</div>
		);
	}

	// Group by acts
	const acts = new Map<number, typeof scenes>();
	for (const scene of scenes) {
		const act = scene.actNumber || 1;
		if (!acts.has(act)) {
			acts.set(act, []);
		}
		acts.get(act)?.push(scene);
	}

	const maxTension = 10;
	const totalDuration = scenes.reduce(
		(sum, s) => sum + s.estimatedDurationSeconds,
		0,
	);

	return (
		<div className="flex flex-col gap-4 p-4">
			<h2 className="text-lg font-semibold text-white">Story Arc</h2>

			{/* Tension curve visualization */}
			<div className="p-4 bg-zinc-900 border border-zinc-700 rounded-lg">
				<div className="flex items-end gap-[2px] h-24">
					{scenes.map((scene) => {
						const height = (scene.tensionLevel / maxTension) * 100;
						const actColors: Record<number, string> = {
							1: "bg-blue-500",
							2: "bg-yellow-500",
							3: "bg-red-500",
						};
						const color =
							actColors[scene.actNumber] || "bg-zinc-500";

						return (
							<div
								key={scene.sceneNumber}
								className="flex-1 flex flex-col justify-end"
								title={`Scene ${scene.sceneNumber}: ${scene.description} (tension: ${scene.tensionLevel})`}
							>
								<div
									className={`${color} rounded-t-sm opacity-80 hover:opacity-100 transition-opacity cursor-pointer min-h-[2px]`}
									style={{ height: `${height}%` }}
								/>
							</div>
						);
					})}
				</div>

				{/* Act labels */}
				<div className="flex mt-2">
					{[...acts.entries()].map(([actNum, actScenes]) => {
						const actDuration = actScenes.reduce(
							(sum, s) => sum + s.estimatedDurationSeconds,
							0,
						);
						const widthPercent = (actDuration / totalDuration) * 100;

						return (
							<div
								key={actNum}
								className="text-center border-r border-zinc-700 last:border-r-0"
								style={{ width: `${widthPercent}%` }}
							>
								<span className="text-[10px] text-zinc-500">
									Act {actNum} ({Math.round(actDuration / 60)}
									min)
								</span>
							</div>
						);
					})}
				</div>
			</div>

			{/* Scene list with inline editing */}
			<div className="flex flex-col gap-2">
				<h3 className="text-sm font-medium text-zinc-400">
					Scene Timeline
				</h3>
				{scenes.map((scene) => {
					const cumulativeDuration = scenes
						.slice(0, scenes.indexOf(scene))
						.reduce((sum, s) => sum + s.estimatedDurationSeconds, 0);
					const minutes = Math.floor(cumulativeDuration / 60);
					const seconds = Math.round(cumulativeDuration % 60);

					return (
						<div
							key={scene.sceneNumber}
							className="flex items-center gap-3 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg hover:border-zinc-600"
						>
							<span className="text-xs text-zinc-500 font-mono w-12">
								{minutes}:{seconds.toString().padStart(2, "0")}
							</span>
							<div className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-400">
								{scene.sceneNumber}
							</div>
							<p className="flex-1 text-xs text-zinc-300 line-clamp-1">
								{scene.description}
							</p>
							<span className="text-[10px] text-zinc-500">
								{scene.estimatedDurationSeconds}s
							</span>
							<TensionDot level={scene.tensionLevel} />
						</div>
					);
				})}
			</div>
		</div>
	);
}

function TensionDot({ level }: { level: number }) {
	const color =
		level >= 8
			? "bg-red-500"
			: level >= 5
				? "bg-yellow-500"
				: "bg-green-500";

	return (
		<div
			className={`w-2 h-2 rounded-full ${color}`}
			title={`Tension: ${level}/10`}
		/>
	);
}

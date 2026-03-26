"use client";

import { useState } from "react";
import {
	useMovieStore,
	type SceneStatus,
} from "@/stores/movie-store";

export function StoryboardView() {
	const {
		scenes,
		showBible,
		acts,
		status,
		sceneStatuses,
		scenesCompleted,
		scenesTotal,
	} = useMovieStore();
	const [expandedScene, setExpandedScene] = useState<number | null>(null);
	const [regeneratePrompt, setRegeneratePrompt] = useState<string>("");
	const [regeneratingScene, setRegeneratingScene] = useState<number | null>(
		null,
	);

	// Group scenes by act
	const scenesByAct = new Map<number, typeof scenes>();
	for (const scene of scenes) {
		const act = scene.actNumber || 1;
		if (!scenesByAct.has(act)) {
			scenesByAct.set(act, []);
		}
		scenesByAct.get(act)?.push(scene);
	}

	return (
		<div className="flex flex-col gap-6 p-4">
			{/* Show Bible summary */}
			{showBible && <ShowBiblePanel />}

			{/* Storyboard approval */}
			{status === "waiting_storyboard_approval" && (
				<div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg flex flex-col gap-3">
					<div>
						<p className="text-sm font-medium text-purple-300">
							Storyboard Ready for Review
						</p>
						<p className="text-xs text-zinc-400 mt-1">
							Review the show bible and scene plan above. Approve
							to begin media generation.
						</p>
					</div>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={() =>
								useMovieStore
									.getState()
									.approveStoryboard()
							}
							className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-500"
						>
							Approve & Generate
						</button>
						<button
							type="button"
							onClick={() => {
								const feedback = window.prompt(
									"Feedback for the AI director (optional):",
								);
								if (feedback !== null) {
									useMovieStore
										.getState()
										.approveStoryboard(feedback || undefined);
								}
							}}
							className="px-4 py-2 text-sm font-medium bg-zinc-700 text-white rounded-lg hover:bg-zinc-600"
						>
							Approve with Feedback
						</button>
					</div>
				</div>
			)}

			{/* Progress bar when processing */}
			{status === "processing" && scenesTotal > 0 && (
				<div className="flex flex-col gap-1">
					<div className="flex justify-between text-xs text-zinc-400">
						<span>Scene Generation Progress</span>
						<span>
							{scenesCompleted}/{scenesTotal}
						</span>
					</div>
					<div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
						<div
							className="h-full bg-blue-500 rounded-full transition-all duration-500"
							style={{
								width: `${Math.max(5, (scenesCompleted / scenesTotal) * 100)}%`,
							}}
						/>
					</div>
				</div>
			)}

			{/* Scene cards */}
			{scenes.length === 0 ? (
				<div className="flex items-center justify-center h-48 text-zinc-500 text-sm">
					No scenes generated yet. Start the pipeline to see the
					storyboard.
				</div>
			) : (
				<>
					<h2 className="text-lg font-semibold text-white">
						Storyboard
					</h2>

					{[...scenesByAct.entries()].map(([actNum, actScenes]) => {
						const actPlan = acts.find(
							(a) => a.actNumber === actNum,
						);
						return (
							<div key={actNum} className="flex flex-col gap-3">
								<div>
									<h3 className="text-sm font-medium text-zinc-300 uppercase tracking-wider">
										{actPlan?.title ||
											ACT_TITLES[actNum] ||
											`Act ${actNum}`}
									</h3>
									{actPlan?.description && (
										<p className="text-xs text-zinc-500 mt-1">
											{actPlan.description}
										</p>
									)}
								</div>

								<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
									{actScenes.map((scene) => {
										const sceneStatus =
											sceneStatuses[
												String(scene.sceneNumber - 1)
											] || "pending";
										return (
											<button
												key={scene.sceneNumber}
												type="button"
												onClick={() =>
													setExpandedScene(
														expandedScene ===
															scene.sceneNumber
															? null
															: scene.sceneNumber,
													)
												}
												className={`flex flex-col gap-2 p-3 rounded-lg border text-left transition-colors ${
													expandedScene ===
													scene.sceneNumber
														? "border-blue-500 bg-blue-500/5"
														: "border-zinc-700 bg-zinc-900 hover:border-zinc-600"
												}`}
											>
												{/* Thumbnail with status */}
												<div className="relative w-full aspect-video bg-zinc-800 rounded flex items-center justify-center">
													<span className="text-2xl text-zinc-600">
														{scene.sceneNumber}
													</span>
													<SceneStatusIndicator
														status={sceneStatus}
													/>
												</div>

												<div className="flex flex-col gap-1">
													<p className="text-xs text-white font-medium line-clamp-2">
														{scene.description}
													</p>
													<div className="flex items-center gap-2">
														<span className="text-[10px] text-zinc-500">
															{
																scene.estimatedDurationSeconds
															}
															s
														</span>
														<TensionBar
															level={
																scene.tensionLevel
															}
														/>
														{scene.mood && (
															<span className="text-[10px] text-zinc-500 capitalize">
																{scene.mood}
															</span>
														)}
													</div>
												</div>
											</button>
										);
									})}
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
														Scene{" "}
														{scene.sceneNumber}
													</h4>
													<span className="text-xs text-zinc-400">
														{
															scene.estimatedDurationSeconds
														}
														s
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

												{scene.charactersPresent
													.length > 0 && (
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

												{/* Regenerate section */}
												<div className="border-t border-zinc-800 pt-3 mt-1">
													{regeneratingScene ===
													scene.sceneNumber ? (
														<div className="flex flex-col gap-2">
															<textarea
																value={
																	regeneratePrompt
																}
																onChange={(
																	event,
																) =>
																	setRegeneratePrompt(
																		event
																			.target
																			.value,
																	)
																}
																placeholder="Modified prompt (leave empty to reuse original)..."
																className="w-full p-2 text-xs bg-zinc-800 border border-zinc-700 rounded text-zinc-300 resize-none"
																rows={3}
															/>
															<div className="flex gap-2">
																<button
																	type="button"
																	onClick={async () => {
																		await useMovieStore
																			.getState()
																			.regenerateScene(
																				scene.sceneNumber -
																					1,
																				regeneratePrompt ||
																					undefined,
																			);
																		setRegeneratingScene(
																			null,
																		);
																		setRegeneratePrompt(
																			"",
																		);
																	}}
																	className="px-3 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-500"
																>
																	Regenerate
																</button>
																<button
																	type="button"
																	onClick={() => {
																		setRegeneratingScene(
																			null,
																		);
																		setRegeneratePrompt(
																			"",
																		);
																	}}
																	className="px-3 py-1 text-xs bg-zinc-700 text-white rounded hover:bg-zinc-600"
																>
																	Cancel
																</button>
															</div>
														</div>
													) : (
														<button
															type="button"
															onClick={() => {
																setRegeneratingScene(
																	scene.sceneNumber,
																);
																setRegeneratePrompt(
																	scene.description,
																);
															}}
															className="px-3 py-1 text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 rounded hover:border-orange-500"
														>
															Regenerate Scene
														</button>
													)}
												</div>
											</div>
										</div>
									) : null,
								)}
							</div>
						);
					})}
				</>
			)}
		</div>
	);
}

function ShowBiblePanel() {
	const { showBible } = useMovieStore();
	const [expanded, setExpanded] = useState(false);

	if (!showBible) return null;

	return (
		<div className="p-4 bg-zinc-900 border border-zinc-700 rounded-lg">
			<button
				type="button"
				onClick={() => setExpanded(!expanded)}
				className="w-full flex items-center justify-between text-left"
			>
				<div>
					<h2 className="text-base font-semibold text-white">
						{showBible.title}
					</h2>
					<p className="text-xs text-zinc-400 mt-0.5">
						{showBible.logline}
					</p>
				</div>
				<span className="text-zinc-500 text-sm">
					{expanded ? "▲" : "▼"}
				</span>
			</button>

			{expanded && (
				<div className="mt-4 flex flex-col gap-4">
					{/* Genre & style */}
					<div className="flex gap-3 flex-wrap">
						{showBible.genre && (
							<span className="px-2 py-1 text-xs bg-zinc-800 border border-zinc-700 rounded text-zinc-300">
								{showBible.genre}
							</span>
						)}
						{showBible.contentType && (
							<span className="px-2 py-1 text-xs bg-zinc-800 border border-zinc-700 rounded text-zinc-300">
								{showBible.contentType}
							</span>
						)}
					</div>

					{/* Visual style */}
					{showBible.visualStyle && (
						<div>
							<h4 className="text-xs font-medium text-zinc-400 mb-1">
								Visual Style
							</h4>
							<p className="text-xs text-zinc-300">
								{showBible.visualStyle}
							</p>
						</div>
					)}

					{/* Color palette */}
					{showBible.colorPalette.length > 0 && (
						<div>
							<h4 className="text-xs font-medium text-zinc-400 mb-1">
								Color Palette
							</h4>
							<div className="flex gap-1">
								{showBible.colorPalette.map((color) => (
									<div
										key={color}
										className="w-8 h-8 rounded border border-zinc-700"
										style={{ backgroundColor: color }}
										title={color}
									/>
								))}
							</div>
						</div>
					)}

					{/* Characters */}
					{showBible.characters.length > 0 && (
						<div>
							<h4 className="text-xs font-medium text-zinc-400 mb-2">
								Characters
							</h4>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-2">
								{showBible.characters.map((character) => (
									<div
										key={character.charId}
										className="p-2 bg-zinc-800 rounded border border-zinc-700"
									>
										<div className="flex items-center gap-2">
											<span className="text-xs font-medium text-white">
												{character.name}
											</span>
											{character.role && (
												<span className="text-[10px] text-zinc-500 capitalize">
													{character.role}
												</span>
											)}
										</div>
										<p className="text-[10px] text-zinc-400 mt-1 line-clamp-2">
											{character.description}
										</p>
										{character.arc && (
											<p className="text-[10px] text-zinc-500 mt-1 italic">
												Arc: {character.arc}
											</p>
										)}
									</div>
								))}
							</div>
						</div>
					)}

					{/* Editing strategy */}
					{showBible.editingStrategy && (
						<div>
							<h4 className="text-xs font-medium text-zinc-400 mb-1">
								Editing Strategy
							</h4>
							<div className="flex flex-col gap-1 text-[10px] text-zinc-400">
								{showBible.editingStrategy.pacingNotes && (
									<p>
										Pacing:{" "}
										{
											showBible.editingStrategy
												.pacingNotes
										}
									</p>
								)}
								{showBible.editingStrategy.musicStrategy && (
									<p>
										Music:{" "}
										{
											showBible.editingStrategy
												.musicStrategy
										}
									</p>
								)}
								{showBible.editingStrategy
									.targetCutsPerMinute > 0 && (
									<p>
										Target cuts/min:{" "}
										{
											showBible.editingStrategy
												.targetCutsPerMinute
										}
									</p>
								)}
								{showBible.editingStrategy.transitionPalette
									.length > 0 && (
									<p>
										Transitions:{" "}
										{showBible.editingStrategy.transitionPalette.join(
											", ",
										)}
									</p>
								)}
							</div>
						</div>
					)}

					{/* Rules */}
					{showBible.rules.length > 0 && (
						<div>
							<h4 className="text-xs font-medium text-zinc-400 mb-1">
								Director Rules
							</h4>
							<ul className="flex flex-col gap-0.5">
								{showBible.rules.map((rule, index) => (
									<li
										key={`rule-${index}`}
										className="text-[10px] text-zinc-400"
									>
										{rule}
									</li>
								))}
							</ul>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

function SceneStatusIndicator({ status }: { status: SceneStatus }) {
	const config: Record<
		SceneStatus,
		{ color: string; label: string; animate?: boolean }
	> = {
		pending: { color: "bg-zinc-600", label: "Pending" },
		processing: {
			color: "bg-blue-500",
			label: "Generating",
			animate: true,
		},
		completed: { color: "bg-green-500", label: "Complete" },
		failed: { color: "bg-red-500", label: "Failed" },
	};

	const { color, label, animate } = config[status] || config.pending;

	return (
		<div
			className={`absolute top-1 right-1 w-2.5 h-2.5 rounded-full ${color} ${animate ? "animate-pulse" : ""}`}
			title={label}
		/>
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

const ACT_TITLES: Record<number, string> = {
	1: "Act 1: Setup",
	2: "Act 2: Confrontation",
	3: "Act 3: Resolution",
};

"use client";

import { useState } from "react";
import { useMovieStore } from "@/stores/movie-store";

const STYLE_OPTIONS = [
	{ value: "cinematic", label: "Cinematic" },
	{ value: "documentary", label: "Documentary" },
	{ value: "animated", label: "Animated" },
	{ value: "noir", label: "Film Noir" },
	{ value: "sci-fi", label: "Sci-Fi" },
	{ value: "fantasy", label: "Fantasy" },
	{ value: "horror", label: "Horror" },
	{ value: "comedy", label: "Comedy" },
];

const DURATION_OPTIONS = [
	{ value: 5, label: "5 min (Short)" },
	{ value: 15, label: "15 min (Short Film)" },
	{ value: 30, label: "30 min (Episode)" },
	{ value: 60, label: "60 min (Feature)" },
];

export function MovieCreationWizard() {
	const {
		query,
		duration,
		style,
		status,
		setQuery,
		setDuration,
		setStyle,
		startPipeline,
	} = useMovieStore();

	const hasPrefilledQuery = query.trim().length > 10;
	const [step, setStep] = useState(hasPrefilledQuery ? 1 : 0);

	const steps = [
		{ title: "Concept", description: "Describe your movie" },
		{ title: "Settings", description: "Duration & style" },
		{ title: "Review", description: "Confirm & start" },
	];

	const canProceed = step === 0 ? query.trim().length > 10 : true;

	return (
		<div className="flex flex-col gap-6 p-6 max-w-2xl mx-auto">
			{/* Step indicator */}
			<div className="flex items-center gap-2">
				{steps.map((s, i) => (
					<div key={s.title} className="flex items-center gap-2">
						<div
							className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
								i <= step
									? "bg-blue-600 text-white"
									: "bg-zinc-800 text-zinc-400"
							}`}
						>
							{i + 1}
						</div>
						<span
							className={`text-sm ${i <= step ? "text-white" : "text-zinc-500"}`}
						>
							{s.title}
						</span>
						{i < steps.length - 1 && <div className="w-8 h-px bg-zinc-700" />}
					</div>
				))}
			</div>

			{/* Step content */}
			{step === 0 && (
				<div className="flex flex-col gap-4">
					<h2 className="text-xl font-semibold text-white">
						Describe Your Movie
					</h2>
					<p className="text-sm text-zinc-400">
						Tell us about your movie concept. Be as detailed as possible about
						the story, characters, and setting.
					</p>
					<textarea
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="A thrilling sci-fi story about a lone astronaut who discovers an ancient alien signal while on a routine mission to Mars..."
						className="w-full h-40 p-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 resize-none focus:outline-none focus:border-blue-500"
					/>
				</div>
			)}

			{step === 1 && (
				<div className="flex flex-col gap-6">
					<h2 className="text-xl font-semibold text-white">Movie Settings</h2>

					<div className="flex flex-col gap-2">
						<label className="text-sm font-medium text-zinc-300">
							Duration
						</label>
						<div className="grid grid-cols-2 gap-2">
							{DURATION_OPTIONS.map((option) => (
								<button
									key={option.value}
									type="button"
									onClick={() => setDuration(option.value)}
									className={`p-3 rounded-lg border text-sm ${
										duration === option.value
											? "border-blue-500 bg-blue-500/10 text-blue-400"
											: "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-600"
									}`}
								>
									{option.label}
								</button>
							))}
						</div>
					</div>

					<div className="flex flex-col gap-2">
						<label className="text-sm font-medium text-zinc-300">
							Visual Style
						</label>
						<div className="grid grid-cols-2 gap-2">
							{STYLE_OPTIONS.map((option) => (
								<button
									key={option.value}
									type="button"
									onClick={() => setStyle(option.value)}
									className={`p-3 rounded-lg border text-sm ${
										style === option.value
											? "border-blue-500 bg-blue-500/10 text-blue-400"
											: "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-600"
									}`}
								>
									{option.label}
								</button>
							))}
						</div>
					</div>
				</div>
			)}

			{step === 2 && (
				<div className="flex flex-col gap-4">
					<h2 className="text-xl font-semibold text-white">Review & Create</h2>

					<div className="p-4 bg-zinc-900 border border-zinc-700 rounded-lg">
						<div className="flex flex-col gap-3">
							<div>
								<span className="text-sm text-zinc-400">Concept:</span>
								<p className="text-sm text-white mt-1">{query}</p>
							</div>
							<div className="flex gap-4">
								<div>
									<span className="text-sm text-zinc-400">Duration:</span>
									<p className="text-sm text-white">{duration} min</p>
								</div>
								<div>
									<span className="text-sm text-zinc-400">Style:</span>
									<p className="text-sm text-white capitalize">{style}</p>
								</div>
							</div>
						</div>
					</div>

					<p className="text-xs text-zinc-500">
						The AI will create a story structure, generate visual assets,
						compose music, and assemble your movie autonomously. This may take
						30-60 minutes depending on duration.
					</p>
				</div>
			)}

			{/* Navigation */}
			<div className="flex justify-between pt-4 border-t border-zinc-800">
				<button
					type="button"
					onClick={() => setStep(Math.max(0, step - 1))}
					disabled={step === 0}
					className="px-4 py-2 text-sm text-zinc-400 hover:text-white disabled:opacity-30"
				>
					Back
				</button>

				{step < 2 ? (
					<button
						type="button"
						onClick={() => setStep(step + 1)}
						disabled={!canProceed}
						className="px-6 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-30"
					>
						Continue
					</button>
				) : (
					<button
						type="button"
						onClick={startPipeline}
						disabled={status === "processing"}
						className="px-6 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-30"
					>
						{status === "processing" ? "Creating..." : "Create Movie"}
					</button>
				)}
			</div>

			{status === "processing" && (
				<div className="flex min-h-[120px] items-center justify-center">
					<div className="flex items-center gap-2 text-zinc-400">
						<span className="animate-bounce [animation-delay:-0.3s]">.</span>
						<span className="animate-bounce [animation-delay:-0.15s]">.</span>
						<span className="animate-bounce">.</span>
						<span className="animate-bounce [animation-delay:0.15s]">.</span>
						<span className="animate-bounce [animation-delay:0.3s]">.</span>
					</div>
				</div>
			)}
		</div>
	);
}

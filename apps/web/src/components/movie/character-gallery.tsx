"use client";

import { useState } from "react";
import { useMovieStore, type MovieCharacter } from "@/stores/movie-store";

export function CharacterGallery() {
	const { characters, addCharacter, removeCharacter, updateCharacter } =
		useMovieStore();
	const [isAdding, setIsAdding] = useState(false);
	const [newName, setNewName] = useState("");
	const [newDescription, setNewDescription] = useState("");
	const [newVoice, setNewVoice] = useState("");

	const handleAdd = () => {
		if (!newName.trim()) return;

		const character: MovieCharacter = {
			charId: `char_${Date.now()}`,
			name: newName.trim(),
			description: newDescription.trim(),
			referenceImageUrl: null,
			voiceDescription: newVoice.trim() || null,
		};

		addCharacter(character);
		setNewName("");
		setNewDescription("");
		setNewVoice("");
		setIsAdding(false);
	};

	return (
		<div className="flex flex-col gap-4 p-4">
			<div className="flex items-center justify-between">
				<h2 className="text-lg font-semibold text-white">Characters</h2>
				<button
					type="button"
					onClick={() => setIsAdding(!isAdding)}
					className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-500"
				>
					{isAdding ? "Cancel" : "Add Character"}
				</button>
			</div>

			{/* Add character form */}
			{isAdding && (
				<div className="p-4 bg-zinc-900 border border-zinc-700 rounded-lg flex flex-col gap-3">
					<input
						type="text"
						value={newName}
						onChange={(event) => setNewName(event.target.value)}
						placeholder="Character name"
						className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
					/>
					<textarea
						value={newDescription}
						onChange={(event) =>
							setNewDescription(event.target.value)
						}
						placeholder="Detailed visual description (appearance, clothing, distinctive features...)"
						className="w-full h-24 p-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white placeholder-zinc-500 resize-none focus:outline-none focus:border-blue-500"
					/>
					<input
						type="text"
						value={newVoice}
						onChange={(event) => setNewVoice(event.target.value)}
						placeholder="Voice description (e.g., warm female voice, mid-30s, slight British accent)"
						className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
					/>
					<button
						type="button"
						onClick={handleAdd}
						disabled={!newName.trim()}
						className="self-end px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-30"
					>
						Add
					</button>
				</div>
			)}

			{/* Character cards */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
				{characters.map((character) => (
					<div
						key={character.charId}
						className="p-4 bg-zinc-900 border border-zinc-700 rounded-lg"
					>
						<div className="flex items-start justify-between mb-2">
							<div className="flex items-center gap-3">
								{/* Avatar placeholder */}
								<div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-lg text-zinc-500 font-medium">
									{character.name.charAt(0).toUpperCase()}
								</div>
								<div>
									<p className="text-sm font-medium text-white">
										{character.name}
									</p>
									<p className="text-[10px] text-zinc-500 font-mono">
										{character.charId}
									</p>
								</div>
							</div>
							<button
								type="button"
								onClick={() =>
									removeCharacter(character.charId)
								}
								className="text-xs text-zinc-500 hover:text-red-400"
							>
								Remove
							</button>
						</div>

						{character.description && (
							<p className="text-xs text-zinc-400 mb-2 line-clamp-3">
								{character.description}
							</p>
						)}

						{character.voiceDescription && (
							<p className="text-[10px] text-zinc-500 italic">
								Voice: {character.voiceDescription}
							</p>
						)}

						{character.referenceImageUrl && (
							<div className="mt-2">
								<img
									src={character.referenceImageUrl}
									alt={character.name}
									className="w-full h-24 object-cover rounded"
								/>
							</div>
						)}
					</div>
				))}
			</div>

			{characters.length === 0 && !isAdding && (
				<p className="text-sm text-zinc-500 text-center py-8">
					No characters yet. The AI Director will create characters
					from your prompt, or you can add them manually.
				</p>
			)}
		</div>
	);
}

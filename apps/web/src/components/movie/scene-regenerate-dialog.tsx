"use client";

import { useState } from "react";

interface SceneRegenerateDialogProps {
	sceneNumber: number;
	sceneDescription: string;
	open: boolean;
	onClose: () => void;
	onRegenerate: (sceneNumber: number, modifiedPrompt: string) => void;
}

export function SceneRegenerateDialog({
	sceneNumber,
	sceneDescription,
	open,
	onClose,
	onRegenerate,
}: SceneRegenerateDialogProps) {
	const [modifiedPrompt, setModifiedPrompt] = useState(sceneDescription);

	if (!open) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
			<div className="w-full max-w-lg p-6 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl">
				<h3 className="text-lg font-semibold text-white mb-1">
					Regenerate Scene {sceneNumber}
				</h3>
				<p className="text-xs text-zinc-400 mb-4">
					Modify the description below and regenerate this scene with
					updated visuals.
				</p>

				<textarea
					value={modifiedPrompt}
					onChange={(event) => setModifiedPrompt(event.target.value)}
					className="w-full h-32 p-3 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 resize-none focus:outline-none focus:border-blue-500"
				/>

				<div className="flex justify-end gap-2 mt-4">
					<button
						type="button"
						onClick={onClose}
						className="px-4 py-2 text-sm text-zinc-400 hover:text-white"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={() => {
							onRegenerate(sceneNumber, modifiedPrompt);
							onClose();
						}}
						className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-500"
					>
						Regenerate
					</button>
				</div>
			</div>
		</div>
	);
}

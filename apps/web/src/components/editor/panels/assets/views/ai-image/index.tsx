"use client";

import { useImageGenStore } from "@/stores/image-gen-store";
import { useImageGenPolling } from "@/hooks/use-image-gen-polling";
import { ArtboardCanvas } from "./artboard-canvas";
import { ControlsPanel } from "./controls-panel";
import { AIImageWorkspaceDialog } from "./ai-image-workspace-dialog";
import { Button } from "@/components/ui/button";
import { Expand } from "lucide-react";

export function AIImageView() {
	const setExpanded = useImageGenStore((state) => state.setExpanded);

	useImageGenPolling();

	return (
		<div className="flex h-full">
			{/* Left: Artboard */}
			<div className="flex min-w-0 flex-1 flex-col bg-neutral-950">
				<div className="flex items-center justify-between border-b border-neutral-800 px-3 py-1.5">
					<h2 className="text-sm font-semibold text-neutral-200">
						AI Image Studio
					</h2>
					<Button
						variant="ghost"
						size="sm"
						className="h-6 w-6 p-0 text-neutral-400 hover:text-neutral-200"
						onClick={() => setExpanded(true)}
						type="button"
					>
						<Expand className="h-3.5 w-3.5" />
					</Button>
				</div>
				<ArtboardCanvas />
			</div>

			{/* Right: Controls */}
			<div className="flex w-[300px] flex-col overflow-hidden border-l">
				<ControlsPanel />
			</div>

			<AIImageWorkspaceDialog />
		</div>
	);
}

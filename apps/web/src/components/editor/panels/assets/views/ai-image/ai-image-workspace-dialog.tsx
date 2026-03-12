"use client";

import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	ResizablePanelGroup,
	ResizablePanel,
	ResizableHandle,
} from "@/components/ui/resizable";
import { useImageGenStore } from "@/stores/image-gen-store";
import { ArtboardCanvas } from "./artboard-canvas";
import { ControlsPanel } from "./controls-panel";

export function AIImageWorkspaceDialog() {
	const { isExpanded, setExpanded } = useImageGenStore();

	return (
		<Dialog open={isExpanded} onOpenChange={setExpanded}>
			<DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] max-h-[90vh] p-0 gap-0">
				<DialogHeader className="px-4 py-2 border-b">
					<DialogTitle>AI Image Studio</DialogTitle>
				</DialogHeader>
				<ResizablePanelGroup
					direction="horizontal"
					className="flex-1"
				>
					<ResizablePanel defaultSize={65} minSize={40}>
						<div className="flex h-full flex-col bg-neutral-950">
							<ArtboardCanvas />
						</div>
					</ResizablePanel>
					<ResizableHandle withHandle />
					<ResizablePanel defaultSize={35} minSize={25}>
						<ControlsPanel />
					</ResizablePanel>
				</ResizablePanelGroup>
			</DialogContent>
		</Dialog>
	);
}

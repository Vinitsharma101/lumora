"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	ArrowUp02Icon,
	ArrowLeft02Icon,
	ArrowDown01Icon,
	Settings02Icon,
	Image01Icon,
	Cursor02Icon,
	Video01Icon,
	AudioWave01Icon,
	CropIcon,
	PenTool01Icon,
	TextFontIcon,
	Layout01Icon,
	RecordIcon,
	PlusSignCircleIcon,
	Search01Icon,
	Chatting01Icon,
	Mic01Icon,
	ThumbsUpIcon,
	ThumbsDownIcon,
} from "@hugeicons/core-free-icons";
import { EditorProvider } from "@/components/providers/editor-provider";
import { useEditor } from "@/hooks/use-editor";
import { cn } from "@/utils/ui";
import { toast } from "sonner";

type CanvasItem = {
	id: string;
	type: "image" | "video" | "text";
	url?: string;
	prompt?: string;
	title?: string;
	content?: string;
	x: number;
	y: number;
	width: number;
	height: number;
};

type ToolStep = {
	id: string;
	label: string;
	status: "running" | "done";
	duration?: string;
};

type ChatAttachment = {
	id: string;
	type: "image" | "video" | "text";
	url?: string;
	prompt?: string;
	title?: string;
};

type ChatMessage = {
	id: string;
	role: "user" | "assistant";
	content: string;
	toolSteps?: ToolStep[];
	attachments?: ChatAttachment[];
};

type ToolId =
	| "cursor"
	| "image"
	| "video"
	| "audio"
	| "crop"
	| "pen"
	| "text"
	| "layout"
	| "record"
	| "add";

type ContextMenuState = {
	x: number;
	y: number;
	itemIds: string[];
} | null;

type SelectionRect = {
	startX: number;
	startY: number;
	currentX: number;
	currentY: number;
} | null;

type ResizeHandle = "nw" | "ne" | "sw" | "se";

type ResizeState = {
	itemId: string;
	handle: ResizeHandle;
	startX: number;
	startY: number;
	origX: number;
	origY: number;
	origW: number;
	origH: number;
} | null;

export default function ImageEditorPage() {
	const params = useParams();
	const projectId = params.project_id as string;

	return (
		<EditorProvider projectId={projectId}>
			<ImageEditorShell projectId={projectId} />
		</EditorProvider>
	);
}

function ImageEditorShell({ projectId }: { projectId: string }) {
	const editor = useEditor();
	const [chatOpen, setChatOpen] = useState(true);
	const [canvasItems, setCanvasItems] = useState<CanvasItem[]>([]);
	const [zoom, setZoom] = useState(1);
	const [activeTool, setActiveTool] = useState<ToolId>("cursor");
	const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
	const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
	const [pendingAttachments, setPendingAttachments] = useState<
		ChatAttachment[]
	>([]);
	const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Persist canvas items to localStorage keyed by projectId
	const storageKey = `grace-studio-canvas-${projectId}`;

	// Load canvas items on mount
	useEffect(() => {
		try {
			const saved = localStorage.getItem(storageKey);
			if (saved) {
				const parsed = JSON.parse(saved) as CanvasItem[];
				if (Array.isArray(parsed) && parsed.length > 0) {
					setCanvasItems(parsed);
				}
			}
		} catch {
			// Corrupted data — ignore
		}
	}, [storageKey]);

	useEffect(() => {
		const activeProject = editor.project.getActiveOrNull();
		if (!activeProject || activeProject.metadata.type === "image") return;
		void editor.project.updateProjectType({ type: "image" });
	}, [editor.project]);

	// Debounced save whenever canvas items change
	useEffect(() => {
		if (saveTimeoutRef.current) {
			clearTimeout(saveTimeoutRef.current);
		}
		saveTimeoutRef.current = setTimeout(() => {
			try {
				localStorage.setItem(storageKey, JSON.stringify(canvasItems));
			} catch {
				// Storage full — ignore
			}
		}, 500);
	}, [canvasItems, storageKey]);

	const addCanvasItem = useCallback(
		(item: Omit<CanvasItem, "id" | "x" | "y">) => {
			const newItem: CanvasItem = {
				...item,
				id: crypto.randomUUID(),
				x: 60 + canvasItems.length * 40,
				y: 60 + canvasItems.length * 40,
			};
			setCanvasItems((prev) => [...prev, newItem]);
		},
		[canvasItems.length],
	);

	const handleZoomIn = useCallback(() => {
		setZoom((prev) => Math.min(4, +(prev + 0.1).toFixed(1)));
	}, []);

	const handleZoomOut = useCallback(() => {
		setZoom((prev) => Math.max(0.1, +(prev - 0.1).toFixed(1)));
	}, []);

	const handleDuplicate = useCallback((itemIds: string[]) => {
		setCanvasItems((prev) => {
			const duplicates: CanvasItem[] = [];
			for (const id of itemIds) {
				const item = prev.find((i) => i.id === id);
				if (item) {
					duplicates.push({
						...item,
						id: crypto.randomUUID(),
						x: item.x + 30,
						y: item.y + 30,
					});
				}
			}
			return [...prev, ...duplicates];
		});
	}, []);

	const handleDelete = useCallback((itemIds: string[]) => {
		setCanvasItems((prev) => prev.filter((i) => !itemIds.includes(i.id)));
		setSelectedItemIds([]);
	}, []);

	const handleBringToFront = useCallback((itemIds: string[]) => {
		setCanvasItems((prev) => {
			const selected = prev.filter((i) => itemIds.includes(i.id));
			const rest = prev.filter((i) => !itemIds.includes(i.id));
			return [...rest, ...selected];
		});
	}, []);

	const handleSendToBack = useCallback((itemIds: string[]) => {
		setCanvasItems((prev) => {
			const selected = prev.filter((i) => itemIds.includes(i.id));
			const rest = prev.filter((i) => !itemIds.includes(i.id));
			return [...selected, ...rest];
		});
	}, []);

	const handleSendToChat = useCallback(
		(itemIds: string[]) => {
			const items = canvasItems.filter((i) => itemIds.includes(i.id));
			const attachments: ChatAttachment[] = items.map((item) => ({
				id: item.id,
				type: item.type,
				url: item.url,
				prompt: item.prompt ?? item.title ?? item.content ?? "untitled",
				title: item.title,
			}));
			setPendingAttachments((prev) => [...prev, ...attachments]);
			setChatOpen(true);
			setContextMenu(null);
		},
		[canvasItems],
	);

	const handleToolAction = useCallback(
		(tool: ToolId) => {
			if (tool === "image") {
				const input = document.createElement("input");
				input.type = "file";
				input.accept = "image/*";
				input.onchange = (event) => {
					const file = (event.target as HTMLInputElement).files?.[0];
					if (file) {
						const url = URL.createObjectURL(file);
						addCanvasItem({
							type: "image",
							url,
							prompt: file.name,
							width: 500,
							height: 375,
						});
						toast.success("Image added to canvas");
					}
				};
				input.click();
				// Reset to cursor after file picker
				setActiveTool("cursor");
			} else if (tool === "pen") {
				toast("Drawing tool coming soon");
				setActiveTool("cursor");
			} else if (
				tool === "video" ||
				tool === "audio" ||
				tool === "crop" ||
				tool === "layout" ||
				tool === "record" ||
				tool === "add"
			) {
				toast("Coming soon");
				setActiveTool("cursor");
			}
		},
		[addCanvasItem],
	);

	return (
		<div className="flex h-screen w-screen flex-col overflow-hidden font-sans bg-[hsl(40_20%_95%)]">
			<ImageEditorHeader />
			<div className="relative flex-1 min-h-0">
				<ImageCanvas
					canvasItems={canvasItems}
					setCanvasItems={setCanvasItems}
					zoom={zoom}
					setZoom={setZoom}
					activeTool={activeTool}
					selectedItemIds={selectedItemIds}
					setSelectedItemIds={setSelectedItemIds}
					contextMenu={contextMenu}
					setContextMenu={setContextMenu}
					addCanvasItem={addCanvasItem}
				/>
				{contextMenu && (
					<ContextMenuOverlay
						contextMenu={contextMenu}
						onClose={() => setContextMenu(null)}
						onDuplicate={handleDuplicate}
						onDelete={handleDelete}
						onBringToFront={handleBringToFront}
						onSendToBack={handleSendToBack}
						onSendToChat={handleSendToChat}
					/>
				)}
				<ImageChatPanel
					isOpen={chatOpen}
					onClose={() => setChatOpen(false)}
					onAddImage={addCanvasItem}
					canvasItems={canvasItems}
					selectedItemIds={selectedItemIds}
					pendingAttachments={pendingAttachments}
					onClearPendingAttachments={() => setPendingAttachments([])}
					onRemovePendingAttachment={(id) =>
						setPendingAttachments((prev) => prev.filter((a) => a.id !== id))
					}
				/>
				<BottomToolbar
					activeTool={activeTool}
					onToolChange={(tool) => {
						setActiveTool(tool);
						handleToolAction(tool);
					}}
				/>
				<ZoomControls
					zoom={zoom}
					onZoomIn={handleZoomIn}
					onZoomOut={handleZoomOut}
				/>
				<BottomRightActions
					projectId={projectId}
					chatOpen={chatOpen}
					onToggleChat={() => setChatOpen((prev) => !prev)}
				/>
			</div>
		</div>
	);
}

function ImageEditorHeader() {
	const editor = useEditor();
	const [projectName, setProjectName] = useState("Untitled");

	useEffect(() => {
		const updateName = () => {
			const project = editor.project.getActiveOrNull();
			if (project) {
				setProjectName(project.metadata.name);
			}
		};
		updateName();
		const unsub = editor.project.subscribe(updateName);
		return unsub;
	}, [editor]);

	return (
		<header className="h-12 flex items-center justify-between px-4 z-20 shrink-0 bg-[hsl(40_20%_95%)]">
			<div className="flex items-center gap-2">
				<Link href="/home">
					<button
						type="button"
						className="flex items-center justify-center size-8 rounded-full hover:bg-black/5 transition-colors"
					>
						<HugeiconsIcon
							icon={ArrowLeft02Icon}
							className="size-4 text-black/80"
						/>
					</button>
				</Link>
				<button
					type="button"
					className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-black/5 transition-colors"
				>
					<span className="text-sm font-semibold text-black/90 uppercase tracking-wide">
						{projectName}
					</span>
					<HugeiconsIcon
						icon={ArrowDown01Icon}
						className="size-3 text-black/50"
					/>
				</button>
			</div>

			<div className="flex items-center gap-2">
				<button
					type="button"
					className="flex items-center justify-center size-9 rounded-full hover:bg-black/5 transition-colors"
				>
					<HugeiconsIcon
						icon={Settings02Icon}
						className="size-[18px] text-black/70"
					/>
				</button>
				<button
					type="button"
					className="px-5 py-2 bg-black text-white text-sm font-medium rounded-full hover:bg-black/85 transition-colors"
				>
					Share
				</button>
			</div>
		</header>
	);
}

function ImageCanvas({
	canvasItems,
	setCanvasItems,
	zoom,
	setZoom,
	activeTool,
	selectedItemIds,
	setSelectedItemIds,
	contextMenu,
	setContextMenu,
	addCanvasItem,
}: {
	canvasItems: CanvasItem[];
	setCanvasItems: React.Dispatch<React.SetStateAction<CanvasItem[]>>;
	zoom: number;
	setZoom: React.Dispatch<React.SetStateAction<number>>;
	activeTool: ToolId;
	selectedItemIds: string[];
	setSelectedItemIds: React.Dispatch<React.SetStateAction<string[]>>;
	contextMenu: ContextMenuState;
	setContextMenu: React.Dispatch<React.SetStateAction<ContextMenuState>>;
	addCanvasItem: (item: Omit<CanvasItem, "id" | "x" | "y">) => void;
}) {
	const canvasRef = useRef<HTMLDivElement>(null);
	const [dragging, setDragging] = useState<{
		id: string;
		offsetX: number;
		offsetY: number;
	} | null>(null);
	const [selectionRect, setSelectionRect] = useState<SelectionRect>(null);
	const [resizing, setResizing] = useState<ResizeState>(null);

	// Ctrl+wheel zoom
	useEffect(() => {
		const element = canvasRef.current;
		if (!element) return;

		const handleWheel = (event: WheelEvent) => {
			if (!event.ctrlKey && !event.metaKey) return;
			event.preventDefault();
			const delta = event.deltaY < 0 ? 0.1 : -0.1;
			setZoom((prev) => Math.min(4, Math.max(0.1, +(prev + delta).toFixed(1))));
		};

		element.addEventListener("wheel", handleWheel, { passive: false });
		return () => element.removeEventListener("wheel", handleWheel);
	}, [setZoom]);

	const getCanvasCoords = useCallback(
		(clientX: number, clientY: number) => {
			if (!canvasRef.current) return { x: 0, y: 0 };
			const rect = canvasRef.current.getBoundingClientRect();
			return {
				x: (clientX - rect.left + canvasRef.current.scrollLeft) / zoom,
				y: (clientY - rect.top + canvasRef.current.scrollTop) / zoom,
			};
		},
		[zoom],
	);

	const handleItemMouseDown = useCallback(
		(event: React.MouseEvent, itemId: string) => {
			// Prevent starting drag/select when right-clicking
			if (event.button === 2) return;
			event.stopPropagation();

			const item = canvasItems.find((i) => i.id === itemId);
			if (!item) return;

			// Multi-select with shift
			if (event.shiftKey) {
				setSelectedItemIds((prev) =>
					prev.includes(itemId)
						? prev.filter((id) => id !== itemId)
						: [...prev, itemId],
				);
				return;
			}

			// Select single item
			if (!selectedItemIds.includes(itemId)) {
				setSelectedItemIds([itemId]);
			}

			const coords = getCanvasCoords(event.clientX, event.clientY);
			setDragging({
				id: itemId,
				offsetX: coords.x - item.x,
				offsetY: coords.y - item.y,
			});
		},
		[canvasItems, selectedItemIds, getCanvasCoords, setSelectedItemIds],
	);

	const handleResizeMouseDown = useCallback(
		(event: React.MouseEvent, itemId: string, handle: ResizeHandle) => {
			event.stopPropagation();
			event.preventDefault();
			const item = canvasItems.find((i) => i.id === itemId);
			if (!item) return;

			setResizing({
				itemId,
				handle,
				startX: event.clientX,
				startY: event.clientY,
				origX: item.x,
				origY: item.y,
				origW: item.width,
				origH: item.height,
			});
		},
		[canvasItems],
	);

	const handleContextMenu = useCallback(
		(event: React.MouseEvent, itemId: string) => {
			event.preventDefault();
			event.stopPropagation();

			// If right-clicked item isn't in selection, select only it
			if (!selectedItemIds.includes(itemId)) {
				setSelectedItemIds([itemId]);
				setContextMenu({
					x: event.clientX,
					y: event.clientY,
					itemIds: [itemId],
				});
			} else {
				setContextMenu({
					x: event.clientX,
					y: event.clientY,
					itemIds: [...selectedItemIds],
				});
			}
		},
		[selectedItemIds, setSelectedItemIds, setContextMenu],
	);

	const handleCanvasMouseDown = useCallback(
		(event: React.MouseEvent) => {
			// Close context menu on any click
			if (contextMenu) {
				setContextMenu(null);
			}

			// Only handle left clicks
			if (event.button !== 0) return;

			// Text tool: click to add text
			if (activeTool === "text") {
				const text = prompt("Enter text:");
				if (text) {
					addCanvasItem({
						type: "text",
						content: text,
						title: "",
						width: 200,
						height: 60,
					});
				}
				return;
			}

			// Cursor tool: start selection rectangle
			if (activeTool === "cursor") {
				setSelectedItemIds([]);
				const coords = getCanvasCoords(event.clientX, event.clientY);
				setSelectionRect({
					startX: coords.x,
					startY: coords.y,
					currentX: coords.x,
					currentY: coords.y,
				});
			}
		},
		[
			activeTool,
			contextMenu,
			getCanvasCoords,
			addCanvasItem,
			setSelectedItemIds,
			setContextMenu,
		],
	);

	const handleMouseMove = useCallback(
		(event: React.MouseEvent) => {
			// Handle resizing
			if (resizing) {
				const deltaX = (event.clientX - resizing.startX) / zoom;
				const deltaY = (event.clientY - resizing.startY) / zoom;

				setCanvasItems((prev) =>
					prev.map((item) => {
						if (item.id !== resizing.itemId) return item;

						let newX = resizing.origX;
						let newY = resizing.origY;
						let newW = resizing.origW;
						let newH = resizing.origH;

						if (resizing.handle === "se") {
							newW = Math.max(50, resizing.origW + deltaX);
							newH = Math.max(50, resizing.origH + deltaY);
						} else if (resizing.handle === "sw") {
							newW = Math.max(50, resizing.origW - deltaX);
							newH = Math.max(50, resizing.origH + deltaY);
							newX = resizing.origX + resizing.origW - newW;
						} else if (resizing.handle === "ne") {
							newW = Math.max(50, resizing.origW + deltaX);
							newH = Math.max(50, resizing.origH - deltaY);
							newY = resizing.origY + resizing.origH - newH;
						} else if (resizing.handle === "nw") {
							newW = Math.max(50, resizing.origW - deltaX);
							newH = Math.max(50, resizing.origH - deltaY);
							newX = resizing.origX + resizing.origW - newW;
							newY = resizing.origY + resizing.origH - newH;
						}

						return { ...item, x: newX, y: newY, width: newW, height: newH };
					}),
				);
				return;
			}

			// Handle item dragging
			if (dragging) {
				const coords = getCanvasCoords(event.clientX, event.clientY);
				const newX = coords.x - dragging.offsetX;
				const newY = coords.y - dragging.offsetY;

				// Move all selected items together
				if (selectedItemIds.includes(dragging.id)) {
					const draggedItem = canvasItems.find((i) => i.id === dragging.id);
					if (!draggedItem) return;
					const deltaX = newX - draggedItem.x;
					const deltaY = newY - draggedItem.y;

					setCanvasItems((prev) =>
						prev.map((item) =>
							selectedItemIds.includes(item.id)
								? {
										...item,
										x: Math.max(0, item.x + deltaX),
										y: Math.max(0, item.y + deltaY),
									}
								: item,
						),
					);
				} else {
					setCanvasItems((prev) =>
						prev.map((item) =>
							item.id === dragging.id
								? { ...item, x: Math.max(0, newX), y: Math.max(0, newY) }
								: item,
						),
					);
				}
				return;
			}

			// Handle selection rectangle
			if (selectionRect) {
				const coords = getCanvasCoords(event.clientX, event.clientY);
				setSelectionRect((prev) =>
					prev ? { ...prev, currentX: coords.x, currentY: coords.y } : null,
				);
			}
		},
		[
			dragging,
			resizing,
			selectionRect,
			canvasItems,
			selectedItemIds,
			zoom,
			getCanvasCoords,
			setCanvasItems,
		],
	);

	const handleMouseUp = useCallback(() => {
		// Finish selection rectangle and select enclosed items
		if (selectionRect) {
			const left = Math.min(selectionRect.startX, selectionRect.currentX);
			const right = Math.max(selectionRect.startX, selectionRect.currentX);
			const top = Math.min(selectionRect.startY, selectionRect.currentY);
			const bottom = Math.max(selectionRect.startY, selectionRect.currentY);

			// Only select if the rectangle has meaningful size
			if (right - left > 5 || bottom - top > 5) {
				const enclosed = canvasItems.filter((item) => {
					const itemRight = item.x + item.width;
					const itemBottom = item.y + item.height;
					return (
						item.x >= left &&
						item.y >= top &&
						itemRight <= right &&
						itemBottom <= bottom
					);
				});
				if (enclosed.length > 0) {
					setSelectedItemIds(enclosed.map((i) => i.id));
				}
			}
			setSelectionRect(null);
		}

		setDragging(null);
		setResizing(null);
	}, [selectionRect, canvasItems, setSelectedItemIds]);

	// Compute selection rectangle for rendering
	const selectionRectStyle = selectionRect
		? {
				left: Math.min(selectionRect.startX, selectionRect.currentX),
				top: Math.min(selectionRect.startY, selectionRect.currentY),
				width: Math.abs(selectionRect.currentX - selectionRect.startX),
				height: Math.abs(selectionRect.currentY - selectionRect.startY),
			}
		: null;

	return (
		<div
			ref={canvasRef}
			role="application"
			className="absolute inset-0 overflow-auto cursor-default"
			onMouseMove={handleMouseMove}
			onMouseUp={handleMouseUp}
			onMouseLeave={handleMouseUp}
			onMouseDown={handleCanvasMouseDown}
			onContextMenu={(event) => event.preventDefault()}
		>
			<div
				className="relative"
				style={{
					width: 3000,
					height: 2000,
					minWidth: "100%",
					minHeight: "100%",
					transform: `scale(${zoom})`,
					transformOrigin: "0 0",
				}}
			>
				{/* Dot grid */}
				<div
					className="absolute inset-0 opacity-[0.15]"
					style={{
						backgroundImage:
							"radial-gradient(circle, #000 0.5px, transparent 0.5px)",
						backgroundSize: "24px 24px",
					}}
				/>

				{canvasItems.length === 0 && (
					<div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-40">
						<div className="w-20 h-20 mb-5 rounded-2xl bg-black/5 flex items-center justify-center">
							<HugeiconsIcon
								icon={Image01Icon}
								className="size-8 text-black/30"
							/>
						</div>
						<h2 className="text-lg font-medium text-black/60 mb-1">
							No items on canvas
						</h2>
						<p className="text-sm text-black/40 text-center max-w-xs">
							Use the chat to generate images or type a prompt to get started.
						</p>
					</div>
				)}

				{canvasItems.map((item) => {
					const isSelected = selectedItemIds.includes(item.id);

					return (
						// biome-ignore lint/a11y/useSemanticElements: canvas items need div for complex layout
						<div
							key={item.id}
							role="button"
							tabIndex={0}
							className={cn(
								"absolute select-none group",
								dragging?.id === item.id
									? "cursor-grabbing z-50"
									: "cursor-grab z-10",
							)}
							style={{
								left: item.x,
								top: item.y,
								width: item.width,
								height: item.type === "text" ? "auto" : item.height,
							}}
							onMouseDown={(event) => handleItemMouseDown(event, item.id)}
							onContextMenu={(event) => handleContextMenu(event, item.id)}
							onKeyDown={(event) => {
								if (event.key === "Enter" || event.key === " ") {
									event.preventDefault();
								}
							}}
						>
							{item.type === "image" && item.url && (
								<div className="rounded-2xl overflow-hidden shadow-xl border border-black/5 bg-white hover:shadow-2xl transition-shadow w-full h-full">
									{/* biome-ignore lint/performance/noImgElement: dynamic external URLs */}
									<img
										src={item.url}
										alt={item.prompt ?? "Generated image"}
										className="w-full h-full object-cover pointer-events-none"
										draggable={false}
									/>
									<div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
										<p className="text-white text-xs line-clamp-2">
											{item.prompt}
										</p>
									</div>
								</div>
							)}

							{item.type === "text" && (
								<div className="rounded-xl bg-white shadow-lg border border-black/5 p-5 hover:shadow-xl transition-shadow">
									{item.title && (
										<h3 className="font-semibold text-sm text-black/90 mb-2">
											{item.title}
										</h3>
									)}
									{item.content && (
										<p className="text-xs text-black/60 leading-relaxed">
											{item.content}
										</p>
									)}
								</div>
							)}

							{item.type === "video" && (
								<div
									className="rounded-2xl overflow-hidden shadow-xl border border-black/5 bg-black/90 flex items-center justify-center hover:shadow-2xl transition-shadow"
									style={{ height: item.height }}
								>
									<HugeiconsIcon
										icon={Video01Icon}
										className="size-10 text-white/40"
									/>
									<span className="absolute bottom-3 left-3 text-white/70 text-xs">
										{item.prompt ?? "Video"}
									</span>
								</div>
							)}

							{/* Selection indicator + resize handles */}
							{isSelected && (
								<>
									<div
										className="absolute inset-0 border-2 border-blue-500 rounded-2xl pointer-events-none"
										style={{ margin: -2 }}
									/>
									{(["nw", "ne", "sw", "se"] as const).map((handle) => (
										<button
											key={handle}
											type="button"
											aria-label={`Resize ${handle}`}
											className="absolute w-3 h-3 bg-white border-2 border-blue-500 rounded-sm z-50 p-0"
											style={{
												...(handle.includes("n")
													? { top: -6 }
													: { bottom: -6 }),
												...(handle.includes("w")
													? { left: -6 }
													: { right: -6 }),
												cursor: `${handle}-resize`,
											}}
											onMouseDown={(event) =>
												handleResizeMouseDown(event, item.id, handle)
											}
										/>
									))}
									{/* Edge handles (visual only, midpoints) */}
									<div
										className="absolute w-3 h-3 bg-white border-2 border-blue-500 rounded-sm pointer-events-none"
										style={{ top: -6, left: "calc(50% - 6px)" }}
									/>
									<div
										className="absolute w-3 h-3 bg-white border-2 border-blue-500 rounded-sm pointer-events-none"
										style={{ bottom: -6, left: "calc(50% - 6px)" }}
									/>
									<div
										className="absolute w-3 h-3 bg-white border-2 border-blue-500 rounded-sm pointer-events-none"
										style={{ left: -6, top: "calc(50% - 6px)" }}
									/>
									<div
										className="absolute w-3 h-3 bg-white border-2 border-blue-500 rounded-sm pointer-events-none"
										style={{ right: -6, top: "calc(50% - 6px)" }}
									/>
								</>
							)}
						</div>
					);
				})}

				{/* Selection rectangle */}
				{selectionRectStyle && selectionRectStyle.width > 2 && (
					<div
						className="absolute border-2 border-dashed border-blue-500 bg-blue-500/10 pointer-events-none z-40"
						style={selectionRectStyle}
					/>
				)}
			</div>
		</div>
	);
}

function ContextMenuOverlay({
	contextMenu,
	onClose,
	onDuplicate,
	onDelete,
	onBringToFront,
	onSendToBack,
	onSendToChat,
}: {
	contextMenu: NonNullable<ContextMenuState>;
	onClose: () => void;
	onDuplicate: (ids: string[]) => void;
	onDelete: (ids: string[]) => void;
	onBringToFront: (ids: string[]) => void;
	onSendToBack: (ids: string[]) => void;
	onSendToChat: (ids: string[]) => void;
}) {
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		function handleClick(event: MouseEvent) {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
				onClose();
			}
		}
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, [onClose]);

	const menuItems = [
		{
			label: "Send to Chat",
			action: () => {
				onSendToChat(contextMenu.itemIds);
				onClose();
			},
		},
		{
			label: "Duplicate",
			action: () => {
				onDuplicate(contextMenu.itemIds);
				onClose();
			},
		},
		{
			label: "Delete",
			action: () => {
				onDelete(contextMenu.itemIds);
				onClose();
			},
		},
		{ label: "divider", action: () => {} },
		{
			label: "Bring to Front",
			action: () => {
				onBringToFront(contextMenu.itemIds);
				onClose();
			},
		},
		{
			label: "Send to Back",
			action: () => {
				onSendToBack(contextMenu.itemIds);
				onClose();
			},
		},
	];

	return (
		<div
			ref={menuRef}
			className="fixed z-50 w-48 bg-white rounded-xl shadow-xl border border-black/10 py-1.5"
			style={{ left: contextMenu.x, top: contextMenu.y }}
		>
			{menuItems.map((menuItem) =>
				menuItem.label === "divider" ? (
					<div key="divider" className="h-px bg-black/5 my-1" />
				) : (
					<button
						key={menuItem.label}
						type="button"
						onClick={menuItem.action}
						className="w-full flex items-center px-3 py-2 text-sm text-black/70 hover:bg-black/5 transition-colors text-left"
					>
						{menuItem.label}
					</button>
				),
			)}
		</div>
	);
}

// Chat modes
const CHAT_MODES = [
	{ id: "create", label: "Create", icon: CreateIcon },
	{ id: "brainstorm", label: "Brainstorm", icon: BrainstormIcon },
] as const;

type ChatMode = (typeof CHAT_MODES)[number]["id"];

function ImageChatPanel({
	isOpen,
	onClose,
	onAddImage,
	canvasItems,
	selectedItemIds,
	pendingAttachments,
	onClearPendingAttachments,
	onRemovePendingAttachment,
}: {
	isOpen: boolean;
	onClose: () => void;
	onAddImage: (item: Omit<CanvasItem, "id" | "x" | "y">) => void;
	canvasItems: CanvasItem[];
	selectedItemIds: string[];
	pendingAttachments: ChatAttachment[];
	onClearPendingAttachments: () => void;
	onRemovePendingAttachment: (id: string) => void;
}) {
	const editor = useEditor();
	const [message, setMessage] = useState("");
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [chatMode, setChatMode] = useState<ChatMode>("create");
	const [showModeDropdown, setShowModeDropdown] = useState(false);
	const [showChatDropdown, setShowChatDropdown] = useState(false);
	const [activeChatName, setActiveChatName] = useState("");
	const [chatSessions, setChatSessions] = useState<string[]>([]);
	const [isGenerating, setIsGenerating] = useState(false);
	const [activeToolSteps, setActiveToolSteps] = useState<ToolStep[]>([]);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const modeDropdownRef = useRef<HTMLDivElement>(null);
	const chatDropdownRef = useRef<HTMLDivElement>(null);

	const [projectName, setProjectName] = useState("Untitled");
	const chatNameInitialized = useRef(false);
	useEffect(() => {
		const updateName = () => {
			const project = editor.project.getActiveOrNull();
			if (project) {
				const name = project.metadata.name;
				setProjectName(name);
				if (!chatNameInitialized.current) {
					chatNameInitialized.current = true;
					setActiveChatName(name);
				}
			}
		};
		updateName();
		const unsub = editor.project.subscribe(updateName);
		return unsub;
	}, [editor]);

	// No auto-inject — pending attachments are shown above the input and sent with the next message

	// Close dropdowns on outside click
	useEffect(() => {
		function handleClick(event: MouseEvent) {
			if (
				modeDropdownRef.current &&
				!modeDropdownRef.current.contains(event.target as Node)
			) {
				setShowModeDropdown(false);
			}
			if (
				chatDropdownRef.current &&
				!chatDropdownRef.current.contains(event.target as Node)
			) {
				setShowChatDropdown(false);
			}
		}
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new messages
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages.length, activeToolSteps.length]);

	const sendToRealApi = useCallback(
		async (conversationHistory: Array<{ role: string; content: string }>) => {
			// Build canvas context so the AI knows what's on the canvas
			const canvasContext =
				canvasItems.length > 0
					? `\nCanvas has ${canvasItems.length} item(s): ${canvasItems.map((i) => `${i.type}("${i.prompt ?? i.title ?? i.content ?? "untitled"}")`).join(", ")}.${selectedItemIds.length > 0 ? ` Selected: ${selectedItemIds.length} item(s).` : ""}`
					: "";

			const response = await fetch("/api/ai/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					messages: [
						{
							role: "system",
							content: `You are a creative AI assistant for Grace Studio's image canvas. You help users create, edit, and brainstorm visual content. When users share images from their canvas, describe what you observe and suggest improvements or creative directions. In Create mode, generate images from descriptions. Be concise, creative, and visual in your responses.${canvasContext}`,
						},
						...conversationHistory,
					],
					provider: "anthropic",
					tools: [],
				}),
			});

			if (!response.ok) {
				throw new Error(`API returned ${response.status}`);
			}

			const data = await response.json();
			return data.content ?? data.message ?? data.text ?? JSON.stringify(data);
		},
		[canvasItems, selectedItemIds],
	);

	const mockResponse = useCallback(
		(trimmed: string, mode: ChatMode): Promise<string> => {
			return new Promise((resolve) => {
				if (mode === "create") {
					setTimeout(() => {
						resolve(
							"I've created the image based on your description. It's been added to your canvas -- you can drag it around to position it where you'd like.\n\nWhat's the story you want to tell?",
						);
					}, 1200);
				} else {
					setTimeout(() => {
						resolve(
							`Here are some ideas based on "${trimmed}":\n\n1. Try a cinematic wide shot with dramatic lighting\n2. Consider adding depth with foreground elements\n3. Use a complementary color palette for visual impact`,
						);
					}, 1500);
				}
			});
		},
		[],
	);

	// Poll a generation job until completion
	const pollGenerationJob = useCallback(
		async (jobId: string, prompt: string): Promise<string | undefined> => {
			const maxAttempts = 60; // 2 minutes max
			for (let attempt = 0; attempt < maxAttempts; attempt++) {
				try {
					const resp = await fetch(`/api/ai/jobs/${jobId}`);
					if (!resp.ok) return undefined;
					const job = await resp.json();

					if (job.status === "completed") {
						const outputData = job.output_data ?? job.output ?? {};
						const urls =
							outputData.output ??
							outputData.image_urls ??
							outputData.urls ??
							[];
						const imageUrl = Array.isArray(urls)
							? urls[0]
							: (outputData.output_url ?? undefined);
						if (imageUrl) {
							onAddImage({
								type: "image",
								url: imageUrl,
								prompt,
								width: 500,
								height: 375,
							});
							return imageUrl as string;
						}
						return undefined;
					}

					if (job.status === "failed") {
						toast.error(job.error_message ?? "Image generation failed");
						return undefined;
					}

					// Still processing — update progress step
					const progress = job.progress
						? `${Math.round(job.progress * 100)}%`
						: undefined;
					setActiveToolSteps((prev) => {
						const updated = [...prev];
						const genStep = updated.find((s) => s.id === "2");
						if (genStep && progress) {
							genStep.label = `Generating image... ${progress}`;
						}
						return updated;
					});
				} catch {
					// Network error during poll — continue
				}
				await new Promise((resolve) => setTimeout(resolve, 2000));
			}
			return undefined;
		},
		[onAddImage],
	);

	const handleSubmit = useCallback(async () => {
		const trimmed = message.trim();
		if (!trimmed && pendingAttachments.length === 0) return;
		if (isGenerating) return;

		// Capture and clear pending attachments
		const attachments = [...pendingAttachments];
		onClearPendingAttachments();

		// Build user message content with attachment context
		let userContent = trimmed;
		if (attachments.length > 0 && !trimmed) {
			userContent = `Here are ${attachments.length} item${attachments.length !== 1 ? "s" : ""} from the canvas:`;
		}

		setMessages((prev) => [
			...prev,
			{
				id: crypto.randomUUID(),
				role: "user",
				content: userContent,
				attachments: attachments.length > 0 ? attachments : undefined,
			},
		]);
		setMessage("");

		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
		}

		setIsGenerating(true);

		if (chatMode === "create") {
			// CREATE MODE: Generate a real image via the generation API
			setActiveToolSteps([
				{ id: "1", label: "Analyzed your request", status: "running" },
			]);

			try {
				// Step 1: Send generation request
				const genResp = await fetch("/api/ai/generate-image", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						prompt: trimmed || "creative image",
						width: 1024,
						height: 768,
						provider: "replicate",
						model: "flux-schnell",
					}),
				});
				const genData = await genResp.json();

				setActiveToolSteps([
					{
						id: "1",
						label: "Analyzed your request",
						status: "done",
						duration: "1s",
					},
					{ id: "2", label: "Generating image...", status: "running" },
				]);

				let imageUrl: string | undefined;

				if (genData.status === "completed" && genData.imageUrl) {
					// FLUX Schnell returned immediately via Prefer: wait
					imageUrl = genData.imageUrl as string;
					onAddImage({
						type: "image",
						url: imageUrl,
						prompt: trimmed || "generated image",
						width: 500,
						height: 375,
					});
				} else if (genData.status === "mock" && genData.mockImageUrl) {
					// No API token — mock fallback
					imageUrl = genData.mockImageUrl as string;
					onAddImage({
						type: "image",
						url: imageUrl,
						prompt: trimmed || "generated image",
						width: 500,
						height: 375,
					});
				} else if (genData.jobId) {
					// Async mode — poll for completion
					imageUrl = await pollGenerationJob(
						genData.jobId,
						trimmed || "generated image",
					);
				}

				const toolStepsDone: ToolStep[] = [
					{
						id: "1",
						label: "Analyzed your request",
						status: "done",
						duration: "1s",
					},
					{
						id: "2",
						label: imageUrl ? "Generated image" : "Generation failed",
						status: "done",
						duration: "done",
					},
				];

				setActiveToolSteps(toolStepsDone);

				const assistantContent = imageUrl
					? "I've created the image and added it to your canvas. You can drag it to reposition and use the handles to resize.\n\nWhat would you like to do next?"
					: "I wasn't able to generate the image. The API might be unavailable — please check that the backend is running.";

				setMessages((prev) => [
					...prev,
					{
						id: crypto.randomUUID(),
						role: "assistant",
						content: assistantContent,
						toolSteps: toolStepsDone,
						attachments: imageUrl
							? [
									{
										id: crypto.randomUUID(),
										type: "image",
										url: imageUrl,
										prompt: trimmed,
									},
								]
							: undefined,
					},
				]);

				if (imageUrl) {
					toast.success("Image added to canvas");
				}
			} catch {
				// Total fallback — mock image
				const seed = Math.random().toString(36).substring(7);
				const imageUrl = `https://picsum.photos/seed/${seed}/800/600`;
				onAddImage({
					type: "image",
					url: imageUrl,
					prompt: trimmed || "generated image",
					width: 500,
					height: 375,
				});

				setMessages((prev) => [
					...prev,
					{
						id: crypto.randomUUID(),
						role: "assistant",
						content:
							"I've created a placeholder image (API unavailable). It's been added to your canvas.",
						toolSteps: [
							{
								id: "1",
								label: "Created placeholder",
								status: "done",
								duration: "1s",
							},
						],
					},
				]);
				toast.success("Placeholder added to canvas");
			}
		} else {
			// BRAINSTORM MODE: Real AI chat, no image generation
			setActiveToolSteps([{ id: "1", label: "Thinking", status: "running" }]);

			let apiContent = userContent;
			if (attachments.length > 0) {
				const attachmentDesc = attachments
					.map(
						(a, idx) =>
							`${idx + 1}. ${a.type}: "${a.prompt ?? a.title ?? "untitled"}"`,
					)
					.join("\n");
				apiContent = `${userContent}\n\n[Attached from canvas:\n${attachmentDesc}]`;
			}

			const conversationHistory = [
				...messages.map((m) => ({ role: m.role, content: m.content })),
				{ role: "user", content: apiContent },
			];

			let responseText: string;
			try {
				responseText = await sendToRealApi(conversationHistory);
			} catch {
				responseText = await mockResponse(
					trimmed || "describe these items",
					chatMode,
				);
			}

			const toolStepsDone: ToolStep[] = [
				{ id: "1", label: "Thinking", status: "done", duration: "1s" },
			];

			setActiveToolSteps(toolStepsDone);
			setMessages((prev) => [
				...prev,
				{
					id: crypto.randomUUID(),
					role: "assistant",
					content: responseText,
					toolSteps: toolStepsDone,
				},
			]);
		}

		setActiveToolSteps([]);
		setIsGenerating(false);
	}, [
		message,
		isGenerating,
		chatMode,
		messages,
		pendingAttachments,
		onAddImage,
		onClearPendingAttachments,
		sendToRealApi,
		mockResponse,
		pollGenerationJob,
	]);

	const handleKeyDown = (event: React.KeyboardEvent) => {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			handleSubmit();
		}
	};

	const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
		setMessage(event.target.value);
		const textarea = event.target;
		textarea.style.height = "auto";
		textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
	};

	const handleNewChat = () => {
		setMessages([]);
		setActiveChatName("New Chat");
		setShowChatDropdown(false);
	};

	const handleAddChat = () => {
		const name = `Chat ${chatSessions.length + 1}`;
		setChatSessions((prev) => [...prev, name]);
		setMessages([]);
		setActiveChatName(name);
		setShowChatDropdown(false);
	};

	const handleSelectChat = (name: string) => {
		setActiveChatName(name);
		setShowChatDropdown(false);
	};

	if (!isOpen) return null;

	const ActiveModeIcon =
		CHAT_MODES.find((m) => m.id === chatMode)?.icon ?? CreateIcon;

	return (
		<div
			className="absolute top-4 right-4 z-30 w-[380px] flex flex-col"
			style={{ height: "calc(100% - 80px)" }}
		>
			<div
				className="bg-white rounded-3xl shadow-2xl border border-black/10 flex flex-col overflow-hidden h-full"
				style={{
					boxShadow: "0 8px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
				}}
			>
				{/* Header */}
				<div className="relative h-[52px] shrink-0 flex items-center justify-between px-5">
					<div ref={chatDropdownRef} className="relative">
						<button
							type="button"
							onClick={() => setShowChatDropdown((prev) => !prev)}
							className="flex items-center gap-1 text-sm font-semibold text-black/90 hover:bg-black/5 rounded-full px-2 py-1 transition-colors"
						>
							<span>{activeChatName || projectName}</span>
							<HugeiconsIcon
								icon={ArrowDown01Icon}
								className="size-2.5 text-black/40"
							/>
						</button>

						{showChatDropdown && (
							<div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-xl shadow-xl border border-black/10 py-1.5 z-50">
								<button
									type="button"
									onClick={handleAddChat}
									className="w-full flex items-center gap-2 px-3 py-2 text-sm text-black/70 hover:bg-black/5 transition-colors"
								>
									<span className="text-black/40">+</span>
									<span>Add Chat</span>
									<span className="ml-auto text-[10px] text-black/30 font-mono">
										{"\u2318'"}
									</span>
								</button>
								<div className="h-px bg-black/5 my-1" />
								<button
									type="button"
									onClick={handleNewChat}
									className={cn(
										"w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-black/5 transition-colors",
										activeChatName === "New Chat"
											? "text-black font-medium"
											: "text-black/70",
									)}
								>
									{activeChatName === "New Chat" && <CheckIcon />}
									<span className={activeChatName !== "New Chat" ? "ml-5" : ""}>
										New Chat
									</span>
								</button>
								{projectName !== "Untitled" && (
									<button
										type="button"
										onClick={() => handleSelectChat(projectName)}
										className={cn(
											"w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-black/5 transition-colors",
											activeChatName === projectName
												? "text-black font-medium"
												: "text-black/70",
										)}
									>
										{activeChatName === projectName && <CheckIcon />}
										<span
											className={activeChatName !== projectName ? "ml-5" : ""}
										>
											{projectName}
										</span>
									</button>
								)}
								{chatSessions
									.filter((s) => s !== "New Chat" && s !== projectName)
									.map((session) => (
										<button
											key={session}
											type="button"
											onClick={() => handleSelectChat(session)}
											className={cn(
												"w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-black/5 transition-colors",
												activeChatName === session
													? "text-black font-medium"
													: "text-black/70",
											)}
										>
											{activeChatName === session && <CheckIcon />}
											<span
												className={activeChatName !== session ? "ml-5" : ""}
											>
												{session}
											</span>
										</button>
									))}
							</div>
						)}
					</div>
					<button
						type="button"
						onClick={onClose}
						className="flex items-center justify-center size-8 rounded-full hover:bg-black/5 transition-colors text-black/60"
					>
						<MinusIcon />
					</button>
				</div>

				{/* Messages area */}
				<div className="flex-1 min-h-0 overflow-y-auto">
					{messages.length === 0 && activeToolSteps.length === 0 ? (
						<div className="flex items-center justify-center h-full text-xs text-black/30">
							<span>No messages</span>
						</div>
					) : (
						<div className="px-4 pb-4 space-y-3">
							{messages.map((msg) => (
								<div key={msg.id}>
									{msg.role === "assistant" && msg.toolSteps && (
										<div className="mb-2 space-y-1">
											{msg.toolSteps.map((step) => (
												<div
													key={step.id}
													className="flex items-center gap-2 text-xs text-black/40"
												>
													{step.status === "running" ? (
														<div className="size-3 rounded-full border border-black/20 border-t-black/60 animate-spin" />
													) : (
														<div className="size-3 rounded-full bg-black/10 flex items-center justify-center">
															<CheckSmallIcon />
														</div>
													)}
													<span>{step.label}</span>
													{step.duration && (
														<span className="text-black/20">
															{step.duration}
														</span>
													)}
												</div>
											))}
										</div>
									)}
									<div
										className={cn(
											"max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap",
											msg.role === "user"
												? "ml-auto bg-black text-white"
												: "mr-auto text-black/80",
										)}
									>
										{msg.content}
									</div>
									{/* Attached images/items shown below text */}
									{msg.attachments && msg.attachments.length > 0 && (
										<div
											className={cn(
												"flex flex-wrap gap-1.5 mt-1.5",
												msg.role === "user" ? "justify-end" : "justify-start",
											)}
										>
											{msg.attachments.map((attachment) => (
												<div
													key={attachment.id}
													className="rounded-xl overflow-hidden border border-black/10 bg-white shadow-sm"
												>
													{attachment.type === "image" && attachment.url ? (
														<div className="w-[140px]">
															{/* biome-ignore lint/performance/noImgElement: dynamic canvas URLs */}
															<img
																src={attachment.url}
																alt={attachment.prompt ?? "Canvas image"}
																className="w-full h-[100px] object-cover"
																draggable={false}
															/>
															<p className="text-[10px] text-black/50 px-2 py-1 truncate">
																{attachment.prompt ?? "Image"}
															</p>
														</div>
													) : (
														<div className="px-3 py-2 max-w-[140px]">
															<p className="text-[10px] font-medium text-black/70 truncate">
																{attachment.type === "text"
																	? attachment.title
																	: (attachment.prompt ?? "Item")}
															</p>
														</div>
													)}
												</div>
											))}
										</div>
									)}
									{msg.role === "assistant" && (
										<div className="flex items-center gap-1 mt-1.5">
											<button
												type="button"
												className="flex items-center justify-center size-6 rounded-full text-black/20 hover:text-black/50 hover:bg-black/5 transition-colors"
												title="Good response"
											>
												<HugeiconsIcon
													icon={ThumbsUpIcon}
													className="size-3.5"
												/>
											</button>
											<button
												type="button"
												className="flex items-center justify-center size-6 rounded-full text-black/20 hover:text-black/50 hover:bg-black/5 transition-colors"
												title="Bad response"
											>
												<HugeiconsIcon
													icon={ThumbsDownIcon}
													className="size-3.5"
												/>
											</button>
										</div>
									)}
								</div>
							))}

							{/* Active tool steps (while generating) */}
							{activeToolSteps.length > 0 && (
								<div className="space-y-1">
									{activeToolSteps.map((step) => (
										<div
											key={step.id}
											className="flex items-center gap-2 text-xs text-black/40"
										>
											{step.status === "running" ? (
												<div className="size-3 rounded-full border border-black/20 border-t-black/60 animate-spin" />
											) : (
												<div className="size-3 rounded-full bg-black/10 flex items-center justify-center">
													<CheckSmallIcon />
												</div>
											)}
											<span>{step.label}</span>
											{step.duration && (
												<span className="text-black/20">{step.duration}</span>
											)}
										</div>
									))}
								</div>
							)}
							<div ref={messagesEndRef} />
						</div>
					)}
				</div>

				{/* Input */}
				<div className="px-2 pb-2 shrink-0">
					<div className="w-full flex flex-col bg-black/[0.04] rounded-[18px] ring-1 ring-inset ring-black/[0.06] overflow-hidden">
						{/* Pending attachments preview */}
						{pendingAttachments.length > 0 && (
							<div className="flex flex-wrap gap-1.5 px-3 pt-3">
								{pendingAttachments.map((attachment) => (
									<div
										key={attachment.id}
										className="relative rounded-lg overflow-hidden border border-black/10 bg-white shadow-sm group/att"
									>
										{attachment.type === "image" && attachment.url ? (
											<div className="w-[80px]">
												{/* biome-ignore lint/performance/noImgElement: dynamic canvas URLs */}
												<img
													src={attachment.url}
													alt={attachment.prompt ?? "Attached image"}
													className="w-full h-[60px] object-cover"
													draggable={false}
												/>
											</div>
										) : (
											<div className="px-2 py-1.5 w-[80px]">
												<p className="text-[9px] text-black/60 truncate">
													{attachment.prompt ?? attachment.title ?? "Item"}
												</p>
											</div>
										)}
										<button
											type="button"
											onClick={() => onRemovePendingAttachment(attachment.id)}
											className="absolute top-0.5 right-0.5 size-4 rounded-full bg-black/60 text-white flex items-center justify-center text-[10px] opacity-0 group-hover/att:opacity-100 transition-opacity"
										>
											×
										</button>
									</div>
								))}
							</div>
						)}
						<div className="w-full">
							<textarea
								ref={textareaRef}
								value={message}
								onChange={handleInput}
								onKeyDown={handleKeyDown}
								placeholder="What do you want to do?"
								rows={1}
								className="w-full px-3.5 py-3 bg-transparent text-sm resize-none outline-none placeholder:text-black/30 min-h-[40px] max-h-[120px]"
								style={{ fieldSizing: "content" }}
								disabled={isGenerating}
							/>
						</div>
						<div className="flex items-center justify-between w-full pb-1.5 pl-2.5 pr-1.5">
							{/* Mode selector */}
							<div ref={modeDropdownRef} className="relative">
								<button
									type="button"
									onClick={() => setShowModeDropdown((prev) => !prev)}
									className="flex items-center gap-1.5 h-6 px-2 rounded-full text-xs text-black/40 hover:bg-black/5 transition-colors"
								>
									<ActiveModeIcon />
									<span>
										{CHAT_MODES.find((m) => m.id === chatMode)?.label}
									</span>
									<UpDownIcon />
								</button>

								{showModeDropdown && (
									<div className="absolute bottom-full left-0 mb-1 w-40 bg-white rounded-xl shadow-xl border border-black/10 py-1.5 z-50">
										{CHAT_MODES.map((mode) => (
											<button
												key={mode.id}
												type="button"
												onClick={() => {
													setChatMode(mode.id);
													setShowModeDropdown(false);
												}}
												className={cn(
													"w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-black/5 transition-colors",
													chatMode === mode.id
														? "text-black font-medium"
														: "text-black/70",
												)}
											>
												<mode.icon />
												<span>{mode.label}</span>
												{chatMode === mode.id && (
													<span className="ml-auto">
														<CheckIcon />
													</span>
												)}
											</button>
										))}
									</div>
								)}
							</div>

							<div className="flex items-center gap-0.5">
								<button
									type="button"
									className="flex items-center justify-center size-9 rounded-full text-black/70 hover:bg-black/5 transition-colors"
								>
									<HugeiconsIcon icon={Mic01Icon} className="size-4" />
								</button>
								<button
									type="button"
									onClick={handleSubmit}
									disabled={!message.trim() || isGenerating}
									className={cn(
										"flex items-center justify-center size-9 rounded-full transition-colors",
										message.trim() && !isGenerating
											? "bg-black text-white hover:bg-black/85"
											: "text-black/20 cursor-default",
									)}
								>
									<HugeiconsIcon icon={ArrowUp02Icon} className="size-4" />
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

function BottomToolbar({
	activeTool,
	onToolChange,
}: {
	activeTool: ToolId;
	onToolChange: (tool: ToolId) => void;
}) {
	const tools = [
		{ id: "cursor" as ToolId, icon: Cursor02Icon, label: "Select" },
		{ id: "image" as ToolId, icon: Image01Icon, label: "Image" },
		{ id: "video" as ToolId, icon: Video01Icon, label: "Video" },
		{ id: "audio" as ToolId, icon: AudioWave01Icon, label: "Audio" },
		{ id: "crop" as ToolId, icon: CropIcon, label: "Crop" },
		{ id: "pen" as ToolId, icon: PenTool01Icon, label: "Draw" },
		{ id: "text" as ToolId, icon: TextFontIcon, label: "Text" },
		{ id: "layout" as ToolId, icon: Layout01Icon, label: "Layout" },
		{ id: "record" as ToolId, icon: RecordIcon, label: "Record" },
		{ id: "add" as ToolId, icon: PlusSignCircleIcon, label: "Add" },
	];

	return (
		<div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
			<div className="flex items-center gap-0.5 bg-white rounded-full px-2 py-1.5 shadow-lg border border-black/5">
				{tools.map((tool) => (
					<button
						key={tool.id}
						type="button"
						onClick={() => onToolChange(tool.id)}
						className={cn(
							"flex items-center justify-center size-10 rounded-full transition-colors",
							activeTool === tool.id
								? "bg-black text-white"
								: "text-black/50 hover:bg-black/5 hover:text-black/70",
						)}
						title={tool.label}
					>
						<HugeiconsIcon icon={tool.icon} className="size-[18px]" />
					</button>
				))}
			</div>
		</div>
	);
}

function ZoomControls({
	zoom,
	onZoomIn,
	onZoomOut,
}: {
	zoom: number;
	onZoomIn: () => void;
	onZoomOut: () => void;
}) {
	const displayPercent = Math.round(zoom * 100);

	return (
		<div className="absolute bottom-4 left-4 z-20 flex items-center gap-2">
			<button
				type="button"
				onClick={onZoomOut}
				className="flex items-center justify-center size-7 rounded-full hover:bg-black/5 transition-colors text-black/50"
			>
				<MinusThinIcon />
			</button>
			<span className="text-xs font-medium text-black/50 min-w-[36px] text-center tabular-nums">
				{displayPercent}%
			</span>
			<button
				type="button"
				onClick={onZoomIn}
				className="flex items-center justify-center size-7 rounded-full hover:bg-black/5 transition-colors text-black/50"
			>
				<PlusThinIcon />
			</button>
		</div>
	);
}

function BottomRightActions({
	projectId,
	chatOpen,
	onToggleChat,
}: {
	projectId: string;
	chatOpen: boolean;
	onToggleChat: () => void;
}) {
	return (
		<div className="absolute bottom-4 right-4 z-20">
			<div className="flex items-center bg-white rounded-full shadow-md border border-black/5">
				{/* Chat toggle */}
				<button
					type="button"
					onClick={onToggleChat}
					className={cn(
						"flex items-center justify-center size-12 rounded-l-full transition-colors",
						chatOpen
							? "bg-black/5 text-black/80"
							: "text-black/50 hover:bg-black/5",
					)}
					title="Toggle chat"
				>
					<HugeiconsIcon icon={Chatting01Icon} className="size-[18px]" />
				</button>
				{/* Video editor link */}
				<Link href={`/editor/${projectId}`}>
					<button
						type="button"
						className="flex items-center justify-center size-12 rounded-r-full text-black/50 hover:bg-black/5 hover:text-black/80 transition-colors"
						title="Open video editor"
					>
						<HugeiconsIcon icon={Search01Icon} className="size-[18px]" />
					</button>
				</Link>
			</div>
		</div>
	);
}

// SVG Icons
function MinusIcon() {
	return (
		<svg
			width="12"
			height="2"
			viewBox="0 0 12 2"
			fill="currentColor"
			xmlns="http://www.w3.org/2000/svg"
			role="img"
			aria-label="Minimize"
		>
			<title>Minimize</title>
			<path d="M0.758789 1.53809C0.626628 1.53809 0.503581 1.50391 0.389648 1.43555C0.275716 1.36263 0.182292 1.26921 0.109375 1.15527C0.0364583 1.03678 0 0.906901 0 0.765625C0 0.628906 0.0364583 0.501302 0.109375 0.382812C0.182292 0.264323 0.275716 0.170898 0.389648 0.102539C0.503581 0.0341797 0.626628 0 0.758789 0H10.6777C10.8099 0 10.9329 0.0341797 11.0469 0.102539C11.1654 0.170898 11.2588 0.264323 11.3271 0.382812C11.4001 0.501302 11.4365 0.628906 11.4365 0.765625C11.4365 0.906901 11.4001 1.03678 11.3271 1.15527C11.2588 1.26921 11.1654 1.36263 11.0469 1.43555C10.9329 1.50391 10.8099 1.53809 10.6777 1.53809H0.758789Z" />
		</svg>
	);
}

function MinusThinIcon() {
	return (
		<svg
			width="14"
			height="2"
			viewBox="0 0 14 2"
			fill="currentColor"
			xmlns="http://www.w3.org/2000/svg"
			role="img"
			aria-label="Zoom out"
		>
			<title>Zoom out</title>
			<rect x="0" y="0" width="14" height="1.5" rx="0.75" />
		</svg>
	);
}

function PlusThinIcon() {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 14 14"
			fill="currentColor"
			xmlns="http://www.w3.org/2000/svg"
			role="img"
			aria-label="Zoom in"
		>
			<title>Zoom in</title>
			<rect x="6.25" y="0" width="1.5" height="14" rx="0.75" />
			<rect x="0" y="6.25" width="14" height="1.5" rx="0.75" />
		</svg>
	);
}

function CheckIcon() {
	return (
		<svg
			width="12"
			height="12"
			viewBox="0 0 12 12"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			role="img"
			aria-label="Selected"
		>
			<title>Selected</title>
			<path
				d="M2 6L5 9L10 3"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

function CheckSmallIcon() {
	return (
		<svg
			width="8"
			height="8"
			viewBox="0 0 8 8"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			role="img"
			aria-label="Done"
		>
			<title>Done</title>
			<path
				d="M1.5 4L3.5 6L6.5 2"
				stroke="currentColor"
				strokeWidth="1.2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

function CreateIcon() {
	return (
		<svg
			viewBox="0 0 14 14"
			fill="currentColor"
			xmlns="http://www.w3.org/2000/svg"
			className="size-3.5"
			role="img"
			aria-label="Create"
		>
			<title>Create</title>
			<path d="M6.5332 2.98242C6.37305 2.98242 6.23438 2.92578 6.11719 2.8125C6 2.69531 5.94141 2.55469 5.94141 2.39062V0.591797C5.94141 0.431641 6 0.292969 6.11719 0.175781C6.23438 0.0585938 6.37305 0 6.5332 0C6.69336 0 6.83203 0.0585938 6.94922 0.175781C7.06641 0.292969 7.125 0.431641 7.125 0.591797V2.39062C7.125 2.55469 7.06641 2.69531 6.94922 2.8125C6.83203 2.92578 6.69336 2.98242 6.5332 2.98242ZM9.04688 4.02539C8.93359 3.91211 8.87695 3.77344 8.87695 3.60938C8.87695 3.44141 8.93359 3.30078 9.04688 3.1875L10.3242 1.92188C10.4375 1.80859 10.5742 1.75195 10.7344 1.75195C10.8984 1.75195 11.0391 1.80859 11.1562 1.92188C11.2656 2.03516 11.3203 2.17383 11.3203 2.33789C11.3203 2.50195 11.2656 2.64063 11.1562 2.75391L9.87891 4.02539C9.76562 4.13867 9.62695 4.19531 9.46289 4.19531C9.29883 4.19531 9.16016 4.13867 9.04688 4.02539ZM10.0898 6.53906C10.0898 6.375 10.1484 6.23633 10.2656 6.12305C10.3828 6.00977 10.5195 5.95312 10.6758 5.95312H12.4746C12.6387 5.95312 12.7773 6.00977 12.8906 6.12305C13.0078 6.23633 13.0664 6.375 13.0664 6.53906C13.0664 6.69922 13.0078 6.83789 12.8906 6.95508C12.7773 7.06836 12.6387 7.125 12.4746 7.125H10.6758C10.5195 7.125 10.3828 7.06836 10.2656 6.95508C10.1484 6.83789 10.0898 6.69922 10.0898 6.53906ZM4.01953 9.04688C4.13281 9.16016 4.18945 9.30078 4.18945 9.46875C4.18945 9.63281 4.13281 9.77148 4.01953 9.88477L2.74805 11.1562C2.63086 11.2695 2.49023 11.3262 2.32617 11.3262C2.16602 11.3262 2.02734 11.2695 1.91016 11.1562C1.80078 11.043 1.74609 10.9043 1.74609 10.7402C1.74609 10.5762 1.80078 10.4375 1.91016 10.3242L3.1875 9.04688C3.30078 8.93359 3.43945 8.87695 3.60352 8.87695C3.76758 8.87695 3.90625 8.93359 4.01953 9.04688ZM2.97656 6.53906C2.97656 6.69922 2.91797 6.83789 2.80078 6.95508C2.68359 7.06836 2.54688 7.125 2.39062 7.125H0.585938C0.429688 7.125 0.292969 7.06836 0.175781 6.95508C0.0585938 6.83789 0 6.69922 0 6.53906C0 6.375 0.0585938 6.23633 0.175781 6.12305C0.292969 6.00977 0.429688 5.95312 0.585938 5.95312H2.39062C2.54688 5.95312 2.68359 6.00977 2.80078 6.12305C2.91797 6.23633 2.97656 6.375 2.97656 6.53906ZM4.01953 4.02539C3.90625 4.13867 3.76758 4.19531 3.60352 4.19531C3.43945 4.19531 3.30078 4.13867 3.1875 4.02539L1.91016 2.75391C1.80078 2.64063 1.74609 2.50195 1.74609 2.33789C1.74609 2.17383 1.80078 2.03516 1.91016 1.92188C2.02734 1.80859 2.16602 1.75195 2.32617 1.75195C2.49023 1.75195 2.63086 1.80859 2.74805 1.92188L4.01953 3.1875C4.13281 3.30078 4.18945 3.44141 4.18945 3.60938C4.18945 3.77344 4.13281 3.91211 4.01953 4.02539ZM9.01758 12.4688C8.87695 12.5273 8.73438 12.5273 8.58984 12.4688C8.44922 12.4141 8.35156 12.3164 8.29688 12.1758L7.46484 10.1074L6.62695 10.957C6.54492 11.0469 6.44727 11.0723 6.33398 11.0332C6.2207 10.998 6.16602 10.916 6.16992 10.7871L6.22852 6.16992C6.22852 6.05273 6.27734 5.97461 6.375 5.93555C6.47656 5.89648 6.56836 5.91992 6.65039 6.00586L9.83203 9.25195C9.91797 9.3457 9.9375 9.44336 9.89062 9.54492C9.84375 9.64258 9.75977 9.69141 9.63867 9.69141L8.43164 9.72656L9.31641 11.7598C9.375 11.9004 9.375 12.0391 9.31641 12.1758C9.25781 12.3164 9.1582 12.4141 9.01758 12.4688Z" />
		</svg>
	);
}

function BrainstormIcon() {
	return (
		<svg
			viewBox="0 0 14 14"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className="size-3.5"
			role="img"
			aria-label="Brainstorm"
		>
			<title>Brainstorm</title>
			<path
				d="M1.5 4.5h2M1.5 7h2M1.5 9.5h2M5 4.5h7.5M5 7h7.5M5 9.5h5"
				stroke="currentColor"
				strokeWidth="1.2"
				strokeLinecap="round"
			/>
		</svg>
	);
}

function UpDownIcon() {
	return (
		<svg
			viewBox="0 0 7 9"
			fill="currentColor"
			xmlns="http://www.w3.org/2000/svg"
			className="size-2 opacity-60"
			role="img"
			aria-label="Toggle"
		>
			<title>Toggle</title>
			<path d="M3.06738 0C3.14355 0 3.21387 0.0161133 3.27832 0.0483398C3.3457 0.0776367 3.41016 0.121582 3.47168 0.180176L5.97217 2.57959C6.01904 2.62646 6.05713 2.68066 6.08643 2.74219C6.11865 2.80371 6.13477 2.87256 6.13477 2.94873C6.13477 3.04834 6.11133 3.1377 6.06445 3.2168C6.01758 3.29297 5.95459 3.35303 5.87549 3.39697C5.79932 3.44092 5.71582 3.46289 5.625 3.46289C5.56348 3.46289 5.49902 3.45264 5.43164 3.43213C5.36719 3.40869 5.30713 3.36914 5.25146 3.31348L3.06738 1.17773L0.883301 3.31348C0.827637 3.37207 0.767578 3.41162 0.703125 3.43213C0.638672 3.45264 0.574219 3.46289 0.509766 3.46289C0.416016 3.46289 0.331055 3.44092 0.254883 3.39697C0.178711 3.35303 0.117188 3.29297 0.0703125 3.2168C0.0234375 3.1377 0 3.04834 0 2.94873C0 2.87256 0.0146484 2.80371 0.0439453 2.74219C0.0761719 2.68066 0.117188 2.62646 0.166992 2.57959L2.66309 0.180176C2.72461 0.121582 2.78906 0.0776367 2.85645 0.0483398C2.92383 0.0161133 2.99414 0 3.06738 0ZM3.06738 8.81543C2.99414 8.81543 2.92383 8.79932 2.85645 8.76709C2.78906 8.73779 2.72461 8.69385 2.66309 8.63525L0.166992 6.23584C0.117188 6.18604 0.0761719 6.13037 0.0439453 6.06885C0.0146484 6.00732 0 5.93848 0 5.8623C0 5.7627 0.0234375 5.6748 0.0703125 5.59863C0.117188 5.52246 0.178711 5.4624 0.254883 5.41846C0.331055 5.37451 0.416016 5.35254 0.509766 5.35254C0.574219 5.35254 0.638672 5.36279 0.703125 5.3833C0.767578 5.40381 0.827637 5.44336 0.883301 5.50195L3.06738 7.6377L5.25146 5.50195C5.30713 5.44629 5.36719 5.4082 5.43164 5.3877C5.49902 5.36426 5.56348 5.35254 5.625 5.35254C5.71582 5.35254 5.79932 5.37451 5.87549 5.41846C5.95459 5.4624 6.01758 5.52246 6.06445 5.59863C6.11133 5.6748 6.13477 5.7627 6.13477 5.8623C6.13477 5.93848 6.11865 6.00732 6.08643 6.06885C6.05713 6.13037 6.01904 6.18604 5.97217 6.23584L3.47168 8.63525C3.41016 8.69385 3.3457 8.73779 3.27832 8.76709C3.21387 8.79932 3.14355 8.81543 3.06738 8.81543Z" />
		</svg>
	);
}

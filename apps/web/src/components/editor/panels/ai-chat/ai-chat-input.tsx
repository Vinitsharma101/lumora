"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAIChatStore } from "@/stores/ai-chat-store";
import type { AIPendingContext, AttachedFile } from "@/stores/ai-chat-store";
import { useAIChat } from "@/hooks/use-ai-chat";
import { Button } from "@/components/ui/button";
import { ArrowUp, Square, X, Plus, Image, Video, Music, FileIcon, Loader2 } from "lucide-react";
import { cn } from "@/utils/ui";

function formatMediaType(type: string): string {
	const labels: Record<string, string> = {
		video: "Video",
		audio: "Audio",
		image: "Image",
		text: "Text",
		sticker: "Sticker",
	};
	return labels[type] ?? type;
}

function formatDuration(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = (seconds % 60).toFixed(1);
	return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileMediaType(mimeType: string): AttachedFile["type"] {
	if (mimeType.startsWith("image/")) return "image";
	if (mimeType.startsWith("video/")) return "video";
	if (mimeType.startsWith("audio/")) return "audio";
	return "file";
}

function getFileIcon(type: AttachedFile["type"]) {
	switch (type) {
		case "image":
			return Image;
		case "video":
			return Video;
		case "audio":
			return Music;
		default:
			return FileIcon;
	}
}

function buildContextPrefix(context: AIPendingContext): string {
	const parts: string[] = [];

	for (const element of context.elements) {
		const mediaLabel = formatMediaType(element.type);
		parts.push(
			`[${mediaLabel}: "${element.name}" at ${formatDuration(element.startTime)}, duration ${formatDuration(element.duration)}]`,
		);
	}

	if (context.selectionRange) {
		parts.push(
			`[Selection: ${formatDuration(context.selectionRange.start)} – ${formatDuration(context.selectionRange.end)}]`,
		);
	}

	return parts.join(" ");
}

function PendingContextBadges({
	context,
	onClear,
}: {
	context: AIPendingContext;
	onClear: () => void;
}) {
	const typeColors: Record<string, string> = {
		video: "bg-blue-500/20 text-blue-400 border-blue-500/30",
		audio: "bg-green-500/20 text-green-400 border-green-500/30",
		image: "bg-amber-500/20 text-amber-400 border-amber-500/30",
		text: "bg-purple-500/20 text-purple-400 border-purple-500/30",
		sticker: "bg-pink-500/20 text-pink-400 border-pink-500/30",
	};

	return (
		<div className="flex flex-wrap items-center gap-1.5 px-3 pb-1 pt-2">
			<span className="text-xs text-muted-foreground">Context:</span>
			{context.elements.map((element) => (
				<span
					key={element.id}
					className={cn(
						"inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
						typeColors[element.type] ?? "bg-muted text-muted-foreground",
					)}
				>
					{formatMediaType(element.type)}: {element.name}
				</span>
			))}
			<button
				type="button"
				onClick={onClear}
				className="ml-auto rounded-full p-0.5 text-muted-foreground hover:text-foreground"
			>
				<X className="size-3" />
			</button>
		</div>
	);
}

function AttachedFileBadges({
	files,
	onRemove,
}: {
	files: AttachedFile[];
	onRemove: (id: string) => void;
}) {
	if (files.length === 0) return null;

	const typeColors: Record<string, string> = {
		image: "bg-amber-500/15 text-amber-400 border-amber-500/25",
		video: "bg-blue-500/15 text-blue-400 border-blue-500/25",
		audio: "bg-green-500/15 text-green-400 border-green-500/25",
		file: "bg-gray-500/15 text-gray-400 border-gray-500/25",
	};

	return (
		<div className="flex flex-wrap items-center gap-1.5 px-3 pb-1 pt-2">
			<span className="text-xs text-muted-foreground">Attached:</span>
			{files.map((file) => {
				const IconComponent = getFileIcon(file.type);
				return (
					<span
						key={file.id}
						className={cn(
							"inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs",
							typeColors[file.type],
						)}
					>
						{file.status === "uploading" ? (
							<Loader2 className="size-3 animate-spin" />
						) : (
							<IconComponent className="size-3" />
						)}
						<span className="max-w-[100px] truncate">{file.name}</span>
						<span className="text-[10px] opacity-60">
							{formatFileSize(file.size)}
						</span>
						<button
							type="button"
							onClick={() => onRemove(file.id)}
							className="ml-0.5 rounded-full p-0.5 hover:bg-white/10"
						>
							<X className="size-2.5" />
						</button>
					</span>
				);
			})}
		</div>
	);
}

export function AIChatInput() {
	const [input, setInput] = useState("");
	const [isDragOver, setIsDragOver] = useState(false);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const { isStreaming, pendingContext, attachedFiles } = useAIChatStore();
	const { sendMessage, stopStreaming } = useAIChat();

	// Auto-focus input when pending context arrives
	useEffect(() => {
		if (pendingContext && textareaRef.current) {
			textareaRef.current.focus();
		}
	}, [pendingContext]);

	const handleClearContext = () => {
		useAIChatStore.getState().clearPendingContext();
	};

	const handleFileSelect = useCallback((files: FileList | File[]) => {
		const store = useAIChatStore.getState();
		const fileArray = Array.from(files);

		for (const file of fileArray) {
			const mediaType = getFileMediaType(file.type);
			const localUrl = URL.createObjectURL(file);

			const attachedFile: AttachedFile = {
				id: crypto.randomUUID(),
				name: file.name,
				type: mediaType,
				mimeType: file.type,
				size: file.size,
				localUrl,
				status: "uploaded", // Local files are ready immediately
				uploadedUrl: localUrl, // In a full implementation, this would be an API URL
			};

			store.addAttachedFile(attachedFile);
		}
	}, []);

	const handleFileInputChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			if (e.target.files && e.target.files.length > 0) {
				handleFileSelect(e.target.files);
				e.target.value = ""; // Reset so the same file can be selected again
			}
		},
		[handleFileSelect],
	);

	const handleRemoveFile = useCallback((id: string) => {
		const store = useAIChatStore.getState();
		const file = store.attachedFiles.find((f) => f.id === id);
		if (file) {
			URL.revokeObjectURL(file.localUrl);
		}
		store.removeAttachedFile(id);
	}, []);

	// Drag-and-drop handlers
	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragOver(true);
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragOver(false);
	}, []);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			setIsDragOver(false);

			if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
				handleFileSelect(e.dataTransfer.files);
			}
		},
		[handleFileSelect],
	);

	const handleSubmit = () => {
		const trimmed = input.trim();
		if (!trimmed || isStreaming) return;

		// Build context-enriched message
		let messageContent = trimmed;
		if (pendingContext && pendingContext.elements.length > 0) {
			const contextPrefix = buildContextPrefix(pendingContext);
			messageContent = `${contextPrefix}\n\n${trimmed}`;
		}

		// Add file context to message
		const currentFiles = useAIChatStore.getState().attachedFiles;
		if (currentFiles.length > 0) {
			const fileDescriptions = currentFiles
				.map((f) => `[Attached ${f.type}: "${f.name}" (${formatFileSize(f.size)})]`)
				.join(" ");
			messageContent = `${fileDescriptions}\n\n${messageContent}`;
		}

		useAIChatStore.getState().addMessage({
			id: crypto.randomUUID(),
			role: "user",
			content: trimmed,
			attachments: currentFiles.length > 0 ? [...currentFiles] : undefined,
			createdAt: new Date(),
		});

		setInput("");
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
		}

		// Clear context and files after sending
		useAIChatStore.getState().clearPendingContext();
		useAIChatStore.getState().clearAttachedFiles();

		sendMessage(messageContent);
	};

	const handleKeyDown = (event: React.KeyboardEvent) => {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			handleSubmit();
		}
	};

	const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
		setInput(event.target.value);
		const textarea = event.target;
		textarea.style.height = "auto";
		textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
	};

	const placeholderText = pendingContext
		? `Ask about the selected ${pendingContext.elements.map((element) => formatMediaType(element.type).toLowerCase()).join(", ")}...`
		: attachedFiles.length > 0
			? "Describe what to do with the attached files..."
			: "Describe your edit...";

	return (
		<div
			className={cn("border-t p-3", isDragOver && "bg-purple-500/5")}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
		>
			{/* Drag overlay */}
			{isDragOver && (
				<div className="mb-2 flex items-center justify-center rounded-lg border-2 border-dashed border-purple-500/40 bg-purple-500/5 py-3">
					<span className="text-xs text-purple-400">
						Drop files here to attach
					</span>
				</div>
			)}

			{pendingContext && pendingContext.elements.length > 0 && (
				<PendingContextBadges
					context={pendingContext}
					onClear={handleClearContext}
				/>
			)}

			<AttachedFileBadges
				files={attachedFiles}
				onRemove={handleRemoveFile}
			/>

			<div
				className={cn(
					"flex items-end gap-2 rounded-lg border bg-background px-3 py-2",
					"focus-within:ring-1 focus-within:ring-ring",
					pendingContext && "ring-1 ring-purple-500/30",
					attachedFiles.length > 0 && "ring-1 ring-amber-500/30",
				)}
			>
				{/* File upload button */}
				<Button
					size="icon"
					variant="ghost"
					className="size-7 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
					onClick={() => fileInputRef.current?.click()}
					disabled={isStreaming}
					title="Attach files (images, videos, audio)"
				>
					<Plus className="size-4" />
				</Button>
				<input
					ref={fileInputRef}
					type="file"
					multiple
					accept="image/*,video/*,audio/*"
					className="hidden"
					onChange={handleFileInputChange}
				/>

				<textarea
					ref={textareaRef}
					value={input}
					onChange={handleInput}
					onKeyDown={handleKeyDown}
					placeholder={placeholderText}
					rows={1}
					className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
					style={{ fieldSizing: "content", maxHeight: "120px" }}
					disabled={isStreaming}
				/>
				{isStreaming ? (
					<Button
						size="icon"
						className="size-7 shrink-0 rounded-full"
						onClick={stopStreaming}
						variant="destructive"
					>
						<Square className="size-3" />
					</Button>
				) : (
					<Button
						size="icon"
						className="size-7 shrink-0 rounded-full"
						onClick={handleSubmit}
						disabled={!input.trim()}
					>
						<ArrowUp className="size-3.5" />
					</Button>
				)}
			</div>
		</div>
	);
}

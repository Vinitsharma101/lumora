import { Button } from "@/components/ui/button";
import { PanelView } from "@/components/editor/panels/assets/views/base-view";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useState, useRef } from "react";
import { extractTimelineAudio } from "@/lib/media/mediabunny";
import { useEditor } from "@/hooks/use-editor";
import { DEFAULT_TEXT_ELEMENT } from "@/constants/text-constants";
import { TRANSCRIPTION_LANGUAGES } from "@/constants/transcription-constants";
import type {
	TranscriptionLanguage,
	TranscriptionProgress,
	CaptionChunk,
} from "@/types/transcription";
import { transcriptionService } from "@/services/transcription/service";
import { decodeAudioToFloat32 } from "@/lib/media/audio";
import { buildCaptionChunks } from "@/lib/transcription/caption";
import { Spinner } from "@/components/ui/spinner";
import { Label } from "@/components/ui/label";
import { CAPTION_TEMPLATES } from "@/constants/caption-templates";
import {
	CAPTION_POSITIONS,
	DEFAULT_CAPTION_POSITION,
} from "@/constants/caption-positions";
import { preloadCaptionFont } from "@/lib/fonts/caption-fonts";
import {
	exportSRT,
	exportVTT,
	importSRT,
	importVTT,
} from "@/lib/transcription/subtitle-format";
import type { TextElement } from "@/types/timeline";

export function Captions() {
	const [selectedLanguage, setSelectedLanguage] =
		useState<TranscriptionLanguage>("auto");
	const [selectedTemplate, setSelectedTemplate] = useState<string>("clean");
	const [selectedPosition, setSelectedPosition] = useState<string>(DEFAULT_CAPTION_POSITION);
	const [isProcessing, setIsProcessing] = useState(false);
	const [processingStep, setProcessingStep] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [lastChunks, setLastChunks] = useState<CaptionChunk[]>([]);
	const containerRef = useRef<HTMLDivElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const editor = useEditor();

	const getTemplateStyle = (): Partial<Omit<TextElement, "id">> => {
		const template = CAPTION_TEMPLATES.find((t) => t.id === selectedTemplate);
		return template?.style ?? {};
	};

	const getPositionY = (): number => {
		const position = CAPTION_POSITIONS.find((p) => p.id === selectedPosition);
		return position?.y ?? 350;
	};

	const handleProgress = (progress: TranscriptionProgress) => {
		if (progress.status === "loading-model") {
			setProcessingStep(`Loading model ${Math.round(progress.progress)}%`);
		} else if (progress.status === "transcribing") {
			setProcessingStep("Transcribing...");
		}
	};

	const insertCaptionChunks = async ({
		chunks,
	}: {
		chunks: CaptionChunk[];
	}) => {
		const templateStyle = getTemplateStyle();
		const positionY = getPositionY();

		if (templateStyle.fontFamily) {
			await preloadCaptionFont({ fontFamily: templateStyle.fontFamily });
		}

		const captionTrackId = editor.timeline.addTrack({
			type: "text",
			index: 0,
		});

		for (let i = 0; i < chunks.length; i++) {
			const chunk = chunks[i];

			const captionData = templateStyle.caption
				? {
						...templateStyle.caption,
						wordTimings: chunk.words,
					}
				: chunk.words
					? { wordTimings: chunk.words }
					: undefined;

			editor.timeline.insertElement({
				placement: { mode: "explicit", trackId: captionTrackId },
				element: {
					...DEFAULT_TEXT_ELEMENT,
					...templateStyle,
					name: `Caption ${i + 1}`,
					content: chunk.text,
					duration: chunk.duration,
					startTime: chunk.startTime,
					transform: {
						...DEFAULT_TEXT_ELEMENT.transform,
						position: { x: 0, y: positionY },
					},
					caption: captionData,
				},
			});
		}
	};

	const handleGenerateTranscript = async () => {
		try {
			setIsProcessing(true);
			setError(null);
			setProcessingStep("Extracting audio...");

			const audioBlob = await extractTimelineAudio({
				tracks: editor.timeline.getTracks(),
				mediaAssets: editor.media.getAssets(),
				totalDuration: editor.timeline.getTotalDuration(),
			});

			setProcessingStep("Preparing audio...");
			const { samples } = await decodeAudioToFloat32({ audioBlob });

			const result = await transcriptionService.transcribe({
				audioData: samples,
				language: selectedLanguage === "auto" ? undefined : selectedLanguage,
				onProgress: handleProgress,
			});

			setProcessingStep("Generating captions...");
			const captionChunks = buildCaptionChunks({ segments: result.segments });
			setLastChunks(captionChunks);

			await insertCaptionChunks({ chunks: captionChunks });
		} catch (error) {
			console.error("Transcription failed:", error);
			setError(
				error instanceof Error ? error.message : "An unexpected error occurred",
			);
		} finally {
			setIsProcessing(false);
			setProcessingStep("");
		}
	};

	const handleLanguageChange = ({ value }: { value: string }) => {
		if (value === "auto") {
			setSelectedLanguage("auto");
			return;
		}

		const matchedLanguage = TRANSCRIPTION_LANGUAGES.find(
			(language) => language.code === value,
		);
		if (!matchedLanguage) return;
		setSelectedLanguage(matchedLanguage.code);
	};

	const handleExport = ({ format }: { format: "srt" | "vtt" }) => {
		if (lastChunks.length === 0) return;

		const content = format === "srt"
			? exportSRT({ chunks: lastChunks })
			: exportVTT({ chunks: lastChunks });

		const blob = new Blob([content], { type: "text/plain" });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = `captions.${format}`;
		anchor.click();
		URL.revokeObjectURL(url);
	};

	const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;

		try {
			const content = await file.text();
			const isVTT = file.name.endsWith(".vtt") || content.startsWith("WEBVTT");
			const chunks = isVTT
				? importVTT({ content })
				: importSRT({ content });

			if (chunks.length === 0) {
				setError("No captions found in file");
				return;
			}

			setLastChunks(chunks);
			await insertCaptionChunks({ chunks });
		} catch {
			setError("Failed to parse subtitle file");
		}

		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	};

	return (
		<PanelView title="Captions" ref={containerRef}>
			<div className="flex flex-col gap-3">
				<Label>Style</Label>
				<div className="grid grid-cols-3 gap-2">
					{CAPTION_TEMPLATES.map((template) => (
						<button
							key={template.id}
							type="button"
							onClick={() => setSelectedTemplate(template.id)}
							className={`rounded-md border p-2 text-center text-xs transition-colors ${
								selectedTemplate === template.id
									? "border-primary bg-primary/10"
									: "border-border hover:border-primary/50"
							}`}
							style={{ backgroundColor: template.preview.backgroundColor }}
						>
							<span
								className="text-xs font-medium"
								style={{
									color: template.style.color ?? "#FFFFFF",
									fontFamily: template.style.fontFamily,
								}}
							>
								{template.preview.text}
							</span>
						</button>
					))}
				</div>
			</div>

			<div className="flex flex-col gap-3">
				<Label>Position</Label>
				<Select
					value={selectedPosition}
					onValueChange={(value) => setSelectedPosition(value)}
				>
					<SelectTrigger>
						<SelectValue placeholder="Select position" />
					</SelectTrigger>
					<SelectContent>
						{CAPTION_POSITIONS.map((position) => (
							<SelectItem key={position.id} value={position.id}>
								{position.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div className="flex flex-col gap-3">
				<Label>Language</Label>
				<Select
					value={selectedLanguage}
					onValueChange={(value) => handleLanguageChange({ value })}
				>
					<SelectTrigger>
						<SelectValue placeholder="Select a language" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="auto">Auto detect</SelectItem>
						{TRANSCRIPTION_LANGUAGES.map((language) => (
							<SelectItem key={language.code} value={language.code}>
								{language.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div className="flex flex-col gap-4">
				{error && (
					<div className="bg-destructive/10 border-destructive/20 rounded-md border p-3">
						<p className="text-destructive text-sm">{error}</p>
					</div>
				)}

				<Button
					className="w-full"
					onClick={handleGenerateTranscript}
					disabled={isProcessing}
				>
					{isProcessing && <Spinner className="mr-1" />}
					{isProcessing ? processingStep : "Generate transcript"}
				</Button>

				<div className="flex gap-2">
					<Button
						variant="outline"
						size="sm"
						className="flex-1"
						onClick={() => fileInputRef.current?.click()}
					>
						Import SRT/VTT
					</Button>
					<input
						ref={fileInputRef}
						type="file"
						accept=".srt,.vtt"
						className="hidden"
						onChange={handleImport}
					/>
					{lastChunks.length > 0 && (
						<>
							<Button
								variant="outline"
								size="sm"
								onClick={() => handleExport({ format: "srt" })}
							>
								SRT
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => handleExport({ format: "vtt" })}
							>
								VTT
							</Button>
						</>
					)}
				</div>
			</div>
		</PanelView>
	);
}

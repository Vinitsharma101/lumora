"use client";

import Image from "next/image";
import { memo, useCallback, useMemo } from "react";
import { PanelView } from "@/components/editor/panels/assets/views/base-view";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	BLUR_INTENSITY_PRESETS,
	DEFAULT_BLUR_INTENSITY,
	DEFAULT_COLOR,
	FPS_PRESETS,
} from "@/constants/project-constants";
import { patternCraftGradients } from "@/data/colors/pattern-craft";
import { colors } from "@/data/colors/solid";
import { syntaxUIGradients } from "@/data/colors/syntax-ui";
import { useEditor } from "@/hooks/use-editor";
import { useEditorStore } from "@/stores/editor-store";
import { dimensionToAspectRatio } from "@/utils/geometry";
import { cn } from "@/utils/ui";
import { Label } from "@/components/ui/label";
import {
	Section,
	SectionContent,
	SectionHeader,
} from "@/components/editor/panels/properties/section";
export function SettingsView() {
	return (
		<PanelView contentClassName="px-0" hideHeader>
			<div className="flex flex-col">
				<Section hasBorderTop={false}>
					<SectionContent>
						<ProjectInfoContent />
					</SectionContent>
				</Section>
				<Section>
					<SectionHeader title="Background" />
					<SectionContent>
						<BackgroundContent />
					</SectionContent>
				</Section>
			</div>
		</PanelView>
	);
}

function ProjectInfoContent() {
	const editor = useEditor();
	const activeProject = editor.project.getActive();
	const { canvasPresets } = useEditorStore();

	const findPresetIndexByAspectRatio = ({
		presets,
		targetAspectRatio,
	}: {
		presets: Array<{ width: number; height: number }>;
		targetAspectRatio: string;
	}) => {
		for (let index = 0; index < presets.length; index++) {
			const preset = presets[index];
			const presetAspectRatio = dimensionToAspectRatio({
				width: preset.width,
				height: preset.height,
			});
			if (presetAspectRatio === targetAspectRatio) {
				return index;
			}
		}
		return -1;
	};

	const currentCanvasSize = activeProject.settings.canvasSize;
	const currentAspectRatio = dimensionToAspectRatio(currentCanvasSize);
	const originalCanvasSize = activeProject.settings.originalCanvasSize ?? null;
	const presetIndex = findPresetIndexByAspectRatio({
		presets: canvasPresets,
		targetAspectRatio: currentAspectRatio,
	});
	const originalPresetValue = "original";
	const selectedPresetValue =
		presetIndex !== -1 ? presetIndex.toString() : originalPresetValue;

	const handleAspectRatioChange = ({ value }: { value: string }) => {
		if (value === originalPresetValue) {
			const canvasSize = originalCanvasSize ?? currentCanvasSize;
			editor.project.updateSettings({
				settings: { canvasSize },
			});
			return;
		}
		const index = parseInt(value, 10);
		const preset = canvasPresets[index];
		if (preset) {
			editor.project.updateSettings({ settings: { canvasSize: preset } });
		}
	};

	const handleFpsChange = (value: string) => {
		const fps = parseFloat(value);
		editor.project.updateSettings({ settings: { fps } });
	};

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-2">
				<Label>Name</Label>
				<span className="leading-none text-sm">
					{activeProject.metadata.name}
				</span>
			</div>
			<div className="flex flex-col gap-2">
				<Label>Aspect ratio</Label>
				<Select
					value={selectedPresetValue}
					onValueChange={(value) => handleAspectRatioChange({ value })}
				>
					<SelectTrigger className="w-fit">
						<SelectValue placeholder="Select an aspect ratio" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={originalPresetValue}>Original</SelectItem>
						{canvasPresets.map((preset, index) => {
							const label = dimensionToAspectRatio({
								width: preset.width,
								height: preset.height,
							});
							return (
								<SelectItem key={label} value={index.toString()}>
									{label}
								</SelectItem>
							);
						})}
					</SelectContent>
				</Select>
			</div>
			<div className="flex flex-col gap-2">
				<Label>Frame rate</Label>
				<Select
					value={activeProject.settings.fps.toString()}
					onValueChange={handleFpsChange}
				>
					<SelectTrigger className="w-fit">
						<SelectValue placeholder="Select a frame rate" />
					</SelectTrigger>
					<SelectContent>
						{FPS_PRESETS.map((preset) => (
							<SelectItem key={preset.value} value={preset.value}>
								{preset.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		</div>
	);
}

const BlurPreview = memo(function BlurPreview({
	blur,
	isSelected,
	onSelect,
}: {
	blur: { label: string; value: number };
	isSelected: boolean;
	onSelect: () => void;
}) {
	return (
		<button
			className={cn(
				"border-foreground/15 hover:border-primary relative aspect-square size-16 cursor-pointer overflow-hidden rounded-sm border",
				isSelected && "border-primary border-2",
			)}
			onClick={onSelect}
			type="button"
			aria-label={`Select ${blur.label} blur`}
		>
			<Image
				src="https://images.unsplash.com/photo-1501785888041-af3ef285b470?q=80&w=200&auto=format&fit=crop"
				alt={`Blur preview ${blur.label}`}
				fill
				className="object-cover"
				style={{ filter: `blur(${blur.value}px)` }}
				loading="eager"
			/>
			<div className="absolute right-0.5 bottom-0.5 left-0.5 text-center">
				<span className="rounded bg-black/50 px-1 text-[10px] text-white">
					{blur.label}
				</span>
			</div>
		</button>
	);
});

function BackgroundContent() {
	const editor = useEditor();
	const activeProject = editor.project.getActive();
	const blurLevels = useMemo(() => BLUR_INTENSITY_PRESETS, []);

	const handleBlurSelect = useCallback(
		async ({ blurIntensity }: { blurIntensity: number }) => {
			await editor.project.updateSettings({
				settings: { background: { type: "blur", blurIntensity } },
			});
		},
		[editor.project],
	);

	const handleColorSelect = useCallback(
		async ({ color }: { color: string }) => {
			await editor.project.updateSettings({
				settings: { background: { type: "color", color } },
			});
		},
		[editor.project],
	);

	const currentBlurIntensity =
		activeProject.settings.background.type === "blur"
			? activeProject.settings.background.blurIntensity
			: DEFAULT_BLUR_INTENSITY;

	const currentBackgroundColor =
		activeProject.settings.background.type === "color"
			? activeProject.settings.background.color
			: DEFAULT_COLOR;

	const isBlurBackground = activeProject.settings.background.type === "blur";
	const isColorBackground = activeProject.settings.background.type === "color";

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-2">
				<Label>Blur</Label>
				<div className="flex flex-wrap gap-2">
					{blurLevels.map((blur) => (
						<BlurPreview
							key={blur.value}
							blur={blur}
							isSelected={
								isBlurBackground && currentBlurIntensity === blur.value
							}
							onSelect={() =>
								handleBlurSelect({ blurIntensity: blur.value })
							}
						/>
					))}
				</div>
			</div>

			<div className="flex flex-col gap-2">
				<Label>Solid colors</Label>
				<div className="flex flex-wrap gap-1.5">
					{colors.map((bg) => (
						<button
							key={bg}
							className={cn(
								"border-foreground/15 hover:border-primary size-8 cursor-pointer rounded-sm border",
								isColorBackground &&
									bg === currentBackgroundColor &&
									"border-primary border-2",
							)}
							style={{ backgroundColor: bg }}
							onClick={() => handleColorSelect({ color: bg })}
							type="button"
							aria-label={`Select background color ${bg}`}
						/>
					))}
				</div>
			</div>

			<div className="flex flex-col gap-2">
				<Label>Gradients</Label>
				<div className="flex flex-wrap gap-1.5">
					{[...patternCraftGradients, ...syntaxUIGradients].map(
						(bg, index) => (
							<button
								key={`gradient-${index}-${bg.slice(0, 20)}`}
								className={cn(
									"border-foreground/15 hover:border-primary size-8 cursor-pointer rounded-sm border",
									isColorBackground &&
										bg === currentBackgroundColor &&
										"border-primary border-2",
								)}
								style={{
									background: bg,
									backgroundSize: "cover",
									backgroundPosition: "center",
								}}
								onClick={() => handleColorSelect({ color: bg })}
								type="button"
								aria-label={`Select gradient background ${index + 1}`}
							/>
						),
					)}
				</div>
			</div>
		</div>
	);
}

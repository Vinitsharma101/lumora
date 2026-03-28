"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor } from "@/hooks/use-editor";
import { formatTimeCode } from "@/lib/time";
import { invokeAction } from "@/lib/actions";
import { EditableTimecode } from "@/components/editable-timecode";
import { Button } from "@/components/ui/button";
import {
	FullScreenIcon,
	PauseIcon,
	PlayIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { OcSocialIcon } from "@grace-studio/ui/icons";
import { Separator } from "@/components/ui/separator";

function useFpsCounter(): number {
	const [fps, setFps] = useState(0);
	const stateRef = useRef({ frames: 0, lastTime: performance.now() });

	useEffect(() => {
		let rafId = 0;
		const tick = (now: number) => {
			const state = stateRef.current;
			state.frames++;
			const delta = now - state.lastTime;
			if (delta >= 1000) {
				setFps(Math.round((state.frames * 1000) / delta));
				state.frames = 0;
				state.lastTime = now;
			}
			rafId = requestAnimationFrame(tick);
		};
		rafId = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(rafId);
	}, []);

	return fps;
}

export function PreviewToolbar({
	isFullscreen,
	onToggleFullscreen,
}: {
	isFullscreen: boolean;
	onToggleFullscreen: () => void;
}) {
	const editor = useEditor();
	const isPlaying = editor.playback.getIsPlaying();
	const currentTime = editor.playback.getCurrentTime();
	const totalDuration = editor.timeline.getTotalDuration();
	const projectFps = editor.project.getActive().settings.fps;
	const renderFps = useFpsCounter();

	return (
		<div className="grid grid-cols-[1fr_auto_1fr] items-center pb-3 pt-5 px-5">
			<div className="flex items-center">
				<EditableTimecode
					time={currentTime}
					duration={totalDuration}
					format="HH:MM:SS:FF"
					fps={projectFps}
					onTimeChange={({ time }) => editor.playback.seek({ time })}
					className="text-center"
				/>
				<span className="text-muted-foreground px-2 font-mono text-xs">/</span>
				<span className="text-muted-foreground font-mono text-xs">
					{formatTimeCode({
						timeInSeconds: totalDuration,
						format: "HH:MM:SS:FF",
						fps: projectFps,
					})}
				</span>
			</div>

			<Button
				variant="text"
				size="icon"
				onClick={() => invokeAction("toggle-play")}
			>
				<HugeiconsIcon icon={isPlaying ? PauseIcon : PlayIcon} />
			</Button>

			<div className="justify-self-end flex items-center gap-2.5">
				<span
					className="font-mono text-[10px] tabular-nums text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5"
					title="Rendering FPS"
				>
					{renderFps} FPS
				</span>
				<Separator orientation="vertical" className="h-4" />
				<Button
					variant="secondary"
					size="sm"
					className="[&_svg]:size-auto px-1 h-7"
					onClick={onToggleFullscreen}
					title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
				>
					<OcSocialIcon size={20} />
				</Button>
				<Separator orientation="vertical" className="h-4" />
				<Button
					variant="text"
					onClick={onToggleFullscreen}
					title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
				>
					<HugeiconsIcon icon={FullScreenIcon} />
				</Button>
			</div>
		</div>
	);
}

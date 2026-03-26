import type React from "react";
import {
	AbsoluteFill,
	interpolate,
	useCurrentFrame,
	useVideoConfig,
} from "remotion";

export interface TextRevealProps {
	text: string;
	color?: string;
	background?: string;
	fontSize?: number;
}

export const TextReveal: React.FC<TextRevealProps> = ({
	text,
	color = "#ffffff",
	background = "#000000",
	fontSize = 64,
}) => {
	const frame = useCurrentFrame();
	const { fps, durationInFrames } = useVideoConfig();

	const words = text.split(" ");
	const totalRevealFrames = fps * 1.5;
	const framesPerWord = totalRevealFrames / words.length;

	const fadeOut = interpolate(
		frame,
		[durationInFrames - fps * 0.5, durationInFrames],
		[1, 0],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	return (
		<AbsoluteFill
			style={{
				backgroundColor: background,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				opacity: fadeOut,
				padding: "10%",
			}}
		>
			<div
				style={{
					display: "flex",
					flexWrap: "wrap",
					justifyContent: "center",
					gap: "0 12px",
				}}
			>
				{words.map((word, i) => {
					const wordStart = i * framesPerWord;
					const wordOpacity = interpolate(
						frame,
						[wordStart, wordStart + framesPerWord * 0.5],
						[0, 1],
						{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
					);
					const wordY = interpolate(
						frame,
						[wordStart, wordStart + framesPerWord * 0.5],
						[20, 0],
						{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
					);

					return (
						<span
							key={`${word}-${i}`}
							style={{
								fontSize,
								fontWeight: 800,
								color,
								fontFamily: "Arial, sans-serif",
								opacity: wordOpacity,
								transform: `translateY(${wordY}px)`,
								display: "inline-block",
							}}
						>
							{word}
						</span>
					);
				})}
			</div>
		</AbsoluteFill>
	);
};

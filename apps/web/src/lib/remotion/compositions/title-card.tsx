import type React from "react";
import {
	AbsoluteFill,
	interpolate,
	useCurrentFrame,
	useVideoConfig,
} from "remotion";

export interface TitleCardProps {
	title: string;
	subtitle?: string;
	background?: string;
	textColor?: string;
}

export const TitleCard: React.FC<TitleCardProps> = ({
	title,
	subtitle,
	background = "#000000",
	textColor = "#ffffff",
}) => {
	const frame = useCurrentFrame();
	const { fps, durationInFrames } = useVideoConfig();

	const fadeIn = interpolate(frame, [0, fps * 0.8], [0, 1], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});

	const fadeOut = interpolate(
		frame,
		[durationInFrames - fps * 0.8, durationInFrames],
		[1, 0],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	const titleScale = interpolate(frame, [0, fps * 0.6], [0.8, 1], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});

	const subtitleY = interpolate(frame, [fps * 0.3, fps * 0.8], [20, 0], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});

	const opacity = Math.min(fadeIn, fadeOut);

	return (
		<AbsoluteFill
			style={{
				backgroundColor: background,
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				opacity,
			}}
		>
			<div
				style={{
					fontSize: 72,
					fontWeight: 800,
					color: textColor,
					fontFamily: "Arial, sans-serif",
					textAlign: "center",
					transform: `scale(${titleScale})`,
					letterSpacing: -1,
				}}
			>
				{title}
			</div>
			{subtitle && (
				<div
					style={{
						fontSize: 32,
						fontWeight: 400,
						color: textColor,
						opacity: 0.7,
						fontFamily: "Arial, sans-serif",
						textAlign: "center",
						marginTop: 16,
						transform: `translateY(${subtitleY}px)`,
					}}
				>
					{subtitle}
				</div>
			)}
		</AbsoluteFill>
	);
};

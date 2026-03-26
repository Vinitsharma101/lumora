import type React from "react";
import {
	AbsoluteFill,
	interpolate,
	useCurrentFrame,
	useVideoConfig,
} from "remotion";

export interface LowerThirdProps {
	primaryText: string;
	secondaryText?: string;
	accentColor?: string;
	textColor?: string;
}

export const LowerThird: React.FC<LowerThirdProps> = ({
	primaryText,
	secondaryText,
	accentColor = "#7C3AED",
	textColor = "#ffffff",
}) => {
	const frame = useCurrentFrame();
	const { fps, durationInFrames } = useVideoConfig();

	const fadeInEnd = fps * 0.5;
	const fadeOutStart = durationInFrames - fps * 0.5;

	const slideIn = interpolate(frame, [0, fadeInEnd], [100, 0], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});

	const opacity = interpolate(
		frame,
		[0, fadeInEnd * 0.5, fadeOutStart, durationInFrames],
		[0, 1, 1, 0],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	const barWidth = interpolate(frame, [0, fadeInEnd], [0, 4], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});

	return (
		<AbsoluteFill>
			<div
				style={{
					position: "absolute",
					bottom: "15%",
					left: "8%",
					display: "flex",
					alignItems: "stretch",
					gap: 12,
					opacity,
					transform: `translateX(${slideIn}px)`,
				}}
			>
				<div
					style={{
						width: barWidth,
						backgroundColor: accentColor,
						borderRadius: 2,
					}}
				/>
				<div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
					<div
						style={{
							fontSize: 36,
							fontWeight: 700,
							color: textColor,
							fontFamily: "Arial, sans-serif",
							textShadow: "0 2px 8px rgba(0,0,0,0.5)",
						}}
					>
						{primaryText}
					</div>
					{secondaryText && (
						<div
							style={{
								fontSize: 22,
								fontWeight: 400,
								color: textColor,
								opacity: 0.8,
								fontFamily: "Arial, sans-serif",
								textShadow: "0 1px 4px rgba(0,0,0,0.5)",
							}}
						>
							{secondaryText}
						</div>
					)}
				</div>
			</div>
		</AbsoluteFill>
	);
};

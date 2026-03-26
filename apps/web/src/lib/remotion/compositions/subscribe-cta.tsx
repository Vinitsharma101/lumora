import type React from "react";
import {
	AbsoluteFill,
	interpolate,
	useCurrentFrame,
	useVideoConfig,
} from "remotion";

export interface SubscribeCTAProps {
	channelName?: string;
	accentColor?: string;
}

export const SubscribeCTA: React.FC<SubscribeCTAProps> = ({
	channelName = "Subscribe",
	accentColor = "#FF0000",
}) => {
	const frame = useCurrentFrame();
	const { fps, durationInFrames } = useVideoConfig();

	const slideIn = interpolate(frame, [0, fps * 0.4], [150, 0], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});

	const slideOut = interpolate(
		frame,
		[durationInFrames - fps * 0.4, durationInFrames],
		[0, 150],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	const bellRotation = interpolate(
		frame,
		[fps * 0.5, fps * 0.6, fps * 0.7, fps * 0.8, fps * 0.9],
		[0, 15, -15, 10, 0],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	const offset = slideIn + slideOut;

	return (
		<AbsoluteFill>
			<div
				style={{
					position: "absolute",
					bottom: "10%",
					right: "5%",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					gap: 12,
					transform: `translateX(${offset}px)`,
				}}
			>
				<div
					style={{
						backgroundColor: accentColor,
						color: "#ffffff",
						padding: "12px 32px",
						borderRadius: 8,
						fontSize: 24,
						fontWeight: 700,
						fontFamily: "Arial, sans-serif",
						display: "flex",
						alignItems: "center",
						gap: 8,
						boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
					}}
				>
					<span
						style={{
							transform: `rotate(${bellRotation}deg)`,
							display: "inline-block",
						}}
					>
						🔔
					</span>
					{channelName}
				</div>
				<div
					style={{
						display: "flex",
						gap: 8,
						fontSize: 14,
						color: "#ffffff",
						fontFamily: "Arial, sans-serif",
						textShadow: "0 1px 4px rgba(0,0,0,0.5)",
					}}
				>
					<span>👍 Like</span>
					<span>💬 Comment</span>
					<span>🔁 Share</span>
				</div>
			</div>
		</AbsoluteFill>
	);
};

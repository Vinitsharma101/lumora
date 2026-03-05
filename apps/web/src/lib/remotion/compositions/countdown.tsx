import React from "react";
import {
	AbsoluteFill,
	interpolate,
	useCurrentFrame,
	useVideoConfig,
} from "remotion";

export interface CountdownProps {
	from?: number;
	color?: string;
	background?: string;
}

export const Countdown: React.FC<CountdownProps> = ({
	from = 3,
	color = "#ffffff",
	background = "#000000",
}) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const currentNumber = Math.max(
		1,
		from - Math.floor(frame / fps),
	);

	const frameInSecond = frame % fps;

	const scale = interpolate(frameInSecond, [0, fps * 0.2, fps * 0.8, fps], [0.5, 1, 1, 0.5], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});

	const opacity = interpolate(frameInSecond, [0, fps * 0.1, fps * 0.8, fps], [0, 1, 1, 0], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});

	return (
		<AbsoluteFill
			style={{
				backgroundColor: background,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			<div
				style={{
					fontSize: 200,
					fontWeight: 900,
					color,
					fontFamily: "Arial, sans-serif",
					transform: `scale(${scale})`,
					opacity,
				}}
			>
				{currentNumber}
			</div>
		</AbsoluteFill>
	);
};

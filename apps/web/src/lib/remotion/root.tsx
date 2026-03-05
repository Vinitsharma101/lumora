import React from "react";
import { Composition } from "remotion";
import { COMPOSITION_REGISTRY } from "./compositions";

/**
 * Remotion Root component — registers all motion-graphic compositions.
 * Used by @remotion/bundler to create a renderable bundle.
 */
export const RemotionRoot: React.FC = () => {
	return (
		<>
			{Object.entries(COMPOSITION_REGISTRY).map(
				([id, { component: Component, defaultProps, defaultDurationInFrames }]) => (
					<Composition
						key={id}
						id={id}
						component={Component}
						durationInFrames={defaultDurationInFrames}
						fps={30}
						width={1920}
						height={1080}
						defaultProps={defaultProps}
					/>
				),
			)}
		</>
	);
};

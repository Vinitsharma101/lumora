import type React from "react";
import { Composition, registerRoot } from "remotion";
import { COMPOSITION_REGISTRY, getCompositionDimensions } from "./compositions";

/**
 * Remotion Root component — registers all motion-graphic compositions.
 * Used by @remotion/bundler to create a renderable bundle.
 */
export const RemotionRoot: React.FC = () => {
	return (
		<>
			{Object.entries(COMPOSITION_REGISTRY).map(
				([
					id,
					{ component: Component, defaultProps, defaultDurationInFrames },
				]) => {
					const { width, height, fps } = getCompositionDimensions(id);
					return (
						<Composition
							key={id}
							id={id}
							component={Component}
							durationInFrames={defaultDurationInFrames}
							fps={fps}
							width={width}
							height={height}
							defaultProps={defaultProps}
						/>
					);
				},
			)}
		</>
	);
};

registerRoot(RemotionRoot);

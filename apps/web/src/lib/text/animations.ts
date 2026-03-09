export interface AnimationResult {
	opacity: number;
	scale: number;
	offsetY: number;
}

export function typewriterAnimation({
	relativeTime,
	wordStart,
}: {
	relativeTime: number;
	wordStart: number;
}): AnimationResult {
	const visible = relativeTime >= wordStart;
	return {
		opacity: visible ? 1 : 0,
		scale: 1,
		offsetY: 0,
	};
}

export function bounceAnimation({
	relativeTime,
	wordStart,
	wordEnd,
}: {
	relativeTime: number;
	wordStart: number;
	wordEnd: number;
}): AnimationResult {
	const isActive = relativeTime >= wordStart && relativeTime < wordEnd;
	if (!isActive) {
		return { opacity: 1, scale: 1, offsetY: 0 };
	}

	const progress = (relativeTime - wordStart) / (wordEnd - wordStart);
	const bounce = Math.sin(progress * Math.PI) * -8;

	return {
		opacity: 1,
		scale: 1,
		offsetY: bounce,
	};
}

export function waveAnimation({
	relativeTime,
	wordIndex,
}: {
	relativeTime: number;
	wordIndex: number;
}): AnimationResult {
	const phase = wordIndex * 0.5;
	const offsetY = Math.sin(relativeTime * 3 + phase) * 4;

	return {
		opacity: 1,
		scale: 1,
		offsetY,
	};
}

export function popInAnimation({
	relativeTime,
	wordStart,
}: {
	relativeTime: number;
	wordStart: number;
}): AnimationResult {
	if (relativeTime < wordStart) {
		return { opacity: 0, scale: 0, offsetY: 0 };
	}

	const elapsed = relativeTime - wordStart;
	const duration = 0.15;
	const progress = Math.min(1, elapsed / duration);
	const eased = 1 - (1 - progress) * (1 - progress);

	return {
		opacity: eased,
		scale: 0.5 + 0.5 * eased,
		offsetY: 0,
	};
}

export function getAnimationForWord({
	animationType,
	relativeTime,
	wordIndex,
	wordStart,
	wordEnd,
}: {
	animationType: string;
	relativeTime: number;
	wordIndex: number;
	wordStart: number;
	wordEnd: number;
}): AnimationResult {
	switch (animationType) {
		case "typewriter":
			return typewriterAnimation({ relativeTime, wordStart });
		case "bounce":
			return bounceAnimation({ relativeTime, wordStart, wordEnd });
		case "wave":
			return waveAnimation({ relativeTime, wordIndex });
		case "pop-in":
			return popInAnimation({ relativeTime, wordStart });
		default:
			return { opacity: 1, scale: 1, offsetY: 0 };
	}
}

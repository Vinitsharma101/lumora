import { useEffect, useRef } from "react";

export function useRafLoop(callback: ({ time }: { time: number }) => void) {
	const callbackRef = useRef(callback);
	callbackRef.current = callback;

	useEffect(() => {
		let rafId = 0;
		let previousTime: number | null = null;
		const arg = { time: 0 };

		const loop = (time: number) => {
			if (previousTime !== null) {
				arg.time = time - previousTime;
				callbackRef.current(arg);
			}
			previousTime = time;
			rafId = requestAnimationFrame(loop);
		};

		rafId = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(rafId);
	}, []);
}

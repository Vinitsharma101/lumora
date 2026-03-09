export interface CaptionPosition {
	id: string;
	name: string;
	y: number;
}

export const CAPTION_POSITIONS: CaptionPosition[] = [
	{ id: "top", name: "Top", y: -300 },
	{ id: "center", name: "Center", y: 0 },
	{ id: "lower-third", name: "Lower Third", y: 200 },
	{ id: "bottom", name: "Bottom", y: 350 },
];

export const DEFAULT_CAPTION_POSITION = "bottom";

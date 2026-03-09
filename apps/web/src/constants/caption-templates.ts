import type { TextElement } from "@/types/timeline";

export interface CaptionTemplate {
	id: string;
	name: string;
	preview: {
		text: string;
		backgroundColor: string;
	};
	style: Partial<Omit<TextElement, "id" | "type" | "name" | "duration" | "startTime" | "trimStart" | "trimEnd">>;
}

export const CAPTION_TEMPLATES: CaptionTemplate[] = [
	{
		id: "clean",
		name: "Clean",
		preview: { text: "Clean", backgroundColor: "#1a1a1a" },
		style: {
			fontFamily: "Inter",
			fontSize: 60,
			fontWeight: "bold",
			color: "#FFFFFF",
			background: { color: "transparent", paddingX: 30, paddingY: 42, cornerRadius: 0 },
			textAlign: "center",
		},
	},
	{
		id: "bold-pill",
		name: "Bold Pill",
		preview: { text: "Bold Pill", backgroundColor: "#1a1a1a" },
		style: {
			fontFamily: "Montserrat",
			fontSize: 55,
			fontWeight: "bold",
			color: "#FFFFFF",
			background: { color: "#000000", paddingX: 40, paddingY: 20, cornerRadius: 50 },
			textAlign: "center",
		},
	},
	{
		id: "hormozi",
		name: "Hormozi",
		preview: { text: "HORMOZI", backgroundColor: "#1a1a1a" },
		style: {
			fontFamily: "Anton",
			fontSize: 75,
			fontWeight: "bold",
			color: "#FFFF00",
			background: { color: "transparent", paddingX: 30, paddingY: 42, cornerRadius: 0 },
			textAlign: "center",
			caption: {
				highlightColor: "#FFFF00",
				highlightEffect: "color",
				animationType: "karaoke",
			},
			stroke: { color: "#000000", width: 4 },
		},
	},
	{
		id: "mrbeast",
		name: "MrBeast",
		preview: { text: "MrBeast", backgroundColor: "#FF0000" },
		style: {
			fontFamily: "Bangers",
			fontSize: 70,
			fontWeight: "bold",
			color: "#FFFFFF",
			background: { color: "#FF0000", paddingX: 35, paddingY: 15, cornerRadius: 8 },
			textAlign: "center",
			stroke: { color: "#000000", width: 3 },
		},
	},
	{
		id: "cinematic",
		name: "Cinematic",
		preview: { text: "Cinematic", backgroundColor: "#0a0a0a" },
		style: {
			fontFamily: "Playfair Display",
			fontSize: 50,
			fontWeight: "normal",
			color: "#FFFFFF",
			background: { color: "transparent", paddingX: 30, paddingY: 42, cornerRadius: 0 },
			textAlign: "center",
			shadow: { color: "rgba(0,0,0,0.8)", blur: 10, offsetX: 2, offsetY: 2 },
		},
	},
	{
		id: "neon-glow",
		name: "Neon Glow",
		preview: { text: "NEON", backgroundColor: "#0a0a0a" },
		style: {
			fontFamily: "Bebas Neue",
			fontSize: 80,
			fontWeight: "bold",
			color: "#39FF14",
			background: { color: "transparent", paddingX: 30, paddingY: 42, cornerRadius: 0 },
			textAlign: "center",
			shadow: { color: "#39FF14", blur: 20, offsetX: 0, offsetY: 0 },
		},
	},
	{
		id: "outline",
		name: "Outline",
		preview: { text: "OUTLINE", backgroundColor: "#1a1a1a" },
		style: {
			fontFamily: "Impact",
			fontSize: 70,
			fontWeight: "bold",
			color: "#FFFFFF",
			background: { color: "transparent", paddingX: 30, paddingY: 42, cornerRadius: 0 },
			textAlign: "center",
			stroke: { color: "#000000", width: 5 },
		},
	},
	{
		id: "gradient-box",
		name: "Gradient Box",
		preview: { text: "Gradient", backgroundColor: "#6366F1" },
		style: {
			fontFamily: "Poppins",
			fontSize: 55,
			fontWeight: "bold",
			color: "#FFFFFF",
			background: { color: "#6366F1", paddingX: 35, paddingY: 15, cornerRadius: 12 },
			textAlign: "center",
		},
	},
	{
		id: "minimal",
		name: "Minimal",
		preview: { text: "minimal", backgroundColor: "#1a1a1a" },
		style: {
			fontFamily: "Inter",
			fontSize: 40,
			fontWeight: "normal",
			color: "#A0A0A0",
			background: { color: "transparent", paddingX: 30, paddingY: 42, cornerRadius: 0 },
			textAlign: "center",
		},
	},
	{
		id: "karaoke-pop",
		name: "Karaoke Pop",
		preview: { text: "Karaoke", backgroundColor: "#1a1a1a" },
		style: {
			fontFamily: "Nunito",
			fontSize: 65,
			fontWeight: "bold",
			color: "#FFFFFF",
			background: { color: "transparent", paddingX: 30, paddingY: 42, cornerRadius: 0 },
			textAlign: "center",
			caption: {
				highlightColor: "#FFD700",
				highlightEffect: "background",
				highlightBackground: "#FFD700",
				animationType: "karaoke",
			},
		},
	},
	{
		id: "typewriter",
		name: "Typewriter",
		preview: { text: "> typewriter_", backgroundColor: "#0D1117" },
		style: {
			fontFamily: "Courier New",
			fontSize: 45,
			fontWeight: "normal",
			color: "#39FF14",
			background: { color: "#0D1117", paddingX: 30, paddingY: 15, cornerRadius: 6 },
			textAlign: "left",
			caption: {
				animationType: "typewriter",
			},
		},
	},
	{
		id: "comic",
		name: "Comic",
		preview: { text: "COMIC!", backgroundColor: "#FFFF00" },
		style: {
			fontFamily: "Comic Neue",
			fontSize: 60,
			fontWeight: "bold",
			color: "#000000",
			background: { color: "#FFFF00", paddingX: 35, paddingY: 15, cornerRadius: 16 },
			textAlign: "center",
			stroke: { color: "#000000", width: 2 },
		},
	},
];

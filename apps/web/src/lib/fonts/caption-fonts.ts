const GOOGLE_FONTS_CSS_URL = "https://fonts.googleapis.com/css2";

const CAPTION_FONT_FAMILIES = [
	"Anton",
	"Bangers",
	"Bebas Neue",
	"Comic Neue",
	"Montserrat",
	"Nunito",
	"Playfair Display",
	"Poppins",
] as const;

const loadedFonts = new Set<string>();

export async function preloadCaptionFont({
	fontFamily,
}: {
	fontFamily: string;
}): Promise<void> {
	if (loadedFonts.has(fontFamily)) return;

	const isSystemFont = [
		"Inter",
		"Impact",
		"Courier New",
		"Arial",
		"sans-serif",
	].includes(fontFamily);
	if (isSystemFont) {
		loadedFonts.add(fontFamily);
		return;
	}

	try {
		const url = `${GOOGLE_FONTS_CSS_URL}?family=${encodeURIComponent(fontFamily)}:wght@400;700&display=swap`;
		const response = await fetch(url);
		const css = await response.text();

		const fontFaceMatches = css.matchAll(
			/url\(([^)]+)\)\s+format\(['"]?(\w+)['"]?\)/g,
		);

		const loadPromises: Promise<FontFace>[] = [];
		for (const match of fontFaceMatches) {
			const fontUrl = match[1];
			const face = new FontFace(fontFamily, `url(${fontUrl})`);
			loadPromises.push(face.load());
		}

		const faces = await Promise.all(loadPromises);
		for (const face of faces) {
			document.fonts.add(face);
		}

		loadedFonts.add(fontFamily);
	} catch (error) {
		console.warn(`Failed to preload font: ${fontFamily}`, error);
	}
}

export async function preloadAllCaptionFonts(): Promise<void> {
	await Promise.allSettled(
		CAPTION_FONT_FAMILIES.map((fontFamily) =>
			preloadCaptionFont({ fontFamily }),
		),
	);
}

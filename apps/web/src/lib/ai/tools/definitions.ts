import type { ToolDefinition } from "../providers/types";

export const AI_TOOLS: ToolDefinition[] = [
	// ── Timeline State ──
	{
		name: "get_timeline_state",
		description:
			"Get the current state of the timeline including all tracks, elements, and their properties. ALWAYS call this first before making any edits.",
		parameters: {
			type: "object",
			properties: {},
			required: [],
		},
	},
	{
		name: "get_project_settings",
		description:
			"Get the current project settings including canvas size, FPS, and background color.",
		parameters: {
			type: "object",
			properties: {},
			required: [],
		},
	},
	{
		name: "get_media_assets",
		description: "List all media assets available in the project.",
		parameters: {
			type: "object",
			properties: {},
			required: [],
		},
	},

	// ── Text/Caption ──
	{
		name: "add_text_caption",
		description:
			"Add a styled text element or caption to the timeline. Use for titles, subtitles, lower thirds, etc.",
		parameters: {
			type: "object",
			properties: {
				content: {
					type: "string",
					description: "The text content to display",
				},
				startTime: {
					type: "number",
					description: "Start time in seconds",
				},
				duration: {
					type: "number",
					description: "Duration in seconds (default: 5)",
				},
				fontSize: {
					type: "number",
					description: "Font size (default: 15, range: 5-300)",
				},
				fontFamily: {
					type: "string",
					description: "Font family name (default: Arial)",
				},
				color: {
					type: "string",
					description: "Text color as hex (default: #ffffff)",
				},
				backgroundColor: {
					type: "string",
					description:
						"Background color as hex (default: #000000, use 'transparent' or '#00000000' for none)",
				},
				textAlign: {
					type: "string",
					enum: ["left", "center", "right"],
					description: "Text alignment (default: center)",
				},
				fontWeight: {
					type: "string",
					enum: ["normal", "bold"],
					description: "Font weight (default: normal)",
				},
				positionX: {
					type: "number",
					description:
						"Horizontal position (-1 to 1, 0 = center). Default: 0",
				},
				positionY: {
					type: "number",
					description:
						"Vertical position (-1 to 1, 0 = center, positive = down). Default: 0",
				},
			},
			required: ["content", "startTime"],
		},
	},
	{
		name: "add_multiple_captions",
		description:
			"Add multiple text captions at once. Use for subtitles/transcription where many captions need to be added sequentially.",
		parameters: {
			type: "object",
			properties: {
				captions: {
					type: "array",
					items: {
						type: "object",
						properties: {
							content: { type: "string" },
							startTime: { type: "number" },
							duration: { type: "number" },
						},
						required: ["content", "startTime", "duration"],
					},
					description: "Array of captions with content, startTime, and duration",
				},
				fontSize: { type: "number", description: "Shared font size for all captions" },
				color: { type: "string", description: "Shared text color for all captions" },
				backgroundColor: { type: "string", description: "Shared background color" },
				positionY: {
					type: "number",
					description: "Shared vertical position for all captions",
				},
			},
			required: ["captions"],
		},
	},

	// ── Element Manipulation ──
	{
		name: "update_element",
		description:
			"Modify properties of an existing element on the timeline.",
		parameters: {
			type: "object",
			properties: {
				trackId: { type: "string", description: "Track ID containing the element" },
				elementId: { type: "string", description: "Element ID to update" },
				updates: {
					type: "object",
					description:
						"Properties to update (e.g., content, startTime, duration, fontSize, color, etc.)",
				},
			},
			required: ["trackId", "elementId", "updates"],
		},
	},
	{
		name: "delete_elements",
		description: "Delete one or more elements from the timeline.",
		parameters: {
			type: "object",
			properties: {
				elements: {
					type: "array",
					items: {
						type: "object",
						properties: {
							trackId: { type: "string" },
							elementId: { type: "string" },
						},
						required: ["trackId", "elementId"],
					},
					description: "Array of { trackId, elementId } pairs to delete",
				},
			},
			required: ["elements"],
		},
	},
	{
		name: "split_element_at_time",
		description: "Split an element at a specific time point.",
		parameters: {
			type: "object",
			properties: {
				trackId: { type: "string" },
				elementId: { type: "string" },
				time: { type: "number", description: "Time in seconds to split at" },
			},
			required: ["trackId", "elementId", "time"],
		},
	},
	{
		name: "move_element",
		description: "Move an element to a new start time.",
		parameters: {
			type: "object",
			properties: {
				trackId: { type: "string" },
				elementId: { type: "string" },
				newStartTime: { type: "number", description: "New start time in seconds" },
			},
			required: ["trackId", "elementId", "newStartTime"],
		},
	},
	{
		name: "set_element_duration",
		description: "Change the duration of an element.",
		parameters: {
			type: "object",
			properties: {
				trackId: { type: "string" },
				elementId: { type: "string" },
				duration: { type: "number", description: "New duration in seconds" },
			},
			required: ["trackId", "elementId", "duration"],
		},
	},

	// ── Project Settings ──
	{
		name: "set_canvas_size",
		description:
			"Change the canvas/aspect ratio. Presets: 16:9 (1920x1080), 9:16 (1080x1920), 1:1 (1080x1080), 4:5 (1080x1350), 4:3 (1440x1080), 21:9 (2560x1080).",
		parameters: {
			type: "object",
			properties: {
				width: { type: "number", description: "Canvas width in pixels" },
				height: { type: "number", description: "Canvas height in pixels" },
			},
			required: ["width", "height"],
		},
	},
	{
		name: "set_background",
		description: "Change the project background color.",
		parameters: {
			type: "object",
			properties: {
				color: { type: "string", description: "Background color as hex" },
			},
			required: ["color"],
		},
	},
	{
		name: "seek_to_time",
		description: "Move the playhead to a specific time.",
		parameters: {
			type: "object",
			properties: {
				time: { type: "number", description: "Time in seconds" },
			},
			required: ["time"],
		},
	},

	// ── Audio/Voice (External API) ──
	{
		name: "generate_voiceover",
		description:
			"Generate a voiceover using text-to-speech (ElevenLabs) and add it to the timeline.",
		parameters: {
			type: "object",
			properties: {
				text: { type: "string", description: "Text to convert to speech" },
				startTime: { type: "number", description: "Where to place on timeline (seconds)" },
				voiceId: {
					type: "string",
					description: "ElevenLabs voice ID (optional, uses default narrator)",
				},
			},
			required: ["text", "startTime"],
		},
	},
	{
		name: "generate_music",
		description:
			"Generate background music using AI (Suno) and add it to the timeline.",
		parameters: {
			type: "object",
			properties: {
				prompt: {
					type: "string",
					description:
						"Description of the music (e.g., 'upbeat corporate background music')",
				},
				duration: { type: "number", description: "Desired duration in seconds" },
				startTime: {
					type: "number",
					description: "Where to place on timeline (seconds). Default: 0",
				},
			},
			required: ["prompt"],
		},
	},

	// ── Stock Media (External API) ──
	{
		name: "search_stock_video",
		description: "Search for stock video clips from Pexels/Pixabay.",
		parameters: {
			type: "object",
			properties: {
				query: { type: "string", description: "Search query" },
				orientation: {
					type: "string",
					enum: ["landscape", "portrait", "square"],
					description: "Video orientation filter",
				},
			},
			required: ["query"],
		},
	},
	{
		name: "search_stock_image",
		description: "Search for stock images from Pexels/Pixabay.",
		parameters: {
			type: "object",
			properties: {
				query: { type: "string", description: "Search query" },
				orientation: {
					type: "string",
					enum: ["landscape", "portrait", "square"],
					description: "Image orientation filter",
				},
			},
			required: ["query"],
		},
	},
	{
		name: "add_stock_media_to_timeline",
		description:
			"Download a stock media item and add it to the timeline.",
		parameters: {
			type: "object",
			properties: {
				url: { type: "string", description: "Download URL of the media" },
				type: {
					type: "string",
					enum: ["video", "image"],
					description: "Media type",
				},
				startTime: { type: "number", description: "Start time on timeline (seconds)" },
				duration: { type: "number", description: "Duration (for images, in seconds)" },
				name: { type: "string", description: "Display name for the media" },
				source: {
					type: "string",
					enum: ["pexels", "pixabay"],
					description: "Media source for attribution",
				},
			},
			required: ["url", "type", "startTime", "source"],
		},
	},

	// ── Motion Graphics (Remotion) ──
	{
		name: "add_motion_graphic",
		description:
			"Render a motion graphic from a template and add it to the timeline.",
		parameters: {
			type: "object",
			properties: {
				compositionId: {
					type: "string",
					enum: [
						"lower-third",
						"title-card",
						"subscribe-cta",
						"countdown",
						"text-reveal",
					],
					description: "Motion graphic template ID",
				},
				props: {
					type: "object",
					description:
						"Template-specific properties (text, colors, etc.)",
				},
				startTime: { type: "number", description: "Start time on timeline (seconds)" },
				duration: { type: "number", description: "Duration in seconds" },
			},
			required: ["compositionId", "startTime"],
		},
	},
	{
		name: "list_motion_templates",
		description:
			"List all available motion graphic templates with their properties.",
		parameters: {
			type: "object",
			properties: {},
			required: [],
		},
	},
];

export function getToolDescriptions(): Record<string, string> {
	const descriptions: Record<string, string> = {};
	for (const tool of AI_TOOLS) {
		descriptions[tool.name] = tool.description;
	}
	return descriptions;
}

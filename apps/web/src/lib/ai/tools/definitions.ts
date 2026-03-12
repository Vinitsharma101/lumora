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
					description:
						"Relative font size (3-20 typical range: subtitles 4-6, body 6-8, titles 10-15). Scales automatically with canvas size.",
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
					description: "Horizontal position (-1 to 1, 0 = center). Default: 0",
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
					description:
						"Array of captions with content, startTime, and duration",
				},
				fontSize: {
					type: "number",
					description:
						"Shared relative font size for all captions (typical: 3-6)",
				},
				fontFamily: {
					type: "string",
					description: "Shared font family (e.g. Anton, Bangers, Montserrat)",
				},
				color: {
					type: "string",
					description: "Shared text color for all captions",
				},
				backgroundColor: {
					type: "string",
					description: "Shared background color",
				},
				animation: {
					type: "string",
					enum: ["none", "pop_in"],
					description: "Optional entrance animation",
				},
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
		description: "Modify properties of an existing element on the timeline.",
		parameters: {
			type: "object",
			properties: {
				trackId: {
					type: "string",
					description: "Track ID containing the element",
				},
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
				newStartTime: {
					type: "number",
					description: "New start time in seconds",
				},
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
				startTime: {
					type: "number",
					description: "Where to place on timeline (seconds)",
				},
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
			"Generate background music using AI and add it to the timeline.",
		parameters: {
			type: "object",
			properties: {
				prompt: {
					type: "string",
					description:
						"Description of the music (e.g., 'upbeat corporate background music')",
				},
				duration: {
					type: "number",
					description: "Desired duration in seconds",
				},
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
		description: "Download a stock media item and add it to the timeline.",
		parameters: {
			type: "object",
			properties: {
				url: { type: "string", description: "Download URL of the media" },
				type: {
					type: "string",
					enum: ["video", "image"],
					description: "Media type",
				},
				startTime: {
					type: "number",
					description: "Start time on timeline (seconds)",
				},
				duration: {
					type: "number",
					description: "Duration (for images, in seconds)",
				},
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

	// ── Motion Graphics ──
	{
		name: "add_motion_graphic",
		description:
			"Render a Remotion motion graphic (animated overlay) and add it to the timeline as a video element. Available compositions: lower-third, title-card, subscribe-cta, countdown, text-reveal.",
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
					description: "The motion graphic template to render",
				},
				props: {
					type: "object",
					description:
						"Props for the composition. lower-third: {primaryText, secondaryText?, accentColor?}. title-card: {title, subtitle?, background?, textColor?}. subscribe-cta: {channelName?, accentColor?}. countdown: {from?, color?, background?}. text-reveal: {text, color?, background?, fontSize?}.",
				},
				startTime: {
					type: "number",
					description: "Start time on timeline in seconds",
				},
				duration: {
					type: "number",
					description: "Duration in seconds (default: 5)",
				},
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

	// ── AI Image Generation (Multi-Provider) ──
	{
		name: "generate_image",
		description:
			"Generate an image from a text description using AI models (FLUX, Google Imagen, or OpenAI DALL-E) and add it to the timeline. Use for creating custom visuals, backgrounds, thumbnails, or any image needed in the video.",
		parameters: {
			type: "object",
			properties: {
				prompt: {
					type: "string",
					description: "Detailed description of the image to generate",
				},
				width: {
					type: "number",
					description: "Image width in pixels (default: 1024, max: 1440)",
				},
				height: {
					type: "number",
					description: "Image height in pixels (default: 1024, max: 1440)",
				},
				provider: {
					type: "string",
					enum: ["replicate", "google_imagen", "openai"],
					description:
						"AI provider to use (default: replicate). replicate = FLUX, google_imagen = Imagen 3, openai = gpt-image-1",
				},
				numImages: {
					type: "number",
					description: "Number of images to generate (1-4, default: 1)",
				},
				startTime: {
					type: "number",
					description: "Where to place on timeline (seconds). Default: 0",
				},
				duration: {
					type: "number",
					description: "How long to show the image (seconds). Default: 5",
				},
			},
			required: ["prompt"],
		},
	},

	// ── AI Video Generation ──
	{
		name: "generate_video",
		description:
			"Generate a video clip from a text description using AI models (Google Veo, Replicate, or OpenAI Sora) and add it to the timeline.",
		parameters: {
			type: "object",
			properties: {
				prompt: {
					type: "string",
					description: "Detailed description of the video scene to generate",
				},
				duration: {
					type: "number",
					description: "Video duration in seconds (default: 4)",
				},
				aspectRatio: {
					type: "string",
					enum: ["16:9", "9:16", "1:1"],
					description: "Video aspect ratio (default: 16:9)",
				},
				provider: {
					type: "string",
					enum: ["google_veo", "replicate", "openai_sora"],
					description: "AI provider to use (default: google_veo)",
				},
				startTime: {
					type: "number",
					description:
						"Where to place on timeline (seconds). Default: end of timeline",
				},
			},
			required: ["prompt"],
		},
	},

	// ── Video-to-Video Transformation ──
	{
		name: "transform_video",
		description:
			"Transform an existing video clip using AI style transfer. Change the visual style, apply artistic effects, or restyle footage.",
		parameters: {
			type: "object",
			properties: {
				videoUrl: {
					type: "string",
					description: "URL of the video to transform",
				},
				prompt: {
					type: "string",
					description:
						"Description of the desired transformation/style (e.g., 'anime style', 'oil painting', 'neon cyberpunk')",
				},
				strength: {
					type: "number",
					description:
						"Transformation strength (0.0-1.0, default: 0.7). Higher = more transformation",
				},
			},
			required: ["videoUrl", "prompt"],
		},
	},

	// ── AI Speech Generation (ElevenLabs) ──
	{
		name: "generate_speech",
		description:
			"Generate realistic speech audio from text using ElevenLabs TTS and add it to the timeline as an audio track. Use for narration, voiceovers, character dialogue.",
		parameters: {
			type: "object",
			properties: {
				text: {
					type: "string",
					description: "Text to convert to speech",
				},
				voiceId: {
					type: "string",
					description:
						"ElevenLabs voice ID. Use list_voices to see available voices. Default: Rachel narrator voice.",
				},
				startTime: {
					type: "number",
					description: "Where to place on timeline (seconds). Default: 0",
				},
			},
			required: ["text"],
		},
	},

	// ── AI Sound Effect Generation (ElevenLabs) ──
	{
		name: "generate_sound_effect",
		description:
			"Generate a sound effect from a text description using ElevenLabs AI and add it to the timeline. Use for ambient sounds, transitions, impacts, etc.",
		parameters: {
			type: "object",
			properties: {
				prompt: {
					type: "string",
					description:
						"Description of the sound effect (e.g., 'thunder crack', 'whoosh transition', 'crowd cheering')",
				},
				durationSeconds: {
					type: "number",
					description:
						"Desired duration in seconds (optional, AI decides if not specified)",
				},
				startTime: {
					type: "number",
					description: "Where to place on timeline (seconds). Default: 0",
				},
			},
			required: ["prompt"],
		},
	},

	// ── Job Polling & Asset Import ──
	{
		name: "poll_job_status",
		description:
			"Poll the status of an async generation job (image, video, speech, SFX). Returns status, progress percentage, and result URL when complete. Use after generate_image, generate_video, transform_video, generate_speech, or generate_sound_effect.",
		parameters: {
			type: "object",
			properties: {
				jobId: {
					type: "string",
					description: "The job ID returned by a generation tool",
				},
			},
			required: ["jobId"],
		},
	},
	{
		name: "import_generated_asset",
		description:
			"Download a completed generated asset and add it to the timeline. Use after poll_job_status shows the job is complete and provides a result URL.",
		parameters: {
			type: "object",
			properties: {
				url: {
					type: "string",
					description: "The result URL from a completed generation job",
				},
				type: {
					type: "string",
					enum: ["video", "image", "audio"],
					description: "Asset type",
				},
				startTime: {
					type: "number",
					description: "Start time on timeline (seconds). Default: 0",
				},
				duration: {
					type: "number",
					description: "Duration on timeline (seconds, for images). Default: 5",
				},
				name: {
					type: "string",
					description: "Display name for the asset",
				},
			},
			required: ["url", "type"],
		},
	},

	// ── List Available Voices ──
	{
		name: "list_voices",
		description:
			"List all available ElevenLabs voices for speech generation. Shows voice names, categories, and IDs.",
		parameters: {
			type: "object",
			properties: {},
			required: [],
		},
	},

	// ── Media Understanding ──
	{
		name: "understand_media",
		description:
			"Analyze an image, video, or audio file using AI to understand its content. Returns a detailed description. Use when the user uploads media or asks about the content of existing media.",
		parameters: {
			type: "object",
			properties: {
				mediaUrl: {
					type: "string",
					description: "URL of the media file to analyze",
				},
				mediaType: {
					type: "string",
					enum: ["image", "video", "audio"],
					description: "Type of media to analyze",
				},
				question: {
					type: "string",
					description:
						"Specific question about the media (optional, defaults to general description)",
				},
			},
			required: ["mediaUrl", "mediaType"],
		},
	},

	// ── Stock Music Search ──
	{
		name: "search_stock_music",
		description:
			"Search for royalty-free stock music from Pixabay. Returns matching tracks with preview URLs that can be added to the timeline.",
		parameters: {
			type: "object",
			properties: {
				query: {
					type: "string",
					description:
						"Search query (e.g., 'upbeat corporate', 'calm piano', 'epic cinematic')",
				},
			},
			required: ["query"],
		},
	},

	// ── Visual Feedback Loop ──
	{
		name: "sample_timeline_frames",
		description:
			"Sample frames from the current timeline at evenly-spaced intervals. Returns base64 JPEG images for visual review. Use this after making edits to verify they look correct.",
		parameters: {
			type: "object",
			properties: {
				count: {
					type: "number",
					description: "Number of frames to sample (default: 4, max: 8)",
				},
				startTime: {
					type: "number",
					description: "Start time in seconds (default: 0)",
				},
				endTime: {
					type: "number",
					description: "End time in seconds (default: end of timeline)",
				},
			},
			required: [],
		},
	},
	{
		name: "review_composition",
		description:
			"Sample frames from the current timeline and review them with AI vision to check for issues (text positioning, animation timing, scaling, visual coherence). Returns structured feedback or approval.",
		parameters: {
			type: "object",
			properties: {
				goal: {
					type: "string",
					description:
						"What the edit should achieve (e.g., 'title text centered with good contrast')",
				},
			},
			required: ["goal"],
		},
	},

	// ── Autonomous Agent Pipeline ──
	{
		name: "start_agent_session",
		description:
			"Start the autonomous agentic video creation pipeline. Use when the user asks to 'create a video', 'make a movie', or any full video production request. The agent will plan scenes, generate assets, assemble timeline, and review quality.",
		parameters: {
			type: "object",
			properties: {
				query: {
					type: "string",
					description:
						"The user's full video creation request (e.g., 'create a 30s YouTube video about space exploration')",
				},
				context: {
					type: "object",
					description:
						"Additional context (aspect ratio, style, etc. from Q&A)",
				},
				mediaAssetIds: {
					type: "array",
					items: { type: "string" },
					description: "IDs of uploaded media assets to include",
				},
			},
			required: ["query"],
		},
	},
	{
		name: "answer_agent_question",
		description:
			"Submit the user's answer to an agent's clarifying question. Use after start_agent_session when the agent asks questions.",
		parameters: {
			type: "object",
			properties: {
				sessionId: {
					type: "string",
					description: "The agent session ID returned by start_agent_session",
				},
				questionId: {
					type: "string",
					description: "The question ID being answered",
				},
				value: {
					type: "string",
					description: "The user's answer value",
				},
			},
			required: ["sessionId", "questionId", "value"],
		},
	},
	{
		name: "get_agent_status",
		description:
			"Poll the autonomous agent pipeline for current status, progress, pending questions, and results. Use to check if the agent has finished or needs more input.",
		parameters: {
			type: "object",
			properties: {
				sessionId: {
					type: "string",
					description: "The agent session ID to check",
				},
			},
			required: ["sessionId"],
		},
	},
	{
		name: "import_agent_timeline",
		description:
			"Import the completed agent pipeline's assembled timeline into the editor. Downloads all generated media assets (videos, images, audio) and places them on the timeline with correct timing, text overlays, and audio tracks. Use after get_agent_status shows status 'completed'.",
		parameters: {
			type: "object",
			properties: {
				sessionId: {
					type: "string",
					description: "The agent session ID whose timeline to import",
				},
			},
			required: ["sessionId"],
		},
	},

	// ── AI Editing Pipeline (Intent → Plan → Commands) ──
	{
		name: "ai_edit",
		description:
			"Execute an AI editing pipeline that parses a natural language prompt into structured editing intent, analyzes the timeline, generates an edit plan, maps it to validated commands, and executes them as a single reversible batch. Use for high-level editing requests like 'cut silences', 'make it more engaging', 'shorten to 30 seconds', 'make it cinematic'. Returns session ID for undo/rollback.",
		parameters: {
			type: "object",
			properties: {
				prompt: {
					type: "string",
					description:
						"Natural language editing instruction (e.g., 'cut all silences', 'make it like TikTok', 'shorten to 30 seconds')",
				},
			},
			required: ["prompt"],
		},
	},
	{
		name: "ai_edit_analyze",
		description:
			"Analyze the current timeline and return detailed metrics: average clip length, silence segments, energy score, pacing score, caption coverage, etc. Use to understand the timeline state before suggesting edits.",
		parameters: {
			type: "object",
			properties: {},
			required: [],
		},
	},
	{
		name: "ai_edit_rollback",
		description:
			"Undo/rollback all changes from a specific AI editing session. Reverts the timeline to the state before the AI edit was executed.",
		parameters: {
			type: "object",
			properties: {
				sessionId: {
					type: "string",
					description: "The AI editing session ID to rollback",
				},
			},
			required: ["sessionId"],
		},
	},
	{
		name: "ai_edit_get_sessions",
		description:
			"List all AI editing sessions with their status, intent, plan, and command counts. Useful for reviewing what AI edits have been made.",
		parameters: {
			type: "object",
			properties: {},
			required: [],
		},
	},
	{
		name: "ai_edit_get_style_profiles",
		description:
			"List all available editing style profiles (reel, youtube, podcast, documentary, corporate, cinematic) with their parameters. Use to understand what styles are available for 'apply style' commands.",
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

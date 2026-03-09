import { PlaybackManager } from "./managers/playback-manager";
import { TimelineManager } from "./managers/timeline-manager";
import { ScenesManager } from "./managers/scenes-manager";
import { ProjectManager } from "./managers/project-manager";
import { MediaManager } from "./managers/media-manager";
import { RendererManager } from "./managers/renderer-manager";
import { CommandManager } from "./managers/commands";
import { SaveManager } from "./managers/save-manager";
import { AudioManager } from "./managers/audio-manager";
import { SelectionManager } from "./managers/selection-manager";
import { TimelineEngine, AgentTimelineAPI } from "@/lib/engine";

export class EditorCore {
	private static instance: EditorCore | null = null;

	public readonly command: CommandManager;
	public readonly playback: PlaybackManager;
	public readonly timeline: TimelineManager;
	public readonly scenes: ScenesManager;
	public readonly project: ProjectManager;
	public readonly media: MediaManager;
	public readonly renderer: RendererManager;
	public readonly save: SaveManager;
	public readonly audio: AudioManager;
	public readonly selection: SelectionManager;

	/** The compositing engine — frame resolution, keyframes, pacing, event log. */
	public readonly engine: TimelineEngine;
	/** Agent-friendly command API — AI agents call this, not raw timeline methods. */
	public readonly agentAPI: AgentTimelineAPI;

	private constructor() {
		this.command = new CommandManager();
		this.playback = new PlaybackManager(this);
		this.timeline = new TimelineManager(this);
		this.scenes = new ScenesManager(this);
		this.project = new ProjectManager(this);
		this.media = new MediaManager(this);
		this.renderer = new RendererManager(this);
		this.save = new SaveManager(this);
		this.audio = new AudioManager(this);
		this.selection = new SelectionManager(this);

		this.engine = new TimelineEngine(this.timeline.getTracks(), 0);
		this.agentAPI = new AgentTimelineAPI(this, this.engine);

		// Keep engine in sync with timeline mutations
		this.timeline.subscribe(() => {
			const version = this.timeline.getVersion();
			if (this.engine.needsRebuild(version)) {
				this.engine.rebuild(this.timeline.getTracks(), version);
			}
		});

		this.save.start();
	}

	static getInstance(): EditorCore {
		if (!EditorCore.instance) {
			EditorCore.instance = new EditorCore();
		}
		return EditorCore.instance;
	}

	static reset(): void {
		EditorCore.instance = null;
	}
}

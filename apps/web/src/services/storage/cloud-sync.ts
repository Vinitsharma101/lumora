import type { TProject, TProjectMetadata } from "@/types/project";

interface CloudProject {
	id: string;
	name: string;
	type: string;
	synced: boolean;
	savedAt: string;
}

interface CloudProjectListResponse {
	projects: CloudProject[];
	source: string;
}

class CloudSyncService {
	private enabled = false;
	private syncQueue: Map<string, TProject> = new Map();
	private syncTimer: ReturnType<typeof setTimeout> | null = null;
	private isSyncing = false;

	enable() {
		this.enabled = true;
	}

	disable() {
		this.enabled = false;
		if (this.syncTimer) {
			clearTimeout(this.syncTimer);
			this.syncTimer = null;
		}
	}

	isEnabled(): boolean {
		return this.enabled;
	}

	async saveProject({ project }: { project: TProject }): Promise<void> {
		if (!this.enabled) return;

		this.syncQueue.set(project.metadata.id, project);
		this.scheduleSyncFlush();
	}

	async deleteProject({ id }: { id: string }): Promise<void> {
		if (!this.enabled) return;

		try {
			await fetch(`/api/projects/${id}`, { method: "DELETE" });
			this.syncQueue.delete(id);
		} catch (error) {
			console.warn("Cloud sync: failed to delete project", error);
		}
	}

	async listProjects(): Promise<TProjectMetadata[]> {
		if (!this.enabled) return [];

		try {
			const response = await fetch("/api/projects");
			if (!response.ok) return [];

			const data: CloudProjectListResponse = await response.json();
			return data.projects.map((project) => ({
				id: project.id,
				name: project.name,
				type: (project.type as "image" | "video") ?? "video",
				duration: 0,
				createdAt: new Date(project.savedAt),
				updatedAt: new Date(project.savedAt),
			}));
		} catch {
			return [];
		}
	}

	private scheduleSyncFlush() {
		if (this.syncTimer) return;

		this.syncTimer = setTimeout(() => {
			this.syncTimer = null;
			this.flushSyncQueue();
		}, 2000);
	}

	private async flushSyncQueue() {
		if (this.isSyncing || this.syncQueue.size === 0) return;

		this.isSyncing = true;

		const entries = Array.from(this.syncQueue.entries());
		this.syncQueue.clear();

		for (const [id, project] of entries) {
			try {
				await fetch("/api/projects", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						id: project.metadata.id,
						name: project.metadata.name,
						type: project.metadata.type ?? "video",
						settings: JSON.stringify(project.settings),
						scenes: JSON.stringify(project.scenes),
						currentSceneId: project.currentSceneId,
						version: project.version,
					}),
				});
			} catch (error) {
				console.warn(`Cloud sync: failed to sync project ${id}`, error);
				this.syncQueue.set(id, project);
			}
		}

		this.isSyncing = false;

		if (this.syncQueue.size > 0) {
			this.scheduleSyncFlush();
		}
	}
}

export const cloudSyncService = new CloudSyncService();

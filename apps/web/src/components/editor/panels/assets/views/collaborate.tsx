"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEditor } from "@/hooks/use-editor";

/** Share project via Next.js API */
async function shareProjectAPI(projectId: string, email: string, role: string) {
	const response = await fetch(`/api/projects/${projectId}`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ action: "share", email, role }),
	});
	if (!response.ok) throw new Error(`API error ${response.status}`);
	return response.json();
}

/** List collaborators via Next.js API */
async function listCollaboratorsAPI(_projectId: string) {
	// For now, returns empty list since backend isn't available
	return { collaborators: [] };
}

/** Remove collaborator via Next.js API */
async function removeCollaboratorAPI(
	projectId: string,
	collaboratorId: string,
) {
	const response = await fetch(`/api/projects/${projectId}`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ action: "remove-collaborator", collaboratorId }),
	});
	if (!response.ok) throw new Error(`API error ${response.status}`);
	return response.json();
}

interface Collaborator {
	id: string;
	email: string;
	role: string;
	user_id: string;
}

export function CollaborateView() {
	const editor = useEditor();
	const projectId = editor.project.getActiveOrNull()?.metadata.id ?? "";
	const [email, setEmail] = useState("");
	const [role, setRole] = useState("editor");
	const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isSharing, setIsSharing] = useState(false);
	const [hasLoaded, setHasLoaded] = useState(false);

	const loadCollaborators = useCallback(async () => {
		if (!projectId) return;
		setIsLoading(true);
		try {
			const data = await listCollaboratorsAPI(projectId);
			setCollaborators(data.collaborators as unknown as Collaborator[]);
			setHasLoaded(true);
		} catch (error) {
			console.error("Failed to load collaborators:", error);
		} finally {
			setIsLoading(false);
		}
	}, [projectId]);

	const handleShare = useCallback(async () => {
		if (!projectId || !email) return;
		setIsSharing(true);
		try {
			await shareProjectAPI(projectId, email, role);
			setEmail("");
			loadCollaborators();
		} catch (error) {
			console.error("Failed to share project:", error);
		} finally {
			setIsSharing(false);
		}
	}, [projectId, email, role, loadCollaborators]);

	const handleRemove = useCallback(
		async ({ collaboratorId }: { collaboratorId: string }) => {
			if (!projectId) return;
			try {
				await removeCollaboratorAPI(projectId, collaboratorId);
				setCollaborators((previous) =>
					previous.filter((collab) => collab.id !== collaboratorId),
				);
			} catch (error) {
				console.error("Failed to remove collaborator:", error);
			}
		},
		[projectId],
	);

	if (!projectId) {
		return (
			<div className="p-4">
				<p className="text-muted-foreground text-sm">
					Open a cloud project to enable collaboration.
				</p>
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col overflow-y-auto">
			<div className="border-b p-3">
				<h3 className="text-sm font-semibold">Collaborate</h3>
				<p className="text-muted-foreground mt-1 text-xs">
					Share your project and edit in real-time
				</p>
			</div>

			{/* Share form */}
			<div className="space-y-3 border-b p-3">
				<div className="space-y-1.5">
					<Label className="text-xs">Invite by email</Label>
					<Input
						type="email"
						placeholder="colleague@example.com"
						value={email}
						onChange={(event) => setEmail(event.target.value)}
						className="h-8"
					/>
				</div>
				<div className="space-y-1.5">
					<Label className="text-xs">Role</Label>
					<div className="flex gap-1">
						{[
							{ value: "viewer", label: "Viewer" },
							{ value: "editor", label: "Editor" },
							{ value: "admin", label: "Admin" },
						].map(({ value, label }) => (
							<Button
								key={value}
								variant={role === value ? "secondary" : "outline"}
								size="sm"
								className="h-7 flex-1 text-xs"
								onClick={() => setRole(value)}
								type="button"
							>
								{label}
							</Button>
						))}
					</div>
				</div>
				<Button
					onClick={handleShare}
					disabled={isSharing || !email}
					className="w-full"
					size="sm"
					type="button"
				>
					{isSharing ? "Sharing..." : "Share"}
				</Button>
			</div>

			{/* Collaborators list */}
			<div className="flex-1 p-3">
				{!hasLoaded ? (
					<Button
						onClick={loadCollaborators}
						disabled={isLoading}
						variant="outline"
						className="w-full"
						size="sm"
						type="button"
					>
						{isLoading ? "Loading..." : "Load Collaborators"}
					</Button>
				) : (
					<div className="space-y-2">
						<h4 className="text-xs font-semibold">
							Collaborators ({collaborators.length})
						</h4>
						{collaborators.length === 0 ? (
							<p className="text-muted-foreground text-xs">
								No collaborators yet. Share the project above.
							</p>
						) : (
							collaborators.map((collab) => (
								<div
									key={collab.id}
									className="bg-muted flex items-center justify-between rounded-md p-2"
								>
									<div>
										<div className="text-xs font-medium">{collab.email}</div>
										<div className="text-muted-foreground text-[10px]">
											{collab.role}
										</div>
									</div>
									<Button
										variant="ghost"
										size="sm"
										className="h-6 text-xs text-red-500"
										onClick={() => handleRemove({ collaboratorId: collab.id })}
										type="button"
									>
										Remove
									</Button>
								</div>
							))
						)}
					</div>
				)}
			</div>
		</div>
	);
}

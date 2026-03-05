"use client";

import type { ToolCallStatus } from "@/stores/ai-chat-store";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/utils/ui";

export function AIChatToolStatus({ tools }: { tools: ToolCallStatus[] }) {
	if (tools.length === 0) return null;

	return (
		<div className="flex flex-col gap-1 mt-1">
			{tools.map((tool) => (
				<div
					key={tool.id}
					className={cn(
						"flex items-center gap-1.5 rounded-md px-2 py-1 text-xs",
						"bg-muted/50",
					)}
				>
					{tool.status === "executing" || tool.status === "pending" ? (
						<Loader2 className="size-3 animate-spin text-blue-500" />
					) : tool.status === "success" ? (
						<CheckCircle2 className="size-3 text-green-500" />
					) : (
						<XCircle className="size-3 text-red-500" />
					)}
					<span className="text-muted-foreground">{tool.description}</span>
				</div>
			))}
		</div>
	);
}

"use client";

import { AIChatHeader } from "./ai-chat-header";
import { AIChatMessages } from "./ai-chat-messages";
import { AIChatInput } from "./ai-chat-input";

export function AIChatPanel() {
	return (
		<div className="panel bg-background flex h-full flex-col rounded-sm border overflow-hidden">
			<AIChatHeader />
			<div className="min-h-0 flex-1">
				<AIChatMessages />
			</div>
			<AIChatInput />
		</div>
	);
}

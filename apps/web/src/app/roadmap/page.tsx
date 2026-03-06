import type { Metadata } from "next";
import { BasePage } from "@/app/base-page";

import { Badge } from "@/components/ui/badge";
import { ReactMarkdownWrapper } from "@/components/ui/react-markdown-wrapper";
import { cn } from "@/utils/ui";

const LAST_UPDATED = "February 25, 2026";

type StatusType = "complete" | "pending" | "default" | "info";

interface Status {
	text: string;
	type: StatusType;
}

interface RoadmapItem {
	title: string;
	description: string;
	status: Status;
}

const roadmapItems: RoadmapItem[] = [
	{
		title: "Start",
		description:
			"This is where it all started. Repository created, initial project structure, and the vision for an AI-powered video editing platform.",
		status: {
			text: "Completed",
			type: "complete",
		},
	},
	{
		title: "Core UI",
		description:
			"Build the foundation - main layout, header, sidebar, timeline container, and basic component structure. Not all functionality yet, but the UI framework that everything else builds on.",
		status: {
			text: "Completed",
			type: "complete",
		},
	},
	{
		title: "Essential functionality",
		description:
			"Everything that makes a video editor **useful**. Timeline interactivity, storage, effects, transitions, etc.",
		status: {
			text: "In progress",
			type: "pending",
		},
	},
	{
		title: "Native app (mobile/desktop)",
		description:
			"Native GraceCut apps for Mac, Windows, Linux, iOS, and Android.",
		status: {
			text: "Not started",
			type: "default",
		},
	},
];

export const metadata: Metadata = {
	title: "Roadmap - GraceCut",
	description:
		"See what's coming next for GraceCut - the AI-powered video editing platform.",
	openGraph: {
		title: "GraceCut Roadmap - What's Coming Next",
		description:
			"See what's coming next for GraceCut - the AI-powered video editing platform.",
		type: "website",
		images: [
			{
				url: "/open-graph/roadmap.jpg",
				width: 1200,
				height: 630,
				alt: "GraceCut Roadmap",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "GraceCut Roadmap - What's Coming Next",
		description:
			"See what's coming next for GraceCut - the AI-powered video editing platform.",
		images: ["/open-graph/roadmap.jpg"],
	},
};

export default function RoadmapPage() {
	return (
		<BasePage
			title="Roadmap"
			description={`What's coming next for GraceCut (last updated: ${LAST_UPDATED})`}
		>
			<div className="mx-auto flex max-w-4xl flex-col gap-16">
				<div className="flex flex-col gap-6">
					{roadmapItems.map((item, index) => (
						<RoadmapItem key={item.title} item={item} index={index} />
					))}
				</div>
			</div>
		</BasePage>
	);
}

function RoadmapItem({ item, index }: { item: RoadmapItem; index: number }) {
	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center gap-2 text-lg font-medium">
				<span className="leading-normal select-none">{index + 1}</span>
				<h3>{item.title}</h3>
				<StatusBadge status={item.status} className="ml-1" />
			</div>
			<div className="text-foreground/70 leading-relaxed">
				<ReactMarkdownWrapper>{item.description}</ReactMarkdownWrapper>
			</div>
		</div>
	);
}

function StatusBadge({
	status,
	className,
}: {
	status: Status;
	className?: string;
}) {
	return (
		<Badge
			className={cn("shadow-none", className, {
				"bg-green-500! text-white": status.type === "complete",
				"bg-yellow-500! text-white": status.type === "pending",
				"bg-blue-500! text-white": status.type === "info",
				"bg-foreground/10! text-accent-foreground": status.type === "default",
			})}
		>
			{status.text}
		</Badge>
	);
}

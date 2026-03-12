import { OcDataBuddyIcon, OcMarbleIcon } from "@grace-studio/ui/icons";

export const SITE_URL = "http://localhost:3000";

export const SITE_INFO = {
	title: "Grace Studio",
	description:
		"An agentic video editing platform powered by AI. In your browser.",
	url: SITE_URL,
	openGraphImage: "/open-graph/default.jpg",
	twitterImage: "/open-graph/default.jpg",
	favicon: "/favicon.ico",
};

export type ExternalTool = {
	name: string;
	description: string;
	url: string;
	icon: React.ElementType;
};

export const EXTERNAL_TOOLS: ExternalTool[] = [
	{
		name: "Marble",
		description:
			"Modern headless CMS for content management and the blog for Grace Studio",
		url: "https://marblecms.com?utm_source=grace-studio",
		icon: OcMarbleIcon,
	},
	{
		name: "Databuddy",
		description: "GDPR compliant analytics and user insights for Grace Studio",
		url: "https://databuddy.cc?utm_source=grace-studio",
		icon: OcDataBuddyIcon,
	},
];

export const DEFAULT_LOGO_URL = "/logos/grace-studio/svg/logo.svg";

export const SOCIAL_LINKS = {
	x: "https://x.com/gracestudioapp",
	discord: "https://discord.com/invite/Mu3acKZvCp",
};


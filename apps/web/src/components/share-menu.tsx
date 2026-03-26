"use client";

import { useState } from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
	Share2,
	Download,
	Link2,
	Check,
	Twitter,
} from "lucide-react";
import { toast } from "sonner";

interface ShareMenuProps {
	title: string;
	url?: string;
	onDownload?: () => void;
	triggerClassName?: string;
}

export function ShareMenu({
	title,
	url,
	onDownload,
	triggerClassName,
}: ShareMenuProps) {
	const [copied, setCopied] = useState(false);

	const shareUrl = url ?? (typeof window !== "undefined" ? window.location.href : "");

	const handleCopyLink = async () => {
		try {
			await navigator.clipboard.writeText(shareUrl);
			setCopied(true);
			toast.success("Link copied to clipboard");
			setTimeout(() => setCopied(false), 2000);
		} catch {
			toast.error("Failed to copy link");
		}
	};

	const handleNativeShare = async () => {
		if (typeof navigator.share === "function") {
			try {
				await navigator.share({
					title,
					url: shareUrl,
				});
			} catch {
				// User cancelled or share failed
			}
		}
	};

	const handleShareToTwitter = () => {
		const tweetText = encodeURIComponent(
			`Check out "${title}" — made with Grace Studio`,
		);
		const tweetUrl = encodeURIComponent(shareUrl);
		window.open(
			`https://twitter.com/intent/tweet?text=${tweetText}&url=${tweetUrl}`,
			"_blank",
			"noopener,noreferrer",
		);
	};

	const supportsNativeShare =
		typeof navigator !== "undefined" && typeof navigator.share === "function";

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className={triggerClassName}
				>
					<Share2 className="size-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-48">
				{onDownload && (
					<>
						<DropdownMenuItem onClick={onDownload}>
							<Download className="size-4 mr-2" />
							Download
						</DropdownMenuItem>
						<DropdownMenuSeparator />
					</>
				)}
				<DropdownMenuItem onClick={handleCopyLink}>
					{copied ? (
						<Check className="size-4 mr-2 text-green-500" />
					) : (
						<Link2 className="size-4 mr-2" />
					)}
					{copied ? "Copied!" : "Copy link"}
				</DropdownMenuItem>
				{supportsNativeShare && (
					<DropdownMenuItem onClick={handleNativeShare}>
						<Share2 className="size-4 mr-2" />
						Share...
					</DropdownMenuItem>
				)}
				<DropdownMenuItem onClick={handleShareToTwitter}>
					<Twitter className="size-4 mr-2" />
					Share on X
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

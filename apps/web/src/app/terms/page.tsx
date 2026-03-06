import type { Metadata } from "next";
import { BasePage } from "@/app/base-page";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { SOCIAL_LINKS } from "@/constants/site-constants";

export const metadata: Metadata = {
	title: "Terms of Service - GraceCut",
	description:
		"GraceCut's Terms of Service. Fair, transparent terms for our free and AI-powered video editor.",
	openGraph: {
		title: "Terms of Service - GraceCut",
		description:
			"GraceCut's Terms of Service. Fair, transparent terms for our free and AI-powered video editor.",
		type: "website",
	},
};

export default function TermsPage() {
	return (
		<BasePage
			title="Terms of service"
			description="Fair and transparent terms for our free, AI-powered video editor. Contact us if you have any questions."
		>
			<Accordion type="single" collapsible className="w-full">
				<AccordionItem
					value="quick-summary"
					className="rounded-2xl border px-5"
				>
					<AccordionTrigger className="no-underline!">
						Quick summary
					</AccordionTrigger>
					<AccordionContent>
						<h3 className="mb-3 text-lg font-medium">
							You own your content, we own nothing.
						</h3>
						<ol className="list-decimal space-y-2 pl-6">
							<li>
								Your content stays private - basic editing is local, AI features
								use encrypted uploads
							</li>
							<li>
								We never claim ownership of your content, even when processing
								AI features
							</li>
							<li>
								Free for personal and commercial use with no watermarks or
								restrictions
							</li>
							<li>Don't use GraceCut for illegal activities or harassment</li>
							<li>
								Service provided "as is" - we can't guarantee perfect uptime
							</li>
							<li>
								Your data is handled securely and transparently
							</li>
							<li>
								You can delete your account anytime and keep using your exported
								videos
							</li>
						</ol>
						<p className="mt-4">
							Questions? Email us at{" "}
							<a
								href="mailto:support@gracecut.app"
								className="text-primary hover:underline"
							>
								support@gracecut.app
							</a>
						</p>
					</AccordionContent>
				</AccordionItem>
			</Accordion>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Your Content, Your Rights</h2>
				<p>
					<strong>You own everything you create.</strong> GraceCut processes
					basic editing locally on your device. For AI features, content is
					encrypted before upload and we cannot access your original files. We
					make no claims to ownership, licensing, or rights over your videos,
					projects, or any content you create using GraceCut.
				</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>
						Your content remains private and under your control at all times
					</li>
					<li>You retain all intellectual property rights to your content</li>
					<li>
						Even when using AI features, we cannot access your unencrypted
						content
					</li>
					<li>You can export and use your content however you choose</li>
					<li>No watermarks, no licensing restrictions from GraceCut</li>
				</ul>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">How You Can Use GraceCut</h2>
				<p>GraceCut is free for personal and commercial use. You can:</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>
						Create videos for personal, educational, or commercial purposes
					</li>
					<li>Use GraceCut for client work and paid projects</li>
					<li>Share and distribute videos created with GraceCut</li>
					<li>
						Use GraceCut for any lawful purpose without restrictions
					</li>
				</ul>
				<p>
					<strong>What we ask:</strong> Don't use GraceCut for illegal
					activities, harassment, or creating harmful content. Be respectful of
					others and follow applicable laws.
				</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">
					AI Features and Data Processing
				</h2>
				<p>
					GraceCut offers optional AI-powered features that require server
					processing:
				</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>
						AI features (auto captions, content analysis, etc.) are completely
						optional
					</li>
					<li>Your content is encrypted on your device before any upload</li>
					<li>
						We use zero-knowledge encryption - we cannot decrypt your content
					</li>
					<li>Encrypted content is deleted immediately after processing</li>
					<li>
						You maintain full ownership and control of your content throughout
					</li>
				</ul>
				<p>
					By using AI features, you consent to the temporary, encrypted
					processing of your content as described in our Privacy Policy. You can
					always choose to use only local editing features.
				</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Account and Service</h2>
				<p>To use certain features, you may create an account:</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>Provide accurate information when signing up</li>
					<li>Keep your account secure and don't share credentials</li>
					<li>You're responsible for activity under your account</li>
					<li>You can delete your account at any time</li>
				</ul>
				<p>
					GraceCut is provided "as is" without warranties. While we strive for
					reliability, we can't guarantee uninterrupted service.
				</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Third-Party Content</h2>
				<p>
					When using GraceCut, make sure you have the right to use any content
					you import:
				</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>Only upload content you own or have permission to use</li>
					<li>
						Respect copyright, trademarks, and other intellectual property
					</li>
					<li>
						Don't use copyrighted music, images, or videos without permission
					</li>
					<li>You're responsible for any claims related to your content</li>
				</ul>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Limitations and Liability</h2>
				<p>
					GraceCut is provided free of charge. To the extent permitted by law:
				</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>We're not liable for any loss of data or content</li>
					<li>
						Projects are stored in your browser and may be lost if you clear
						browser data
					</li>
					<li>We're not responsible for how you use the service</li>
					<li>Our liability is limited to the maximum extent allowed by law</li>
				</ul>
				<p>
					Since your content stays on your device, we have no way to recover
					lost projects. Consider exporting important videos when finished
					editing.
				</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Service Changes</h2>
				<p>We may update GraceCut and these terms:</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>We'll notify you of significant changes to these terms</li>
					<li>Continued use means you accept any updates</li>
					<li>Major changes will be communicated in advance</li>
				</ul>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Termination</h2>
				<p>You can stop using GraceCut at any time:</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>Delete your account through your profile settings</li>
					<li>Clear your browser data to remove local projects</li>
					<li>Your content remains yours even if you stop using GraceCut</li>
					<li>We may suspend accounts for violations of these terms</li>
				</ul>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Contact Us</h2>
				<p>Questions about these terms or need to report an issue?</p>
				<p>
					Email us at{" "}
					<a
						href="mailto:support@gracecut.app"
						className="text-primary hover:underline"
					>
						support@gracecut.app
					</a>
					, or reach out on{" "}
					<a
						href={SOCIAL_LINKS.x}
						target="_blank"
						rel="noopener"
						className="text-primary hover:underline"
					>
						X (Twitter)
					</a>
					.
				</p>
				<p>
					These terms are governed by applicable law in your jurisdiction. We
					prefer to resolve disputes through friendly discussion.
				</p>
			</section>
			<Separator />
			<p className="text-muted-foreground text-sm">
				Last updated: July 14, 2025
			</p>
		</BasePage>
	);
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/utils/ui";
import { useEditor } from "@/hooks/use-editor";
import {
	TEMPLATE_CATEGORIES,
	TEMPLATES,
	type Template,
	type TemplateCategoryId,
} from "@/constants/home-templates";

export function TemplateGrid() {
	const [activeCategory, setActiveCategory] =
		useState<TemplateCategoryId>("all");
	const [executingId, setExecutingId] = useState<string | null>(null);
	const editor = useEditor();
	const router = useRouter();

	const filteredTemplates =
		activeCategory === "all"
			? TEMPLATES
			: TEMPLATES.filter((template) =>
					template.categories.includes(activeCategory),
				);

	const handleTemplateClick = async (template: Template) => {
		if (executingId) return;
		setExecutingId(template.id);

		try {
			const projectId = await editor.project.createNewProject({
				name: `${template.name} ${template.nameHighlight}`.trim(),
				type: template.type,
			});

			const route =
				template.type === "image"
					? `/images/${projectId}`
					: `/editor/${projectId}`;
			router.push(route);
		} catch (error) {
			toast.error("Failed to create project", {
				description:
					error instanceof Error ? error.message : "Please try again",
			});
			setExecutingId(null);
		}
	};

	return (
		<div className="flex flex-col gap-6">
			{/* Category Filter Tabs */}
			<div className="flex items-center justify-center gap-2 flex-wrap">
				{TEMPLATE_CATEGORIES.map((category) => (
					<button
						key={category.id}
						type="button"
						onClick={() => setActiveCategory(category.id)}
						className={cn(
							"rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
							activeCategory === category.id
								? "bg-foreground text-background"
								: "bg-muted text-muted-foreground hover:bg-muted/80",
						)}
					>
						{category.label}
					</button>
				))}
			</div>

			{/* Template Cards Grid */}
			<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-4">
				{filteredTemplates.map((template) => {
					const isExecuting = executingId === template.id;

					return (
						<button
							key={template.id}
							type="button"
							disabled={executingId !== null}
							onClick={() => handleTemplateClick(template)}
							className="group text-left disabled:opacity-50 disabled:cursor-not-allowed"
						>
							<div className="overflow-hidden rounded-xl relative">
								<div
									className={cn(
										"aspect-[4/3] bg-gradient-to-br transition-transform duration-300 group-hover:scale-105",
										template.gradient,
									)}
								/>
								{isExecuting && (
									<div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
										<div className="size-5 border-2 border-white/80 border-t-transparent rounded-full animate-spin" />
									</div>
								)}
							</div>
							<p className="mt-2 text-xs tracking-wide">
								{template.name && (
									<span className="uppercase">
										{template.name}{" "}
									</span>
								)}
								<span className="font-bold uppercase">
									{template.nameHighlight}
								</span>
							</p>
						</button>
					);
				})}
			</div>
		</div>
	);
}

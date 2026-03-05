"use client";

import { motion } from "motion/react";
import { cn } from "@/utils/ui";

interface SectionWrapperProps {
	children: React.ReactNode;
	className?: string;
	id?: string;
}

export function SectionWrapper({
	children,
	className,
	id,
}: SectionWrapperProps) {
	return (
		<motion.section
			id={id}
			initial={{ opacity: 0, y: 20 }}
			whileInView={{ opacity: 1, y: 0 }}
			viewport={{ once: true, margin: "-100px" }}
			transition={{ duration: 0.6, ease: "easeOut" }}
			className={cn(
				"mx-auto max-w-6xl px-6 py-24 md:py-32",
				className,
			)}
		>
			{children}
		</motion.section>
	);
}

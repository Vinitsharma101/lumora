import { z } from "zod";

const webEnvSchema = z.object({
	// Node
	NODE_ENV: z.enum(["development", "production", "test"]),
	ANALYZE: z.string().optional(),
	NEXT_RUNTIME: z.enum(["nodejs", "edge"]).optional(),

	// Public (available client-side)
	NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
	NEXT_PUBLIC_API_URL: z.url().default("http://localhost:8000"),
	NEXT_PUBLIC_MARBLE_API_URL: z.url(),

	// Server-side (used by blog pages and drizzle-kit CLI)
	DATABASE_URL: z
		.string()
		.startsWith("postgres://")
		.or(z.string().startsWith("postgresql://"))
		.optional(),
	MARBLE_WORKSPACE_KEY: z.string().optional(),

	// Transcription (server-side, optional)
	CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
	R2_ACCESS_KEY_ID: z.string().optional(),
	R2_SECRET_ACCESS_KEY: z.string().optional(),
	R2_BUCKET_NAME: z.string().optional(),
	MODAL_TRANSCRIPTION_URL: z.url().optional(),

	// Legacy (no longer used by web app, kept optional for drizzle config compat)
	BETTER_AUTH_SECRET: z.string().optional(),
	UPSTASH_REDIS_REST_URL: z.url().optional(),
	UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

	// AI providers (moved to FastAPI, kept optional for backwards compat)
	ANTHROPIC_API_KEY: z.string().optional(),
	OPENAI_API_KEY: z.string().optional(),
	GOOGLE_AI_API_KEY: z.string().optional(),

	// External AI services (moved to FastAPI, kept optional for backwards compat)
	ELEVENLABS_API_KEY: z.string().optional(),
	PEXELS_API_KEY: z.string().optional(),
	PIXABAY_API_KEY: z.string().optional(),
});

export type WebEnv = z.infer<typeof webEnvSchema>;

export const webEnv = webEnvSchema.parse(process.env);

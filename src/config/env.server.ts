import { z } from "zod";

const schema = z.object({
	DATABASE_URL: z.string(),
	NODE_ENV: z
		.enum(["development", "production", "test"])
		.default("development"),
});

export const env = schema.parse(process.env);

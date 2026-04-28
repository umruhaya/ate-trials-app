import { z } from "zod";

const schema = z.object({
	VITE_APP_TITLE: z.string(),
});

export const env = schema.parse(import.meta.env);

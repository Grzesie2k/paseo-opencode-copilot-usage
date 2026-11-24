import { z } from "zod";

export const inputSchema = z
  .object({ provider: z.string().min(1), authPath: z.string().min(1) })
  .strict();
export type Input = z.infer<typeof inputSchema>;

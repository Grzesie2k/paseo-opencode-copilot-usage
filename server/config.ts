import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export const PROVIDER = "github-copilot";

export function authPath(env: NodeJS.ProcessEnv = process.env): string {
  return join(
    env.XDG_DATA_HOME || join(env.HOME || homedir(), ".local", "share"),
    "opencode",
    "auth.json",
  );
}

/** GitHub OAuth token (opencode stores it as `refresh`); `access` is a short-lived Copilot token. */
export async function readToken(path: string, provider = PROVIDER): Promise<string | null> {
  try {
    const entry = (JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>)[provider];
    if (!entry || typeof entry !== "object") return null;
    const { type, refresh } = entry as Record<string, unknown>;
    return type === "oauth" && typeof refresh === "string" && refresh.trim() ? refresh.trim() : null;
  } catch {
    return null;
  }
}

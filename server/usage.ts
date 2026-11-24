import { z } from "zod";
import {
  hashAccountKey,
  toneFromUsedPct,
  unavailable,
  windowFromUsedPct,
  type UsageAccount,
  type UsageReport,
} from "@getpaseo/plugin/server/usage";
import type { Input } from "../shared/input.js";
import { authPath, PROVIDER, readToken } from "./config.js";

const responseSchema = z.object({
  login: z.string().optional(),
  copilot_plan: z.string().optional(),
  quota_reset_date: z.string().nullable().optional(),
  quota_snapshots: z.object({
    premium_interactions: z
      .object({
        unlimited: z.boolean().optional(),
        entitlement: z.number().finite(),
        credits_used: z.number().finite().optional(),
        remaining: z.number().finite().optional(),
        percent_remaining: z.number().finite().optional(),
      })
      .optional(),
  }),
});

function userInfo(token: string, fetchApi: typeof fetch): Promise<Response> {
  return fetchApi("https://api.github.com/copilot_internal/user", {
    headers: { Authorization: `token ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
}

export async function discover(
  path = authPath(),
  fetchApi: typeof fetch = fetch,
): Promise<UsageAccount[]> {
  const token = await readToken(path);
  if (!token) return [];
  let login: string | undefined;
  try {
    const response = await userInfo(token, fetchApi);
    if (!response.ok) return [];
    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success) return [];
    login = parsed.data.login;
  } catch {
    return [];
  }
  return [
    {
      key: hashAccountKey(`${path}:${PROVIDER}`),
      label: login ? `OpenCode Copilot (${login})` : "OpenCode Copilot",
      harness: "OpenCode",
      input: { provider: PROVIDER, authPath: path },
    },
  ];
}

export async function fetchUsage(
  input: Input,
  fetchApi: typeof fetch = fetch,
): Promise<UsageReport> {
  const token = await readToken(input.authPath, input.provider);
  if (!token) throw new Error(`Login for "${input.provider}" no longer exists`);
  const response = await userInfo(token, fetchApi);
  if (response.status === 401 || response.status === 403)
    return unavailable({ kind: "rejected", status: response.status, refreshedBy: "opencode" });
  if (!response.ok) throw new Error(`Copilot usage API returned ${response.status}`);

  const data = responseSchema.parse(await response.json());
  const quota = data.quota_snapshots.premium_interactions;
  if (!quota || quota.unlimited || quota.entitlement <= 0)
    return { status: "available", windows: [], balances: [], details: [] };

  const remaining = quota.remaining ?? 0;
  const used = quota.credits_used ?? Math.max(0, quota.entitlement - remaining);
  const pct = Math.min(100, (used / quota.entitlement) * 100);

  return {
    status: "available",
    windows: [
      windowFromUsedPct({
        id: "premium",
        label: "Monthly premium quota",
        shortLabel: "mo",
        utilizationPct: pct,
        resetsAt: data.quota_reset_date ?? null,
        tone: toneFromUsedPct(pct),
      }),
    ],
    balances: [
      {
        id: "premium_credits",
        label: "Premium credits",
        used,
        remaining: Math.max(0, remaining),
        limit: quota.entitlement,
        unit: "credits",
        tone: toneFromUsedPct(pct),
      },
    ],
    details: data.copilot_plan ? [{ id: "plan", label: "Plan", value: data.copilot_plan }] : [],
  };
}

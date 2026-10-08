export const runtime = "nodejs";

type EscapeRankEntry = {
  id?: string;
  studentNo?: string;
  name?: string;
  group?: string;
  tripTeam?: "A" | "B" | "C";
  tripClasses?: string;
  missionId?: string;
  missionTitle?: string;
  place?: string;
  score?: number;
  videoLearningScore?: number;
  elapsedSeconds?: number;
  createdAt?: string;
};

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers ?? {}),
    },
  });
}

function getWebhookUrl() {
  return process.env.TRIP_GOOGLE_SCRIPT_URL ?? process.env.GOOGLE_SHEETS_WEBHOOK_URL;
}

function parseBackendJson(value: string) {
  try {
    return JSON.parse(value) as { ok?: boolean; error?: string; rankings?: unknown };
  } catch {
    return null;
  }
}

function normalizeRankings(value: unknown): EscapeRankEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is EscapeRankEntry => {
      if (!entry || typeof entry !== "object") return false;
      const item = entry as EscapeRankEntry;
      return Boolean(item.missionId) && typeof item.score === "number";
    })
    .slice(0, 1000);
}

export async function GET() {
  const webhookUrl = getWebhookUrl();
  if (!webhookUrl) {
    return json({ ok: false, rankings: [], code: "missing_config" });
  }

  const url = new URL(webhookUrl);
  url.searchParams.set("action", "escape-ranking");

  try {
    const response = await fetch(url, { cache: "no-store" });
    const data = (await response.json()) as { ok?: boolean; error?: string; rankings?: unknown };
    if (!response.ok || data.ok === false) {
      return json(
        { ok: false, rankings: [], code: "ranking_fetch_failed", message: data.error },
        { status: 502 },
      );
    }
    return json({ ok: true, rankings: normalizeRankings(data.rankings) });
  } catch {
    return json({ ok: false, rankings: [], code: "ranking_fetch_failed" }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const webhookUrl = getWebhookUrl();
  if (!webhookUrl) {
    return json({ ok: false, code: "missing_config" }, { status: 501 });
  }

  const body = (await request.json()) as { ranking?: EscapeRankEntry };
  if (!body.ranking?.missionId || typeof body.ranking.score !== "number") {
    return json({ ok: false, code: "invalid_ranking" }, { status: 400 });
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      type: "escape-ranking",
      ranking: body.ranking,
      receivedAt: new Date().toISOString(),
    }),
  });

  const text = await response.text();
  const backend = parseBackendJson(text);
  if (!response.ok || backend?.ok === false) {
    return json(
      {
        ok: false,
        code: "google_script_error",
        message: backend?.error || text || response.statusText,
      },
      { status: 502 },
    );
  }

  return json({ ok: true, message: text || "saved" });
}

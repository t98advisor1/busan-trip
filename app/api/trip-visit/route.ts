export const runtime = "nodejs";

type VisitorCounts = {
  today?: number;
  total?: number;
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

function normalizeCounts(value: unknown): VisitorCounts | null {
  if (!value || typeof value !== "object") return null;
  const item = value as VisitorCounts & { counts?: VisitorCounts };
  const source = item.counts ?? item;
  if (typeof source.today !== "number" || typeof source.total !== "number") return null;
  return {
    today: Math.max(0, Math.round(source.today)),
    total: Math.max(0, Math.round(source.total)),
  };
}

function parseJsonMaybe(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

async function fetchSharedCounts(webhookUrl: string) {
  const url = new URL(webhookUrl);
  url.searchParams.set("action", "visitor-count");
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json();
  return normalizeCounts(data);
}

export async function GET() {
  const webhookUrl = getWebhookUrl();
  if (!webhookUrl) {
    return json({ ok: false, code: "missing_config", counts: null });
  }

  try {
    const counts = await fetchSharedCounts(webhookUrl);
    if (!counts) return json({ ok: false, code: "invalid_counter_response", counts: null }, { status: 502 });
    return json({ ok: true, counts });
  } catch {
    return json({ ok: false, code: "visitor_fetch_failed", counts: null }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const webhookUrl = getWebhookUrl();
  if (!webhookUrl) {
    return json({ ok: false, code: "missing_config", counts: null }, { status: 501 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    dateKey?: string;
    path?: string;
    userAgent?: string;
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        type: "visitor-count",
        dateKey: body.dateKey,
        path: body.path,
        userAgent: body.userAgent,
        receivedAt: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      return json({ ok: false, code: "google_script_error", message, counts: null }, { status: 502 });
    }

    const text = await response.text();
    const parsed = text ? parseJsonMaybe(text) : null;
    if (
      parsed &&
      typeof parsed === "object" &&
      "ok" in parsed &&
      (parsed as { ok?: boolean }).ok === false
    ) {
      return json({ ok: false, code: "google_script_error", counts: null }, { status: 502 });
    }
    const directCounts = normalizeCounts(parsed);
    const counts = directCounts ?? (await fetchSharedCounts(webhookUrl));
    if (!counts) return json({ ok: false, code: "invalid_counter_response", counts: null }, { status: 502 });
    return json({ ok: true, counts });
  } catch {
    return json({ ok: false, code: "visitor_save_failed", counts: null }, { status: 502 });
  }
}

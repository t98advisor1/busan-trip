import { createHmac } from "node:crypto";

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
  ownerKey?: string;
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

// Public ranking privacy: other students' 학번·이름 are masked on the server,
// and a keyed hash (ownerKey) lets the app group one student's chapters
// without ever sending the real identity to other devices.
function hmac(secret: string, value: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

function getOwnerKey(entry: EscapeRankEntry, secret: string) {
  return `k${hmac(secret, `${entry.studentNo ?? ""}|${entry.name ?? ""}`).slice(0, 16)}`;
}

function maskName(value?: string) {
  const name = (value ?? "").trim();
  if (!name || name === "익명") return "익명";
  const chars = [...name];
  if (chars.length === 1) return "*";
  if (chars.length === 2) return `${chars[0]}*`;
  return `${chars[0]}${"*".repeat(chars.length - 2)}${chars[chars.length - 1]}`;
}

function maskStudentNo(value?: string) {
  const studentNo = (value ?? "").trim();
  if (!studentNo) return "";
  if (studentNo.length <= 2) return "*".repeat(studentNo.length);
  return `${studentNo.slice(0, -2)}**`;
}

function toPublicRanking(entry: EscapeRankEntry, secret: string): EscapeRankEntry {
  const id = String(entry.id ?? "");
  const studentNo = (entry.studentNo ?? "").trim();
  const name = (entry.name ?? "").trim();
  const escapedNo = studentNo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const idHasIdentity =
    (studentNo.length > 0 && new RegExp("(^|\\D)" + escapedNo + "(\\D|$)").test(id)) ||
    (name.length > 1 && id.includes(name));
  return {
    ...entry,
    id: !id || idHasIdentity ? `r${hmac(secret, `${id}|${entry.createdAt ?? ""}|${entry.missionId ?? ""}`).slice(0, 16)}` : id,
    studentNo: maskStudentNo(entry.studentNo),
    name: maskName(entry.name),
    ownerKey: getOwnerKey(entry, secret),
  };
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
    return json({
      ok: true,
      rankings: normalizeRankings(data.rankings).map((entry) => toPublicRanking(entry, webhookUrl)),
    });
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

  return json({ ok: true, message: text || "saved", ownerKey: getOwnerKey(body.ranking, webhookUrl) });
}

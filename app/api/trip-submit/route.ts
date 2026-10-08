export const runtime = "nodejs";

type TripRecord = {
  recordType?: "full-record" | "stamp-score" | "escape-score";
  school?: string;
  activity?: string;
  tripTeam?: "A" | "B" | "C";
  tripClasses?: string;
  student?: {
    studentNo?: string;
    name?: string;
    group?: string;
    email?: string;
  };
  score?: number;
  stampScore?: number;
  escapeScore?: number;
  rank?: string;
  stamps?: unknown[];
  checkedSchedule?: unknown[];
  memories?: unknown[];
  missionLogs?: unknown[];
  escapeRankings?: unknown[];
  reflection?: string;
  photoSubmission?: {
    portraitConsent?: boolean;
    folderHint?: string;
    photos?: {
      index?: number;
      name?: string;
      type?: string;
      size?: number;
      dataUrl?: string;
    }[];
  };
  submittedAt?: string;
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

function parseBackendJson(value: string) {
  try {
    return JSON.parse(value) as { ok?: boolean; error?: string };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const record = (await request.json()) as TripRecord;
  const webhookUrl =
    process.env.TRIP_GOOGLE_SCRIPT_URL ?? process.env.GOOGLE_SHEETS_WEBHOOK_URL;

  if (!record.student?.studentNo || !record.student?.name) {
    return json(
      { ok: false, code: "invalid_student", message: "studentNo and name are required" },
      { status: 400 },
    );
  }

  if (
    record.photoSubmission?.photos?.length &&
    !record.photoSubmission.portraitConsent
  ) {
    return json(
      {
        ok: false,
        code: "missing_portrait_consent",
        message: "Portrait consent confirmation is required for photo submissions.",
      },
      { status: 400 },
    );
  }

  if (!webhookUrl) {
    return json(
      {
        ok: false,
        code: "missing_config",
        message: "Set TRIP_GOOGLE_SCRIPT_URL to your Google Apps Script web app URL.",
      },
      { status: 501 },
    );
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      ...record,
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

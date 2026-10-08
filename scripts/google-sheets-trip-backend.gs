/**
 * 2026 신천고등학교 부산 수학여행 웹앱용 Google Sheets/Drive 백엔드.
 *
 * 설치:
 * 1. 기록을 받을 Google Sheet에서 확장 프로그램 > Apps Script를 엽니다.
 * 2. 이 파일 전체를 붙여넣고 저장합니다.
 * 3. 배포 > 새 배포 > 웹 앱을 선택합니다.
 * 4. 실행 사용자: 나, 액세스 권한: 모든 사용자로 배포합니다.
 * 5. 발급된 /exec URL을 Vercel의 TRIP_GOOGLE_SCRIPT_URL에 등록합니다.
 */

const SHEET_ID = ""; // Sheet에 연결된 스크립트라면 비워 둡니다.
const PHOTO_ROOT_FOLDER_ID = ""; // 특정 Drive 폴더를 쓰려면 폴더 ID를 입력합니다.
const PHOTO_ROOT_FOLDER_NAME = "2026 신천고 부산수학여행 제출사진";
const TIME_ZONE = "Asia/Seoul";

const HEADERS = {
  submissions: [
    "submittedAt", "recordType", "school", "activity", "tripTeam", "tripClasses",
    "studentNo", "name", "email", "totalScore", "stampScore", "escapeScore",
    "rank", "stampCount", "checkedScheduleCount", "memoryCount", "missionLogCount",
    "photoCount", "portraitConsent",
  ],
  stamps: [
    "submittedAt", "tripTeam", "studentNo", "name", "day", "place", "stamp",
    "subject", "reward",
  ],
  schedules: [
    "submittedAt", "tripTeam", "studentNo", "name", "day", "date", "time",
    "title", "place", "subject", "note",
  ],
  answers: [
    "submittedAt", "tripTeam", "studentNo", "name", "missionId", "place",
    "question", "studentAnswer", "correctAnswer", "isCorrect", "earnedScore",
    "elapsedSeconds",
  ],
  memories: [
    "submittedAt", "tripTeam", "studentNo", "name", "day", "date", "time",
    "title", "place", "note", "hasPhoto", "photoCount", "photoCaptions", "updatedAt",
  ],
  reflections: [
    "submittedAt", "tripTeam", "studentNo", "name", "email", "reflection",
  ],
  rankings: [
    "id", "studentNo", "name", "tripTeam", "tripClasses", "missionId",
    "missionTitle", "place", "score", "elapsedSeconds", "createdAt",
  ],
  visitors: ["dateKey", "count", "lastVisitedAt"],
  photos: [
    "submittedAt", "tripTeam", "tripClasses", "studentNo", "name", "photoIndex",
    "originalName", "mimeType", "size", "driveFileId", "driveUrl", "folderPath",
    "portraitConsent",
  ],
};

function doGet(e) {
  try {
    const spreadsheet = getSpreadsheet();
    const action = e && e.parameter ? String(e.parameter.action || "") : "";

    if (action === "escape-ranking") {
      return jsonOutput({
        ok: true,
        rankings: readEscapeRankings(spreadsheet),
        servedAt: new Date().toISOString(),
      });
    }

    if (action === "visitor-count") {
      return jsonOutput({
        ok: true,
        counts: readVisitorCounts(spreadsheet),
        servedAt: new Date().toISOString(),
      });
    }

    return jsonOutput({
      ok: true,
      message: "Sincheon trip backend is ready.",
      features: ["records", "rankings", "visitors", "drive-photos"],
    });
  } catch (error) {
    return jsonOutput({ ok: false, error: errorMessage(error) });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const payload = parsePayload(e);
    const spreadsheet = getSpreadsheet();

    if (payload.type === "visitor-count") {
      return jsonOutput({
        ok: true,
        counts: incrementVisitorCount(spreadsheet, payload),
        savedAt: new Date().toISOString(),
      });
    }

    if (payload.type === "escape-ranking") {
      appendEscapeRanking(spreadsheet, payload.ranking || {});
      return jsonOutput({
        ok: true,
        rankings: readEscapeRankings(spreadsheet),
        savedAt: new Date().toISOString(),
      });
    }

    requireStudent(payload);
    appendSubmission(spreadsheet, payload);

    if (payload.recordType === "stamp-score") {
      appendStamps(spreadsheet, payload);
    } else if (payload.recordType === "full-record" || !payload.recordType) {
      appendStamps(spreadsheet, payload);
      appendSchedules(spreadsheet, payload);
      appendAnswers(spreadsheet, payload);
      appendMemories(spreadsheet, payload);
      appendReflection(spreadsheet, payload);
      appendPhotos(spreadsheet, payload);
    }

    return jsonOutput({ ok: true, savedAt: new Date().toISOString() });
  } catch (error) {
    return jsonOutput({ ok: false, error: errorMessage(error) });
  } finally {
    try {
      lock.releaseLock();
    } catch (ignored) {
      // Lock acquisition can fail before ownership is established.
    }
  }
}

function getSpreadsheet() {
  const spreadsheet = SHEET_ID
    ? SpreadsheetApp.openById(SHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error("Google Sheet에 연결된 Apps Script에서 실행하거나 SHEET_ID를 입력해 주세요.");
  }
  return spreadsheet;
}

function parsePayload(e) {
  const body = e && e.postData ? e.postData.contents : "{}";
  try {
    return JSON.parse(body || "{}");
  } catch (error) {
    throw new Error("요청 데이터가 올바른 JSON 형식이 아닙니다.");
  }
}

function requireStudent(payload) {
  if (!valueAt(payload, "student.studentNo") || !valueAt(payload, "student.name")) {
    throw new Error("학번과 이름이 필요합니다.");
  }
}

function appendSubmission(spreadsheet, payload) {
  appendNamedRow(spreadsheet, "Submissions", HEADERS.submissions, {
    submittedAt: payload.submittedAt || new Date().toISOString(),
    recordType: payload.recordType || "full-record",
    school: payload.school || "",
    activity: payload.activity || "",
    tripTeam: payload.tripTeam || "",
    tripClasses: payload.tripClasses || "",
    studentNo: valueAt(payload, "student.studentNo"),
    name: valueAt(payload, "student.name"),
    email: valueAt(payload, "student.email"),
    totalScore: numberValue(payload.score),
    stampScore: numberValue(payload.stampScore),
    escapeScore: numberValue(payload.escapeScore),
    rank: payload.rank || "",
    stampCount: arrayValue(payload.stamps).length,
    checkedScheduleCount: arrayValue(payload.checkedSchedule).length,
    memoryCount: arrayValue(payload.memories).length,
    missionLogCount: arrayValue(payload.missionLogs).length,
    photoCount: arrayValue(valueAt(payload, "photoSubmission.photos")).length,
    portraitConsent: valueAt(payload, "photoSubmission.portraitConsent") ? "yes" : "no",
  });
}

function appendStamps(spreadsheet, payload) {
  arrayValue(payload.stamps).forEach(function (stamp) {
    appendNamedRow(spreadsheet, "Stamps", HEADERS.stamps, {
      submittedAt: payload.submittedAt || new Date().toISOString(),
      tripTeam: payload.tripTeam || "",
      studentNo: valueAt(payload, "student.studentNo"),
      name: valueAt(payload, "student.name"),
      day: stamp.day || "",
      place: stamp.place || "",
      stamp: stamp.stamp || "",
      subject: stamp.subject || "",
      reward: numberValue(stamp.reward),
    });
  });
}

function appendSchedules(spreadsheet, payload) {
  arrayValue(payload.checkedSchedule).forEach(function (event) {
    appendNamedRow(spreadsheet, "ScheduleRecords", HEADERS.schedules, {
      submittedAt: payload.submittedAt || new Date().toISOString(),
      tripTeam: event.team || payload.tripTeam || "",
      studentNo: valueAt(payload, "student.studentNo"),
      name: valueAt(payload, "student.name"),
      day: event.day || "",
      date: event.date || "",
      time: event.time || "",
      title: event.title || "",
      place: event.place || "",
      subject: event.subject || "",
      note: event.note || "",
    });
  });
}

function appendAnswers(spreadsheet, payload) {
  arrayValue(payload.missionLogs).forEach(function (log) {
    appendNamedRow(spreadsheet, "MissionAnswers", HEADERS.answers, {
      submittedAt: log.submittedAt || payload.submittedAt || new Date().toISOString(),
      tripTeam: payload.tripTeam || "",
      studentNo: valueAt(payload, "student.studentNo"),
      name: valueAt(payload, "student.name"),
      missionId: log.missionId || "",
      place: log.place || "",
      question: log.question || "",
      studentAnswer: log.answer || "",
      correctAnswer: log.correctAnswer || "",
      isCorrect: log.isCorrect ? "correct" : "wrong",
      earnedScore: numberValue(log.earnedScore),
      elapsedSeconds: numberValue(log.elapsedSeconds),
    });
  });
}

function appendMemories(spreadsheet, payload) {
  arrayValue(payload.memories).forEach(function (memory) {
    appendNamedRow(spreadsheet, "Memories", HEADERS.memories, {
      submittedAt: payload.submittedAt || new Date().toISOString(),
      tripTeam: payload.tripTeam || "",
      studentNo: valueAt(payload, "student.studentNo"),
      name: valueAt(payload, "student.name"),
      day: memory.day || "",
      date: memory.date || "",
      time: memory.time || "",
      title: memory.title || "",
      place: memory.place || "",
      note: memory.note || "",
      hasPhoto: memory.hasPhoto ? "yes" : "no",
      photoCount: numberValue(memory.photoCount),
      photoCaptions: arrayValue(memory.photoCaptions).join(" | "),
      updatedAt: memory.updatedAt || "",
    });
  });
}

function appendReflection(spreadsheet, payload) {
  appendNamedRow(spreadsheet, "Reflections", HEADERS.reflections, {
    submittedAt: payload.submittedAt || new Date().toISOString(),
    tripTeam: payload.tripTeam || "",
    studentNo: valueAt(payload, "student.studentNo"),
    name: valueAt(payload, "student.name"),
    email: valueAt(payload, "student.email"),
    reflection: payload.reflection || "",
  });
}

function appendEscapeRanking(spreadsheet, ranking) {
  if (!ranking.missionId || typeof ranking.score !== "number") {
    throw new Error("방탈출 랭킹의 챕터와 점수가 필요합니다.");
  }
  appendNamedRow(spreadsheet, "EscapeRankings", HEADERS.rankings, {
    id: ranking.id || Utilities.getUuid(),
    studentNo: ranking.studentNo || "",
    name: ranking.name || "익명",
    tripTeam: ranking.tripTeam || "",
    tripClasses: ranking.tripClasses || "",
    missionId: ranking.missionId || "",
    missionTitle: ranking.missionTitle || "",
    place: ranking.place || "",
    score: numberValue(ranking.score),
    elapsedSeconds: numberValue(ranking.elapsedSeconds),
    createdAt: ranking.createdAt || new Date().toISOString(),
  });
}

function readEscapeRankings(spreadsheet) {
  const sheet = getSheet(spreadsheet, "EscapeRankings", HEADERS.rankings);
  const objects = readNamedRows(sheet);
  const latest = {};

  objects.forEach(function (row) {
    const missionId = String(row.missionId || "");
    if (!missionId) return;
    const studentNo = String(row.studentNo || "");
    const name = String(row.name || "익명");
    const ownerKey = studentNo || name;
    const key = missionId + ":" + ownerKey;
    const entry = {
      id: String(row.id || ""),
      studentNo: studentNo,
      name: name,
      tripTeam: String(row.tripTeam || ""),
      tripClasses: String(row.tripClasses || ""),
      missionId: missionId,
      missionTitle: String(row.missionTitle || ""),
      place: String(row.place || ""),
      score: numberValue(row.score),
      elapsedSeconds: numberValue(row.elapsedSeconds),
      createdAt: dateText(row.createdAt),
    };
    const previous = latest[key];
    if (!previous || dateMillis(entry.createdAt) >= dateMillis(previous.createdAt)) {
      latest[key] = entry;
    }
  });

  return Object.keys(latest)
    .map(function (key) { return latest[key]; })
    .sort(function (a, b) {
      return b.score - a.score || a.elapsedSeconds - b.elapsedSeconds;
    })
    .slice(0, 1000);
}

function incrementVisitorCount(spreadsheet, payload) {
  const sheet = getSheet(spreadsheet, "VisitorCounts", HEADERS.visitors);
  const supplied = String(payload.dateKey || "");
  const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(supplied)
    ? supplied
    : Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM-dd");
  const lastRow = sheet.getLastRow();
  let targetRow = 0;

  if (lastRow >= 2) {
    const dates = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let index = 0; index < dates.length; index += 1) {
      if (normalizeDateKey(dates[index][0]) === dateKey) {
        targetRow = index + 2;
        break;
      }
    }
  }

  if (targetRow) {
    const current = numberValue(sheet.getRange(targetRow, 2).getValue());
    sheet.getRange(targetRow, 2, 1, 2).setValues([[current + 1, new Date().toISOString()]]);
  } else {
    appendNamedRow(spreadsheet, "VisitorCounts", HEADERS.visitors, {
      dateKey: dateKey,
      count: 1,
      lastVisitedAt: new Date().toISOString(),
    });
  }

  return readVisitorCounts(spreadsheet);
}

function readVisitorCounts(spreadsheet) {
  const sheet = getSheet(spreadsheet, "VisitorCounts", HEADERS.visitors);
  const todayKey = Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM-dd");
  let today = 0;
  let total = 0;
  readNamedRows(sheet).forEach(function (row) {
    const count = numberValue(row.count);
    total += count;
    if (normalizeDateKey(row.dateKey) === todayKey) today += count;
  });
  return { today: today, total: total };
}

function normalizeDateKey(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, TIME_ZONE, "yyyy-MM-dd");
  }
  const text = String(value || "").replace(/^'/, "").trim();
  const match = text.match(/^(\d{4})[.\/-]\s*(\d{1,2})[.\/-]\s*(\d{1,2})/);
  if (!match) return text;
  return [match[1], String(Number(match[2])).padStart(2, "0"), String(Number(match[3])).padStart(2, "0")].join("-");
}

function appendPhotos(spreadsheet, payload) {
  const photos = arrayValue(valueAt(payload, "photoSubmission.photos"));
  if (!photos.length) return;
  if (!valueAt(payload, "photoSubmission.portraitConsent")) {
    throw new Error("사진 제출 전 초상권 동의 확인이 필요합니다.");
  }

  const studentNo = String(valueAt(payload, "student.studentNo") || "");
  const name = String(valueAt(payload, "student.name") || "");
  const classFolderName = classFolderFromStudentNo(studentNo);
  const studentFolderName = sanitizeDriveName(studentNo + "_" + name) || "학생_미입력";
  const root = getPhotoRootFolder();
  const classFolder = getOrCreateChildFolder(root, classFolderName);
  const studentFolder = getOrCreateChildFolder(classFolder, studentFolderName);
  const folderPath = PHOTO_ROOT_FOLDER_NAME + "/" + classFolderName + "/" + studentFolderName;

  photos.forEach(function (photo, arrayIndex) {
    const decoded = decodeDataUrl(photo.dataUrl);
    const photoIndex = numberValue(photo.index) || arrayIndex + 1;
    const originalName = sanitizeDriveName(photo.name || "photo-" + photoIndex + ".jpg");
    const extension = extensionForMime(decoded.mimeType);
    const baseName = originalName.replace(/\.[^.]+$/, "") || "photo-" + photoIndex;
    const fileName = sanitizeDriveName(
      studentNo + "_" + name + "_" + String(photoIndex).padStart(2, "0") + "_" + baseName,
    ) + extension;
    const blob = Utilities.newBlob(decoded.bytes, decoded.mimeType, fileName);
    const file = studentFolder.createFile(blob);
    file.setDescription("신천고 부산 수학여행 사진 제출 · " + studentNo + " " + name);

    appendNamedRow(spreadsheet, "PhotoSubmissions", HEADERS.photos, {
      submittedAt: payload.submittedAt || new Date().toISOString(),
      tripTeam: payload.tripTeam || "",
      tripClasses: payload.tripClasses || "",
      studentNo: studentNo,
      name: name,
      photoIndex: photoIndex,
      originalName: photo.name || "",
      mimeType: decoded.mimeType,
      size: numberValue(photo.size) || decoded.bytes.length,
      driveFileId: file.getId(),
      driveUrl: file.getUrl(),
      folderPath: folderPath,
      portraitConsent: "yes",
    });
  });
}

function getPhotoRootFolder() {
  if (PHOTO_ROOT_FOLDER_ID) return DriveApp.getFolderById(PHOTO_ROOT_FOLDER_ID);
  const matches = DriveApp.getFoldersByName(PHOTO_ROOT_FOLDER_NAME);
  return matches.hasNext() ? matches.next() : DriveApp.createFolder(PHOTO_ROOT_FOLDER_NAME);
}

function getOrCreateChildFolder(parent, name) {
  const matches = parent.getFoldersByName(name);
  return matches.hasNext() ? matches.next() : parent.createFolder(name);
}

function classFolderFromStudentNo(studentNo) {
  const digits = String(studentNo || "").replace(/\D/g, "");
  if (digits.length >= 5) {
    return Number(digits.slice(0, 1)) + "학년_" + Number(digits.slice(1, 3)) + "반";
  }
  if (digits.length >= 4) {
    return Number(digits.slice(0, 1)) + "학년_" + Number(digits.slice(1, 2)) + "반";
  }
  return "학급_미확인";
}

function decodeDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("사진 데이터 형식이 올바르지 않습니다.");
  return {
    mimeType: match[1] || "image/jpeg",
    bytes: Utilities.base64Decode(match[2]),
  };
}

function extensionForMime(mimeType) {
  const extensions = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/heic": ".heic",
    "image/heif": ".heif",
  };
  return extensions[mimeType] || ".jpg";
}

function sanitizeDriveName(value) {
  return String(value || "")
    .replace(/[\\/:*?"<>|#%{}~]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function getSheet(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  ensureHeaders(sheet, headers);
  return sheet;
}

function ensureHeaders(sheet, headers) {
  const lastColumn = sheet.getLastColumn();
  const current = lastColumn
    ? sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0]
    : [];
  const merged = current.filter(String);
  headers.forEach(function (header) {
    if (merged.indexOf(header) === -1) merged.push(header);
  });
  if (!merged.length) return;
  sheet.getRange(1, 1, 1, merged.length).setValues([merged]);
  sheet.getRange(1, 1, 1, merged.length)
    .setFontWeight("bold")
    .setBackground("#173140")
    .setFontColor("#ffffff");
  sheet.setFrozenRows(1);
}

function appendNamedRow(spreadsheet, sheetName, headers, values) {
  const sheet = getSheet(spreadsheet, sheetName, headers);
  const actualHeaders = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0];
  const row = actualHeaders.map(function (header) {
    return safeCell(values[header]);
  });
  sheet.appendRow(row);
}

function readNamedRows(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  const headers = values[0].map(String);
  return values.slice(1).map(function (row) {
    const item = {};
    headers.forEach(function (header, index) {
      item[header] = row[index];
    });
    return item;
  });
}

function safeCell(value) {
  if (value === null || typeof value === "undefined") return "";
  if (typeof value === "string" && /^[=+\-@]/.test(value)) return "'" + value;
  return value;
}

function valueAt(object, path) {
  return String(path || "").split(".").reduce(function (value, key) {
    return value === null || typeof value === "undefined" ? "" : value[key];
  }, object);
}

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

function numberValue(value) {
  const number = Number(value || 0);
  return isFinite(number) ? number : 0;
}

function dateText(value) {
  return value instanceof Date ? value.toISOString() : String(value || "");
}

function dateMillis(value) {
  const millis = new Date(value || 0).getTime();
  return isNaN(millis) ? 0 : millis;
}

function errorMessage(error) {
  return error && error.message ? String(error.message) : String(error || "unknown_error");
}

function jsonOutput(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

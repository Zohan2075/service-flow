// Google Drive API helpers for backup/restore.
// Uses the Drive v3 REST API directly — no SDK dependency needed.

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const FILE_NAME = "serviceflow-backup.json";
const MIME = "application/json";

type GoogleApiErrorPayload = {
  error?: {
    message?: string;
    errors?: Array<{
      message?: string;
      reason?: string;
    }>;
  };
};

async function parseDriveError(action: string, res: Response): Promise<Error> {
  let apiMessage = "";
  let reason = "";

  try {
    const payload = (await res.clone().json()) as GoogleApiErrorPayload;
    apiMessage = payload.error?.message?.trim() ?? "";
    reason = payload.error?.errors?.map((item) => item.reason?.trim()).filter(Boolean).join(", ") ?? "";
  } catch {
    try {
      apiMessage = (await res.text()).trim();
    } catch {
      apiMessage = "";
    }
  }

  const detail = `${apiMessage} ${reason}`.trim().toLowerCase();

  if (res.status === 401) {
    return new Error("Google Drive session expired. Sign in again and reconnect Drive.");
  }

  if (res.status === 403) {
    if (
      detail.includes("insufficient authentication scopes") ||
      detail.includes("insufficientpermissions") ||
      detail.includes("forbidden")
    ) {
      return new Error("Google Drive permission is missing. Reconnect Drive and accept the Drive access prompt again.");
    }

    if (
      detail.includes("access not configured") ||
      detail.includes("has not been used in project") ||
      detail.includes("is disabled")
    ) {
      return new Error("Google Drive API is not enabled for this Google Cloud project. Enable it under APIs & Services > Library, then try again.");
    }
  }

  if (apiMessage) {
    return new Error(`${action} failed: ${apiMessage}`);
  }

  return new Error(`${action} failed: ${res.status}`);
}

async function findBackupFile(token: string): Promise<string | null> {
  const q = encodeURIComponent(`name='${FILE_NAME}' and trashed=false`);
  const res = await fetch(
    `${DRIVE_API}/files?q=${q}&spaces=drive&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw await parseDriveError("Drive list", res);
  const data = await res.json();
  return data.files?.[0]?.id ?? null;
}

export async function uploadBackup(token: string, json: string): Promise<void> {
  const existingId = await findBackupFile(token);

  if (existingId) {
    // Update existing file content
    const res = await fetch(
      `${UPLOAD_API}/files/${existingId}?uploadType=media`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": MIME,
        },
        body: json,
      }
    );
    if (!res.ok) throw await parseDriveError("Drive update", res);
  } else {
    // Create with multipart upload (metadata + content)
    const metadata = { name: FILE_NAME, mimeType: MIME };
    const boundary = "serviceflow_boundary";
    const body =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${MIME}\r\n\r\n` +
      `${json}\r\n` +
      `--${boundary}--`;

    const res = await fetch(`${UPLOAD_API}/files?uploadType=multipart`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    });
    if (!res.ok) throw await parseDriveError("Drive create", res);
  }
}

export async function downloadBackup(token: string): Promise<string> {
  const fileId = await findBackupFile(token);
  if (!fileId) throw new Error("No backup found on Google Drive");

  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw await parseDriveError("Drive download", res);
  return res.text();
}

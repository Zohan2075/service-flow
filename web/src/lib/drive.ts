// Google Drive API helpers for backup/restore.
// Uses the Drive v3 REST API directly — no SDK dependency needed.

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const FILE_NAME = "serviceflow-backup.json";
const MIME = "application/json";

async function findBackupFile(token: string): Promise<string | null> {
  const q = encodeURIComponent(`name='${FILE_NAME}' and trashed=false`);
  const res = await fetch(
    `${DRIVE_API}/files?q=${q}&spaces=drive&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Drive list failed: ${res.status}`);
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
    if (!res.ok) throw new Error(`Drive update failed: ${res.status}`);
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
    if (!res.ok) throw new Error(`Drive create failed: ${res.status}`);
  }
}

export async function downloadBackup(token: string): Promise<string> {
  const fileId = await findBackupFile(token);
  if (!fileId) throw new Error("No backup found on Google Drive");

  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Drive download failed: ${res.status}`);
  return res.text();
}

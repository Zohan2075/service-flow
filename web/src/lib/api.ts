const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export async function exchangeDriveCode(
  code: string,
  redirectUri: string = "postmessage"
): Promise<{ access_token: string; refresh_token: string }> {
  const res = await fetch(`${API_URL}/api/v1/drive/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, redirect_uri: redirectUri }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = (body as Record<string, unknown>).detail ?? res.statusText;
    throw new Error(`Drive exchange failed: ${res.status} - ${detail}`);
  }
  return res.json();
}

export async function getDriveToken(jwt: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/v1/drive/token`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok) throw new Error(`Drive token refresh failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export async function revokeDriveToken(jwt: string): Promise<void> {
  await fetch(`${API_URL}/api/v1/drive/revoke`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${jwt}` },
  });
}
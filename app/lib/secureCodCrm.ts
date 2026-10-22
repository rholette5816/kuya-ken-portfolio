import "server-only";

const supabaseUrl = process.env.SECURECOD_CRM_SUPABASE_URL;
const supabaseKey = process.env.SECURECOD_CRM_SUPABASE_SECRET_KEY;

export function secureCodCrmConfigured() {
  return Boolean(supabaseUrl && supabaseKey);
}

async function request(path: string) {
  if (!supabaseUrl || !supabaseKey) throw new Error("Secure COD Express CRM is not configured.");
  const headers: Record<string, string> = {
    apikey: supabaseKey,
    Accept: "application/json"
  };
  if (!supabaseKey.startsWith("sb_secret_")) headers.Authorization = `Bearer ${supabaseKey}`;
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers,
    cache: "no-store"
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body && typeof body === "object" && "message" in body ? String(body.message) : response.statusText;
    throw new Error(`Secure COD Express CRM request failed: ${detail}`);
  }
  return Array.isArray(body) ? body : [];
}

export function crmSelect(table: string, query = "select=*") {
  return request(`${table}?${query}`);
}

export async function crmSelectAll(table: string, query = "select=*", maxRows = 50000) {
  const rows: any[] = [];
  const pageSize = 1000;
  for (let offset = 0; offset < maxRows; offset += pageSize) {
    const batch = await crmSelect(table, `${query}&limit=${pageSize}&offset=${offset}`);
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

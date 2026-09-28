export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const res = await fetch(endpoint, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    // Keep cookies same-origin
    credentials: "include"
  });
  
  const data = await res.json().catch(() => null);
  
  if (!res.ok) {
    throw new Error(data?.error?.message || "An API error occurred");
  }
  
  return data;
}

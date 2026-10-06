export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

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
    throw new ApiError(data?.error?.message || "An API error occurred", res.status, data?.error?.code);
  }
  
  return data;
}

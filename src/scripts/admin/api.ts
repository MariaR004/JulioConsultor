type AdminApiErrorBody = {
  error?: string;
};

export class AdminApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function adminApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const hasFormBody = options.body instanceof FormData;
  if (options.body && !hasFormBody && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    headers
  });
  const body = (await response.json().catch(() => ({}))) as AdminApiErrorBody & T;
  if (!response.ok) {
    throw new AdminApiError(response.status, body.error || "Falha na requisição.");
  }
  return body as T;
}

export async function adminJson<T>(path: string, method: string, body?: unknown) {
  return adminApi<T>(path, {
    body: body === undefined ? undefined : JSON.stringify(body),
    method
  });
}

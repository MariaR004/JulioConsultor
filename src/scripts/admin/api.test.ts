import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminApiError, adminApi, adminJson } from "@/scripts/admin/api";

// ---------------------------------------------------------------------------
// Helpers para construir Response-like mocks
// ---------------------------------------------------------------------------

function makeResponse(options: { ok: boolean; status: number; body?: unknown }): Response {
  const jsonBody = options.body ?? {};
  return {
    ok: options.ok,
    status: options.status,
    json: vi.fn().mockResolvedValue(jsonBody)
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// adminApi — respostas bem-sucedidas
// ---------------------------------------------------------------------------

describe("adminApi — resposta ok", () => {
  it("retorna o body parseado quando response.ok é true", async () => {
    const payload = { id: "abc", name: "Casa" };
    vi.mocked(fetch).mockResolvedValue(makeResponse({ ok: true, status: 200, body: payload }));

    const result = await adminApi<typeof payload>("/api/admin/properties");
    expect(result).toEqual(payload);
  });

  it("passa credentials same-origin na requisição", async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse({ ok: true, status: 200, body: {} }));

    await adminApi("/api/admin/properties");

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect((init as RequestInit).credentials).toBe("same-origin");
  });
});

// ---------------------------------------------------------------------------
// adminApi — respostas de erro
// ---------------------------------------------------------------------------

describe("adminApi — resposta !ok", () => {
  it("lança AdminApiError com o status HTTP correto", async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeResponse({ ok: false, status: 404, body: { error: "Não encontrado." } })
    );

    await expect(adminApi("/api/admin/properties/999")).rejects.toBeInstanceOf(AdminApiError);

    try {
      await adminApi("/api/admin/properties/999");
    } catch (error) {
      expect((error as AdminApiError).status).toBe(404);
    }
  });

  it("usa body.error como mensagem quando presente", async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeResponse({ ok: false, status: 422, body: { error: "Payload inválido." } })
    );

    await expect(adminApi("/api/admin/properties")).rejects.toThrow("Payload inválido.");
  });

  it('usa "Falha na requisição." quando body.error está ausente', async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse({ ok: false, status: 500, body: {} }));

    await expect(adminApi("/api/admin/properties")).rejects.toThrow("Falha na requisição.");
  });

  it('usa "Falha na requisição." quando body.json() rejeita', async () => {
    const response = {
      ok: false,
      status: 503,
      json: vi.fn().mockRejectedValue(new Error("not json"))
    } as unknown as Response;
    vi.mocked(fetch).mockResolvedValue(response);

    await expect(adminApi("/api/admin/properties")).rejects.toThrow("Falha na requisição.");
  });
});

// ---------------------------------------------------------------------------
// adminApi — cabeçalho content-type
// ---------------------------------------------------------------------------

describe("adminApi — cabeçalho content-type", () => {
  it("seta content-type application/json quando body não é FormData", async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse({ ok: true, status: 200, body: {} }));

    await adminApi("/api/admin/properties", {
      method: "POST",
      body: JSON.stringify({ title: "Casa" })
    });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const headers = (init as RequestInit).headers as Headers;
    expect(headers.get("content-type")).toBe("application/json");
  });

  it("NÃO seta content-type quando body é FormData", async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse({ ok: true, status: 200, body: {} }));

    const formData = new FormData();
    formData.set("file", "data");

    await adminApi("/api/admin/photos", {
      method: "POST",
      body: formData
    });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const headers = (init as RequestInit).headers as Headers;
    expect(headers.has("content-type")).toBe(false);
  });

  it("não sobrescreve content-type já definido nas options", async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse({ ok: true, status: 200, body: {} }));

    await adminApi("/api/admin/properties", {
      method: "POST",
      body: "raw",
      headers: { "content-type": "text/plain" }
    });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const headers = (init as RequestInit).headers as Headers;
    expect(headers.get("content-type")).toBe("text/plain");
  });

  it("não seta content-type quando não há body", async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse({ ok: true, status: 200, body: {} }));

    await adminApi("/api/admin/properties", { method: "GET" });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const headers = (init as RequestInit).headers as Headers;
    expect(headers.has("content-type")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// adminJson
// ---------------------------------------------------------------------------

describe("adminJson", () => {
  it("serializa o body com JSON.stringify e repassa o method", async () => {
    const payload = { title: "Casa", price_cents: 100000 };
    vi.mocked(fetch).mockResolvedValue(makeResponse({ ok: true, status: 201, body: { id: "1" } }));

    await adminJson("/api/admin/properties", "POST", payload);

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/admin/properties");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).body).toBe(JSON.stringify(payload));
  });

  it("não inclui body quando body é undefined", async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse({ ok: true, status: 200, body: {} }));

    await adminJson("/api/admin/properties/1", "DELETE");

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect((init as RequestInit).body).toBeUndefined();
  });

  it("retorna o body parseado de adminApi", async () => {
    const serverResponse = { property: { id: "xyz" } };
    vi.mocked(fetch).mockResolvedValue(
      makeResponse({ ok: true, status: 200, body: serverResponse })
    );

    const result = await adminJson<typeof serverResponse>("/api/admin/properties/1", "PATCH", {
      title: "Atualizado"
    });
    expect(result).toEqual(serverResponse);
  });

  it("propaga AdminApiError de adminApi", async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeResponse({ ok: false, status: 401, body: { error: "Não autorizado." } })
    );

    await expect(adminJson("/api/admin/properties", "POST", {})).rejects.toThrow("Não autorizado.");
  });
});

// ---------------------------------------------------------------------------
// AdminApiError
// ---------------------------------------------------------------------------

describe("AdminApiError", () => {
  it("é instância de Error e contém status e message", () => {
    const error = new AdminApiError(403, "Acesso negado.");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AdminApiError);
    expect(error.status).toBe(403);
    expect(error.message).toBe("Acesso negado.");
  });
});

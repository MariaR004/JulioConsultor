import { describe, expect, it } from "vitest";
import { safeJsonScript } from "@/lib/safeJson";

describe("safeJsonScript", () => {
  it("escapes script-closing text while preserving parseable JSON", () => {
    const output = safeJsonScript({ title: "</script><img src=x onerror=alert(1)>" });

    expect(output).not.toContain("</script>");
    expect(output).toContain("\\u003c/script>");
    expect(JSON.parse(output)).toEqual({ title: "</script><img src=x onerror=alert(1)>" });
  });
});

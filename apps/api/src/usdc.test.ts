import { describe, it, expect } from "vitest";
import { formatUsdc, parseUsdc } from "@pact/shared";

describe("usdc helpers", () => {
  it("parses and formats", () => {
    expect(parseUsdc("37.42")).toBe(37_420_000n);
    expect(formatUsdc(37_420_000n)).toBe("37.42");
  });
});

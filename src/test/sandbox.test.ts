import { describe, expect, it } from "vitest";
import { isSandboxEmail } from "@/lib/sandbox";

describe("isSandboxEmail", () => {
  it("returns false for null and undefined", () => {
    expect(isSandboxEmail(null)).toBe(false);
    expect(isSandboxEmail(undefined)).toBe(false);
  });

  it("returns false for non-yopmail email", () => {
    expect(isSandboxEmail("a@b.com")).toBe(false);
  });

  it("returns false for lowercase test email when not yopmail", () => {
    expect(isSandboxEmail("test@b.com")).toBe(false);
  });

  it("returns false for mixed case email when not yopmail", () => {
    expect(isSandboxEmail("qa+TeSt@b.com")).toBe(false);
  });

  it("returns true for yopmail domain", () => {
    expect(isSandboxEmail("random@yopmail.com")).toBe(true);
    expect(isSandboxEmail("random@YOPMAIL.COM")).toBe(true);
  });
});

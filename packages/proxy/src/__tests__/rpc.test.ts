import { describe, it, expect } from "vitest";
import { RPCError, isTlsProtocolError } from "../rpc.js";

// ── RPCError ──

describe("RPCError", () => {
  it("has correct name, message, and code", () => {
    const err = new RPCError("something broke", "unavailable");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("RPCError");
    expect(err.message).toBe("something broke");
    expect(err.code).toBe("unavailable");
  });

  it("is caught by instanceof Error", () => {
    const err = new RPCError("x", "unknown");
    expect(err instanceof Error).toBe(true);
  });
});

// ── isTlsProtocolError ──

describe("isTlsProtocolError", () => {
  it("returns false for non-Error values", () => {
    expect(isTlsProtocolError("EPROTO")).toBe(false);
    expect(isTlsProtocolError(null)).toBe(false);
    expect(isTlsProtocolError(undefined)).toBe(false);
    expect(isTlsProtocolError(42)).toBe(false);
  });

  it("detects EPROTO", () => {
    const err = Object.assign(new Error("tls failed"), { code: "EPROTO" });
    expect(isTlsProtocolError(err)).toBe(true);
  });

  it("detects ECONNRESET", () => {
    const err = Object.assign(new Error("connection reset"), {
      code: "ECONNRESET",
    });
    expect(isTlsProtocolError(err)).toBe(true);
  });

  it("detects 'packet length too long' in message", () => {
    const err = new Error("packet length too long");
    expect(isTlsProtocolError(err)).toBe(true);
  });

  it("detects 'wrong version number' in message", () => {
    const err = new Error("wrong version number");
    expect(isTlsProtocolError(err)).toBe(true);
  });

  it("returns false for generic errors", () => {
    const err = new Error("timeout");
    expect(isTlsProtocolError(err)).toBe(false);
  });

  it("returns false for errors with irrelevant codes", () => {
    const err = Object.assign(new Error("nope"), { code: "ENOTFOUND" });
    expect(isTlsProtocolError(err)).toBe(false);
  });
});

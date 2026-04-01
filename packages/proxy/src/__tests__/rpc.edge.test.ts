import { describe, it, expect } from "vitest";
import { isTlsProtocolError } from "../rpc.js";

describe("isTlsProtocolError — extended", () => {
  it("detects combined EPROTO code and TLS message", () => {
    const err = Object.assign(new Error("wrong version number"), {
      code: "EPROTO",
    });
    expect(isTlsProtocolError(err)).toBe(true);
  });

  it("returns false for Error with unrelated code and message", () => {
    const err = Object.assign(new Error("DNS lookup failed"), {
      code: "ENOTFOUND",
    });
    expect(isTlsProtocolError(err)).toBe(false);
  });

  it("detects 'packet length too long' case-sensitive", () => {
    // The function checks includes(), which is case-sensitive
    const lower = new Error("packet length too long");
    const upper = new Error("PACKET LENGTH TOO LONG");
    expect(isTlsProtocolError(lower)).toBe(true);
    expect(isTlsProtocolError(upper)).toBe(false);
  });

  it("returns false for empty Error", () => {
    expect(isTlsProtocolError(new Error())).toBe(false);
    expect(isTlsProtocolError(new Error(""))).toBe(false);
  });

  it("returns false for objects that look like errors but are not", () => {
    const fakeError = {
      message: "EPROTO",
      code: "EPROTO",
      stack: "fake stack",
    };
    expect(isTlsProtocolError(fakeError)).toBe(false);
  });

  it("returns false for boolean", () => {
    expect(isTlsProtocolError(true)).toBe(false);
    expect(isTlsProtocolError(false)).toBe(false);
  });

  it("detects ECONNRESET with additional message", () => {
    const err = Object.assign(
      new Error("read ECONNRESET at TLSWrap.onStreamRead"),
      { code: "ECONNRESET" },
    );
    expect(isTlsProtocolError(err)).toBe(true);
  });

  it("message check is substring match", () => {
    const err = new Error(
      "error:1408F10B:SSL routines:ssl3_get_record:wrong version number",
    );
    expect(isTlsProtocolError(err)).toBe(true);
  });
});

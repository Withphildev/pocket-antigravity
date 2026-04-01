import { beforeEach, describe, expect, it } from "vitest";
import {
  clearTransportHints,
  forgetTransportHint,
  getPreferredTransport,
  getTransportOrder,
  rememberSuccessfulTransport,
} from "../transport-hints.js";

const target = {
  httpsPort: 19222,
  csrfToken: "test-token",
};

describe("transport hints", () => {
  beforeEach(() => {
    clearTransportHints();
  });

  it("defaults to HTTPS first when no hint exists", () => {
    expect(getPreferredTransport(target)).toBeUndefined();
    expect(getTransportOrder(target)).toEqual(["https", "http"]);
  });

  it("prefers the last successful transport", () => {
    rememberSuccessfulTransport(target, "http");

    expect(getPreferredTransport(target)).toBe("http");
    expect(getTransportOrder(target)).toEqual(["http", "https"]);
  });

  it("clearTransportHints resets preferences", () => {
    rememberSuccessfulTransport(target, "http");

    clearTransportHints();

    expect(getPreferredTransport(target)).toBeUndefined();
    expect(getTransportOrder(target)).toEqual(["https", "http"]);
  });

  it("forgetTransportHint removes only the targeted preference", () => {
    const other = {
      httpsPort: 19223,
      csrfToken: "other-token",
    };
    rememberSuccessfulTransport(target, "http");
    rememberSuccessfulTransport(other, "http");

    forgetTransportHint(target);

    expect(getPreferredTransport(target)).toBeUndefined();
    expect(getPreferredTransport(other)).toBe("http");
  });
});

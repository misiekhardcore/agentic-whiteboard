import { describe, expect, it } from "vitest";

import { ConfigurationError } from "./ConfigurationError";
import { environmentReader } from "./environmentReader";

describe("the environment reader", () => {
  it("trims a setting and treats a blank one as absent", () => {
    const read = environmentReader({ SECRET: "  s3cret \n", BLANK: "   " });

    expect(read.value("SECRET")).toBe("s3cret");
    expect(read.value("BLANK")).toBeNull();
    expect(read.value("UNSET")).toBeNull();
  });

  it("reads an http address without a trailing slash", () => {
    const read = environmentReader({ STORAGE_URL: "http://localhost:8000//" });

    expect(read.origin("STORAGE_URL")).toBe("http://localhost:8000");
    expect(read.origin("UNSET")).toBeNull();
  });

  it("refuses an address with another scheme, naming the setting and its value", () => {
    const read = environmentReader({ STORAGE_URL: "ws://localhost:8000" });

    expect(() => read.origin("STORAGE_URL")).toThrow(ConfigurationError);
    expect(() => read.origin("STORAGE_URL")).toThrow(
      'STORAGE_URL must be an http:// or https:// address, received "ws://localhost:8000".',
    );
  });

  it("refuses an address that is not a URL at all", () => {
    expect(() => environmentReader({ APP_URL: "localhost" }).origin("APP_URL")).toThrow(
      ConfigurationError,
    );
  });

  it("reads a socket address, refusing one a browser cannot open", () => {
    const read = environmentReader({ CANVAS_URL: " wss://canvas.example.com/ " });

    expect(read.socketOrigin("CANVAS_URL")).toBe("wss://canvas.example.com");
    expect(read.socketOrigin("UNSET")).toBeNull();
    expect(() =>
      environmentReader({ CANVAS_URL: "https://canvas.example.com" }).socketOrigin("CANVAS_URL"),
    ).toThrow(ConfigurationError);
  });

  it("reads a listening port, defaulting it and refusing a value that is not one", () => {
    expect(environmentReader({ PORT: " 4200 " }).port("PORT", 4100)).toBe(4200);
    expect(environmentReader({}).port("PORT", 4100)).toBe(4100);
    expect(() => environmentReader({ PORT: "eighty" }).port("PORT", 4100)).toThrow(
      ConfigurationError,
    );
    expect(() => environmentReader({ PORT: "70000" }).port("PORT", 4100)).toThrow(
      ConfigurationError,
    );
  });
});

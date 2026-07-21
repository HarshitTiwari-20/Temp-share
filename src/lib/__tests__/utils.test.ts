import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatBytes,
  formatCountdown,
  generateRoomCode,
  generateAnonymousName,
  pickCursorColor,
  CURSOR_COLORS,
} from "../utils";

describe("formatBytes", () => {
  it("formats zero", () => {
    assert.equal(formatBytes(0), "0 B");
  });

  it("formats kilobytes", () => {
    assert.equal(formatBytes(1024), "1 KB");
  });

  it("formats megabytes", () => {
    assert.equal(formatBytes(1024 * 1024 * 2.5, 1), "2.5 MB");
  });
});

describe("formatCountdown", () => {
  it("formats zero", () => {
    assert.equal(formatCountdown(0), "00:00");
  });

  it("formats minutes and seconds", () => {
    assert.equal(formatCountdown(125000), "02:05");
  });

  it("formats hours", () => {
    const result = formatCountdown(3661000);
    assert.ok(result.includes("1h"));
  });
});

describe("generateRoomCode", () => {
  it("generates 6 digit codes by default", () => {
    for (let i = 0; i < 20; i++) {
      const code = generateRoomCode();
      assert.match(code, /^\d{6}$/);
    }
  });

  it("generates 8 digit codes when requested", () => {
    const code = generateRoomCode(8);
    assert.match(code, /^\d{8}$/);
  });

  it("never includes letters or symbols", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateRoomCode(6);
      assert.ok(/^\d+$/.test(code));
    }
  });
});

describe("generateAnonymousName", () => {
  it("returns non-empty name", () => {
    const name = generateAnonymousName();
    assert.ok(name.length > 3);
    assert.match(name, /\d{2}$/);
  });
});

describe("pickCursorColor", () => {
  it("cycles through palette", () => {
    assert.equal(pickCursorColor(0), CURSOR_COLORS[0]);
    assert.equal(pickCursorColor(CURSOR_COLORS.length), CURSOR_COLORS[0]);
  });
});

// Keep node:test happy when run with --test
export {};

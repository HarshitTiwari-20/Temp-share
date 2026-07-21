import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createRoomSchema,
  joinRoomSchema,
  isAllowedMimeType,
} from "../validations";

describe("createRoomSchema", () => {
  it("accepts valid mixed room", () => {
    const result = createRoomSchema.safeParse({
      type: "MIXED",
      expirationMinutes: 50,
    });
    assert.equal(result.success, true);
  });

  it("rejects expiration over 24h", () => {
    const result = createRoomSchema.safeParse({
      type: "CODE",
      expirationMinutes: 2000,
    });
    assert.equal(result.success, false);
  });

  it("applies defaults", () => {
    const result = createRoomSchema.safeParse({});
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.type, "MIXED");
      assert.equal(result.data.expirationMinutes, 50);
    }
  });
});

describe("joinRoomSchema", () => {
  it("accepts 6 digit code", () => {
    const result = joinRoomSchema.safeParse({ roomCode: "483920" });
    assert.equal(result.success, true);
  });

  it("rejects letters", () => {
    const result = joinRoomSchema.safeParse({ roomCode: "ABC123" });
    assert.equal(result.success, false);
  });

  it("rejects short codes", () => {
    const result = joinRoomSchema.safeParse({ roomCode: "123" });
    assert.equal(result.success, false);
  });
});

describe("isAllowedMimeType", () => {
  it("allows images", () => {
    assert.equal(isAllowedMimeType("image/png"), true);
  });

  it("allows pdf", () => {
    assert.equal(isAllowedMimeType("application/pdf"), true);
  });

  it("allows zip", () => {
    assert.equal(isAllowedMimeType("application/zip"), true);
  });
});

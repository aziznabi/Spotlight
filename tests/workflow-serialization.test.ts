import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

// Resolve the actual serializer used by Workflow, including scoped npm overrides.
const require = createRequire(import.meta.url);
const corePath = require.resolve("@workflow/core");
const devaluePath = createRequire(corePath).resolve("devalue");
let serializer: typeof import("devalue");
let codec: {
  serialize(value: unknown, mode: string): Uint8Array;
  deserialize(value: Uint8Array, mode: string): unknown;
};
beforeAll(async () => {
  serializer = await import(pathToFileURL(devaluePath).href);
  // Exercise Workflow's hardened operations and custom reducers, not just devalue.
  const codecModule = await import(
    new URL("./serialization/codec-devalue.js", pathToFileURL(corePath)).href
  );
  codec = codecModule.devalueCodec;
});

describe("Workflow serialization dependency security and compatibility", () => {
  it("does not serialize bytes outside a Node Buffer view", () => {
    const allocation = Uint8Array.from([81, 82, 83, 84, 85, 86]);
    const view = Buffer.from(allocation.buffer, 2, 2);
    const restored = serializer.parse(serializer.stringify(view)) as Uint8Array;
    expect([...restored]).toEqual([83, 84]);
    expect([...new Uint8Array(restored.buffer)]).toEqual([83, 84]);
    for (const mode of ["client", "step", "workflow"]) {
      const result = codec.deserialize(
        codec.serialize(view, mode),
        mode,
      ) as Uint8Array;
      expect([...result]).toEqual([83, 84]);
      expect([...new Uint8Array(result.buffer)]).toEqual([83, 84]);
    }
  });

  it("retains Workflow's sparse-array allocation limit", () => {
    const encode = (length: number) =>
      new TextEncoder().encode(JSON.stringify([[-7, length]]));
    expect(() => codec.deserialize(encode(100_001), "client")).toThrow(
      /exceeds the maximum/,
    );
    const allowed = codec.deserialize(encode(100_000), "client") as unknown[];
    expect(allowed.length).toBe(100_000);
    expect(Object.keys(allowed)).toHaveLength(0);
  });

  it("rejects coerced prototype keys in null-prototype records", () => {
    const payload = JSON.stringify([
      ["null", ["__proto__"], 1],
      { polluted: 2 },
      true,
    ]);
    expect(() => serializer.parse(payload)).toThrow();
    expect(() =>
      codec.deserialize(new TextEncoder().encode(payload), "client"),
    ).toThrow();
  });

  it("reads a persisted payload produced by Workflow 5.0.1 with devalue 5.9.2", () => {
    const previous =
      '[{"id":1,"status":2,"when":3,"attempts":5},"d7232aa1-33d2-440c-9566-a0083dfe0d44","wait",["Date",4],"2026-10-03T00:00:00.000Z",0]';
    expect(
      codec.deserialize(new TextEncoder().encode(previous), "client"),
    ).toEqual({
      id: "d7232aa1-33d2-440c-9566-a0083dfe0d44",
      status: "wait",
      when: new Date("2026-10-03T00:00:00Z"),
      attempts: 0,
    });
  });

  it("preserves Workflow's legitimate cyclic objects, dates, maps and binary views", () => {
    const source = {
      date: new Date("2026-10-03T00:00:00Z"),
      map: new Map([["status", "claimed"]]),
      bytes: Buffer.from([83, 84]),
      record: Object.assign(Object.create(null), { status: "completed" }),
      self: null as unknown,
    };
    source.self = source;
    for (const mode of ["client", "step", "workflow"]) {
      const result = codec.deserialize(
        codec.serialize(source, mode),
        mode,
      ) as typeof source;
      expect(result.self).toBe(result);
      expect(result.date).toEqual(source.date);
      expect(result.map.get("status")).toBe("claimed");
      expect([...result.bytes]).toEqual([83, 84]);
      expect(result.record.status).toBe("completed");
      expect(Object.getPrototypeOf(result.record)).toBeNull();
    }
  });
});

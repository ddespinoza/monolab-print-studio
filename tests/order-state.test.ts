import { describe, expect, it } from "vitest";
import {
  canSubmit,
  entryMetrics,
  initialState,
  orderReducer,
  submitBlockers,
  totalVolume,
  type OrderAction,
  type OrderState,
} from "@/lib/order-state";
import { computeMetrics } from "@/lib/stl-metrics";

function box(x: number, y: number, z: number): Float32Array {
  const v = [
    [0, 0, 0],
    [x, 0, 0],
    [x, y, 0],
    [0, y, 0],
    [0, 0, z],
    [x, 0, z],
    [x, y, z],
    [0, y, z],
  ];
  const quads = [
    [0, 3, 2, 1],
    [4, 5, 6, 7],
    [0, 1, 5, 4],
    [1, 2, 6, 5],
    [2, 3, 7, 6],
    [3, 0, 4, 7],
  ];
  const out: number[] = [];
  for (const [a, b, c, d] of quads) for (const i of [a, b, c, a, c, d]) out.push(...v[i]);
  return new Float32Array(out);
}

const run = (state: OrderState, ...actions: OrderAction[]): OrderState =>
  actions.reduce(orderReducer, state);
const add = (id: string): OrderAction => ({
  type: "add",
  files: [{ id, name: `${id}.stl`, sizeBytes: 1_000_000 }],
});
const parsed = (id: string, x = 10, y = 10, z = 10): OrderAction => {
  const positions = box(x, y, z);
  return { type: "parsed", id, positions, base: computeMetrics(positions) };
};
const uploaded = (id: string): OrderAction[] => [
  { type: "uploadStart", id },
  { type: "uploadDone", id, token: "a".repeat(32) },
];

describe("orderReducer", () => {
  it("adds files as reading and pending, up to 10", () => {
    const s = run(initialState, add("a"));
    expect(s.files[0]).toMatchObject({
      id: "a",
      parse: "reading",
      scalePercent: 100,
      upload: { status: "pending" },
    });
    const many = run(initialState, {
      type: "add",
      files: Array.from({ length: 12 }, (_, i) => ({ id: `f${i}`, name: "x.stl", sizeBytes: 1 })),
    });
    expect(many.files).toHaveLength(10);
  });
  it("selects the first parsed file", () => {
    const s = run(initialState, add("a"), add("b"), parsed("b"), parsed("a"));
    expect(s.activeId).toBe("b");
  });
  it("marks a parse error without touching other files", () => {
    const s = run(
      initialState,
      add("a"),
      add("b"),
      { type: "parseFailed", id: "a", error: "mal" },
      parsed("b"),
    );
    expect(s.files[0]).toMatchObject({ parse: "error", parseError: "mal" });
    expect(s.files[1].parse).toBe("ready");
  });
  it("auto-fits an oversize model in simple mode and flags it", () => {
    const s = run(initialState, add("a"), parsed("a", 100, 154, 100));
    expect(s.files[0]).toMatchObject({ scalePercent: 49, autoAdjusted: true });
  });
  it("leaves an oversize model alone in advanced mode", () => {
    const s = run({ ...initialState, mode: "advanced" }, add("a"), parsed("a", 100, 154, 100));
    expect(s.files[0]).toMatchObject({ scalePercent: 100, autoAdjusted: false });
    expect(submitBlockers(s)).toContain("exceeds");
  });
  it("auto-fits everything when switching to simple mode", () => {
    const s = run({ ...initialState, mode: "advanced" }, add("a"), parsed("a", 100, 154, 100), {
      type: "setMode",
      mode: "simple",
    });
    expect(s.files[0].scalePercent).toBe(49);
  });
  it("sets and clamps the scale", () => {
    const s = run(initialState, add("a"), parsed("a"), { type: "setScale", id: "a", percent: 400 });
    expect(s.files[0].scalePercent).toBe(250);
    expect(run(s, { type: "setScale", id: "a", percent: 1 }).files[0].scalePercent).toBe(5);
  });
  it("rotating recomputes the metrics and keeps the scale", () => {
    const s = run(
      initialState,
      add("a"),
      parsed("a", 20, 10, 5),
      { type: "setScale", id: "a", percent: 50 },
      { type: "rotate", id: "a", axis: "x" },
    );
    expect(s.files[0].base?.size).toEqual({ x: 20, y: 5, z: 10 });
    expect(s.files[0].scalePercent).toBe(50);
  });
  it("removing the active file selects another", () => {
    const s = run(initialState, add("a"), add("b"), parsed("a"), parsed("b"), {
      type: "remove",
      id: "a",
    });
    expect(s.files.map((f) => f.id)).toEqual(["b"]);
    expect(s.activeId).toBe("b");
  });
  it("tracks upload progress, failure and retry", () => {
    let s = run(
      initialState,
      add("a"),
      { type: "uploadStart", id: "a" },
      { type: "uploadProgress", id: "a", progress: 40 },
    );
    expect(s.files[0].upload).toMatchObject({ status: "uploading", progress: 40 });
    s = run(s, { type: "uploadFailed", id: "a", error: "red" });
    expect(s.files[0].upload).toMatchObject({ status: "failed", error: "red" });
    s = run(s, { type: "uploadStart", id: "a" });
    expect(s.files[0].upload).toMatchObject({ status: "uploading", progress: 0 });
  });
});

describe("selectors", () => {
  const ready = (...ids: string[]): OrderState =>
    run(initialState, ...ids.flatMap((id) => [add(id), parsed(id), ...uploaded(id)]));
  it("entryMetrics applies the scale", () => {
    const s = run(initialState, add("a"), parsed("a", 100, 50, 20), {
      type: "setScale",
      id: "a",
      percent: 50,
    });
    expect(entryMetrics(s.files[0])?.size).toEqual({ x: 50, y: 25, z: 10 });
  });
  it("totalVolume sums ready files at their scale", () => {
    const s = ready("a", "b");
    expect(totalVolume(s)).toBe(2);
  });
  it("canSubmit needs at least one uploaded file", () => {
    expect(canSubmit(initialState)).toBe(false);
    expect(canSubmit(ready("a"))).toBe(true);
  });
  it("blocks while reading, uploading or after an upload failure", () => {
    expect(submitBlockers(run(initialState, add("a")))).toEqual(expect.arrayContaining(["busy"]));
    const failed = run(ready("a"), add("b"), parsed("b"), {
      type: "uploadFailed",
      id: "b",
      error: "x",
    });
    expect(canSubmit(failed)).toBe(false);
    expect(submitBlockers(failed)).toContain("failed");
  });
  it("ignores files that failed to parse", () => {
    const s = run(ready("a"), add("b"), { type: "parseFailed", id: "b", error: "mal" });
    expect(canSubmit(s)).toBe(true);
  });
  it("reset returns to the initial state keeping the mode", () => {
    const s = run({ ...ready("a"), mode: "advanced" }, { type: "reset" });
    expect(s).toEqual({ ...initialState, mode: "advanced" });
  });
});

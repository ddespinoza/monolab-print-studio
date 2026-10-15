import { autoFitPercent, exceedsBuild, scaledMetrics } from "@/lib/fit";
import { rotate90, type Axis } from "@/lib/orient";
import { computeMetrics, totalVolumeCm3, type StlMetrics } from "@/lib/stl-metrics";
import { MAX_FILES } from "@/lib/validation";

export type Mode = "simple" | "advanced";

export interface FileEntry {
  id: string;
  name: string;
  sizeBytes: number;
  parse: "reading" | "ready" | "error";
  parseError?: string;
  /** Triangle positions in the current orientation. */
  positions?: Float32Array;
  /** Metrics at 100 % scale in the current orientation. */
  base?: StlMetrics;
  scalePercent: number;
  autoAdjusted: boolean;
  visible: boolean;
  upload: {
    status: "pending" | "uploading" | "done" | "failed";
    progress: number;
    token?: string;
    error?: string;
  };
}

export interface OrderState {
  files: FileEntry[];
  activeId?: string;
  mode: Mode;
}

export const initialState: OrderState = { files: [], mode: "simple" };

export type OrderAction =
  | { type: "add"; files: { id: string; name: string; sizeBytes: number }[] }
  | { type: "parsed"; id: string; positions: Float32Array; base: StlMetrics }
  | { type: "parseFailed"; id: string; error: string }
  | { type: "uploadStart"; id: string }
  | { type: "uploadProgress"; id: string; progress: number }
  | { type: "uploadDone"; id: string; token: string }
  | { type: "uploadFailed"; id: string; error: string }
  | { type: "remove"; id: string }
  | { type: "select"; id: string }
  | { type: "setScale"; id: string; percent: number }
  | { type: "autoFit"; id: string }
  | { type: "rotate"; id: string; axis: Axis }
  | { type: "toggleVisible"; id: string }
  | { type: "setMode"; mode: Mode }
  | { type: "reset" };

const clamp = (n: number): number => Math.min(250, Math.max(5, Math.round(n)));

function patch(
  state: OrderState,
  id: string,
  change: (f: FileEntry) => Partial<FileEntry>,
): OrderState {
  return { ...state, files: state.files.map((f) => (f.id === id ? { ...f, ...change(f) } : f)) };
}

/** Auto-fit when the model at its current scale exceeds the build volume. */
function fitIfNeeded(f: FileEntry): Partial<FileEntry> {
  if (!f.base) return {};
  const scaled = scaledMetrics(f.base, f.scalePercent);
  if (!exceedsBuild(scaled.size)) return {};
  return { scalePercent: autoFitPercent(f.base.size), autoAdjusted: true };
}

export function orderReducer(state: OrderState, action: OrderAction): OrderState {
  switch (action.type) {
    case "add": {
      const room = MAX_FILES - state.files.length;
      const added: FileEntry[] = action.files.slice(0, Math.max(0, room)).map((f) => ({
        ...f,
        parse: "reading",
        scalePercent: 100,
        autoAdjusted: false,
        visible: true,
        upload: { status: "pending", progress: 0 },
      }));
      return { ...state, files: [...state.files, ...added] };
    }
    case "parsed": {
      let next = patch(state, action.id, () => ({
        parse: "ready",
        positions: action.positions,
        base: action.base,
      }));
      if (state.mode === "simple") next = patch(next, action.id, fitIfNeeded);
      return { ...next, activeId: next.activeId ?? action.id };
    }
    case "parseFailed":
      return patch(state, action.id, () => ({ parse: "error", parseError: action.error }));
    case "uploadStart":
      return patch(state, action.id, () => ({ upload: { status: "uploading", progress: 0 } }));
    case "uploadProgress":
      return patch(state, action.id, (f) => ({
        upload: { ...f.upload, progress: action.progress },
      }));
    case "uploadDone":
      return patch(state, action.id, () => ({
        upload: { status: "done", progress: 100, token: action.token },
      }));
    case "uploadFailed":
      return patch(state, action.id, () => ({
        upload: { status: "failed", progress: 0, error: action.error },
      }));
    case "remove": {
      const files = state.files.filter((f) => f.id !== action.id);
      const activeId =
        state.activeId === action.id ? files.find((f) => f.parse === "ready")?.id : state.activeId;
      return { ...state, files, activeId };
    }
    case "select":
      return { ...state, activeId: action.id };
    case "setScale":
      return patch(state, action.id, () => ({
        scalePercent: clamp(action.percent),
        autoAdjusted: false,
      }));
    case "autoFit":
      return patch(state, action.id, (f) =>
        f.base ? { scalePercent: autoFitPercent(f.base.size), autoAdjusted: true } : {},
      );
    case "rotate":
      return patch(state, action.id, (f) => {
        if (!f.positions) return {};
        const positions = rotate90(f.positions, action.axis);
        return { positions, base: computeMetrics(positions) };
      });
    case "toggleVisible":
      return patch(state, action.id, (f) => ({ visible: !f.visible }));
    case "setMode": {
      const next = { ...state, mode: action.mode };
      return action.mode === "simple"
        ? { ...next, files: next.files.map((f) => ({ ...f, ...fitIfNeeded(f) })) }
        : next;
    }
    case "reset":
      return { ...initialState, mode: state.mode };
  }
}

export function entryMetrics(f: FileEntry): StlMetrics | undefined {
  return f.base ? scaledMetrics(f.base, f.scalePercent) : undefined;
}

const usable = (state: OrderState): FileEntry[] => state.files.filter((f) => f.parse !== "error");

export function totalVolume(state: OrderState): number {
  return totalVolumeCm3(usable(state).flatMap((f) => entryMetrics(f)?.volumeCm3 ?? []));
}

export type Blocker = "empty" | "busy" | "failed" | "exceeds";

/** Why the submit button is disabled; empty when the order can be sent. */
export function submitBlockers(state: OrderState): Blocker[] {
  const files = usable(state);
  const blockers: Blocker[] = [];
  if (files.length === 0) blockers.push("empty");
  if (
    files.some(
      (f) =>
        f.parse === "reading" || f.upload.status === "pending" || f.upload.status === "uploading",
    )
  )
    blockers.push("busy");
  if (files.some((f) => f.upload.status === "failed")) blockers.push("failed");
  if (
    files.some((f) => {
      const m = entryMetrics(f);
      return m ? exceedsBuild(m.size) : false;
    })
  )
    blockers.push("exceeds");
  return blockers;
}

export const canSubmit = (state: OrderState): boolean => submitBlockers(state).length === 0;

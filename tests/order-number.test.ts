import { describe, expect, it } from "vitest";
import { nextOrderNumber } from "@/lib/order-number";

describe("nextOrderNumber", () => {
  it("starts at ML-0001 on an empty sheet", () => {
    expect(nextOrderNumber([])).toBe("ML-0001");
  });
  it("ignores header and junk cells", () => {
    expect(nextOrderNumber(["ID Pedido", "", "foo", "ML-12x"])).toBe("ML-0001");
  });
  it("uses the max suffix, not the count or last row", () => {
    expect(nextOrderNumber(["ML-0003", "ML-0010", "ML-0002"])).toBe("ML-0011");
  });
  it("zero-pads to 4 digits and grows past 9999", () => {
    expect(nextOrderNumber(["ML-0009"])).toBe("ML-0010");
    expect(nextOrderNumber(["ML-9999"])).toBe("ML-10000");
  });
});

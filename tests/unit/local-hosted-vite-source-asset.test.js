import { describe, expect, it } from "vitest";
import { decodeViteRawSourceAsset } from "../../scripts/local-hosted/vite-source-asset.mjs";

describe("local hosted Vite source asset decoding", () => {
  it("preserves legacy raw CSS responses byte for byte", () => {
    const css = Buffer.from(".card { color: #06b6d4; }\n", "utf8");

    expect(decodeViteRawSourceAsset(css, "text/css; charset=utf-8")).toEqual(css);
  });

  it("decodes Vite 7 raw modules without evaluating served JavaScript", () => {
    const css = "@import \"./base.css\";\n.card::after { content: \"\\\\ok\"; }\n";
    const response = Buffer.from(
      `export default ${JSON.stringify(css)}\n//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozfQ==`,
      "utf8"
    );

    expect(decodeViteRawSourceAsset(response, "text/javascript").toString("utf8")).toBe(css);
    expect(decodeViteRawSourceAsset(response, "text/css; charset=utf-8").toString("utf8")).toBe(css);
  });

  it("fails closed for an unexpected JavaScript response", () => {
    expect(() => decodeViteRawSourceAsset("console.log('unexpected')", "text/javascript"))
      .toThrow("expected export-default module contract");
  });
});

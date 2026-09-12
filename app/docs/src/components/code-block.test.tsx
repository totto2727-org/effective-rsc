import { beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";

import type { CodeLanguage } from "./code-block";

let CodeBlock: typeof import("./code-block").CodeBlock;
let offlineMarkup: string;

const decodeText = (value: string) =>
  value.replace(/&(amp|lt|gt|quot|#x27);/g, (entity) => {
    switch (entity) {
      case "&amp;":
        return "&";
      case "&lt;":
        return "<";
      case "&gt;":
        return ">";
      case "&quot;":
        return '"';
      case "&#x27;":
        return "'";
      default:
        throw new TypeError(`Unexpected escaped entity: ${entity}`);
    }
  });

// Inspect React's serialized text without executing markup. Real browser parsing,
// computed colors and no-JavaScript rendering are covered by docs.e2e.ts.
const serializedCodeText = (html: string) => {
  const body = html.match(/<code>([\s\S]*?)<\/code>/)?.[1];
  expect(body).toBeDefined();
  return decodeText(body!.replace(/<\/?span\b[^>]*>/g, ""));
};

beforeAll(async () => {
  // Load the actual component only after denying network and WASM startup.
  // Restoring in finally also covers a failed import or renderer initialization.
  vi.resetModules();
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
    throw new Error("CodeBlock must initialize and render without network access.");
  });
  const instantiate = vi.spyOn(WebAssembly, "instantiate").mockImplementation(() => {
    throw new Error("CodeBlock must not instantiate WebAssembly.");
  });
  const compile = vi.spyOn(WebAssembly, "compile").mockImplementation(() => {
    throw new Error("CodeBlock must not compile WebAssembly.");
  });
  try {
    ({ CodeBlock } = await import("./code-block"));
    offlineMarkup = renderToStaticMarkup(
      CodeBlock({ code: 'const message = "日本語";\n', language: "typescript" }),
    );
    for (const [language, code] of fixtures) {
      expect(serializedCodeText(renderToStaticMarkup(CodeBlock({ code, language })))).toBe(code);
    }
    expect(fetch).not.toHaveBeenCalled();
    expect(instantiate).not.toHaveBeenCalled();
    expect(compile).not.toHaveBeenCalled();
  } finally {
    fetch.mockRestore();
    instantiate.mockRestore();
    compile.mockRestore();
  }
});

const fixtures = [
  ["tsx", 'const Page = () => <main title="資料">日本語 🐙</main>;\n'],
  ["typescript", "export type Env = { readonly label: string };\n"],
  ["ts", "const count: number = 42;\n"],
  ["javascript", "export const answer = 42;\n"],
  ["js", 'console.log("hello");\n'],
  ["jsx", "const page = <h1>Hello</h1>;\n"],
  ["json", '{ "label": "Workers", "count": 1 }\n'],
  ["jsonc", '{\n  // Local bindings\n  "vars": { "APP_LABEL": "資料" },\n}\n'],
  ["bash", 'BASE=ed886996\ngit show "$BASE:packages/effective-rsc/package.json"\n'],
  ["sh", "vp install\nvp build\n"],
  ["shell", "(cd tests/e2e && vp run test)\n"],
  ["diff", '--- a/package.json\n+++ b/package.json\n@@ -1 +1 @@\n-"0.1.4"\n+"0.1.4-workers.0"\n'],
  ["css", ".code { color: #e1e4e8; }\n"],
  ["text", "├─ src/\n└─ 日本語の説明\n"],
] as const satisfies readonly (readonly [CodeLanguage, string])[];

describe("server CodeBlock", () => {
  it("initializes and highlights offline with a dark palette and real tokens", () => {
    expect(offlineMarkup).toContain('class="shiki github-dark"');
    expect(offlineMarkup).toContain('data-code-block=""');
    expect(offlineMarkup).toContain('data-language="typescript"');
    expect(offlineMarkup).toContain('tabindex="0"');
    expect(offlineMarkup).toContain("background-color:#24292e");
    expect(offlineMarkup).toContain('class="line"');
    expect(
      new Set([...offlineMarkup.matchAll(/style="color:(#[\da-f]+)/gi)].map((hit) => hit[1])).size,
    ).toBeGreaterThan(1);
    expect(serializedCodeText(offlineMarkup)).toBe('const message = "日本語";\n');
  });

  it.each(fixtures)("preserves exact source for the finite %s language", (language, code) => {
    const html = renderToStaticMarkup(CodeBlock({ code, language }));
    expect(serializedCodeText(html)).toBe(code);
    expect(html).toContain('class="line"');
    expect(html).not.toContain("<script");
  });

  it.each([
    "",
    "\n",
    "\n\n",
    "no trailing newline",
    "\t leading and trailing \t ",
    "a\r\nb\r\n",
    "a\rb\rc",
    "a\r\nb\rc\n\n",
  ])("preserves serialized whitespace and line endings for %j", (code) => {
    // HTML parsers normalize literal carriage returns. This specifically checks
    // that token rendering does not itself normalize or append source bytes.
    expect(serializedCodeText(renderToStaticMarkup(CodeBlock({ code, language: "tsx" })))).toBe(
      code,
    );
  });

  it("escapes hostile markup as text instead of accepting HTML or event handlers", () => {
    const code =
      '</code></pre><script>globalThis.pwned = true</script><img src=x onerror="boom()"> &amp; \' "';
    const html = renderToStaticMarkup(CodeBlock({ code, language: "tsx" }));
    expect(serializedCodeText(html)).toBe(code);
    expect(new Set([...html.matchAll(/<\/?([a-z][a-z0-9]*)\b/g)].map((hit) => hit[1]))).toEqual(
      new Set(["pre", "code", "span"]),
    );
    expect(html).not.toMatch(/<[^>]+\bonerror\s*=/);
  });

  it("uses explicit text mode by default and does not silently fall back for bad wiring", () => {
    expect(renderToStaticMarkup(CodeBlock({ code: "plain" }))).toContain('data-language="text"');
    expect(() =>
      CodeBlock({ code: "unknown", language: "not-registered" as CodeLanguage }),
    ).toThrow("unsupported language");
  });

  it("does not leak previous grammar state between repeated renders", () => {
    const code = "const number = 42;\n";
    const before = renderToStaticMarkup(CodeBlock({ code, language: "ts" }));
    CodeBlock({ code: "/* unfinished comment", language: "ts" });
    expect(renderToStaticMarkup(CodeBlock({ code, language: "ts" }))).toBe(before);
  });
});

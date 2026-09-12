import { Fragment, type CSSProperties } from "react";
import { createHighlighterCoreSync } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import bash from "shiki/langs/bash.mjs";
import css from "shiki/langs/css.mjs";
import diff from "shiki/langs/diff.mjs";
import javascript from "shiki/langs/javascript.mjs";
import json from "shiki/langs/json.mjs";
import jsonc from "shiki/langs/jsonc.mjs";
import jsx from "shiki/langs/jsx.mjs";
import tsx from "shiki/langs/tsx.mjs";
import typescript from "shiki/langs/typescript.mjs";
import githubDark from "shiki/themes/github-dark.mjs";
import type { TokenStyles } from "shiki/types";

// Imported by RSC content modules, never by the client shell. All registrations are
// local static imports: no bundle loader, network request, or Oniguruma/WASM asset.
// https://shiki.style/guide/bundles#fine-grained-bundle
// https://shiki.style/guide/regex-engines#javascript-regexp-engine
const highlighter = createHighlighterCoreSync({
  engine: createJavaScriptRegexEngine(),
  langs: [bash, css, diff, javascript, json, jsonc, jsx, tsx, typescript],
  themes: [githubDark],
});

const languages = {
  bash: "bash",
  css: "css",
  diff: "diff",
  javascript: "javascript",
  js: "javascript",
  json: "json",
  jsonc: "jsonc",
  jsx: "jsx",
  sh: "bash",
  shell: "bash",
  text: "text",
  ts: "typescript",
  tsx: "tsx",
  typescript: "typescript",
} as const;

export type CodeLanguage = keyof typeof languages;

export interface CodeBlockProps {
  readonly code: string;
  readonly language?: CodeLanguage;
}

const theme = highlighter.getTheme("github-dark");
const rootStyle: CSSProperties = { color: theme.fg, backgroundColor: theme.bg };

const tokenStyle = (token: TokenStyles): CSSProperties => {
  // TextMate's fontStyle flags are italic=1, bold=2, underline=4.
  const flags = token.fontStyle ?? 0;
  return {
    color: token.color ?? theme.fg,
    ...(token.bgColor === undefined ? {} : { backgroundColor: token.bgColor }),
    ...(flags & 1 ? { fontStyle: "italic" } : {}),
    ...(flags & 2 ? { fontWeight: "bold" } : {}),
    ...(flags & 4 ? { textDecoration: "underline" } : {}),
  };
};

/** Server-rendered tokens stay text nodes, including HTML-looking source excerpts. */
export function CodeBlock({ code, language = "text" }: CodeBlockProps) {
  if (!Object.hasOwn(languages, language)) {
    throw new TypeError("CodeBlock received an unsupported language.");
  }
  const lang = languages[language];
  const lines = highlighter.codeToTokensBase(code, { lang, theme: "github-dark" });
  // Shiki omits line delimiters from tokens. Reinsert the original delimiters,
  // not an unconditional trailing newline or trimmed/normalized source string.
  const endings = code.match(/\r?\n/g) ?? [];

  return (
    <pre
      className="shiki github-dark"
      data-code-block=""
      data-language={lang}
      style={rootStyle}
      tabIndex={0}
    >
      <code>
        {lines.map((line, lineIndex) => (
          <Fragment key={lineIndex}>
            <span className="line">
              {line.map((token, tokenIndex) => (
                <span key={tokenIndex} style={tokenStyle(token)}>
                  {token.content}
                </span>
              ))}
            </span>
            {endings[lineIndex] ?? ""}
          </Fragment>
        ))}
      </code>
    </pre>
  );
}

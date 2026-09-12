import { CodeBlock, type CodeLanguage } from "../components/code-block";

export interface CoreSource {
  readonly path: string;
  readonly code: string;
  readonly language: CodeLanguage;
}

export function SourceExcerpt({ source }: { readonly source: CoreSource }) {
  return (
    <figure data-core-source={source.path}>
      <figcaption>
        <code>{source.path}</code> の抜粋
      </figcaption>
      <CodeBlock code={source.code} language={source.language} />
    </figure>
  );
}

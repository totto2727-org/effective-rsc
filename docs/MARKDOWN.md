# Markdown integration

## Purpose

This document describes the repository's Markdown integration and its verification boundaries.
For application setup and the public API, see [the package README](../packages/markdown/README.md).
The runnable example is `examples/markdown`.

## Responsibilities

Vite discovers documents with `import.meta.glob` and imports their contents with `?raw`.
Vite also resolves assets with `?url` and owns their development URLs, production emission, and hashing.
The Markdown package consumes those maps rather than implementing a filesystem loader, asset copier, or bundler.

The package maps source files to application URLs while preserving directory hierarchy.
For example, `content/index.md` maps to `/manual` and `content/guide/deep/details.md` maps to `/manual/guide/deep/details`.
Relative document links resolve from their containing source file and retain queries and fragments.
Asset references use URLs supplied by Vite.

`createMarkdownCollection`, `parseMarkdown`, and URL resolvers expose expected failures through `MarkdownError` in Effect's error channel.
Collection entries and `get` remain ordinary values and lookup operations.
A missing document is a lookup miss, allowing the application's catch-all middleware to return 404 before streaming.
Core delegates URL matching and decoding to Effect HTTP and only translates the named catch-all capture.
Collection lookup preserves segment boundaries and decodes each URL segment once, including literal percent filenames.

## collection.ts の処理フロー

対象: [`packages/markdown/src/collection.ts`](../packages/markdown/src/collection.ts)。
このファイルはViteが読み込んだ文字列・アセットURLを索引化します。
Markdownの構文解析とReact描画は別の処理です。

### 1. コレクション生成

`createMarkdownCollection(options)`はEffectを返し、以下の処理はそのEffectを実行したときに行われます。
`documents`は`?raw`の文字列マップ、`assets`は`?url`のURLマップです。

```mermaid
flowchart TD
    A["Effect実行: source / basePath / documents / assets"] --> B["sourceとbasePathをセグメント化"]
    B --> C{"設定条件を満たすか"}
    C -->|いいえ| E["MarkdownErrorでEffect失敗"]
    C -->|はい| D["公開URL索引・ソース索引・アセット索引を作成"]
    D --> F{"未処理のアセットがあるか"}
    F -->|はい| G{"globキーがsource配下か"}
    G -->|いいえ| E
    G -->|はい| H["キーをセグメント単位でencodeして登録<br/>値はViteのURLをそのまま保持"]
    H --> F
    F -->|いいえ| I{"未処理のMarkdownがあるか"}
    I -->|はい| J{"globキーがsource配下で<br/>ファイル名が.mdで終わるか"}
    J -->|いいえ| E
    J -->|はい| K["sourceからの相対階層とbasePathを結合<br/>.mdを除去し、indexはディレクトリURLへ"]
    K --> L["各セグメントをencodeして公開URLを作成"]
    L --> M{"公開URLが重複するか"}
    M -->|はい| E
    M -->|いいえ| N["本文・URL・参照解決関数を持つEntryを作成<br/>公開URLとソースの両索引へ登録"]
    N --> I
    I -->|いいえ| O["URL順のentries / get / resolveLink / resolveImageを返す"]
```

設定確認では、`source`が`./`で始まる空でないディレクトリであること、`basePath`が`/`で始まりquery・fragmentを含まないこと、いずれにも`..`セグメントがないことを確認します。
globキーにも`./`・source配下・`..`なしを求め、`.md`だけのファイル名は受け付けません。
例: `./content/guide/index.md` → `/manual/guide`、`./content/guide/start.md` → `/manual/guide/start`。

### 2. リクエストURLからEntryを検索

`get(pathname)`は同期的なMap検索で、Effectではありません。
見つからない場合は`undefined`を返し、404にする判断は呼び出し側が担当します。

```mermaid
flowchart TD
    A["get: リクエストのpathname"] --> B["最初のquery / fragment以降を取り除く"]
    B --> C{"先頭が / か"}
    C -->|いいえ| X["undefined"]
    C -->|はい| D["単独の末尾 / を除去<br/>連続 / は保持"]
    D --> E["先頭 / を除去してセグメントに分割"]
    E --> F["各セグメントを1回decode<br/>decode失敗時は元の文字列を保持"]
    F --> G["各セグメントを再encodeして索引キーを作成"]
    G --> H{"公開URL索引に存在するか"}
    H -->|はい| Y["MarkdownEntry"]
    H -->|いいえ| X
```

分割してからdecodeするため、セグメント内のencoded slashがディレクトリ境界へ変わることはありません。
ファイル名が文字列として`%20`を含む場合も、URLの`%2520`を二重decodeせず検索します。

### 3. Markdown内のリンク・画像参照を解決

`resolveLink`と`resolveImage`は共通の`resolveLocal`を使うEffectです。
前者はMarkdownファイルをページURLへ解決でき、後者はアセット索引だけを使います。

```mermaid
flowchart TD
    A["resolveLink / resolveImageのEffect実行"] --> B{"参照が # / またはschemeで始まるか"}
    B -->|はい| C["参照をそのまま返す"]
    B -->|いいえ| D["パスとquery / fragmentのsuffixを分離"]
    D --> E{"パスが空か"}
    E -->|はい| F["現在のEntry URL + suffixを返す"]
    E -->|いいえ| G["元Markdownのディレクトリを基準にする"]
    G --> H["参照を分割し各セグメントを1回decode<br/>失敗時は元の文字列を保持"]
    H --> I["空とドットは読み飛ばす<br/>..は親へ移動、その他は追加"]
    I --> J{"..によってsourceの外へ出るか"}
    J -->|はい| X["MarkdownErrorでEffect失敗"]
    J -->|いいえ| K["sourceと解決済み相対パスを結合<br/>セグメント単位でencode"]
    K --> L{"リンクであり、対象が.mdか"}
    L -->|はい| M["ソース索引からEntryの公開URLを取得"]
    L -->|いいえ| N["アセット索引からViteのURLを取得"]
    M --> O{"対象が見つかったか"}
    N --> O
    O -->|いいえ| X
    O -->|はい| P["取得したURL + suffixを返す"]
```

外部URLやルート相対URLのポリシーはComark・アプリケーション側に委譲します。
アセットの読み込み・変換・出力はViteの担当で、この処理は渡されたURLを検索するだけです。
suffixは文字列として末尾へ追加し、既存URLのqueryを再構成・マージしません。

## Rendering

Parsing retains Comark's standard defaults and adds the mdts plugins for footnotes, math, Mermaid with Tokyo Night, and Shiki.
`parseMarkdown` prepares a Comark document and resolves link/image attributes before rendering.
Applications import Comark's standard `MarkdownDocument` directly and supply their own component mappings.
The package provides no React renderer factory, forced component mappings, or custom Math/Mermaid SSR replacements.

Content and plugins are trusted authored inputs.
This integration is not a sanitizer for untrusted submissions.
Standard Comark document rendering does not automatically register its separate Math/Mermaid components; rich no-JavaScript rendering is tracked in [the roadmap](ROADMAP.md#standard-rendering-and-deferred-rich-ssr).

## Verification

- Repository root: `vp run check` and `vp run test` validate formatting, lint, types, collection errors, URL mapping, parsing, and core contracts.
- `tests/e2e-build`: `vp run test` builds a dedicated fixture and runs browser checks against standalone Wrangler.
- `tests/e2e-dev`: `vp run test` starts Vite development and verifies Markdown edits, additions, and deletion using a minimal fixture.
- Each E2E project has its own fixed Vite and Playwright configuration and only the fixture assets needed for its tests.
- Temporary mutable fixture copies and artifacts stay in ignored package-local `tmp` directories.

Typed metadata, relationships, loaders, and richer SSR support remain separate roadmap items.

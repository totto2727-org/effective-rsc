import type { DocPage } from "./types";
import { CodeBlock } from "../components/code-block";

const baseline = "ed886996d1d3780b94166af4f798c53416d547c8";
const comparison = "9058a71dcb522ffed8eb838ef9aef3c69953dfe7";
const injectorFix = "214149b697845a0b033701656ec5d8ac89738269";
const upstream = `https://github.com/nikhilsnayak/effective-rsc/blob/${baseline}`;

interface ReadingSnippet {
  readonly id: string;
  readonly kind: "show" | "diff";
  readonly path: string;
  readonly revision: string;
  readonly selection: string;
  readonly command: string;
  readonly code: string;
}

// These excerpts were extracted from the immutable Git objects, not from the working tree.
// Escaped blank diff context lines preserve Git whitespace without trailing source whitespace.
const snippets = {
  "package-version": {
    id: "package-version",
    kind: "diff",
    path: "packages/effective-rsc/package.json",
    revision: "9058a71dcb522ffed8eb838ef9aef3c69953dfe7",
    selection: "実際の diff から 2 hunk を抜粋（他の hunk は省略、前後文脈 0 行）",
    command:
      "git diff --no-ext-diff --no-color --unified=0 ed886996d1d3780b94166af4f798c53416d547c8 9058a71dcb522ffed8eb838ef9aef3c69953dfe7 -- packages/effective-rsc/package.json",
    code: `diff --git a/packages/effective-rsc/package.json b/packages/effective-rsc/package.json
index a6d8558e..06a7939e 100644
--- a/packages/effective-rsc/package.json
+++ b/packages/effective-rsc/package.json
@@ -3,2 +3,2 @@
-  "version": "0.1.4",
-  "description": "An experimental, Effect-native React Server Components framework for Bun.",
+  "version": "0.1.4-workers.0",
+  "description": "Effect-native React Server Components with a Web fetch core and Vite/Cloudflare Workers integration.",
@@ -6 +6 @@
-    "bun",
+    "cloudflare-workers",`,
  },
  "http-layer": {
    id: "http-layer",
    kind: "diff",
    path: "packages/effective-rsc/src/server/application.ts",
    revision: "9058a71dcb522ffed8eb838ef9aef3c69953dfe7",
    selection: "実際の diff から 1 hunk を抜粋（他の hunk は省略、前後文脈 3 行）",
    command:
      "git diff --no-ext-diff --no-color --unified=3 ed886996d1d3780b94166af4f798c53416d547c8 9058a71dcb522ffed8eb838ef9aef3c69953dfe7 -- packages/effective-rsc/src/server/application.ts",
    code: `diff --git a/packages/effective-rsc/src/server/application.ts b/packages/effective-rsc/src/server/application.ts
index c8f612b3..94bf31bd 100644
--- a/packages/effective-rsc/src/server/application.ts
+++ b/packages/effective-rsc/src/server/application.ts
@@ -302,14 +254,7 @@ const httpLayer = <Services, ApplicationError>(
     }),
   );
\x20
-  return Layer.mergeAll(StaticAssetsLayer, PublicAssetsLayer).pipe(
-    Layer.provideMerge(ApplicationRoutesLayer),
-  );
+  return ApplicationRoutesLayer;
 };
\x20
-const serverLayer = <Services, ApplicationError>(
-  application: ApplicationDefinition<Services, ApplicationError>,
-): ServerApplicationLayer<ApplicationError> =>
-  HttpRouter.serve(httpLayer(application)).pipe(Layer.provide(BunServerLayer));
-
-export const ServerApplication = { httpLayer, serverLayer };
+export const ServerApplication = { httpLayer };`,
  },
  "fetch-handler": {
    id: "fetch-handler",
    kind: "show",
    path: "packages/effective-rsc/src/workers.ts",
    revision: "9058a71dcb522ffed8eb838ef9aef3c69953dfe7",
    selection: "108–138行（表示外の行は省略）",
    command:
      "git show 9058a71dcb522ffed8eb838ef9aef3c69953dfe7:packages/effective-rsc/src/workers.ts | sed -n '108,138p'",
    code: `export const createFetchHandler =
  <Services, ApplicationError>(
    application: ApplicationDefinition<Services, ApplicationError>,
  ): FetchHandler =>
  async (request, env, executionContext) => {
    if (bodyTooLarge(request)) {
      return new Response("Request body exceeds the 10 MiB limit.", { status: 413 });
    }

    const requestContext: WorkersRequestContext<unknown, unknown> = {
      env,
      executionContext,
      request,
    };
    const { dispose, handler } = HttpRouter.toWebHandler(
      ServerApplication.httpLayer(application).pipe(
        Layer.provide(Layer.succeed(WorkersRequestContext, requestContext)),
      ),
      { disableLogger: true },
    );

    try {
      return await releaseResponseBody(
        await handler(request, Context.make(WorkersRequestContext, requestContext)),
        dispose,
      );
    } catch (cause) {
      await dispose();
      throw cause;
    }
  };`,
  },
  "flight-import": {
    id: "flight-import",
    kind: "diff",
    path: "packages/effective-rsc/src/server/flight-renderer.tsx",
    revision: "9058a71dcb522ffed8eb838ef9aef3c69953dfe7",
    selection: "実際の diff から 1 hunk を抜粋（他の hunk は省略、前後文脈 3 行）",
    command:
      "git diff --no-ext-diff --no-color --unified=3 ed886996d1d3780b94166af4f798c53416d547c8 9058a71dcb522ffed8eb838ef9aef3c69953dfe7 -- packages/effective-rsc/src/server/flight-renderer.tsx",
    code: `diff --git a/packages/effective-rsc/src/server/flight-renderer.tsx b/packages/effective-rsc/src/server/flight-renderer.tsx
index 9c0ce5db..db0bc304 100644
--- a/packages/effective-rsc/src/server/flight-renderer.tsx
+++ b/packages/effective-rsc/src/server/flight-renderer.tsx
@@ -1,11 +1,10 @@
-import { Context, Effect, Exit, FiberSet, Layer, Scope } from 'effect';
-import type { TemporaryReferenceSet } from 'react-server-dom-rspack/server.node';
-import { renderToReadableStream } from 'react-server-dom-rspack/server.node';
+import { Context, Effect, Exit, FiberSet, Layer, Scope } from "effect";
+import type { createTemporaryReferenceSet } from "@vitejs/plugin-rsc/rsc/server";
\x20
-import type { AnyMiddleware } from '../application/middleware';
-import type { RenderRuntimeContext } from '../application/render-runtime';
-import type { FlightPayload, ServerFnResult } from '../rsc/flight';
-import type { RouteTreeModel } from '../rsc/route-tree';
+import type { AnyMiddleware } from "../application/middleware";
+import type { RenderRuntimeContext } from "../application/render-runtime";
+import type { FlightPayload, ServerFnResult } from "../rsc/flight";
+import type { RouteTreeModel } from "../rsc/route-tree";
\x20
 type FlightStream = ReadableStream<Uint8Array>;
 `,
  },
  "ssr-boundary": {
    id: "ssr-boundary",
    kind: "show",
    path: "packages/effective-rsc/src/server/html-renderer.tsx",
    revision: "9058a71dcb522ffed8eb838ef9aef3c69953dfe7",
    selection: "42–46行（表示外の行は省略）",
    command:
      "git show 9058a71dcb522ffed8eb838ef9aef3c69953dfe7:packages/effective-rsc/src/server/html-renderer.tsx | sed -n '42,46p'",
    code: `            const ssr = await import.meta.viteRsc.loadModule<typeof import("./ssr")>(
              "ssr",
              "index",
            );
            return ssr.renderHtml(flight.stream, { formState, signal });`,
  },
  "ssr-entry": {
    id: "ssr-entry",
    kind: "show",
    path: "packages/effective-rsc/src/server/ssr.tsx",
    revision: "9058a71dcb522ffed8eb838ef9aef3c69953dfe7",
    selection: "1–30行（表示外の行は省略）",
    command:
      "git show 9058a71dcb522ffed8eb838ef9aef3c69953dfe7:packages/effective-rsc/src/server/ssr.tsx | sed -n '1,30p'",
    code: `import { createFromReadableStream, getClientEntryUrl } from "@vitejs/plugin-rsc/ssr";
import { use } from "react";
import { renderToReadableStream } from "react-dom/server.edge";

import { RouteTree } from "../client/route-tree";
import type { FlightPayload } from "../rsc/flight";
import { injectFlightPayload } from "./flight-html-stream";
import type { HtmlRenderOptions } from "./html-renderer";

export const renderHtml = async (
  stream: ReadableStream<Uint8Array>,
  options: HtmlRenderOptions,
): Promise<ReadableStream<Uint8Array>> => {
  const [ssrFlightStream, browserFlightStream] = stream.tee();
  let payload: PromiseLike<FlightPayload> | null = null;

  function SsrRoot() {
    const { routeTree } = use(
      (payload ??= createFromReadableStream<FlightPayload>(ssrFlightStream)),
    );
    return <RouteTree root={routeTree} />;
  }

  const html = await renderToReadableStream(<SsrRoot />, {
    bootstrapScriptContent: \`import(\${JSON.stringify(getClientEntryUrl())})\`,
    formState: options.formState,
    signal: options.signal,
  });
  return html.pipeThrough(injectFlightPayload(browserFlightStream));
};`,
  },
  "rsc-entry-removed": {
    id: "rsc-entry-removed",
    kind: "diff",
    path: "packages/effective-rsc/src/build/rsc-entry.ts",
    revision: "9058a71dcb522ffed8eb838ef9aef3c69953dfe7",
    selection: "実際の diff から 1 hunk を抜粋（他の hunk は省略、前後文脈 3 行）",
    command:
      "git diff --no-ext-diff --no-color --unified=3 ed886996d1d3780b94166af4f798c53416d547c8 9058a71dcb522ffed8eb838ef9aef3c69953dfe7 -- packages/effective-rsc/src/build/rsc-entry.ts",
    code: `diff --git a/packages/effective-rsc/src/build/rsc-entry.ts b/packages/effective-rsc/src/build/rsc-entry.ts
deleted file mode 100644
index 9b097415..00000000
--- a/packages/effective-rsc/src/build/rsc-entry.ts
+++ /dev/null
@@ -1,10 +0,0 @@
-'use server-entry';
-
-import App from 'effective-rsc/application-entry';
-
-import { ServerApplication } from '../server/application';
-
-export default App;
-
-export const HttpLayer = ServerApplication.httpLayer(App);
-export const ServerLayer = ServerApplication.serverLayer(App);`,
  },
  "vite-entries": {
    id: "vite-entries",
    kind: "show",
    path: "packages/effective-rsc/src/vite.ts",
    revision: "9058a71dcb522ffed8eb838ef9aef3c69953dfe7",
    selection: "37–48行（表示外の行は省略）",
    command:
      "git show 9058a71dcb522ffed8eb838ef9aef3c69953dfe7:packages/effective-rsc/src/vite.ts | sed -n '37,48p'",
    code: `  return [
    react(),
    rsc({
      entries: {
        client: browserEntry,
        rsc: rscEntry,
        ssr: fileURLToPath(new URL("./server/ssr.tsx", import.meta.url)),
      },
      serverHandler: false,
    }),
    applicationAlias,
  ];`,
  },
  "cloudflare-wrapper": {
    id: "cloudflare-wrapper",
    kind: "show",
    path: "packages/effective-rsc/src/cloudflare.ts",
    revision: "9058a71dcb522ffed8eb838ef9aef3c69953dfe7",
    selection: "14–40行（表示外の行は省略）",
    command:
      "git show 9058a71dcb522ffed8eb838ef9aef3c69953dfe7:packages/effective-rsc/src/cloudflare.ts | sed -n '14,40p'",
    code: `const rscEnvironment = { name: "rsc", childEnvironments: ["ssr"] };

const ssrOutputNesting = (): Plugin => ({
  name: "effective-rsc:cloudflare-ssr-output",
  enforce: "pre",
  config: (config): UserConfig | void => {
    if (config.environments?.["ssr"]?.build?.outDir !== undefined) return;

    const rootOutput = config.build?.outDir ?? "dist";
    const rscOutput = config.environments?.["rsc"]?.build?.outDir ?? join(rootOutput, "rsc");
    return { environments: { ssr: { build: { outDir: join(rscOutput, "ssr") } } } };
  },
});

/**
 * Configures ERSC for Cloudflare Workers.
 *
 * The Worker environment is always \`rsc\` with \`ssr\` as its child so that React Server Components
 * execute in workerd. By default, SSR output is nested beneath the RSC Worker output, allowing
 * Wrangler to include it as a Worker module. An explicit SSR \`build.outDir\` is preserved.
 * Other Cloudflare plugin options are forwarded unchanged.
 */
export const erscCloudflare = (options: ErscCloudflareOptions = {}): PluginOption[] => [
  ...ersc(options),
  ...cloudflare({ ...options.cloudflare, viteEnvironment: rscEnvironment }),
  ssrOutputNesting(),
];`,
  },
  "response-lifetime": {
    id: "response-lifetime",
    kind: "show",
    path: "packages/effective-rsc/src/workers.ts",
    revision: "9058a71dcb522ffed8eb838ef9aef3c69953dfe7",
    selection: "56–98行（表示外の行は省略）",
    command:
      "git show 9058a71dcb522ffed8eb838ef9aef3c69953dfe7:packages/effective-rsc/src/workers.ts | sed -n '56,98p'",
    code: `const releaseResponseBody = async (
  response: Response,
  release: () => Promise<void>,
): Promise<Response> => {
  if (response.body === null) {
    await release();
    return response;
  }

  let released = false;
  const releaseOnce = async () => {
    if (!released) {
      released = true;
      await release();
    }
  };
  const reader = response.body.getReader();
  const body = new ReadableStream<Uint8Array>({
    async cancel(reason) {
      try {
        await reader.cancel(reason);
      } finally {
        await releaseOnce();
      }
    },
    async pull(controller) {
      try {
        const result = await reader.read();
        if (result.done) {
          controller.close();
          await releaseOnce();
          return;
        }
        controller.enqueue(result.value);
      } catch (cause) {
        controller.error(cause);
        await releaseOnce();
      }
    },
  });

  return new Response(body, response);
};`,
  },
  "request-context": {
    id: "request-context",
    kind: "diff",
    path: "packages/effective-rsc/src/server/application.ts",
    revision: "9058a71dcb522ffed8eb838ef9aef3c69953dfe7",
    selection: "実際の diff から 1 hunk を抜粋（他の hunk は省略、前後文脈 3 行）",
    command:
      "git diff --no-ext-diff --no-color --unified=3 ed886996d1d3780b94166af4f798c53416d547c8 9058a71dcb522ffed8eb838ef9aef3c69953dfe7 -- packages/effective-rsc/src/server/application.ts",
    code: `diff --git a/packages/effective-rsc/src/server/application.ts b/packages/effective-rsc/src/server/application.ts
index c8f612b3..94bf31bd 100644
--- a/packages/effective-rsc/src/server/application.ts
+++ b/packages/effective-rsc/src/server/application.ts
@@ -256,10 +204,14 @@ const httpLayer = <Services, ApplicationError>(
       const RequestContextMiddleware = HttpRouter.middleware<{
         provides: Services | FlightRenderer | HtmlRenderer;
       }>()((httpEffect): Effect.Effect<HttpServerResponse.HttpServerResponse, Types.unhandled> =>
-        httpEffect.pipe(Effect.provideContext(applicationServices)),
+        Effect.flatMap(Effect.context(), (requestContext) =>
+          httpEffect.pipe(
+            Effect.provideContext(Context.merge(requestContext, applicationServices)),
+          ),
+        ),
       );
       const makeRouteLayer = (destination: CompiledDestination<Services>) => {
-        const GetLayer = HttpRouter.add('GET', destination.pattern, (request) =>
+        const GetLayer = HttpRouter.add("GET", destination.pattern, (request) =>
           render({
             destination,
             formState: null,`,
  },
  "render-scope": {
    id: "render-scope",
    kind: "show",
    path: "packages/effective-rsc/src/server/flight-renderer.tsx",
    revision: "ed886996d1d3780b94166af4f798c53416d547c8",
    selection: "43–50行（表示外の行は省略）",
    command:
      "git show ed886996d1d3780b94166af4f798c53416d547c8:packages/effective-rsc/src/server/flight-renderer.tsx | sed -n '43,50p'",
    code: `        const parentScope = yield* Effect.scope;
        const renderScope = yield* Scope.fork(parentScope);
        const release = Scope.close(renderScope, Exit.void);
        return yield* Effect.gen(function* () {
          const runtime = yield* FiberSet.makeRuntimePromise<Services>().pipe(
            Scope.provide(renderScope),
          );
          const signal = yield* Effect.abortSignal.pipe(Scope.provide(renderScope));`,
  },
} satisfies Record<string, ReadingSnippet>;

function ReadingSource({ snippet }: { readonly snippet: ReadingSnippet }) {
  return (
    <figure
      data-reading-excerpt={snippet.id}
      data-source-kind={snippet.kind}
      data-source-path={snippet.path}
      data-baseline={baseline}
      data-comparison={comparison}
    >
      <figcaption>
        <p>
          <code>{snippet.path}</code>
        </p>
        <p>
          {snippet.kind === "diff" ? (
            <>
              Before: <code>{baseline}</code>
              <br />
              After: <code>{comparison}</code>
            </>
          ) : (
            <>
              出典コミット: <code>{snippet.revision}</code>
            </>
          )}
        </p>
        <p>{snippet.selection}。記号・改行を含む原文であり、疑似コードではありません。</p>
        {snippet.kind === "diff" || snippet.revision === baseline ? (
          <p>
            <a href={`${upstream}/${snippet.path}`}>上流の固定ソースを開く</a>
          </p>
        ) : null}
      </figcaption>
      <CodeBlock
        code={snippet.code}
        language={
          snippet.kind === "diff" ? "diff" : snippet.path.endsWith(".tsx") ? "tsx" : "typescript"
        }
      />
      <details>
        <summary>この抜粋を Git で再現する</summary>
        <p>リポジトリのルートで実行します。diff の場合は省略した hunk も表示します。</p>
        <CodeBlock code={snippet.command} language="bash" />
      </details>
    </figure>
  );
}

function Provenance() {
  return (
    <aside aria-label="コードの出典とライセンス">
      <p>
        比較は上流 <code>{baseline}</code>（manifest の version は <code>0.1.4</code>）から、
        ドキュメント追加前のローカルコミット <code>{comparison}</code> までに固定しています。
        このサイトの現在の HEAD や、npm の配布物そのものを比較した記事ではありません。
      </p>
      <p>
        上流のコード抜粋: Copyright (c) 2026-present Nikhil S、
        <a href={`${upstream}/LICENSE`}>MIT License（著作権表示・許諾条件・免責の全文）</a>。 After
        はこのリポジトリでの改変版です。 ローカルコミットの公開を前提とした GitHub
        リンクは作らず、各抜粋に再現コマンドを添えています。
      </p>
    </aside>
  );
}

export const readingPages: readonly DocPage[] = [
  {
    slug: "/reading/overview",
    title: "01. 差分の地図を作る",
    description:
      "上流 0.1.4 と Workers 版の固定コミットから、残した設計と置き換えた責務を読み分けます。",
    section: "Code reading",
    headings: [
      { id: "comparison", title: "何と何を比較するのか" },
      { id: "file-layout", title: "削除・追加・移動の地図" },
      { id: "reading-strategy", title: "差分を読む順番" },
    ],
    content: () => (
      <>
        <h2 id="comparison">何と何を比較するのか</h2>
        <Provenance />
        <p>
          この比較は Effront への rename と core Vite plugin / Cloudflare adapter
          の分離より前のものです。 現在の package とディレクトリは <code>effront</code> と{" "}
          <code>packages/effront</code>、application API は<code>Application.effront()</code>{" "}
          です。以下に現れる一体型の historical factory ではなく、現在は
          <code>plugins: [effront(), effrontCloudflare()]</code> を登録します。
        </p>
        <p>
          最初に実行環境の名前ではなく、フレームワークが何を所有するかに注目します。 上流は Bun
          向けの実験的 RSC
          フレームワークで、サーバー起動、ビルド、静的ファイル配信までを持っています。 比較版は Web
          の Request → Response を入口にし、最初のホストを Cloudflare Workers としています。
          この方針は比較版の <code>docs/WORKERS.md</code> に記録されており、以下の manifest
          の変更とも一致します。
        </p>
        <ReadingSource snippet={snippets["package-version"]} />
        <p>
          <code>0.1.4</code> は固定した上流コミットの manifest から読み取った値です。 同じ名前の
          release tag や npm 公開版と完全に同じ内容だという意味ではありません。 After の{" "}
          <code>0.1.4-workers.0</code> も、公開済みであることを意味しません。
        </p>
        <CodeBlock
          code={`# Git オブジェクトが存在するこのクローンのルートで実行
BASE=${baseline}
AFTER=${comparison}
git show "$BASE:packages/effective-rsc/package.json"
git diff --find-renames --name-status "$BASE" "$AFTER"
git diff --stat "$BASE" "$AFTER"
# 省略なしの全リポジトリ差分
git diff "$BASE" "$AFTER"
# 読解する runtime ソースだけに絞る場合
git diff "$BASE" "$AFTER" -- packages/effective-rsc/src`}
          language="bash"
        />

        <h2 id="file-layout">削除・追加・移動の地図</h2>
        <p>
          以下は <code>git ls-tree</code> と <code>git diff --find-renames --name-status</code>{" "}
          から作った、 読解に必要なパスだけの編集図です。完全なツリーではありません。
          「存続」は同名パスが残るという意味で、内容が不変という意味ではありません。
        </p>
        <CodeBlock
          code={`リポジトリの代表的な変更（BASE → AFTER）
├─ packages/effective-rsc/
│  ├─ src/application/             存続: Page・Layout・Middleware・ServerFn
│  ├─ src/client/                  存続: hydration・ルーター・Flight クライアント
│  ├─ src/rsc/                     存続: Flight 契約とルート木
│  ├─ src/server/application.ts    変更: httpLayer を残し Bun の起動責務を除く
│  ├─ src/server/serve.ts          削除
│  ├─ src/server/start.ts          削除
│  ├─ src/server/server-config.ts  削除
│  ├─ src/build/                   削除: Rspack と専用ビルド・開発処理
│  ├─ src/dev/                     削除: 開発パネルなど
│  ├─ src/cli.ts                   削除
│  ├─ src/workers.ts               追加: Fetch とリクエスト単位の context
│  ├─ src/vite.ts                  追加: RSC・SSR・client の entry
│  ├─ src/cloudflare.ts            追加: workerd と出力配置の結線
│  └─ src/server/ssr.tsx           追加: SSR グラフの entry
├─ packages/vercel/               削除
├─ packages/create-ersc-app/       削除
├─ packages/e2e/                  追加: 実 consumer のブラウザー受け入れ
├─ packages/gitignore-patterns/   追加: tooling 用の別パッケージ
├─ examples/hello-world/          削除
├─ examples/event-platform/       削除
├─ examples/workers/              追加
├─ fixtures/・site/・vendor/      削除
├─ bun.lock・bunfig.toml          削除
└─ pnpm-lock.yaml・pnpm-workspace.yaml・vite.config.ts 追加

Git が rename として検出する例（内容にも変更あり）:
packages/effective-rsc/tests/application/component.test.tsx
  → packages/effective-rsc/src/application/component.test.tsx`}
          language="text"
        />
        <p>
          <code>server/html-renderer.tsx</code> は削除されず、SSR への橋渡しとして残っています。
          新しい <code>server/ssr.tsx</code> への責務の分離は、ファイル全体の単純な rename
          ではありません。 同様に <code>examples/workers/</code> は旧 example
          の名前だけを変えたものとして扱いません。 このサイトの <code>packages/docs/</code>{" "}
          は比較終点の後に追加するため、この地図には含めません。
        </p>
        <CodeBlock
          code={`git ls-tree -r --name-only ${baseline} -- packages examples fixtures site vendor
git ls-tree -r --name-only ${comparison} -- packages examples
git diff --find-renames --name-status ${baseline} ${comparison} -- packages/effective-rsc`}
          language="bash"
        />

        <h2 id="reading-strategy">差分を読む順番</h2>
        <ol>
          <li>
            <a href="/reading/runtime">入口</a>: Bun サーバーを起動する設計から、ホストが呼ぶ Fetch
            関数へ。
          </li>
          <li>
            <a href="/reading/rendering">描画</a>: React の Flight を保ち、RSC・SSR・browser の
            import を交換する。
          </li>
          <li>
            <a href="/reading/tooling">ビルド</a>: Rspack の専用処理から Vite の environment と
            Workers artifact へ。
          </li>
          <li>
            <a href="/reading/lifetimes">寿命</a>: Response を返した後も生きる Effect scope
            と、その終了条件を追う。
          </li>
        </ol>
        <p>
          引用符や整形の変更だけを仕様変更と数えないことが重要です。 逆に「Bun の import
          を消しただけ」と読むと、request context の merge、SSR の出力配置、body の dispose
          を見落とします。 authoring API の主要な構成要素が残ることと、旧
          CLI・ホスト・全機能との互換性が保証されることは別です。
        </p>
      </>
    ),
  },
  {
    slug: "/reading/runtime",
    title: "02. 起動するサーバーから呼ばれる Fetch へ",
    description:
      "httpLayer を中心に残し、Workers の env と実行 context をリクエスト内へ渡す変更を追います。",
    section: "Code reading",
    headings: [
      { id: "host-ownership", title: "ホストの所有権を外に出す" },
      { id: "fetch-entry", title: "Fetch の入口を読む" },
      { id: "runtime-boundaries", title: "維持した契約と変わった制限" },
    ],
    content: () => (
      <>
        <h2 id="host-ownership">ホストの所有権を外に出す</h2>
        <Provenance />
        <p>
          Before の <code>src/server/start.ts</code> は <code>BunRuntime.runMain</code> で
          <code>serve(options)</code> を起動し、<code>Effect.never</code> でプロセスを生かします。
          <code>src/server/serve.ts</code> はコンパイル済みサーバーを読み込み、BunServices
          を提供します。 その一段下にあった「アプリケーションを HTTP
          ルートへ変換する」責務は、Workers でも利用できます。
        </p>
        <ReadingSource snippet={snippets["http-layer"]} />
        <p>
          削除されるのは <code>HttpRouter.serve(...)</code> と BunServerLayer
          の合成、および静的配信の Layer です。
          <code>httpLayer</code> 自体は残ります。 改修の要点は HTTP
          ルートを作る処理と、ソケット・プロセス・アセットをホストする処理を切り離すことです。 After
          では静的アセットの binding を <code>examples/workers/wrangler.jsonc</code> が持ちます。
        </p>
        <p>
          <a href={`${upstream}/packages/effective-rsc/src/server/start.ts`}>Before の start.ts</a>{" "}
          と <a href={`${upstream}/packages/effective-rsc/src/server/serve.ts`}>serve.ts</a>{" "}
          も併せて読むと、削除された起動経路を確認できます。
        </p>

        <h2 id="fetch-entry">Fetch の入口を読む</h2>
        <ReadingSource snippet={snippets["fetch-handler"]} />
        <ol>
          <li>
            <code>createFetchHandler(application)</code>{" "}
            はアプリケーション定義を受け取り、ホストが呼ぶ非同期関数を返します。
          </li>
          <li>
            返された関数の中で <code>request</code>、<code>env</code>、<code>executionContext</code>{" "}
            を一つの context にまとめます。
          </li>
          <li>
            <code>Layer.provide</code> はアプリケーションサービスの構築時にも同じ Workers context
            を読めるようにします。
          </li>
          <li>
            <code>handler(request, Context.make(...))</code> はハンドラー実行側にも context
            を渡します。Layer 構築時の提供だけでは、この二つの用途を説明できません。
          </li>
          <li>
            <code>dispose</code> は Response の返却直後ではなく、body の終了処理へ渡します。詳細は{" "}
            <a href="/reading/lifetimes">寿命の章</a> で追います。
          </li>
        </ol>
        <p>
          実 consumer の <code>examples/workers/src/worker.ts</code> は public subpath の
          <code>effective-rsc/workers</code> からこの関数を import し、
          <code>{"export default { fetch: createFetchHandler(application) };"}</code> を公開します。
          ホストが listen する場所やポートを、このランタイム関数へ渡す設計ではありません。
        </p>

        <h2 id="runtime-boundaries">維持した契約と変わった制限</h2>
        <ul>
          <li>
            維持: <code>server/application.ts</code> はルート木を作り、Accept が{" "}
            <code>text/x-component</code> と等しい場合は Flight、それ以外は HTML を返します。
            動的応答の <code>private, no-store</code> と <code>Vary: Accept</code>{" "}
            の処理も残ります。
          </li>
          <li>
            変更: <code>workers.ts</code> が各呼び出しでアプリケーション Layer を構築します。
            <code>getWorkersEnv&lt;Env&gt;()</code> の型引数は型アサーションであり、実 binding
            のスキーマ検証ではありません。
          </li>
          <li>
            制限の違い: Before の <code>server/server-config.ts</code> は Bun に 10 MiB の body
            上限を設定します。 After の <code>workers.ts</code> は Content-Length
            が不正または上限超過なら 413 を返しますが、ヘッダーがない場合はここでは拒否しません。
            <code>server/server-fn-request.ts</code> は Server Function の body を実際に数えて別途
            10 MiB を制限し、この読み取り失敗は 400 に変換します。 全 HTTP body
            が同じ場所で同じステータスになる、と一般化しないでください。
          </li>
          <li>
            範囲外: Fetch という共通境界があっても、任意の Node/Bun
            環境でそのまま動く保証はありません。
            <code>application/render-runtime.ts</code> の AsyncLocalStorage は残り、example は{" "}
            <code>nodejs_compat</code> を設定しています。 D1・KV・R2
            や本番デプロイは、この比較版の実装範囲ではありません。
          </li>
        </ul>
        <CodeBlock
          code={`git diff ${baseline} ${comparison} -- packages/effective-rsc/src/server/server-config.ts packages/effective-rsc/src/server/server-fn-request.ts
git show ${comparison}:examples/workers/src/worker.ts
git show ${comparison}:examples/workers/wrangler.jsonc`}
          language="bash"
        />
      </>
    ),
  },
  {
    slug: "/reading/rendering",
    title: "03. Flight を残して描画の境界を変える",
    description:
      "RSC、SSR、browser の役割と、HTML に Flight を埋め込む経路を実コードで分解します。",
    section: "Code reading",
    headings: [
      { id: "flight-protocol", title: "変えるのは統合先、残すのは React のプロトコル" },
      { id: "ssr-crossing", title: "RSC から SSR へ何が渡るか" },
      { id: "html-and-browser", title: "二本の Flight とブラウザー" },
      { id: "server-functions", title: "Server Function も同じ境界で読む" },
    ],
    content: () => (
      <>
        <h2 id="flight-protocol">変えるのは統合先、残すのは React のプロトコル</h2>
        <Provenance />
        <p>
          RSC は Server Component を評価して Flight を作る段階、SSR はその結果を読んで HTML
          を作る段階です。 Client Component の実装をブラウザーへ配る段階も別にあります。
          上流にも複数の entry はありました。Workers
          版で初めてこの概念を発明したわけではなく、統合する compiler と renderer を変えています。
        </p>
        <ReadingSource snippet={snippets["flight-import"]} />
        <p>
          Before の <code>react-server-dom-rspack/server.node</code> への依存を外し、 After は{" "}
          <code>@vitejs/plugin-rsc/rsc/server</code> の型を参照します。 実際の{" "}
          <code>renderToReadableStream</code> は同ファイルの render 内で同じ subpath から動的 import
          します。 import 行だけを見ると「renderer
          が消えた」と誤読するので、利用箇所まで辿りましょう。
        </p>
        <p>
          共通契約の <code>src/rsc/flight.ts</code> は <code>formState</code>、
          <code>routeTree</code>、<code>serverFnResult</code> という payload の形を保ちます。
          <code>text/x-component</code> と <code>x-ersc-server-fn</code> の値も変わりません。 これは
          ERSC が React に渡す model と識別子が残るという意味であり、wire bytes や bundler
          が生成する module ID の同一性まで保証するものではありません。
        </p>

        <h2 id="ssr-crossing">RSC から SSR へ何が渡るか</h2>
        <p>
          Before の <code>server/html-renderer.tsx</code> は React と{" "}
          <code>react-dom/server.bun</code> を直接 import して HTML を作ります。 After
          の同ファイルは SSR entry をロードする橋渡しになっています。
        </p>
        <ReadingSource snippet={snippets["ssr-boundary"]} />
        <p>
          引数を一つずつ確認すると、渡るのは Flight の Web stream と <code>formState</code>、
          <code>signal</code> です。 Workers の <code>env</code> と <code>executionContext</code>{" "}
          は引数にありません。 ただし、アプリケーションが秘密を明示的に JSX や Client Component の
          props に入れれば漏えいし得ます。 「フレームワークが自動的に env
          を転送しない」と「秘密を絶対に描画できない」は異なる主張です。
        </p>

        <h2 id="html-and-browser">二本の Flight とブラウザー</h2>
        <ReadingSource snippet={snippets["ssr-entry"]} />
        <ol>
          <li>
            <code>stream.tee()</code> は Flight を SSR 消費用と HTML
            に埋め込むブラウザー用に分けます。この分岐は Before の HtmlRenderer にもありました。
          </li>
          <li>
            <code>@vitejs/plugin-rsc/ssr</code> で payload を読み、<code>RouteTree</code> を{" "}
            <code>react-dom/server.edge</code> で描画します。
          </li>
          <li>
            <code>getClientEntryUrl()</code> の URL から hydration 用 entry
            を読み込むスクリプトを出力します。
          </li>
          <li>
            <code>injectFlightPayload</code> がもう一方の Flight を HTML stream
            に埋め込みます。実装は存続する <code>server/flight-html-stream.ts</code> にあります。
          </li>
        </ol>
        <p>
          ブラウザー側では <code>client/flight-client.ts</code> の import が
          <code>react-server-dom-rspack/client.browser</code> から{" "}
          <code>@vitejs/plugin-rsc/browser</code> へ変わります。 navigation 用の GET と Server
          Function 用の POST を区別する既存の構造は残り、開発判定は
          <code>process.env.NODE_ENV</code> から <code>import.meta.env.DEV</code> へ変わります。
        </p>

        <aside id="post-comparison-injector" aria-label="固定比較より後の修正">
          <p>
            <strong>比較範囲外の追記: このサイトの検証で見つかった境界の問題</strong>
          </p>
          <p>
            ローカルコミット <code>{injectorFix}</code> は、上の比較終点 <code>{comparison}</code>{" "}
            より後の修正です。 元の12抜粋は更新せず、ここだけを別の時点の記録として読んでください。
            対象は <code>packages/effective-rsc/src/server/flight-html-stream.ts</code> です。
          </p>
          <p>
            HTML stream の chunk は HTML parser が挿入を許す区切りとは限りません。 修正前は Flight
            の script を並行して挿入できるため、分割された href 属性、日本語の UTF-8
            文字、コメント、script／style の途中へ入り込む可能性がありました。 修正は HTML
            本体をそのまま流し、HTML の EOF 後に Flight の script を出力し、保持した document
            の閉じタグを最後に出力します。 HTML 自体の streaming は保ちますが、ブラウザー向け Flight
            の埋め込みは HTML 完了まで待つ方式です。 待機中のブラウザー側 Flight は tee
            のキューに蓄積されるため、hydration 開始とメモリ使用量のトレードオフがあります。
          </p>
          <p>
            同じ修正で、Flight の各 chunk を独立して厳密に UTF-8 decode し、不完全・不正な UTF-8 は
            base64 のバイト列として扱うようにしています。 また、cancel 時に保留中の flush や tee
            のもう一方を待って request scope の解放が止まらないよう、readable
            側でキャンセルを受け取る wrapper を加えています。 これは新しい RSC
            プロトコルではなく、既存のバイト列を壊さず運ぶための修正です。
          </p>
          <p>
            同コミットの <code>packages/effective-rsc/tests/server/flight-html-stream.test.ts</code>{" "}
            は、 HTML の境界、Flight のテスト用バイト列の全分割位置での復元、EOF
            の順序、エラー、キャンセルを回帰テストにしています。
            この修正のテストと、固定比較の時点の実装を混同しないよう、確認コマンドも分けます。
          </p>
          <CodeBlock
            code={`# 固定比較とは別の、後続修正だけを確認
git show ${injectorFix} -- packages/effective-rsc/src/server/flight-html-stream.ts packages/effective-rsc/tests/server/flight-html-stream.test.ts
# 現在の作業ツリーで injector の回帰テストを実行
vp test run packages/effective-rsc/tests/server/flight-html-stream.test.ts`}
            language="bash"
          />
        </aside>

        <h2 id="server-functions">Server Function も同じ境界で読む</h2>
        <p>
          <code>server/server-fn-request.ts</code> では React の <code>decodeReply</code>、
          <code>decodeAction</code>、<code>decodeFormState</code>、<code>loadServerAction</code>{" "}
          の利用を保ち、import 元を Vite RSC に変えています。
          <code>loadServerAction</code> の呼び出しは <code>Effect.try</code> から{" "}
          <code>Effect.tryPromise</code> へ変わります。 origin 検証や、JS 呼び出しと progressive
          form の区別も残ります。独自 JSON RPC への置き換えではありません。
        </p>
        <p>
          一方で、比較版の Workers example を対象にしたブラウザースイートには Server Function
          の受け入れシナリオはありません。 ソースに経路が残っていることを、両ホストで全 Server
          Function 動作を検証済みという意味に広げないでください。
        </p>
        <CodeBlock
          code={`git diff ${baseline} ${comparison} -- packages/effective-rsc/src/rsc/flight.ts packages/effective-rsc/src/server/html-renderer.tsx packages/effective-rsc/src/client/flight-client.ts packages/effective-rsc/src/server/server-fn-request.ts`}
          language="bash"
        />
      </>
    ),
  },
  {
    slug: "/reading/tooling",
    title: "04. ビルドの責務を entry と出力配置で読む",
    description:
      "Rspack の専用 entry を Vite の environment へ置き換え、Wrangler が実行できる形まで追います。",
    section: "Code reading",
    headings: [
      { id: "old-entry", title: "上流のコンパイル済みサーバー契約" },
      { id: "vite-graphs", title: "三つの entry とホストの結線" },
      { id: "artifact-layout", title: "ビルド成功と実行成功の間" },
      { id: "tooling-checks", title: "確認コマンドとテストの読み分け" },
    ],
    content: () => (
      <>
        <h2 id="old-entry">上流のコンパイル済みサーバー契約</h2>
        <Provenance />
        <p>
          Before の <code>src/build/rspack-config.ts</code> は application・client・rsc・ssr の
          entry を扱い、 Bun 向け module の external 化や browser graph への混入防止を持っています。
          下の削除ファイルは、アプリケーション定義と HTTP／サーバー Layer
          をコンパイル済みの入口として公開していました。
        </p>
        <ReadingSource snippet={snippets["rsc-entry-removed"]} />
        <p>
          この入口、専用 CLI、build/dev の一式を除去し、consumer の Worker entry と Vite
          の設定へ所有権を移しています。 「Rspack を Vite に rename
          した」のではなく、誰がビルドを制御し、成果物の何をホストが呼ぶかを変更しています。 上流の{" "}
          <code>packages/vercel/</code> も比較版から削除され、Vercel
          向け出力との互換性はここでは維持しません。
        </p>

        <h2 id="vite-graphs">三つの entry とホストの結線</h2>
        <ReadingSource snippet={snippets["vite-entries"]} />
        <p>
          <code>src/vite.ts</code> の <code>ersc()</code> は React と RSC plugin をまとめ、 client
          にフレームワークの <code>src/vite/browser.ts</code>、rsc に既定で consumer の
          <code>./src/worker.ts</code>、ssr にフレームワークの <code>src/server/ssr.tsx</code>{" "}
          を渡します。
          <code>serverHandler: false</code> により、Worker の Fetch entry を使う構成にします。
          アプリケーション alias は <code>effective-rsc/application-entry</code> を既定の{" "}
          <code>./src/application.tsx</code> へ結びます。
        </p>
        <ReadingSource snippet={snippets["cloudflare-wrapper"]} />
        <p>
          <code>erscCloudflare()</code> がこの共通 Vite 設定と Cloudflare plugin を合成します。
          <code>rsc</code> を Worker environment、<code>ssr</code> をその child
          として指定するため、開発時の RSC と SSR も workerd 側で実行する構成です。 RSC だけが React
          の <code>react-server</code> 条件を使い、SSR と browser は別グラフとして扱います。
          consumer が React、RSC、Cloudflare plugin を重ねて登録する前提ではありません。
        </p>
        <p>
          <code>node:path</code> がこの tooling のファイルにあることと、リクエストを Node SSR
          へ逃がすことは別です。 import
          を評価するグラフを先に確認すると、この違いを読み分けられます。
        </p>

        <h2 id="artifact-layout">ビルド成功と実行成功の間</h2>
        <p>
          <code>ssrOutputNesting</code> は SSR の出力先が明示されていなければ、RSC
          出力の配下に置きます。 既定では <code>dist/rsc/ssr</code> です。 比較版の{" "}
          <code>docs/WORKERS.md</code> には、兄弟ディレクトリの <code>dist/ssr</code> では
          ビルドできても Wrangler が SSR module を Worker
          に添付せず、実行時に失敗する背景が記録されています。 このコードは明示した SSR outDir
          を上書きしないので、任意の出力先を指定しても安全になる仕組みではありません。
        </p>
        <CodeBlock
          code={`# 既定の生成物の関係だけを示す模式図（全出力ファイルではない）
examples/workers/dist/
├─ client/              ブラウザー向けアセット
└─ rsc/
   ├─ wrangler.json     ビルドが生成する実行設定
   └─ ssr/              Worker の出力配下に置く SSR module`}
          language="text"
        />
        <p>
          <code>examples/workers/package.json</code> の local script は生成した
          <code>dist/rsc/wrangler.json</code> を <code>--local --no-bundle</code> で実行します。
          生の RSC ソースを Wrangler に再コンパイルさせるのではありません。 アセットの binding と
          runtime vars はホスト設定が持ち、example は <code>run_worker_first</code> を指定せず標準の
          asset-first routing を使います。
        </p>

        <h2 id="tooling-checks">確認コマンドとテストの読み分け</h2>
        <CodeBlock
          code={`# リポジトリのルート
vp run typecheck
vp test run

# consumer のディレクトリから実行。dev は別ターミナルで動かす
cd examples/workers
vp dev
# 開発サーバーを終了してから、または別ターミナルで
vp build
vp run local

# 別ターミナルでリポジトリのルートから実行
(cd packages/e2e && vp run test)`}
          language="bash"
        />
        <p>
          root の <code>vite.config.ts</code> は VitePlus の整形・lint・unit test
          設定を所有し、example の起動スクリプトを root へ置かない構成です。
          <code>packages/e2e/playwright.config.ts</code> は開発、Wrangler の既定変数、Wrangler
          の変数上書きという三つの project を持ちます。 built 側では生成設定を使用し、空の env file
          と隔離した出力・state ディレクトリを使います。
        </p>
        <p>
          <code>packages/e2e/tests/workers-fetch.e2e.ts</code> が対象とするのは
          HTML／Flight、秘密値の非表示、 client counter の hydration、リンク遷移、未知ルートの 404
          です。
          設定やテストが存在するという静的な証拠と、実際にそのテストを走らせて通ったという実行証拠を区別します。
          この章の抜粋作成自体は、全ランタイムテストを再実行したという報告ではありません。
        </p>
        <CodeBlock
          code={`git show ${comparison}:packages/e2e/playwright.config.ts
git show ${comparison}:packages/e2e/tests/workers-fetch.e2e.ts
git show ${comparison}:docs/WORKERS.md`}
          language="bash"
        />
      </>
    ),
  },
  {
    slug: "/reading/lifetimes",
    title: "05. Response より長く生きるリクエスト scope",
    description:
      "Layer の構築から stream の EOF・エラー・キャンセルまで、サービスが生きる範囲を追います。",
    section: "Code reading",
    headings: [
      { id: "two-lifetimes", title: "ハンドラーの完了と body の完了は違う" },
      { id: "response-release", title: "release のすべての出口を読む" },
      { id: "context-merge", title: "構築時と実行時の context を失わない" },
      { id: "lifetime-evidence", title: "テストが何を証明するか" },
    ],
    content: () => (
      <>
        <h2 id="two-lifetimes">ハンドラーの完了と body の完了は違う</h2>
        <Provenance />
        <p>
          streaming Response を返した瞬間に、すべての Server Component が描画済みとは限りません。
          非同期の描画や body
          の読み取りが続く間にアプリケーションサービスを解放すると、後続の処理は寿命の切れた資源を参照します。
          「リクエスト単位」とは handler の Promise が解決するまで、というだけでは不足します。
        </p>
        <p>
          上流にも Flight の描画 scope を親 scope から fork する設計はあります。 次の Before
          の断片は After にも残り、今回初めて scope が導入されたわけではないことが分かります。
        </p>
        <ReadingSource snippet={snippets["render-scope"]} />
        <p>
          Workers 版で加わるのは、その外側にあるアプリケーション Layer と Web Response
          の寿命の接続です。
          <code>workers.ts</code> はリクエストごとに <code>HttpRouter.toWebHandler</code> を作り、
          返された <code>dispose</code> を body の終端まで保持します。
          <code>server/application.ts</code> に残る <code>Stream.ensuring(flight.release)</code>{" "}
          は、内側の Flight scope の解放を担当します。
        </p>

        <h2 id="response-release">release のすべての出口を読む</h2>
        <ReadingSource snippet={snippets["response-lifetime"]} />
        <ul>
          <li>
            <strong>body がない:</strong> 読み取り待ちは不要なので <code>release()</code>{" "}
            を実行して元の Response を返します。
          </li>
          <li>
            <strong>EOF:</strong> <code>reader.read()</code> の <code>done</code> を検知して stream
            を閉じ、<code>releaseOnce()</code> を呼びます。
          </li>
          <li>
            <strong>読み取りエラー:</strong> エラーを controller に伝えた後、
            <code>releaseOnce()</code> を呼びます。
          </li>
          <li>
            <strong>キャンセル:</strong> 元の reader へ理由を渡し、<code>finally</code>{" "}
            で解放します。cancel 自体が失敗する経路も意識した構造です。
          </li>
          <li>
            <strong>body を返す前の例外:</strong>{" "}
            <a href="/reading/runtime#fetch-entry">createFetchHandler の catch</a> で{" "}
            <code>dispose()</code> してから例外を投げ直します。
          </li>
        </ul>
        <p>
          <code>released</code> は body wrapper 内で重複した解放呼び出しを防ぐためのフラグです。
          ここから「ホストがどのように接続を切っても必ず即座にキャンセルが通知される」とまでは結論できません。
          EOF・エラー・キャンセルのどれも届かない stream
          の寿命やホストの締切は、別に考える必要があります。
        </p>

        <h2 id="context-merge">構築時と実行時の context を失わない</h2>
        <ReadingSource snippet={snippets["request-context"]} />
        <p>
          Before はアプリケーションのサービス context だけを <code>Effect.provideContext</code>{" "}
          に渡します。 After は現在の request context を取得し、
          <code>Context.merge(requestContext, applicationServices)</code> で合成してから渡します。
          外側で渡した Workers の値を、アプリケーションの middleware
          を通った途端に失わないための変更として読めます。
        </p>
        <p>
          ここは「グローバルな env を便利に参照する」設計ではありません。
          <code>WorkersRequestContext</code> は <code>ersc/workers/WorkersRequestContext</code>{" "}
          という識別子を持ち、 提供されていない場所では既定値が TypeError を投げます。
          入力の不正と、フレームワークの結線に必要な context がない状態を分けて読めます。
        </p>

        <h2 id="lifetime-evidence">テストが何を証明するか</h2>
        <p>
          比較版の <code>packages/effective-rsc/tests/server/workers.test.tsx</code> は public Fetch
          adapter を呼び、 並行する二つの request の env・executionContext・URL
          が混ざらないことを検査します。 サービスの acquire/release を events に記録し、通常の
          EOF、空 body、body の cancel、stream failure の解放を確認します。
        </p>
        <p>
          ただしこのテストは middleware が応答を返して描画を short-circuit します。 したがって Fetch
          adapter の context と寿命の回帰を検出する証拠にはなりますが、実 workerd の
          RSC・SSR・hydration 全体の証明ではありません。
          <a href="/reading/tooling#tooling-checks">別パッケージのブラウザー受け入れ</a>{" "}
          と組み合わせて読む理由はここにあります。
        </p>
        <CodeBlock
          code={`git show ${comparison}:packages/effective-rsc/tests/server/workers.test.tsx
git diff ${baseline} ${comparison} -- packages/effective-rsc/src/application/render-runtime.ts packages/effective-rsc/src/server/flight-renderer.tsx
# リポジトリのルートで adapter の回帰テストを実行
vp test run packages/effective-rsc/tests/server/workers.test.tsx`}
          language="bash"
        />
        <p>
          読解の最後は、変数や関数の名前ではなく「誰が資源を取得し、どの出口で解放するか」を図にできるか確認しましょう。
          この比較では React の描画プロトコルを保ちながら、ホストと request scope
          の接続方法を変えています。
          その二つを区別できると、移植で残すべき性質と、ホストごとに確認すべき性質が見えてきます。
        </p>
      </>
    ),
  },
];

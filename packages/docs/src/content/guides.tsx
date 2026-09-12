import { CodeBlock } from "../components/code-block";
import type { CodeLanguage } from "../components/code-block";
import type { DocPage } from "./types";

const code = (source: string, language: CodeLanguage) => (
  <CodeBlock code={source} language={language} />
);

export const guidePages: readonly DocPage[] = [
  {
    slug: "/",
    title: "Effront for Workers",
    description:
      "Cloudflare Workers 上で Effect と React Server Components を動かすための入門です。",
    section: "Guide",
    headings: [
      { id: "overview", title: "このフレームワークがすること" },
      { id: "boundaries", title: "実行境界" },
      { id: "next", title: "次に読むもの" },
    ],
    content: () => (
      <>
        <p>
          Effront は、Effect で記述したサーバー側の UI を React Server Components
          としてレンダリングし、Cloudflare Workers の <code>fetch</code>{" "}
          ハンドラーから返す実験的なフレームワークです。
        </p>
        <h2 id="overview">このフレームワークがすること</h2>
        <p>
          アプリケーションは Routes、Layout、Page、必要なら Component、Middleware、Server Function
          から組み立てます。Page と Layout が返す Effect
          の要求をアプリケーション定義に集約し、Request ごとの Layer で満たします。
        </p>
        <table>
          <thead>
            <tr>
              <th>グラフ</th>
              <th>役割</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>RSC</td>
              <td>Page、Layout、Effect を Workers の workerd で実行し、Flight を生成します。</td>
            </tr>
            <tr>
              <td>SSR</td>
              <td>HTML と埋め込み Flight ストリームを生成します。</td>
            </tr>
            <tr>
              <td>Browser</td>
              <td>HTML を hydrate し、対応ブラウザーではクライアントナビゲーションを行います。</td>
            </tr>
          </tbody>
        </table>
        <h2 id="boundaries">実行境界</h2>
        <p>
          共通のホスト境界は <code>Request</code> から <code>Response</code> です。Workers 固有の{" "}
          <code>env</code> と <code>executionContext</code> はリクエストローカルな Effect context
          に置かれ、Flight や HTML へ自動では直列化されません。
        </p>
        <p>
          そのため、秘密値を安全に保つには、値を JSX に表示せず、Client Component の props
          にも渡さないでください。明示的に渡した値は React によりクライアントへ届きます。
        </p>
        <h2 id="next">次に読むもの</h2>
        <p>
          まず <a href="/guide/getting-started">はじめる</a> で最小の Worker を作り、続けて{" "}
          <a href="/guide/routes">ルーティング</a> と <a href="/guide/effect">Effect とサービス</a>{" "}
          を読んでください。
        </p>
        <p>
          高度な実装詳細と API の網羅的な説明は、このローカルガイドではなく{" "}
          <a href="https://github.com/nikhilsnayak/effective-rsc">
            upstream の effective-rsc リポジトリ
          </a>
          、Workers のホスト仕様は{" "}
          <a href="https://developers.cloudflare.com/workers/runtime-apis/handlers/fetch/">
            Cloudflare の Fetch handler ドキュメント
          </a>
          を参照してください。
        </p>
      </>
    ),
  },
  {
    slug: "/guide/getting-started",
    title: "はじめる",
    description:
      "VitePlus、Cloudflare Vite plugin、Workers Fetch ハンドラーで最小のアプリケーションを起動します。",
    section: "Guide",
    headings: [
      { id: "setup", title: "前提条件" },
      { id: "files", title: "最小構成" },
      { id: "application", title: "アプリケーションを書く" },
      { id: "run", title: "ローカルで動かす" },
    ],
    content: () => (
      <>
        <p>
          このリポジトリの <code>examples/workers</code> は実行できる最小例です。ここでは公開 export
          を使う構成を示します。パッケージ公開や npm からのインストールを前提にはしません。
        </p>
        <h2 id="setup">前提条件</h2>
        <p>リポジトリのルートで、まず workspace の固定済み依存関係をインストールします。</p>
        {code(`vp install`, "bash")}
        <p>
          Vite 設定は <a href="/guide/workers">Cloudflare Workers のホスト設定</a>
          で確認してください。
        </p>
        <h2 id="files">最小構成</h2>
        {code(
          `src/
  entry.server.ts  # fetch export
  entry.client.ts  # アプリケーション定義の export
  application.tsx   # JSX を含むルートグラフ
vite.config.ts     # VitePlus の設定
wrangler.jsonc     # Worker 名、vars、assets の設定`,
          "text",
        )}
        <p>
          Worker 名、assets、bindings の設定は{" "}
          <a href="https://developers.cloudflare.com/workers/wrangler/configuration/">
            Cloudflare の Wrangler configuration
          </a>
          を参照してください。Effront は生成済みの Wrangler artifact を実行し、Wrangler に未処理の
          RSC source をコンパイルさせません。
        </p>
        <h2 id="application">アプリケーションを書く</h2>
        <p>
          同じ <code>EFFRONT</code> 値から Layout、Page、Routes を作り、最後に{" "}
          <code>EFFRONT.make</code> で閉じます。以下の <code>src/application.tsx</code>{" "}
          はサービスを要求しないため <code>layer</code> は不要です。
        </p>
        {code(
          `import { Effect } from "effect";
import { Application } from "effront";

const EFFRONT = Application.effront();

const RootLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <html lang="ja">
        <body><main>{children}</main></body>
      </html>,
    ),
});

const HomePage = EFFRONT.Page.make({
  render: () => Effect.succeed(<h1>Hello, Workers</h1>),
});

export default EFFRONT.make({
  routes: EFFRONT.Routes.make({ layout: RootLayout }).page("/", HomePage),
});`,
          "tsx",
        )}
        <p>
          <code>src/entry.client.ts</code> はアプリケーション定義を公開します。ブラウザーの
          hydration entry は Effront が提供します。
        </p>
        {code(`export { default } from "./application";`, "ts")}
        <p>
          <code>src/entry.server.ts</code> は Cloudflare が呼ぶ export です。
        </p>
        {code(
          `import { createFetchHandler } from "effront/workers";
import application from "./entry.client";

export default { fetch: createFetchHandler(application) };`,
          "ts",
        )}
        <h2 id="run">ローカルで動かす</h2>
        {code(
          `cd examples/workers
vp dev

# 本番ビルドを Vite なしで Workers として確認する場合
vp build
vp run local`,
          "bash",
        )}
        <p>
          <code>vp dev</code> は Cloudflare Vite plugin を通じて workerd で実行します。
          <code>vp run local</code> はビルド後の <code>dist/rsc/wrangler.json</code> を Wrangler
          に渡します。手書きの未処理 RSC ソースを Wrangler にコンパイルさせるものではありません。
        </p>
      </>
    ),
  },
  {
    slug: "/guide/routes",
    title: "ルート、Layout、パラメーター",
    description:
      "不変な Routes グラフに Page、ネストした Layout、Schema によるパスパラメーターを追加します。",
    section: "Guide",
    headings: [
      { id: "pages", title: "静的ページとパラメーター" },
      { id: "mount", title: "ネストした Routes" },
      { id: "matching", title: "マッチング時の注意" },
    ],
    content: () => (
      <>
        <p>
          Routes は不変です。<code>page</code> と <code>mount</code>{" "}
          は新しい定義を返すので、戻り値をつないでアプリケーションのグラフを組み立てます。
        </p>
        <h2 id="pages">静的ページとパラメーター</h2>
        <p>
          パラメーター付き Page は URL の文字列を schema で decode してから <code>render</code>{" "}
          に渡します。 パスの <code>:slug</code> と schema のキーは一致させます。schema の定義方法は{" "}
          <a href="https://effect.website/docs/schema/introduction/">Effect Schema documentation</a>{" "}
          を参照してください。
        </p>
        {code(
          `import { Effect, Schema } from "effect";

const ArticlePage = EFFRONT.Page.make({
  params: Schema.Struct({ slug: Schema.NonEmptyString }),
  render: ({ params }) =>
    Effect.succeed(<article><h1>{params.slug}</h1></article>),
});

const HomePage = EFFRONT.Page.make({
  render: () => Effect.succeed(<h1>ホーム</h1>),
});`,
          "tsx",
        )}
        <h2 id="mount">ネストした Routes</h2>
        <p>
          子 Routes を <code>mount</code> すると、その Layout と Loading
          の祖先関係を保ったままプレフィックスの下へ追加します。
        </p>
        {code(
          `const ArticleLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(<section><h1>記事</h1>{children}</section>),
});

const ArticleLoading = EFFRONT.Loading.make({
  render: () => <p>記事を読み込み中…</p>,
});

const articles = EFFRONT.Routes.make({
  layout: ArticleLayout,
  loading: ArticleLoading,
}).page("/:slug", ArticlePage);

const routes = EFFRONT.Routes.make({ layout: RootLayout })
  .page("/", HomePage)
  .mount("/articles", articles);`,
          "tsx",
        )}
        <h2 id="matching">マッチング時の注意</h2>
        <p>
          GET と HEAD では、レンダリング前にパラメーターを一度だけ decode します。decode に失敗した
          URL は 404 になります。予約済みの <code>/_effront</code>{" "}
          名前空間はアプリケーションのルートに使えません。
        </p>
        <details>
          <summary>ルートを分割したい場合</summary>
          <p>
            一つのモジュールで <code>Application.effront()</code> を作り、それを import して
            Page、Layout、Routes を定義してください。異なる EFFRONT identity
            から作った値は同じアプリケーションに混ぜられません。
          </p>
        </details>
      </>
    ),
  },
  {
    slug: "/guide/components",
    title: "Component と Server Function",
    description: "Effront の Effectful Component、Server Function、Client boundary を接続します。",
    section: "Guide",
    headings: [
      { id: "server", title: "Effectful な Server Component" },
      { id: "client-boundary", title: "Client boundary と CSS" },
      { id: "mutations", title: "Server Function による更新" },
      { id: "boundary", title: "境界を守る" },
    ],
    content: () => (
      <>
        <h2 id="server">Effectful な Server Component</h2>
        <p>
          共有のサーバー UI には <code>EFFRONT.Component.make</code> を使えます。<code>render</code>{" "}
          は props を受け、<code>Effect&lt;ReactNode&gt;</code> を返します。
        </p>
        {code(
          `import { Effect } from "effect";

const Welcome = EFFRONT.Component.make({
  render: ({ name }: { readonly name: string }) =>
    Effect.succeed(<p>こんにちは、{name} さん。</p>),
});

const HomePage = EFFRONT.Page.make({
  render: () => Effect.succeed(<Welcome name="Ada" />),
});`,
          "tsx",
        )}
        <h2 id="client-boundary">Client boundary と CSS</h2>
        <p>
          <code>"use client"</code> の境界は通常の React component に適用し、
          <code>EFFRONT.Component.make</code> では包みません。React 側の意味は{" "}
          <a href="https://react.dev/reference/rsc/use-client">use client reference</a>{" "}
          を参照してください。 グローバル CSS は Layout が実際に render する export 済み Client
          Component から import します。 アプリケーション定義オブジェクトだけから import
          すると、Vite RSC が renderable な CSS 依存として 追跡できない場合があります。
        </p>
        <h2 id="mutations">Server Function による更新</h2>
        <p>
          更新処理には <code>EFFRONT.ServerFn.make</code> を使います。input は schema で decode
          され、handler は Effect を返します。<code>Schema.fromFormData</code> を使うと、戻り値を
          native の <code>form action</code>
          に渡せます。schema の詳細は{" "}
          <a href="https://effect.website/docs/schema/introduction/">
            Effect Schema documentation
          </a>{" "}
          を参照してください。
        </p>
        {code(
          `"use server";

import { Effect, Schema } from "effect";

export const followAuthor = EFFRONT.ServerFn.make({
  input: Schema.fromFormData(Schema.Struct({ authorId: Schema.NonEmptyString })),
  handler: ({ authorId }) => Effect.logInfo("Followed author", { authorId }),
});`,
          "ts",
        )}
        {code(
          `const FollowAuthorButton = EFFRONT.Component.make({
  render: ({ authorId }: { readonly authorId: string }) =>
    Effect.succeed(
      <form action={followAuthor}>
        <input name="authorId" type="hidden" value={authorId} />
        <button type="submit">Follow author</button>
      </form>,
    ),
});`,
          "tsx",
        )}
        <p>
          Server Function をサーバーグラフから通常の async
          関数として直接呼び出すことはできません。React が 呼び出せる action
          として渡してください。入力 decode と handler の失敗は action の失敗として React の
          エラー処理へ届きます。フォーム state は{" "}
          <a href="https://react.dev/reference/react/useActionState">useActionState reference</a>{" "}
          を参照してください。
        </p>
        <h2 id="boundary">境界を守る</h2>
        <p>
          Client Component に渡す props は Flight
          を通るため、シリアライズ可能で公開してよい値だけにしてください。 環境変数、Request、Effect
          service を直接渡してはいけません。
        </p>
      </>
    ),
  },
  {
    slug: "/guide/effect",
    title: "Effect とアプリケーションサービス",
    description:
      "Effect の Context.Service と Layer を使い、サーバーの依存関係を Page に注入します。",
    section: "Guide",
    headings: [
      { id: "service", title: "型付きサービスと Layer" },
      { id: "lifetime", title: "リクエストごとの生存期間" },
    ],
    content: () => (
      <>
        <p>
          アプリケーションが要求するサービス union を{" "}
          <code>Application.effront&lt;Services&gt;()</code> に指定します。サービスを要求するなら{" "}
          <code>EFFRONT.make</code> の <code>layer</code> が必須です。
        </p>
        <h2 id="service">型付きサービスと Layer</h2>
        <p>
          サービス自身の設計は{" "}
          <a href="https://effect.website/docs/requirements-management/services/">
            Effect Services
          </a>{" "}
          と{" "}
          <a href="https://effect.website/docs/requirements-management/layers/">
            Layers documentation
          </a>{" "}
          を参照してください。 Effront 固有の接続点は、
          <code>Application.effront&lt;Services&gt;()</code> と<code>EFFRONT.make</code> の{" "}
          <code>layer</code> です。
        </p>
        {code(
          `import { Effect } from "effect";
import { Application } from "effront";
import { Greeting } from "./greeting";

const EFFRONT = Application.effront<Greeting>();

const RootLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <html lang="ja">
        <body>{children}</body>
      </html>,
    ),
});

const HomePage = EFFRONT.Page.make({
  render: Effect.fn("HomePage.render")(function* () {
    const greeting = yield* Greeting;
    const message = yield* greeting.message("Ada");
    return <h1>{message}</h1>;
  }),
});

export default EFFRONT.make({
  routes: EFFRONT.Routes.make({ layout: RootLayout }).page("/", HomePage),
  layer: Greeting.layer,
});`,
          "tsx",
        )}
        <h2 id="lifetime">リクエストごとの生存期間</h2>
        <p>
          Workers の <code>createFetchHandler</code> はアプリケーション Layer
          をグローバルに一度だけ構築しません。各 request で取得し、Response body の
          EOF、エラー、キャンセルまで scope
          を保持します。リクエスト固有の接続や値をモジュールグローバルにキャッシュしないでください。
        </p>
        <p>
          Middleware が提供するサービスは、その Middleware を追加した EFFRONT の
          Page、Layout、Component、Server Function
          で利用できます。認証のような依存関係を明示する用途に向きます。
        </p>
      </>
    ),
  },
  {
    slug: "/guide/workers",
    title: "Cloudflare Workers のホスト設定",
    description:
      "Workers の env と execution context を安全に読む方法、および Vite と Wrangler の役割を説明します。",
    section: "Guide",
    headings: [
      { id: "vite", title: "Vite 設定" },
      { id: "context", title: "リクエストコンテキスト" },
      { id: "secrets", title: "環境値と秘密値" },
    ],
    content: () => (
      <>
        <h2 id="vite">Vite 設定</h2>
        <p>
          Core と Cloudflare adapter は分けて登録します。<code>effront()</code> が React、Vite RSC、
          compiler を担当し、<code>effrontCloudflare()</code> は <code>rsc</code> Worker
          environment、子
          <code>ssr</code> environment、Workers 向け SSR 出力配置だけを担当します。
        </p>
        {code(
          `import { effront } from "effront/vite";
import { effrontCloudflare } from "effront/cloudflare";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [effront(), effrontCloudflare()],
});`,
          "ts",
        )}
        <p>
          Cloudflare の option が必要な場合は{" "}
          <code>effrontCloudflare(&#123; ...options &#125;)</code> と 直接渡します。通常の設定では
          option は不要です。<code>cloudflare</code> で入れ子にせず、React plugin と Vite RSC plugin
          は 重ねて登録しないでください。Cloudflare adapter を省けば将来の Node/Bun host adapter と
          組み合わせられますが、それらはまだ実装されていません。デフォルトでは RSC entry は
          <code>src/entry.server.ts</code>、アプリケーションの alias は{" "}
          <code>src/entry.client.ts</code> です。
        </p>
        <h2 id="context">リクエストコンテキスト</h2>
        <p>
          Fetch export は <code>(request, env, executionContext)</code> を受けます。サーバー側
          Effect の中で型付きの host 値を取得できます。
        </p>
        {code(
          `import { Effect } from "effect";
import { getWorkersEnv, getWorkersRequestContext } from "effront/workers";

type Env = { APP_LABEL: string; SERVER_TOKEN?: string };
type ExecutionContext = { waitUntil(promise: Promise<unknown>): void };

const requestInfo = Effect.gen(function* () {
  const env = yield* getWorkersEnv<Env>();
  const context = yield* getWorkersRequestContext<Env, ExecutionContext>();
  return { label: env.APP_LABEL, path: new URL(context.request.url).pathname };
});`,
          "ts",
        )}
        <p>
          これらの型パラメーターは runtime validation ではありません。binding
          の検証が必要なら、自分の Layer で値を検査してください。helper は request の Effect context
          の外では使用できません。
        </p>
        <h2 id="secrets">環境値と秘密値</h2>
        <p>
          bindings と local secrets の設定は{" "}
          <a href="https://developers.cloudflare.com/workers/configuration/environment-variables/">
            Cloudflare environment variables documentation
          </a>
          を参照してください。Effront は env を HTML や Flight に自動直列化しませんが、JSX や Client
          props に 明示的に渡した値は公開されます。
        </p>
      </>
    ),
  },
  {
    slug: "/guide/testing",
    title: "テストとローカル検証",
    description: "型、ユニット、実際の Vite/workerd と Wrangler artifact を段階的に検証します。",
    section: "Guide",
    headings: [
      { id: "commands", title: "標準チェック" },
      { id: "acceptance", title: "実行経路を分けて検証する" },
      { id: "expectations", title: "確認すべきふるまい" },
    ],
    content: () => (
      <>
        <h2 id="commands">標準チェック</h2>
        {code(
          `vp check
vp test run

# ブラウザーによる Workers 受け入れテスト
cd packages/e2e
vp run test

# ドキュメントサイトのブラウザー検証
vp run test:docs`,
          "bash",
        )}
        <p>
          単体テストは実装の横に <code>*.test.ts</code> または <code>*.test.tsx</code>{" "}
          として置きます。複数モジュールや外部ツールの契約は統合テストにします。ブラウザー suite は{" "}
          <code>*.e2e.ts</code> とし、Vitest の標準 discovery と分離します。
        </p>
        <h2 id="acceptance">実行経路を分けて検証する</h2>
        <p>
          ビルド成功だけでは RSC、hydration、Workers の request lifetime
          は確認できません。少なくとも次の二つを実行してください。
        </p>
        <ol>
          <li>
            <code>vp dev</code> で Vite と Cloudflare plugin による workerd 実行を確認する。
          </li>
          <li>
            <code>vp build</code> 後に <code>vp run local</code> で生成済み{" "}
            <code>dist/rsc/wrangler.json</code> を Wrangler が実行できることを確認する。
          </li>
        </ol>
        <h2 id="expectations">確認すべきふるまい</h2>
        <ul>
          <li>HTML 表示、Flight 応答、hydrate 後の Client Component の操作。</li>
          <li>リンク遷移、未知のルート、パラメーター decode 失敗時の応答。</li>
          <li>
            runtime binding の差し替えと、秘密値が HTML、Flight、Client props に現れないこと。
          </li>
          <li>Response の完了、エラー、キャンセル後にリクエスト scope が解放されること。</li>
        </ul>
        <p>
          実際の Workers Fetch 経路を外部サービスなしで検証できます。Cloudflare
          への認証、デプロイ、公開はローカル検証には必要ありません。
        </p>
      </>
    ),
  },
];

import { CodeBlock } from "../components/code-block";
import type { CodeLanguage } from "../components/code-block";
import type { DocPage } from "./types";

const code = (source: string, language: CodeLanguage) => (
  <CodeBlock code={source} language={language} />
);

export const guidePages: readonly DocPage[] = [
  {
    slug: "/",
    title: "Effront",
    description: "Web標準とEffectベースで実装されたReactのメタフレームワークです。",
    section: "Guide",
    headings: [
      { id: "overview", title: "Effrontについて" },
      { id: "boundaries", title: "Web標準を境界にする" },
      { id: "next", title: "次に読むもの" },
    ],
    content: () => (
      <>
        <p>EffrontはWeb標準とEffectベースで実装されたReactのメタフレームワークです。</p>
        <p>
          Web標準の Request／Response とストリームを境界にすることで、
          対応するホストアダプターを通じて、実行環境や既存フレームワークへ組み込める設計です。
        </p>
        <h2 id="overview">Effrontについて</h2>
        <p>
          React Server Components による UI と、Effect による依存関係・リソース管理を結び付けます。
          アプリケーションを Routes、Layout、Page、Component、Middleware、Server Function
          から組み立て、 必要なサービスをアプリケーションの Layer から注入します。
        </p>
        <h2 id="boundaries">Web標準を境界にする</h2>
        <p>
          リクエストから Flight と HTML を生成し、ブラウザーでは hydration
          とナビゲーションを行います。
          アプリケーションの定義と、ビルド統合・実行環境の接続を分けているため、
          ページやサービスのコードにプラットフォームの起動処理を混ぜる必要はありません。
        </p>
        <p>
          実行環境ごとの対応状況と必要な設定は、<a href="/platforms">Platforms</a>{" "}
          にまとめています。
        </p>
        <h2 id="next">次に読むもの</h2>
        <p>
          <a href="/guide/getting-started">はじめる</a> でアプリケーションの構成を確認し、
          <a href="/guide/routes">ルーティング</a> と <a href="/guide/effect">サービスの注入</a>{" "}
          を読んでください。内部の処理を理解したい場合は <a href="/core/overview">Core の解説</a>
          を順に読み進めてください。
        </p>
      </>
    ),
  },
  {
    slug: "/guide/getting-started",
    title: "はじめる",
    description: "Cloudflareを実行環境に、アプリケーションの作成からローカル起動まで進めます。",
    section: "Guide",
    headings: [
      { id: "setup", title: "準備" },
      { id: "files", title: "アプリケーションの構成" },
      { id: "application", title: "アプリケーションを書く" },
      { id: "run", title: "ビルド統合と実行" },
    ],
    content: () => (
      <>
        <h2 id="setup">準備</h2>
        <p>
          この入門ではCloudflareを実行環境に使います。VitePlusで管理するアプリケーションに、npmレジストリから必要なパッケージを追加します。
          VitePlusの導入方法は <a href="https://viteplus.dev/guide/">公式ガイド</a>{" "}
          を参照してください。
        </p>
        {code(
          `vp add effront
vp add -D @effront/vite @effront/cloudflare @vitejs/plugin-rsc wrangler`,
          "bash",
        )}
        <p>
          ReactとEffectは、インストールするEffrontのpeer dependenciesに合うバージョンを使います。
          <code>@vitejs/plugin-rsc</code>{" "}
          は開発時の依存最適化でアプリケーションから直接解決するため、明示的に追加します。
        </p>
        <h2 id="files">アプリケーションの構成</h2>
        {code(
          `src/
  entry.workers.ts # Fetch ハンドラーを公開するエントリ
  entry.client.ts  # アプリケーション定義のexport
  application.tsx  # JSXを含むルートグラフ
vite.config.ts    # ビルドとホスト統合
wrangler.jsonc    # Cloudflareの設定`,
          "text",
        )}
        <h2 id="application">アプリケーションを書く</h2>
        <p>
          同じ <code>EFFRONT</code> 値から Layout、Page、Routes を作り、<code>EFFRONT.make</code>{" "}
          で閉じます。 次の <code>src/application.tsx</code> はサービスを要求しないため{" "}
          <code>layer</code> は不要です。
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
  render: () => Effect.succeed(<h1>Hello, Effront</h1>),
});

export default EFFRONT.make({
  routes: EFFRONT.Routes.make({ layout: RootLayout }).page("/", HomePage),
});`,
          "tsx",
        )}
        <p>
          <code>src/entry.client.ts</code> はアプリケーション定義を公開します。ブラウザーのhydration
          entryはEffrontが提供します。
        </p>
        {code(`export { default } from "./application";`, "ts")}
        <h2 id="run">ビルド統合と実行</h2>
        <p>
          <code>src/entry.workers.ts</code> にFetchハンドラーを定義します。
        </p>
        {code(
          `import { createFetchHandler } from "effront/workers";
import application from "./entry.client";

export default { fetch: createFetchHandler(application) };`,
          "ts",
        )}
        <p>
          <code>vite.config.ts</code> でEffrontとCloudflareのプラグインを登録します。
        </p>
        {code(
          `import { effront } from "@effront/vite";
import { effrontCloudflare } from "@effront/cloudflare";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [effront(), effrontCloudflare()],
});`,
          "ts",
        )}
        <p>
          <code>wrangler.jsonc</code> にアプリケーション名とサーバーエントリを設定します。
        </p>
        {code(
          `{
  "name": "my-effront-app",
  "main": "src/entry.workers.ts",
  "compatibility_date": "2026-09-12",
  "compatibility_flags": ["nodejs_compat"],
  "assets": { "binding": "ASSETS" }
}`,
          "json",
        )}
        <p>アプリケーションのディレクトリから開発サーバーを起動します。</p>
        {code(`vp dev`, "bash")}
        <p>
          ターミナルに表示されたURLを開くと <code>Hello, Effront</code> が表示されます。
          ビルド済みのアプリケーションは次のコマンドで確認できます。
        </p>
        {code(
          `vp build
vp exec wrangler dev --local --no-bundle --config dist/rsc/wrangler.json`,
          "bash",
        )}
        <p>
          環境変数やホスト設定の詳細は <a href="/platforms/cloudflare">Cloudflare</a>{" "}
          のページを参照してください。
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
          GET と HEAD では、レンダリング前に Page のパスパラメーターを Schema で一度だけ decode
          します。 この Schema に適合しないパスは 404 を返します。予約済みの <code>/_effront</code>{" "}
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
          <code>"use client"</code> の詳細は{" "}
          <a href="https://react.dev/reference/rsc/use-client">React の公式リファレンス</a>{" "}
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
      { id: "missing-services", title: "サービス不足の型エラー" },
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
        <h2 id="missing-services">サービス不足の型エラー</h2>
        <p>
          要求するサービスの宣言と、Layer による提供は型チェックで確認されます。 上の Greeting
          を例にすると、次の不足を検出します。診断の全文は呼び出し方により変わります。
        </p>
        <ul>
          <li>
            <code>Application.effront()</code> のまま Page の render で Greeting を要求すると、
            <code>TS2769: No overload matches this call</code> になります。 render が返す Effect
            の要求サービス Greeting が、利用可能なサービスに含まれないためです。
            <code>Application.effront&lt;Greeting&gt;()</code> と宣言します。
          </li>
          <li>
            Greeting を宣言して <code>EFFRONT.make</code> の layer を省略すると、
            <code>TS2345</code> になります。渡したオブジェクトに必須の layer が不足しています。
          </li>
          <li>
            <code>layer: Layer.empty</code> を渡すと、
            <code>
              TS2322: Type 'Layer&lt;never, never, never&gt;' is not assignable to type
              'Layer&lt;Greeting, never, HttpRouter&gt;'
            </code>
            になります。Layer の出力に Greeting が不足しているため、
            <code>Greeting.layer</code> を渡します。
          </li>
        </ul>
        <p>
          複数サービスを宣言した場合は、それらをすべて提供する Layer を渡します。 Middleware
          経由で追加するサービスは、その Middleware を適用したスコープで利用します。
        </p>
        <h2 id="lifetime">リクエストごとの生存期間</h2>
        <p>
          Fetch ランタイムはアプリケーション Layer をグローバルに一度だけ構築しません。各 request
          で取得し、Response body の EOF、エラー、キャンセルまで scope
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
    slug: "/guide/testing",
    title: "アプリケーションのテスト",
    description: "アプリケーションの処理、ページ表示、ユーザー操作を検証します。",
    section: "Guide",
    headings: [
      { id: "services", title: "アプリケーションの処理" },
      { id: "pages", title: "ページとユーザー操作" },
      { id: "tools", title: "テストツール" },
    ],
    content: () => (
      <>
        <h2 id="services">アプリケーションの処理</h2>
        <p>
          Page や Server Function から呼ぶ処理を Effect
          として切り出すと、表示から独立して検証できます。 テスト用のサービス実装を Layer
          で提供し、戻り値、業務上のエラー、保存内容を確認します。
          アプリケーション全体にテスト用サービスを使う場合は、
          <code>EFFRONT.make</code> の <code>layer</code> に渡します。
        </p>
        <h2 id="pages">ページとユーザー操作</h2>
        <p>
          起動したアプリケーションに実ブラウザーでアクセスし、利用者が見る結果を確認します。
          起動設定は <a href="/guide/getting-started">はじめる</a>、ホストごとの設定は
          <a href="/platforms">プラットフォーム</a> を参照してください。
        </p>
        <ul>
          <li>URL に対応する記事やデータが表示されること。</li>
          <li>リンクで目的のページへ移動できること。</li>
          <li>フォーム送信が保存内容と画面に反映されること。</li>
          <li>入力エラーやアクセス権限に応じた案内が表示されること。</li>
        </ul>
        <h2 id="tools">テストツール</h2>
        <p>
          テストの書き方は <a href="https://vitest.dev/guide/">Vitest</a>、
          ブラウザーテストとサーバー自動起動は
          <a href="https://playwright.dev/docs/test-webserver">Playwright</a>{" "}
          の公式ガイドを参照してください。
        </p>
      </>
    ),
  },
];

import { CodeBlock } from "../components/code-block";
import type { CodeLanguage } from "../components/code-block";
import type { DocPage } from "./types";

const code = (source: string, language: CodeLanguage) => (
  <CodeBlock code={source} language={language} />
);

export const platformPages: readonly DocPage[] = [
  {
    slug: "/platforms",
    title: "プラットフォーム",
    description: "実行環境に合わせたホスト統合を選びます。",
    section: "Platforms",
    headings: [
      { id: "architecture", title: "ホスト統合の役割" },
      { id: "support", title: "対応状況" },
    ],
    content: () => (
      <>
        <h2 id="architecture">ホスト統合の役割</h2>
        <p>
          Effront のコアは Web 標準の Request と Response を入口にします。 共通のビルド統合は{" "}
          <code>@effront/vite</code>、実行環境との接続はホスト用プラグインが担当します。
          利用するホスト用プラグインを <code>effront()</code> と組み合わせて登録します。
        </p>
        <p>
          現在の構成は、アプリケーション定義の <code>entry.client.ts</code> と Fetch を公開する
          <code>entry.workers.ts</code> を使います。Vite
          とホスト用プラグインは後者を直接読み込みます。将来の Node / Bun 向けには、
          <code>entry.server.ts</code> から Fetch を接続する方式と、Runtime を再利用して Effect HTTP
          で直接ホストする方式を検討しています。
        </p>
        <h2 id="support">対応状況</h2>
        <ul>
          <li>
            <a href="/platforms/cloudflare">Cloudflare Workers</a>:<code>@effront/cloudflare</code>{" "}
            で、開発サーバーと Wrangler による実行に対応しています。
          </li>
          <li>Node、Bun、Vercel: 専用アダプターは今後の対応候補です。</li>
        </ul>
        <p>
          最初のアプリケーションは <a href="/guide/getting-started">はじめる</a> の Cloudflare
          Workers 向けサンプルで作成できます。
        </p>
      </>
    ),
  },
  {
    slug: "/platforms/cloudflare",
    title: "Cloudflare Workers のホスト設定",
    description:
      "Workers の env と execution context を安全に読む方法、および Vite と Wrangler の役割を説明します。",
    section: "Platforms",
    headings: [
      { id: "setup", title: "セットアップ" },
      { id: "vite", title: "Vite 設定" },
      { id: "local", title: "ローカル実行と検証" },
      { id: "context", title: "リクエストコンテキスト" },
      { id: "secrets", title: "環境値と秘密値" },
    ],
    content: () => (
      <>
        <h2 id="setup">セットアップ</h2>
        <p>
          アプリケーションにホストアダプターとWranglerを追加します。 Cloudflare Vite
          pluginはアダプターの依存関係に含まれます。
        </p>
        {code(`vp add -D @effront/cloudflare wrangler`, "bash")}
        <p>
          Wranglerの詳細は{" "}
          <a href="https://developers.cloudflare.com/workers/wrangler/configuration/">
            公式設定リファレンス
          </a>{" "}
          を参照してください。
        </p>
        {code(
          `src/
  entry.workers.ts
  entry.client.ts
  application.tsx
vite.config.ts
wrangler.jsonc`,
          "text",
        )}
        <p>
          <code>src/entry.workers.ts</code> から Fetch ハンドラーを公開します。
        </p>
        {code(
          `import { createFetchHandler } from "effront/workers";
import application from "./entry.client";

export default { fetch: createFetchHandler(application) };`,
          "ts",
        )}
        <p>
          <code>wrangler.jsonc</code> の最小設定です。
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
        <h2 id="vite">Vite 設定</h2>
        <p>
          Vite 統合と Cloudflare adapter は分けて登録します。<code>effront()</code> が React、Vite
          RSC、 compiler を担当し、<code>effrontCloudflare()</code> は <code>rsc</code> Worker
          environment、子
          <code>ssr</code> environment、Workers 向け SSR 出力配置だけを担当します。
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
          Cloudflare の option が必要な場合は{" "}
          <code>effrontCloudflare(&#123; ...options &#125;)</code> と 直接渡します。通常の設定では
          option は不要です。<code>cloudflare</code> で入れ子にせず、React plugin と Vite RSC plugin
          はアダプターと共通プラグインが登録します。デフォルトでは RSC entry は
          <code>src/entry.workers.ts</code>、アプリケーションの alias は{" "}
          <code>src/entry.client.ts</code> です。
        </p>
        <h2 id="local">ローカル実行と検証</h2>
        {code(
          `vp dev

# ビルド済み成果物を Vite と独立に実行する
vp build
vp exec wrangler dev --local --no-bundle --config dist/rsc/wrangler.json`,
          "bash",
        )}
        <p>
          開発時は Cloudflare Vite plugin が RSC と SSR を workerd で実行します。 ビルド後は
          Wrangler が <code>dist/rsc/wrangler.json</code> を読み込みます。 未処理の RSC ソースを
          Wrangler に直接コンパイルさせません。 ローカル検証に Cloudflare
          の認証やデプロイは不要です。
        </p>
        <h2 id="context">リクエストコンテキスト</h2>
        <p>
          Fetch export は <code>(request, env, executionContext)</code> を受けます。サーバー側
          Effect の中で型付きの host 値を取得できます。
        </p>
        {code(
          `import { Effect } from "effect";
import { createWorkersContextAccessors } from "@effront/cloudflare/workers";

type Env = { APP_LABEL: string; SERVER_TOKEN?: string };
export const { getWorkersEnv, getWorkersRequestContext } =
  createWorkersContextAccessors<Env>();

const requestInfo = Effect.gen(function* () {
  const env = yield* getWorkersEnv();
  const context = yield* getWorkersRequestContext();
  return { label: env.APP_LABEL, path: new URL(context.request.url).pathname };
});`,
          "ts",
        )}
        <p>
          factory にアプリケーションの Env を一度指定すると、生成した取得関数がその型を返します。
          ExecutionContext は <code>waitUntil(promise: Promise&lt;unknown&gt;): void</code>
          を持つ型に設定済みです。個別の呼び出しで型を指定する場合は、同じモジュールが公開する
          <code>getWorkersEnv&lt;Env&gt;()</code> と{" "}
          <code>getWorkersRequestContext&lt;Env&gt;()</code>
          も使えます。リクエスト処理中の Effect から取得してください。
        </p>
        <p>
          どの factory も同じリクエスト用 Context を読みます。型指定はアプリケーション側の契約で、
          binding の実行時検証は必要に応じて Layer で行います。
          <code>@effront/cloudflare/workers</code> はランタイム用の入口で、Vite
          プラグインとは分離されています。
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
];

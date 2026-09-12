import { CodeBlock } from "../components/code-block";
import type { CodeLanguage } from "../components/code-block";
import type { DocPage } from "./types";

const code = (source: string, language: CodeLanguage) => (
  <CodeBlock code={source} language={language} />
);

export const platformPages: readonly DocPage[] = [
  {
    slug: "/platforms/cloudflare",
    title: "Cloudflare Workers のホスト設定",
    description:
      "Workers の env と execution context を安全に読む方法、および Vite と Wrangler の役割を説明します。",
    section: "Platforms",
    headings: [
      { id: "support", title: "対応状況とセットアップ" },
      { id: "vite", title: "Vite 設定" },
      { id: "local", title: "ローカル実行と検証" },
      { id: "context", title: "リクエストコンテキスト" },
      { id: "secrets", title: "環境値と秘密値" },
    ],
    content: () => (
      <>
        <h2 id="support">対応状況とセットアップ</h2>
        <p>
          現在提供しているホスト統合は <code>@effront/cloudflare</code> です。 Node、Bun、Vercel
          向けアダプターは未提供で、実行を保証していません。 このページに限り、Cloudflare Workers
          固有の起動方法と設定を扱います。
        </p>
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
  entry.server.ts
  entry.client.ts
  application.tsx
vite.config.ts
wrangler.jsonc`,
          "text",
        )}
        <p>
          <code>src/entry.server.ts</code> から Fetch ハンドラーを公開します。
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
  "main": "src/entry.server.ts",
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
          は 重ねて登録しないでください。Cloudflare adapter を省けば将来の Node/Bun host adapter と
          組み合わせられますが、それらはまだ実装されていません。デフォルトでは RSC entry は
          <code>src/entry.server.ts</code>、アプリケーションの alias は{" "}
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
];

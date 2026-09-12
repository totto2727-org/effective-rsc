import { CodeBlock } from "../components/code-block";
import type { CodeLanguage } from "../components/code-block";
import type { DocPage } from "./types";

const code = (source: string, language: CodeLanguage = "ts") => (
  <CodeBlock code={source} language={language} />
);

const table = (rows: readonly (readonly [string, string])[]) => (
  <table>
    <thead>
      <tr>
        <th>API / 項目</th>
        <th>契約</th>
      </tr>
    </thead>
    <tbody>
      {rows.map(([name, description]) => (
        <tr key={name}>
          <td>
            <code>{name}</code>
          </td>
          <td>{description}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

export const apiReferencePages: readonly DocPage[] = [
  {
    slug: "/api-reference",
    title: "API reference",
    description:
      "Effront の公開エントリーポイントと、アプリケーション・Fetch・ビルド API の索引です。",
    section: "API reference",
    headings: [
      { id: "exports", title: "公開エントリーポイント" },
      { id: "index", title: "API 索引" },
    ],
    content: () => (
      <>
        <h2 id="exports">公開エントリーポイント</h2>
        <p>
          アプリケーションを定義する API、リクエストを処理する
          API、ビルド設定を分けて読み込みます。以下は現在の Effront パッケージの公開契約です。
        </p>
        {table([
          [
            "effront",
            "Application、PageViewTransition を公開。実行時は react-server 条件の RSC グラフで使用します。",
          ],
          [
            "effront/workers",
            "Fetch ハンドラー、リクエストコンテキストと型付き reader を公開します。",
          ],
          [
            "@effront/vite",
            "effront と EffrontViteOptions。Vite の RSC・SSR・ブラウザー環境を構成します。",
          ],
          [
            "@effront/cloudflare",
            "effrontCloudflare と EffrontCloudflareOptions。Cloudflare のビルド・開発統合です。",
          ],
          [
            "@effront/cloudflare/workers",
            "CloudflareExecutionContext と Cloudflare 向けの型付き reader。リクエスト処理から利用します。",
          ],
        ])}
        <p>
          <code>effront/internal/client-entry</code> と <code>effront/internal/ssr-entry</code>{" "}
          はビルド統合が読み込むエントリーです。アプリケーションの組み立てには以下の API
          を使います。ファクトリーの戻り値の型は推論されるため、内部モジュールから型を直接 import
          する必要はありません。
        </p>
        <h2 id="index">API 索引</h2>
        <ul>
          <li>
            <a href="/api-reference/application">Application</a>: identity、サービス型、make。
          </li>
          <li>
            <a href="/api-reference/components">Component・Page・Layout・Loading</a>: 描画と入力。
          </li>
          <li>
            <a href="/api-reference/routing">Routes・Middleware</a>: ルート構成とスコープ。
          </li>
          <li>
            <a href="/api-reference/server-functions">ServerFn</a>: Schema 入力とサーバー実行。
          </li>
          <li>
            <a href="/api-reference/workers">Fetch・Workers context</a>: ホストとの接続と reader。
          </li>
          <li>
            <a href="/api-reference/vite">Vite・Cloudflare plugins</a>: オプションと出力構成。
          </li>
        </ul>
      </>
    ),
  },
  {
    slug: "/api-reference/application",
    title: "Application",
    description: "Application.effront で作る identity と、make に渡すルート・サービスの契約です。",
    section: "API reference",
    headings: [
      { id: "identity", title: "Application.effront" },
      { id: "make", title: "make" },
      { id: "example", title: "最小定義" },
    ],
    content: () => (
      <>
        <h2 id="identity">Application.effront</h2>
        {code(`import { Application } from "effront";

const EFFRONT = Application.effront();
// サービスが必要な場合: Application.effront<MyService>()`)}
        <p>
          <code>Application.effront&lt;Services = never&gt;()</code> は新しいアプリケーション
          identity を持つファクトリー集合を返します。<code>Services</code> はアプリケーション Layer
          が提供する Effect
          サービス型です。共有モジュールで一度作り、各定義から同じ値を読み込みます。
        </p>
        {table([
          ["Component / Page / Layout / Loading", "同じ identity に属する描画定義を作ります。"],
          [
            "Routes / Middleware / ServerFn",
            "同じ identity に属するルート・ミドルウェア・サーバー関数を作ります。",
          ],
          [
            "withMiddleware(middleware)",
            "identity と make を共有し、ミドルウェアを追加した新しいファクトリー集合を返します。元の集合は変更しません。",
          ],
          [
            "make({ routes, layer? })",
            "Fetch ハンドラーへ渡すアプリケーション定義を返します。サーバーの起動は行いません。",
          ],
        ])}
        <p>
          別々の <code>Application.effront()</code> が返した値は、同じサービス型でも別 identity
          です。異なる identity の Page・Routes・Layout・Loading・Middleware を組み合わせると{" "}
          <code>TypeError</code> になります。
        </p>
        <h2 id="make">make</h2>
        {table([
          ["routes", "同じ identity の空でない Routes。ルートの Routes 自身に layout が必要です。"],
          [
            "layer",
            "Layer.Layer<Services, ApplicationError, HttpRouter.HttpRouter>。Services が never なら省略でき、省略時は Layer.empty です。",
          ],
          [
            "戻り値",
            "サービス型と Layer のエラー型を保持するアプリケーション定義。createFetchHandler の引数になります。",
          ],
        ])}
        <p>
          <code>HttpRouter.HttpRouter</code> は <code>effect/unstable/http</code>{" "}
          のサービスです。ハンドラーが提供する Router に対し、アプリケーション Layer から独自の HTTP
          ルートを登録できます。Layer は Fetch リクエストごとに構築されます。
        </p>
        <h2 id="example">最小定義</h2>
        {code(
          `import { Effect } from "effect";
import { Application } from "effront";

const EFFRONT = Application.effront();
const RootLayout = EFFRONT.Layout.make({
  render: ({ children }) => Effect.succeed(
    <html lang="ja"><head><title>Example</title></head>
      <body>{children}</body></html>
  ),
});
const Home = EFFRONT.Page.make({
  render: () => Effect.succeed(<h1>Home</h1>),
});

export default EFFRONT.make({
  routes: EFFRONT.Routes.make({ layout: RootLayout }).page("/", Home),
});`,
          "tsx",
        )}
      </>
    ),
  },
  {
    slug: "/api-reference/components",
    title: "Component・Page・Layout・Loading",
    description:
      "描画ファクトリーの render、Page の params Schema、Loading の同期契約を確認します。",
    section: "API reference",
    headings: [
      { id: "render", title: "描画 API" },
      { id: "params", title: "Page の params" },
      { id: "view-transition", title: "PageViewTransition" },
      { id: "loading", title: "Layout と Loading" },
    ],
    content: () => (
      <>
        <h2 id="render">描画 API</h2>
        <p>
          以下の呼び出し形はすべて <code>EFFRONT</code>、または{" "}
          <code>EFFRONT.withMiddleware(...)</code> の戻り値から利用します。Component・Page・Layout
          の render は{" "}
          <code>Effect.Effect&lt;Awaited&lt;ReactNode&gt;, E, AvailableServices&gt;</code>{" "}
          を返します。E
          は任意のエラー型です。利用可能なサービスは、アプリケーションのサービスと適用済み
          Middleware が提供するサービスです。
        </p>
        {table([
          [
            "Component.make({ render })",
            "render(props) の props 型は利用者が指定。戻り値は JSX に配置できる非同期コンポーネントです。",
          ],
          [
            "Page.make({ render })",
            "静的 Page。render() は引数なし。戻り値は Routes.page に登録する定義です。",
          ],
          [
            "Page.make({ params, render })",
            "パラメーター付き Page。render({ params }) は Schema でデコード済みの値を受け取ります。",
          ],
          [
            "Layout.make({ render })",
            "render({ children }) の children は Awaited<ReactNode>。戻り値を Routes.make の layout に渡します。",
          ],
          [
            "Loading.make({ render })",
            "render() は ReactNode を同期的に返します。戻り値を Routes.make の loading に渡します。",
          ],
        ])}
        {code(
          `const Greeting = EFFRONT.Component.make({
  render: ({ name }: { readonly name: string }) =>
    Effect.succeed(<p>こんにちは、{name}</p>),
});
const Home = EFFRONT.Page.make({
  render: () => Effect.succeed(<Greeting name="太郎" />),
});`,
          "tsx",
        )}
        <p>
          このページの断片では <code>Effect</code>・<code>Schema</code> を <code>effect</code>{" "}
          から、<code>EFFRONT</code>{" "}
          を共有するアプリケーションモジュールから読み込むものとします。Page は JSX
          コンポーネントとして直接呼ぶのではなく、Routes に登録します。
        </p>
        <h2 id="view-transition">PageViewTransition</h2>
        <p>
          <code>import {"{ PageViewTransition }"} from "effront"</code> で読み込む Effect
          の既定値付きコンテキストです。
          <code>Layer.succeed(PageViewTransition, config)</code> をアプリケーションの Layer
          に組み合わせます。 各 Page の <code>viewTransition</code>{" "}
          は指定したプロパティだけを上書きします。
          遷移種別の対応表はプロパティごと置き換え、表の中身はマージしません。
        </p>
        {table([
          ["enabled", "既定は true。false はフレームワークの Page アニメーションを無効化します。"],
          [
            "default / enter / exit / update / share",
            "React ViewTransition のクラス名、auto、none、または遷移種別とクラスの対応表。",
          ],
          [
            "Page.make({ viewTransition: false, render })",
            "この Page のアニメーションを無効化します。",
          ],
          ["Page.make({ viewTransition: config, render })", "この Page に個別の設定を指定します。"],
        ])}
        <p>
          設定は Flight を通るシリアライズ可能な値です。 境界名 effront-page
          はフレームワーク用に予約されています。独自の境界には React
          の自動名か別の名前を使います。コールバックは設定に含めず、独自の React 境界で扱います。
          利用例は{" "}
          <a href="/advanced/client-navigation#transition-scope">ページ遷移のアニメーション</a>{" "}
          を参照してください。
        </p>
        <p>
          全体で無効にした場合も Page 側の enabled: true で有効にできます。 表示中に enabled
          を切り替えると境界が追加・削除されるため、ページ内の状態が再初期化される場合があります。
          継続して保持する状態は共有 Layout に置きます。 OS
          の減速モーション設定の切替では境界を維持し、ページ内の入力状態を保持します。
        </p>
        <h2 id="params">Page の params</h2>
        {code(
          `const Article = EFFRONT.Page.make({
  params: Schema.Struct({ id: Schema.FiniteFromString }),
  render: ({ params }) => Effect.succeed(<h1>記事 {params.id}</h1>),
});
const routes = EFFRONT.Routes.make().page("/articles/:id", Article);`,
          "tsx",
        )}
        <p>
          上の <code>params.id</code> は <code>number</code> です。Schema の Encoded
          側のキーがパスのパラメーター名と過不足なく一致し、各値が URL
          由来の文字列を受け取れる必要があります。キーが空の Schema や任意の文字列キーを持つ Record
          ではなく、キーを確定できる Schema を渡します。
        </p>
        <p>
          静的パスには params のない Page を、<code>:id</code> などを含むパスには対応する params
          Schema を持つ Page を登録します。
        </p>
        <h2 id="loading">Layout と Loading</h2>
        {code(
          `const SectionLayout = EFFRONT.Layout.make({
  render: ({ children }) => Effect.succeed(<section>{children}</section>),
});
const Pending = EFFRONT.Loading.make({
  render: () => <p role="status">読み込み中…</p>,
});
const section = EFFRONT.Routes.make({
  layout: SectionLayout,
  loading: Pending,
}).page("/", Home);`,
          "tsx",
        )}
        <p>
          Loading はルートの Suspense fallback を定義します。Effect や Promise
          を返さず、同期的に表示できる UI を返します。ルート Layout は HTML 文書の外枠を、子 Routes
          の Layout はその内側の UI を担当できます。
        </p>
      </>
    ),
  },
  {
    slug: "/api-reference/routing",
    title: "Routes・Middleware",
    description:
      "Routes の不変ビルダー、パス制約、Middleware が追加するサービスと実行スコープです。",
    section: "API reference",
    headings: [
      { id: "routes", title: "Routes" },
      { id: "paths", title: "パスの契約" },
      { id: "middleware", title: "Middleware と withMiddleware" },
    ],
    content: () => (
      <>
        <h2 id="routes">Routes</h2>
        {table([
          [
            "Routes.make()",
            "layout と loading を持たない空の Routes を作ります。子ルートの組み立てに使えます。",
          ],
          [
            "Routes.make({ layout?, loading? })",
            "同じ identity の Layout と Loading を設定します。",
          ],
          [
            "Routes.fromPages(entries, { layout?, loading? })",
            "glob などで列挙した [静的パス, Page] の配列から Routes を作ります。初期化時に空配列、無効なパス、重複、identity の不一致を検証します。Page は params を持たない定義を使用します。直接アプリケーションへ渡す場合は Layout を設定し、子 Routes として mount することもできます。",
          ],
          [
            "routes.page(path, page)",
            "Page を追加した新しい Routes を返します。path と params の対応を型で検証します。",
          ],
          [
            "routes.mount(prefix, child)",
            "空でない子 Routes を静的 prefix の下に追加した新しい Routes を返します。",
          ],
        ])}
        {code(`const articles = EFFRONT.Routes.make()
  .page("/", ArticleIndex)
  .page("/:id", Article);
const routes = EFFRONT.Routes.make({ layout: RootLayout })
  .page("/", Home)
  .mount("/articles", articles);`)}
        <p>
          各 Page と Layout は同じ EFFRONT で定義済みとします。子の <code>/</code> は{" "}
          <code>/articles</code> に、<code>/:id</code> は <code>/articles/:id</code> に対応します。
          <code>page</code> と <code>mount</code> は元の Routes を変更しません。
        </p>
        <h2 id="paths">パスの契約</h2>
        {table([
          [
            "/ と /articles/:id",
            "絶対パスのリテラルと、セグメント全体を占める :name パラメーターを使用します。",
          ],
          ["mount の prefix", "パラメーターを含まない静的パスを指定します。"],
          [
            "重複",
            "大文字小文字を正規化し、パラメーター名を除いた形が同じルートは競合します。例: /articles/:id と /articles/:slug。",
          ],
          [
            "無効なパス",
            "末尾の /（ルート / を除く）、空・.・.. セグメント、ワイルドカード、クエリー、ハッシュなどは指定できません。",
          ],
          [
            "/_effront",
            "フレームワーク予約領域です。ルート直下の /:name のようにこの領域へも一致するパターンも make 時に拒否されます。",
          ],
        ])}
        <h2 id="middleware">Middleware と withMiddleware</h2>
        <p>
          <code>Middleware.make(handler)</code> は Effect HTTP のレスポンス Effect
          を受け取り、レスポンス Effect を返す Middleware
          を定義します。独自のエラー型を外側へ追加せず、受け取った Effect
          のエラーと残りのサービス要求を保ちます。認証などで失敗応答を返す場合は HTTP
          レスポンスへ変換します。
        </p>
        {code(
          `import { Context, Effect } from "effect";
import { Application } from "effront";

class RequestLabel extends Context.Service<RequestLabel, {
  readonly value: string;
}>()("example/RequestLabel") {}

const EFFRONT = Application.effront();
const ProvideLabel = EFFRONT.Middleware.make<{ provides: RequestLabel }>(
  (httpEffect) => httpEffect.pipe(
    Effect.provideService(RequestLabel, { value: "request" }),
  ),
);
const Scoped = EFFRONT.withMiddleware(ProvideLabel);
const Home = Scoped.Page.make({
  render: () => Effect.gen(function* () {
    const label = yield* RequestLabel;
    return <h1>{label.value}</h1>;
  }),
});`,
          "tsx",
        )}
        <p>
          <code>provides</code>{" "}
          はジェネリック型の設定であり、実行時のオプションではありません。実際のサービス提供は
          handler で行います。<code>withMiddleware</code>{" "}
          は必要なサービスが利用可能かを型で検証し、提供されるサービスを派生ファクトリーに追加します。
        </p>
        <p>
          派生ファクトリーで作った Component・Page・Layout・Routes・ServerFn は、その時点の
          Middleware チェーンを保持します。追加順に外側から内側へ適用され、同じスコープへ同じ
          Middleware を二度追加すると <code>TypeError</code> になります。
        </p>
      </>
    ),
  },
  {
    slug: "/api-reference/server-functions",
    title: "ServerFn",
    description:
      "ServerFn.make の input と handler、および Encoded / Type に基づく引数の対応です。",
    section: "API reference",
    headings: [
      { id: "make", title: "ServerFn.make" },
      { id: "arguments", title: "引数の対応" },
      { id: "execution", title: "実行境界" },
    ],
    content: () => (
      <>
        <h2 id="make">ServerFn.make</h2>
        {table([
          [
            "ServerFn.make({ input, handler })",
            "同じ identity と Middleware チェーンを保持する Server Function 定義を返します。",
          ],
          [
            "input",
            "Schema decoder 一つ、または位置引数に対応する Schema decoder の readonly 配列。",
          ],
          [
            "handler",
            "デコード済みの位置引数を受け取り、Effect.Effect<Output, E, AvailableServices> を返します。E は任意のエラー型です。",
          ],
          [
            "戻り値の呼び出し型",
            "各 Schema の Encoded 側の引数を受け取り、Promise<Output> を返す関数です。",
          ],
        ])}
        {code(`const rename = EFFRONT.ServerFn.make({
  input: Schema.Struct({ name: Schema.NonEmptyString }),
  handler: ({ name }) => Effect.succeed({ name }),
});
const describe = EFFRONT.ServerFn.make({
  input: [Schema.FiniteFromString, Schema.String],
  handler: (count, label) => Effect.succeed({ count, label }),
});`)}
        <p>
          <code>EFFRONT</code> は共有するアプリケーション identity、<code>Effect</code> と{" "}
          <code>Schema</code> は <code>effect</code> の export
          です。二つ目の例は、呼び出し側では文字列の数値を送り、handler では number を受け取ります。
        </p>
        <h2 id="arguments">引数の対応</h2>
        {table([
          ["input: Schema.String", "引数一つ。handler には string が渡されます。"],
          ["input: [Schema.String, Schema.Finite]", "引数二つ。順番は配列の順序と一致します。"],
          [
            "input: Schema.Tuple([Schema.String, Schema.Finite])",
            "タプル値を持つ引数一つ。Schema の配列とは区別します。",
          ],
          ["input: []", "引数なし。handler は () => Effect です。"],
        ])}
        {code(`const update = EFFRONT.ServerFn.make({
  input: [
    Schema.Struct({ count: Schema.Finite }),
    Schema.fromFormData(Schema.Struct({ name: Schema.NonEmptyString })),
  ],
  handler: (previousState, form) => Effect.succeed({
    count: previousState.count + 1,
    name: form.name,
  }),
});`)}
        <p>
          この定義の呼び出し型は、前の状態と FormData を受け取ります。handler
          の二番目の引数はデコード済みの <code>{"{ name: string }"}</code> です。React の{" "}
          <code>useActionState</code> の位置引数に対応させる場合にも、この配列形式を使えます。
        </p>
        <h2 id="execution">実行境界</h2>
        <p>
          ServerFn は React の Server Function プロトコルで実行するための定義です。
          <code>"use server"</code>{" "}
          モジュールから公開する関数として利用し、ブラウザーから届いた呼び出しを Effront の Fetch
          ランタイムが解釈して、入力のデコードと handler の Effect を実行します。
        </p>
        <p>
          通常のサーバー関数のように RSC 内から直接 await すると <code>TypeError</code>{" "}
          で拒否されます。サーバー内でも使いたい処理は通常の Effect として切り出し、ServerFn の
          handler から呼びます。返す値は React の転送可能な値にし、env
          や秘密値を含めないでください。
        </p>
      </>
    ),
  },
  {
    slug: "/api-reference/workers",
    title: "Fetch・Workers context",
    description:
      "createFetchHandler と、コアおよび Cloudflare のリクエストローカル reader を参照します。",
    section: "API reference",
    headings: [
      { id: "fetch", title: "createFetchHandler" },
      { id: "context", title: "WorkersRequestContext" },
      { id: "readers", title: "コアの reader" },
      { id: "cloudflare", title: "Cloudflare の reader" },
    ],
    content: () => (
      <>
        <h2 id="fetch">createFetchHandler</h2>
        {code(`import { createFetchHandler } from "effront/workers";
import application from "./entry.client";

export default { fetch: createFetchHandler(application) };`)}
        <p>
          <code>createFetchHandler(application)</code> は <code>EFFRONT.make</code>{" "}
          の戻り値を受け取り、次の公開型のハンドラーを返します。現在の関数の戻り値は既定の{" "}
          <code>FetchHandler</code> で、Env と ExecutionContext は unknown です。
        </p>
        {code(`export type FetchHandler<Env = unknown, ExecutionContext = unknown> = (
  request: Request,
  env: Env,
  executionContext: ExecutionContext,
) => Promise<Response>;`)}
        <p>
          アプリケーション Layer はリクエストごとに構築され、レスポンス body
          の完了・エラー・キャンセルまで Scope を保持します。body
          がないレスポンスではすぐ解放します。Fetch の入口では Content-Length を検査し、10 MiB
          を超える値や不正な値を 413 で拒否します。Server Function の POST は、Content-Length
          の有無にかかわらず受信 body の実サイズにも 10 MiB の上限を適用します。Content-Length
          がない独自 HTTP ルートの body を、この入口が一律に実測制限するわけではありません。
        </p>
        <h2 id="context">WorkersRequestContext</h2>
        {code(`import { WorkersRequestContext } from "effront/workers";
// 同名の型も公開されています。
// WorkersRequestContext<Env, ExecutionContext>
//   readonly env: Env
//   readonly executionContext: ExecutionContext
//   readonly request: Request`)}
        <p>
          値としての <code>WorkersRequestContext</code> は Effect の Context.Reference で、型は{" "}
          <code>WorkersRequestContext&lt;unknown, unknown&gt;</code> です。Fetch
          ハンドラーが供給します。Context が提供されていない場所で読むと、既定値の取得が{" "}
          <code>TypeError</code> になります。
        </p>
        <h2 id="readers">コアの reader</h2>
        {table([
          [
            "createWorkersContextAccessors<Env = unknown, ExecutionContext = unknown>()",
            "型を固定した getWorkersEnv と getWorkersRequestContext の組を返します。新たなサービスや Layer は作りません。",
          ],
          ["getWorkersEnv<Env = unknown>()", "Effect で現在の env を返します。"],
          [
            "getWorkersRequestContext<Env = unknown, ExecutionContext = unknown>()",
            "Effect で現在の env・executionContext・request を返します。",
          ],
        ])}
        {code(`import { createWorkersContextAccessors } from "effront/workers";

type Env = { readonly APP_LABEL: string };
type HostContext = { waitUntil(promise: Promise<unknown>): void };
export const { getWorkersEnv, getWorkersRequestContext } =
  createWorkersContextAccessors<Env, HostContext>();`)}
        <p>
          reader のジェネリックはホストが渡す値の型を指定するもので、実行時検証は行いません。reader
          が返す Effect は Page・Middleware・アプリケーション Layer の構築など、Fetch リクエストの
          Context がある場所で実行します。
        </p>
        <h2 id="cloudflare">Cloudflare の reader</h2>
        {code(`import { Effect } from "effect";
import { createWorkersContextAccessors } from "@effront/cloudflare/workers";

type Env = { readonly APP_LABEL: string };
const { getWorkersEnv, getWorkersRequestContext } =
  createWorkersContextAccessors<Env>();

export const readLabel = Effect.gen(function* () {
  const env = yield* getWorkersEnv();
  const { executionContext } = yield* getWorkersRequestContext();
  executionContext.waitUntil(Promise.resolve());
  return env.APP_LABEL;
});`)}
        {table([
          [
            "CloudflareExecutionContext",
            "waitUntil(promise: Promise<unknown>): void を持つ、公開された最小の実行コンテキスト型。",
          ],
          [
            "createWorkersContextAccessors<Env = unknown>()",
            "コアの accessor の ExecutionContext を CloudflareExecutionContext に固定します。",
          ],
          ["getWorkersEnv<Env = unknown>()", "現在の env を返す Effect。"],
          [
            "getWorkersRequestContext<Env = unknown>()",
            "WorkersRequestContext<Env, CloudflareExecutionContext> を返す Effect。",
          ],
        ])}
        <p>
          Cloudflare 版もコアと同じリクエスト Context を読みます。env は自動的に HTML や Flight
          に含まれませんが、描画結果や ServerFn
          の戻り値へ入れた値はブラウザーへ届きます。公開してよい値だけを明示的に返してください。
        </p>
      </>
    ),
  },
  {
    slug: "/api-reference/vite",
    title: "Vite・Cloudflare plugins",
    description: "effront と effrontCloudflare の公開オプション、既定エントリー、環境構成です。",
    section: "API reference",
    headings: [
      { id: "effront", title: "@effront/vite" },
      { id: "cloudflare", title: "@effront/cloudflare" },
      { id: "configuration", title: "組み合わせ方" },
    ],
    content: () => (
      <>
        <h2 id="effront">@effront/vite</h2>
        <p>
          <code>effront(options: EffrontViteOptions = {}): PluginOption[]</code> は React
          Compiler、RSC・SSR・ブラウザーの各エントリー、アプリケーション定義の alias を設定します。
        </p>
        {code(`export type EffrontViteOptions = {
  readonly rsc?: string;
  readonly application?: string;
};`)}
        {table([
          ["rsc", "既定値 ./src/entry.workers.ts。{ fetch } を公開する RSC 環境のエントリー。"],
          [
            "application",
            "既定値 ./src/entry.client.ts。アプリケーション定義を公開するモジュール。Vite の root を基準に解決されます。",
          ],
          [
            "effront/application-entry",
            "application オプションから生成される Vite alias。パッケージの独立した公開 subpath ではありません。",
          ],
        ])}
        <p>
          React plugin と RSC plugin はこの統合が登録します。同じ構成へ重複登録しないでください。
          <code>application</code> の既定ファイル名が entry.client.ts
          でも、内容はブラウザーの起動コードではなくアプリケーション定義です。
        </p>
        <h2 id="cloudflare">@effront/cloudflare</h2>
        <p>
          <code>effrontCloudflare(options: EffrontCloudflareOptions = {}): PluginOption[]</code> は
          Cloudflare Vite plugin を構成します。オプションの型は次の定義です。
        </p>
        {code(`import { cloudflare } from "@cloudflare/vite-plugin";

export type EffrontCloudflareOptions = Omit<
  NonNullable<Parameters<typeof cloudflare>[0]>,
  "viteEnvironment"
>;`)}
        {table([
          [
            "options",
            "viteEnvironment 以外の Cloudflare Vite plugin オプションを、そのまま転送します。cloudflare プロパティの下へネストしません。",
          ],
          [
            "viteEnvironment",
            "rsc と、その子環境 ssr に固定されます。オプションから変更できません。",
          ],
          ["SSR の出力先", "既定で RSC 出力ディレクトリー内の ssr。通常は dist/rsc/ssr です。"],
          [
            "environments.ssr.build.outDir",
            "利用者が明示した場合は維持されます。変更時も Wrangler が SSR モジュールを取り込める構成にします。",
          ],
        ])}
        <p>
          RSC と SSR は Cloudflare の workerd で動作します。ビルド後のローカル実行には生成された
          Wrangler 設定を使います。ランタイムで env を読む場合は、このビルド用エントリーではなく{" "}
          <code>@effront/cloudflare/workers</code> を読み込みます。
        </p>
        <h2 id="configuration">組み合わせ方</h2>
        {code(`import { defineConfig } from "vite-plus";
import { effront } from "@effront/vite";
import { effrontCloudflare } from "@effront/cloudflare";

export default defineConfig({
  plugins: [
    effront({
      rsc: "./src/entry.workers.ts",
      application: "./src/entry.client.ts",
    }),
    effrontCloudflare(),
  ],
});`)}
        <p>
          上記のエントリーパスは既定値なので <code>effront()</code> と省略できます。Wrangler
          設定を含む実行可能な初期構成は <a href="/guide/getting-started">はじめる</a>
          、ホスト固有の設定は <a href="/platforms/cloudflare">Cloudflare Workers</a>{" "}
          を参照してください。
        </p>
      </>
    ),
  },
];

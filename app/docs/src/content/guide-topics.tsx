import { CodeBlock } from "../components/code-block";
import type { CodeLanguage } from "../components/code-block";
import type { DocPage } from "./types";

const code = (source: string, language: CodeLanguage) => (
  <CodeBlock code={source} language={language} />
);

export const serverFunctionsGuide: DocPage = {
  slug: "/guide/server-functions",
  title: "Server Function",
  description:
    "Schema で入力を検証し、アプリケーションサービスを使う更新処理を React のフォームから呼び出します。",
  section: "Guide",
  headings: [
    { id: "identity", title: "アプリケーションと同じ定義を使う" },
    { id: "input", title: "入力の型とデコード" },
    { id: "forms", title: "フォームから直接呼び出す" },
    { id: "state", title: "useActionState で結果を表示する" },
    { id: "application", title: "Page とアプリケーションへ組み込む" },
    { id: "refresh", title: "再表示と失敗の扱い" },
  ],
  content: () => (
    <>
      <p>
        <code>EFFRONT.ServerFn.make</code> は Schema と Effect の handler を結び付けます。 React の
        Server Function として公開することで、フォームや Client Component
        からサーバー側の処理を呼び出せます。 通信や参照のエンコードは React
        に任せ、アプリケーション独自の RPC エンドポイントを用意する必要はありません。
      </p>
      <h2 id="identity">アプリケーションと同じ定義を使う</h2>
      <p>
        <code>src/effront.ts</code> に共有の定義を置き、Page、Layout、Routes、Server Function から
        import します。 この例は <a href="/guide/effect">サービス</a> の Greeting を使います。
        アプリケーションを閉じる <code>EFFRONT.make</code> には <code>layer: Greeting.layer</code>{" "}
        を渡してください。
      </p>
      {code(
        `import { Application } from "effront";
import { Greeting } from "./greeting";

export const EFFRONT = Application.effront<Greeting>();`,
        "ts",
      )}
      <h2 id="input">入力の型とデコード</h2>
      <p>
        呼び出し側は Schema のエンコードされた型を渡し、handler はデコードされた型を受け取ります。
        引数には手書きの型注釈を付けず、Schema から推論させます。 通常のオブジェクト入力には{" "}
        <code>Schema.Struct</code> を使います。 次の <code>src/greet-object.ts</code> は{" "}
        <code>{'{ name: "Ada" }'}</code> を受け取る Server Function です。
      </p>
      {code(
        `"use server";

import { Effect, Schema } from "effect";
import { EFFRONT } from "./effront";
import { Greeting } from "./greeting";

export const greetObject = EFFRONT.ServerFn.make({
  input: Schema.Struct({ name: Schema.NonEmptyString }),
  handler: ({ name }) => Effect.flatMap(Greeting, (service) => service.message(name)),
});`,
        "ts",
      )}
      <h2 id="forms">フォームから直接呼び出す</h2>
      <p>
        ネイティブフォームは FormData を渡すため、<code>Schema.fromFormData</code>{" "}
        でフィールドをデコードします。 戻り値が void の Server Function は、そのまま{" "}
        <code>form action</code> に渡せます。
        <code>src/follow-author.ts</code>{" "}
        の例では記録だけを行います。実際の保存処理はアプリケーションサービスから呼び出してください。
      </p>
      {code(
        `"use server";

import { Effect, Schema } from "effect";
import { EFFRONT } from "./effront";

export const followAuthor = EFFRONT.ServerFn.make({
  input: Schema.fromFormData(Schema.Struct({ authorId: Schema.NonEmptyString })),
  handler: ({ authorId }) => Effect.logInfo("著者をフォロー", { authorId }),
});`,
        "ts",
      )}
      <p>
        <code>src/follow-author-button.tsx</code> からネイティブの参照を渡します。
      </p>
      {code(
        `import { Effect } from "effect";
import { EFFRONT } from "./effront";
import { followAuthor } from "./follow-author";

export const FollowAuthorButton = EFFRONT.Component.make({
  render: ({ authorId }: { readonly authorId: string }) =>
    Effect.succeed(
      <form action={followAuthor}>
        <input name="authorId" type="hidden" value={authorId} />
        <button type="submit">フォローする</button>
      </form>,
    ),
});`,
        "tsx",
      )}
      <h2 id="state">useActionState で結果を表示する</h2>
      <p>
        <code>useActionState</code> は前回の state と今回の FormData を渡します。
        <code>input: [StateSchema, FormSchema]</code> とすると、それぞれの引数を個別に検証できます。
        一つの <code>Schema.Array</code> や <code>Schema.Tuple</code> を input
        に渡した場合は、配列を値に持つ一つの引数です。
        <code>src/greet.ts</code> に状態付きの Server Function を定義します。
      </p>
      {code(
        `"use server";

import { Effect, Schema } from "effect";
import { EFFRONT } from "./effront";
import { Greeting } from "./greeting";

const StateSchema = Schema.Struct({ message: Schema.String });
const FormSchema = Schema.fromFormData(Schema.Struct({ name: Schema.NonEmptyString }));

export const greet = EFFRONT.ServerFn.make({
  input: [StateSchema, FormSchema],
  handler: (_previousState, { name }) =>
    Effect.gen(function* () {
      const greeting = yield* Greeting;
      const message = yield* greeting.message(name);
      return { message };
    }),
});`,
        "ts",
      )}
      <p>
        <code>src/greeting-form.tsx</code> でネイティブの Server Function 参照をそのまま
        useActionState に渡します。 独自の async ラッパーに置き換えないことで、React が JavaScript
        の読み込み前のフォーム送信も扱える形を保ちます。
      </p>
      {code(
        `"use client";

import { useActionState } from "react";
import { greet } from "./greet";

export function GreetingForm() {
  const [state, formAction, pending] = useActionState(greet, { message: "" });
  return (
    <form action={formAction}>
      <input name="name" required />
      <button disabled={pending} type="submit">挨拶する</button>
      <p aria-live="polite">{state.message}</p>
    </form>
  );
}`,
        "tsx",
      )}
      <h2 id="application">Page とアプリケーションへ組み込む</h2>
      <p>
        <code>src/application.tsx</code> で二つのフォームを表示し、Greeting の実装を提供します。
      </p>
      {code(
        `import { Effect } from "effect";
import { EFFRONT } from "./effront";
import { Greeting } from "./greeting";
import { GreetingForm } from "./greeting-form";
import { FollowAuthorButton } from "./follow-author-button";

const RootLayout = EFFRONT.Layout.make({
  render: ({ children }) => Effect.succeed(
    <html lang="ja"><body>{children}</body></html>,
  ),
});

const HomePage = EFFRONT.Page.make({
  render: () => Effect.succeed(
    <main>
      <GreetingForm />
      <FollowAuthorButton authorId="ada" />
    </main>,
  ),
});

export default EFFRONT.make({
  routes: EFFRONT.Routes.make({ layout: RootLayout }).page("/", HomePage),
  layer: Greeting.layer,
});`,
        "tsx",
      )}
      <h2 id="refresh">再表示と失敗の扱い</h2>
      <p>
        呼び出しの成功後は現在のルートを再表示します。更新結果を読む Page
        と更新処理が同じサービスの契約を使うため、画面の再取得を別の通信方式で実装する必要はありません。
        入力のデコード失敗と handler の失敗は action の失敗として React のエラー処理へ届きます。
        想定内の業務上の失敗をフォームに表示したい場合は、handler の中で明示的に state
        へ変換してください。
      </p>
      <p>
        Server Function をサーバーグラフで通常の async 関数として直接呼び出すことはできません。
        サーバー内で共有する処理は Effect のサービスや関数へ切り出し、React からの呼び出しだけを
        Server Function にします。 認証・認可は入力 Schema とは別に、
        <a href="/guide/middleware">Middleware</a> や handler で確認します。 hidden
        フィールドや前回の state もクライアントから届く入力です。
      </p>
    </>
  ),
};

export const middlewareGuide: DocPage = {
  slug: "/guide/middleware",
  title: "Middleware",
  description:
    "リクエストの前後処理とサービスの提供を、Routes と Server Function のスコープに結び付けます。",
  section: "Guide",
  headings: [
    { id: "view", title: "Middleware を持つ定義を派生させる" },
    { id: "routes", title: "Routes でスコープを有効にする" },
    { id: "actions", title: "Server Function でサービスを使う" },
    { id: "order", title: "実行順序と応答の短絡" },
    { id: "reach", title: "スコープと HTTP 全体の使い分け" },
  ],
  content: () => (
    <>
      <p>
        Middleware は後続の HTTP Effect を受け取り、処理の前後を包みます。
        リクエストから取り出した情報の提供や、認証済み利用者がいる場合だけ後続へ進める処理に使います。
        サービスの型を追加する宣言と、実行時にサービスを提供する処理の両方が必要です。
      </p>
      <h2 id="view">Middleware を持つ定義を派生させる</h2>
      <p>
        <code>src/request-scope.ts</code> では RequestInfo を提供します。 ベースの{" "}
        <code>EFFRONT.Middleware.make</code> から作り、<code>withMiddleware</code> で派生させます。
        RequestEFFRONT は元と同じアプリケーションの identity を保ち、RequestInfo
        を利用可能なサービスに加えます。
      </p>
      {code(
        `import { Context, Effect } from "effect";
import { HttpServerRequest } from "effect/unstable/http";
import { Application } from "effront";

export class RequestInfo extends Context.Service<
  RequestInfo,
  { readonly url: string }
>()("app/middleware/RequestInfo") {}

export const EFFRONT = Application.effront();

const WithRequestInfo = EFFRONT.Middleware.make<{ provides: RequestInfo }>(
  Effect.fnUntraced(function* (httpEffect) {
    const request = yield* HttpServerRequest.HttpServerRequest;
    return yield* httpEffect.pipe(
      Effect.provideService(RequestInfo, { url: request.url }),
    );
  }),
);

export const RequestEFFRONT = EFFRONT.withMiddleware(WithRequestInfo);`,
        "ts",
      )}
      <h2 id="routes">Routes でスコープを有効にする</h2>
      <p>
        派生した定義から作った Routes が Middleware を有効にします。 Page、Layout、Component
        は、その有効なスコープの内側で render されるときに提供サービスを消費します。 Page
        だけを派生した定義から作り、ベースの Routes に置いてもスコープは有効になりません。 次の{" "}
        <code>src/application.tsx</code> はリクエストの URL を表示します。
      </p>
      {code(
        `import { Effect } from "effect";
import { EFFRONT, RequestEFFRONT, RequestInfo } from "./request-scope";

const RootLayout = EFFRONT.Layout.make({
  render: ({ children }) => Effect.succeed(
    <html lang="ja"><body>{children}</body></html>,
  ),
});

const RequestPage = RequestEFFRONT.Page.make({
  render: Effect.fn("RequestPage.render")(function* () {
    const info = yield* RequestInfo;
    return <p>アクセス先: {info.url}</p>;
  }),
});

const routes = RequestEFFRONT.Routes.make({ layout: RootLayout })
  .page("/request", RequestPage);

export default EFFRONT.make({ routes });`,
        "tsx",
      )}
      <p>
        ネストする場合も派生した Routes を <code>mount</code> します。 Middleware が渡す RequestInfo
        はこのスコープのサービスなので、アプリケーションの layer から提供する必要はありません。
      </p>
      <h2 id="actions">Server Function でサービスを使う</h2>
      <p>
        派生した定義から作った Server Function は、呼び出されたときに自身の Middleware
        スコープを有効にします。 Page
        の表示時だけでなく、更新時にも認証・認可を行うための接続点です。
        <code>src/record-request.ts</code> の void action はフォームへ直接渡せます。
      </p>
      {code(
        `"use server";

import { Effect, Schema } from "effect";
import { RequestEFFRONT, RequestInfo } from "./request-scope";

export const recordRequest = RequestEFFRONT.ServerFn.make({
  input: Schema.fromFormData(Schema.Struct({})),
  handler: () => Effect.gen(function* () {
    const info = yield* RequestInfo;
    yield* Effect.logInfo("フォームを受信", { url: info.url });
  }),
});`,
        "ts",
      )}
      <h2 id="order">実行順序と応答の短絡</h2>
      <p>
        <code>EFFRONT.withMiddleware(first).withMiddleware(second)</code> は
        first、second、後続処理の順で入り、応答は逆順に戻ります。 同じ Middleware
        を同じチェーンに二度追加することはできません。 次の例は後続を実行せず 503 を返す Middleware
        です。使う場合は Routes を作る定義に追加してください。
      </p>
      {code(
        `import { Effect } from "effect";
import { HttpServerResponse } from "effect/unstable/http";
import { EFFRONT } from "./request-scope";

export const Maintenance = EFFRONT.Middleware.make(() =>
  Effect.succeed(HttpServerResponse.text("メンテナンス中です", { status: 503 })),
);`,
        "ts",
      )}
      <p>
        認証の場合は同じ分岐構造でセッションを検証し、失敗時は 401
        などの応答を返し、成功時だけ検証済みの CurrentUser を後続へ提供します。 Cookie
        やヘッダーに書かれた利用者名を、そのまま本人確認の結果として扱わないでください。
      </p>
      <h2 id="reach">スコープと HTTP 全体の使い分け</h2>
      <p>
        Effront のスコープ付き Middleware は、その Routes と Server Function を対象にします。
        ユーザー定義 HTTP、静的アセット、どのルートにも一致しないリクエストには適用されません。
        Fetch 内の HTTP 全体に共通ヘッダーなどを適用するには、<a href="/guide/http">HTTP</a>{" "}
        で説明するネイティブのグローバル Middleware をアプリケーション Layer に登録します。
      </p>
    </>
  ),
};

export const httpGuide: DocPage = {
  slug: "/guide/http",
  title: "ユーザー定義 HTTP",
  description:
    "Page と同じアプリケーション Layer に Effect HTTP のルートとグローバル Middleware を登録します。",
  section: "Guide",
  headings: [
    { id: "router", title: "HttpRouter にルートを登録する" },
    { id: "services", title: "Page と HTTP でサービスを共有する" },
    { id: "global", title: "グローバル Middleware を登録する" },
    { id: "boundary", title: "Fetch の境界とリソースの生存期間" },
  ],
  content: () => (
    <>
      <p>
        Effront のアプリケーション Layer は Effect の HttpRouter を要求できます。 そこに登録した
        HTTP ルートは Page や Server Function と同じ Fetch ハンドラーで処理されます。 JSON
        API、ヘルスチェック、外部サービスからの通知など、React の表示とは別の HTTP
        応答を返す用途に使います。
      </p>
      <h2 id="router">HttpRouter にルートを登録する</h2>
      <p>
        <code>HttpRouter.use</code> は Layer の構築時に router を受け取ります。
        <a href="/guide/effect">サービス</a> で定義した Greeting を取得し、GET の応答を登録します。
        次の <code>src/http.ts</code> は <code>/api/greeting</code> で JSON を返します。
      </p>
      {code(
        `import { Effect } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/unstable/http";
import { Greeting } from "./greeting";

export const GreetingApi = HttpRouter.use(
  Effect.fnUntraced(function* (router) {
    const greeting = yield* Greeting;
    yield* router.add(
      "GET",
      "/api/greeting",
      Effect.map(greeting.message("Ada"), (message) =>
        HttpServerResponse.jsonUnsafe({ message }),
      ),
    );
  }),
);`,
        "ts",
      )}
      <p>
        応答はネイティブの HttpServerResponse で構築します。 たとえば{" "}
        <code>{"HttpServerResponse.jsonUnsafe({ accepted: true }, { status: 202 })"}</code> は 202
        の JSON 応答です。 jsonUnsafe は JSON に変換できる既知の値に使い、入力検証や失敗の扱いは
        HTTP handler 側で定義してください。 Page や Server Function と異なる URL を選び、
        <code>/_effront</code> の予約領域を避けます。
      </p>
      <h2 id="services">Page と HTTP でサービスを共有する</h2>
      <p>
        HTTP 登録処理が要求するサービスを <code>Layer.provideMerge</code> で提供します。 単に
        provide するのではなく merge して出力にも残すことで、Page、Layout、Component、Server
        Function にも同じサービスを提供できます。 サービスの章の application.tsx で、
        <code>layer: Greeting.layer</code> の代わりに次の ApplicationLayer を渡します。
      </p>
      {code(
        `import { Layer } from "effect";
import { Greeting } from "./greeting";
import { GreetingApi } from "./http";

const ApplicationLayer = GreetingApi.pipe(Layer.provideMerge(Greeting.layer));

// EFFRONT と routes はサービスの章と同じ定義を使います。
export default EFFRONT.make({ routes, layer: ApplicationLayer });`,
        "ts",
      )}
      <p>
        ネイティブの HttpApi や RPC の HTTP ルート登録 Layer も、最終的に同じ HttpRouter
        へ登録し、要求するサービスを満たす形で合成します。 Effront 専用の API・RPC
        プロトコルはありません。この章では基本となる HttpRouter の合成を示しています。
      </p>
      <h2 id="global">グローバル Middleware を登録する</h2>
      <p>
        <code>{"HttpRouter.middleware(handler, { global: true })"}</code> はルーター全体へ登録する
        Layer を返します。
        <code>src/application-layer.ts</code> で HTTP ルートとまとめ、アプリケーションの layer
        に渡します。
      </p>
      {code(
        `import { Effect, Layer } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/unstable/http";
import { Greeting } from "./greeting";
import { GreetingApi } from "./http";

const GlobalHeaders = HttpRouter.middleware(
  (httpEffect) => Effect.map(
    httpEffect,
    HttpServerResponse.setHeader("x-content-type-options", "nosniff"),
  ),
  { global: true },
);

export const ApplicationLayer = Layer.mergeAll(GreetingApi, GlobalHeaders).pipe(
  Layer.provideMerge(Greeting.layer),
);`,
        "ts",
      )}
      <p>
        このグローバル Middleware は Effront のルーターに到達した Page、Server
        Function、ユーザー定義 HTTP と未一致リクエストを対象にします。 ただし、この例の Effect.map
        がヘッダーを追加するのは、後続の Effect が成功として返した応答だけです。 未一致リクエストは
        RouteNotFound の失敗となるため、最終的な 404 応答にはこの例のヘッダーは付きません。
        失敗時の応答も変更したい場合は、対象の HTTP
        エラーを扱って応答へ変換する処理を別途定義してください。
        <a href="/guide/middleware">スコープ付き Middleware</a> のように特定の Routes
        の内側だけへ限定されません。
      </p>
      <h2 id="boundary">Fetch の境界とリソースの生存期間</h2>
      <p>
        「グローバル」はこの Fetch 内のルーターに対する範囲です。 ホストが Effront の Fetch
        を呼ぶ前に処理する応答には適用されません。 ホストが直接配信する静的アセットにはこの Layer の
        Middleware を適用できないため、アセットの共通ヘッダーはホスト側で設定します。 Fetch
        ランタイムがルーターの起動前に返すリクエストサイズ超過の 413 も対象外です。
      </p>
      <p>
        アプリケーション Layer
        はリクエストごとに構築され、同じリクエストの処理にサービスを提供します。 スコープの解放は
        Response body の読み取り完了、エラー、キャンセルに結び付きます。
        常駐サーバー全体の終了時までサービスが生存する、という契約ではありません。
        ホストとの接続方法は <a href="/platforms">プラットフォーム</a> を参照してください。
      </p>
    </>
  ),
};

import { type CoreSource, SourceExcerpt } from "./core-source";
import type { DocPage } from "./types";

export const coreModelSources = {
  fetchBoundary: {
    path: "packages/effront/src/workers.ts",
    code: `    const requestContext: WorkersRequestContext<unknown, unknown> = {
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
    }`,
    language: "ts",
  },
  applicationIdentity: {
    path: "packages/effront/src/application/effront.ts",
    code: `const effront = <Services = never>(): EFFRONT<Services> => {
  const identity = makeEFFRONTIdentity<Services>();
  const make: EFFRONTMake<Services> = (options) => makeApplication(identity, options);
  let nextRouteScopeId = 0;
  const allocateRouteScopeId = () => {
    const scopeId = nextRouteScopeId;
    nextRouteScopeId += 1;
    return scopeId;
  };

  return makeEFFRONT(identity, Object.freeze([]), allocateRouteScopeId, make);
};`,
    language: "ts",
  },
  middlewareScope: {
    path: "packages/effront/src/application/effront.ts",
    code: `  const withMiddleware = <Value extends AnyMiddleware<ApplicationServices>>(
    value: Value & ApplicableMiddleware<AvailableServices, Value>,
  ): EFFRONT<ApplicationServices, AvailableServices | MiddlewareProvidedServices<Value>> => {
    getMiddlewareState(value);
    if (getEFFRONTIdentity(value) !== identity) {
      throw new TypeError("Middleware was created by a different EFFRONT module.");
    }
    if (middleware.includes(value)) {
      throw new TypeError("Middleware cannot appear twice in the same scope.");
    }

    return makeEFFRONT(identity, Object.freeze([...middleware, value]), allocateRouteScopeId, make);
  };`,
    language: "ts",
  },
  compiledDestination: {
    path: "packages/effront/src/application/route-graph.ts",
    code: `export type RouteScope<Services> = {
  readonly id: string;
  readonly layout: LayoutComponent<Services> | null;
  readonly loading: LoadingComponent<Services> | null;
};

export type CompiledDestination<Services> = {
  readonly middleware: ReadonlyArray<AnyMiddleware<Services>>;
  readonly page: PageImplementationState<Services>;
  readonly pattern: AbsolutePath;
  readonly scopes: ReadonlyArray<RouteScope<Services>>;
};

export type CompiledRouteGraph<Services> = readonly [
  CompiledDestination<Services>,
  ...Array<CompiledDestination<Services>>,
];`,
    language: "ts",
  },
  routeTraversal: {
    path: "packages/effront/src/application/route-graph.ts",
    code: `    for (const route of currentState.pages) {
      const pattern = joinRoutePaths(prefix, route.path);
      validateUnreservedPath(pattern);
      destinations.push(
        Object.freeze({ middleware, page: getPageState(route.page), pattern, scopes }),
      );
    }

    for (const mount of currentState.mounts) {
      visit(mount.routes, joinRoutePaths(prefix, mount.path), scopes, middleware);
    }
  };`,
    language: "ts",
  },
  parameterValidation: {
    path: "packages/effront/src/server/application.ts",
    code: `    if (request.method !== "POST" && destination.page.paramsSchema !== null) {
      return yield* Schema.decodeEffect(destination.page.paramsSchema)(encodedParams).pipe(
        Effect.matchEffect({
          onFailure: () =>
            Effect.succeed(
              HttpServerResponse.empty({ status: 404, headers: DynamicResponseHeaders }),
            ),
          onSuccess: (value) => renderResponse({ _tag: "Decoded", value }),
        }),
      );
    }
    return yield* renderResponse({ _tag: "Encoded", value: encodedParams });
  });`,
    language: "ts",
  },
} satisfies Record<string, CoreSource>;

export const coreModelPages: readonly DocPage[] = [
  {
    slug: "/architecture/implementation/overview",
    title: "01. coreの処理を追う",
    description:
      "アプリケーション定義からFetch、Flight、HTML、ブラウザーまで、現在のcoreを読むための全体像をつかみます。",
    section: "アーキテクチャ",
    group: "実装解説",
    headings: [
      { id: "responsibilities", title: "coreと統合パッケージの責務" },
      { id: "entries", title: "定義と起動の入口を分ける" },
      { id: "request-flow", title: "1つのRequestを応答まで追う" },
      { id: "reading-order", title: "依存関係に沿って読み進める" },
    ],
    content: () => (
      <>
        <p>
          この章からは、ReactのメタフレームワークであるEffrontの現在の実装を、Web標準とEffectの境界に沿って読みます。
          読む中心は <code>packages/effront/src</code> です。
          宣言時に作るルートグラフと、リクエストごとに動くサービスを区別すると、描画や画面遷移のコードの役割が見えてきます。
        </p>
        <h2 id="responsibilities">coreと統合パッケージの責務</h2>
        <p>
          <code>application/</code>{" "}
          はPage、Layout、Middlewareなどの定義を同じアプリケーションに結び付け、Routesを描画先のグラフへ変換します。
          <code>server/</code> はEffect
          HTTPへのルート登録、リクエストの処理、FlightとHTMLの応答を担当します。
          <code>rsc/</code> は描画するルートツリーとFlightの契約を持ち、<code>client/</code>{" "}
          は初期hydration、画面遷移、Server Function呼び出しを担当します。
          これらがcoreの実行時の仕事です。
        </p>
        <p>
          一方、<code>packages/vite/src/index.ts</code> の <code>effront</code>{" "}
          はReact・RSCプラグイン、エントリ、アプリケーション定義のaliasを設定します。
          <code>packages/cloudflare/src/index.ts</code> の <code>effrontCloudflare</code>{" "}
          はRSC環境とその子SSR環境をCloudflareプラグインへ接続し、SSRの出力配置を調整します。
          現在のCloudflare統合ではRSCとSSRをworkerdで実行します。
          ビルド時のモジュールグラフを組み立てる仕事と、Requestを処理する仕事を分けて読んでください。
        </p>
        <p>
          WebのRequest／Responseはホストへの接続境界です。ただし境界が共通であることと、すべてのホストに対応済みであることは別です。
          現在の検証対象はCloudflare Workersであり、Node／BunのアダプターやEffect
          HTTPを直接ホストする経路は計画段階です。
          サーバー起動時にRuntimeを再利用する将来案を、現在のリクエスト単位の実装と混同しないようにします。
        </p>
        <h2 id="entries">定義と起動の入口を分ける</h2>
        <p>
          利用側の <code>src/entry.client.ts</code> はアプリケーション定義をexportする入口です。
          名前にclientが含まれていても、ここをブラウザーの起動処理と読み替えると依存関係を見失います。
          Vite統合はこのファイルを <code>effront/application-entry</code> の既定の参照先にします。
          利用側の <code>src/entry.workers.ts</code> はその定義を読み、
          <code>createFetchHandler(application)</code> から作ったハンドラーを <code>fetch</code>{" "}
          として公開します。 Viteの既定のRSCエントリはこちらです。
        </p>
        <p>
          ブラウザーの実際の起動処理はcoreの <code>client/entry.ts</code> にあり、
          <code>BrowserRuntime.runMain(browserMain)</code> を呼びます。
          <code>client/application.ts</code> の <code>activateBrowser</code>{" "}
          は初期Flightを取得してdocumentをhydrateし、refreshとServer
          Functionの呼び出しを設定します。 クライアントルーターは <code>navigationMode</code>{" "}
          がClientの場合にだけ導入されます。
          アプリケーション定義の入口、Fetchの入口、ブラウザーの入口は、それぞれ別の役割を持っています。
        </p>
        <h2 id="request-flow">1つのRequestを応答まで追う</h2>
        <p>
          最初に <code>workers.ts</code> の <code>createFetchHandler</code> を読みます。
          次の抜粋では、ホストから受け取った値をまとめ、<code>ServerApplication.httpLayer</code>{" "}
          をWebハンドラーへ変換しています。
          この処理は返された関数の内側にあるため、アプリケーションのLayerはリクエストごとに構築されます。
        </p>
        <SourceExcerpt source={coreModelSources.fetchBoundary} />
        <p>
          <code>WorkersRequestContext</code> の契約は <code>env</code>、
          <code>executionContext</code>、<code>request</code> です。
          Layerへの提供とハンドラー呼び出し時のContextへの提供によって、サービスの獲得中もHTTP処理中も同じリクエストの値を参照できます。
          coreはこれらを暗黙にFlightやHTMLへ追加しません。
          <code>@effront/cloudflare/workers</code>{" "}
          のアクセサーも、この既存ContextにCloudflareの型を与える薄い入口です。
        </p>
        <ol>
          <li>
            Fetchハンドラーがリクエスト用Contextを用意し、HTTPルートとアプリケーションサービスを構築します。
          </li>
          <li>
            <code>server/application.ts</code>{" "}
            が目的のルートとmiddlewareを通し、Pageのパラメーターを検証します。POSTはServer
            Functionの準備・実行を通る別の分岐です。
          </li>
          <li>
            <code>renderRouteTree</code> が描画先をツリーにし、<code>FlightRenderer</code>{" "}
            がReactのFlightを生成します。
          </li>
          <li>
            Acceptが <code>FlightMediaType</code> と一致する場合はFlightを返し、それ以外は{" "}
            <code>HtmlRenderer</code> でHTMLのストリームにします。
          </li>
          <li>ブラウザーが初期応答をhydrateし、その後の遷移や再取得を担当します。</li>
        </ol>
        <p>
          Responseを返した時点では、ストリームの描画が終わっているとは限りません。
          <code>releaseResponseBody</code> は本文の終端・エラー・キャンセルで <code>dispose</code>{" "}
          を呼び、本文がない応答はすぐ解放します。
          この境界があることで、本文を作る間に必要なリクエスト用サービスの寿命を保てます。 詳細は{" "}
          <a href="/architecture/implementation/request">04. リクエスト処理</a> へ進みます。
        </p>
        <h2 id="reading-order">依存関係に沿って読み進める</h2>
        <p>
          まず <a href="/architecture/implementation/application">02. アプリケーション定義</a>{" "}
          で定義を結び付けるidentityとサービスの型を読み、
          <a href="/architecture/implementation/routing">03. ルートの組み立て</a>{" "}
          でRoutesがHTTP側へ渡すデータを確認します。 その後に{" "}
          <a href="/architecture/implementation/request">リクエスト処理</a> と{" "}
          <a href="/architecture/implementation/rendering">描画</a>{" "}
          を読むと、宣言時の値がどこで実行されるかを追えます。
        </p>
        <p>
          最後に <a href="/architecture/implementation/navigation">ナビゲーション</a> と{" "}
          <a href="/architecture/implementation/server-functions">Server Functions</a>{" "}
          で、初回表示後の往復を追います。
          読むたびに「これは定義、リクエストのContext、転送するデータのどれか」を確かめてください。
          同じ画面を扱うコードでも、この3つは寿命と境界が違います。
        </p>
      </>
    ),
  },
  {
    slug: "/architecture/implementation/application",
    title: "02. アプリケーション定義",
    description:
      "Application.effrontが作るidentity、サービスの型、middlewareのスコープとリクエストContextの接続を読みます。",
    section: "アーキテクチャ",
    group: "実装解説",
    headings: [
      { id: "identity", title: "同じアプリケーションに属すること" },
      { id: "service-contract", title: "定義が要求するサービスの型" },
      { id: "middleware-context", title: "middlewareで利用可能なContextを広げる" },
      { id: "runtime-boundary", title: "定義からリクエストの実行へ" },
    ],
    content: () => (
      <>
        <p>
          公開入口の <code>index.ts</code> がexportする <code>Application</code> を、
          <code>application/effront.ts</code> までたどります。
          <code>Application.effront&lt;Services&gt;()</code>{" "}
          はサービスをその場で起動する関数ではなく、同じ契約に属する定義を作るためのfactory群を返します。
          この段階の結び付きが、後のリクエスト処理で誤った定義やContextを混ぜないための土台になります。
        </p>
        <h2 id="identity">同じアプリケーションに属すること</h2>
        <SourceExcerpt source={coreModelSources.applicationIdentity} />
        <p>
          呼び出しごとに <code>makeEFFRONTIdentity</code> が新しいidentityを作り、<code>make</code>{" "}
          のクロージャーがその値を保持します。
          <code>makeEFFRONT</code>{" "}
          は同じidentityをComponent、Layout、Loading、Middleware、Page、Routes、ServerFnのfactoryへ渡します。
          <code>allocateRouteScopeId</code>{" "}
          もこの単位で共有され、Routesを作るたびに番号を割り当てます。
        </p>
        <p>
          <code>application/effront-identity.ts</code> の <code>EFFRONTMember</code>{" "}
          はidentityと種別のsymbolキーを持つ契約です。 identityには描画時の実行Contextとなる{" "}
          <code>renderRuntime</code> があり、Servicesには型レベルのinvariantな印が付いています。
          型のServicesが同じでも、別々に <code>Application.effront</code>{" "}
          を呼んで作った値は実行時には別のidentityです。
          <code>makeApplication</code>、<code>Routes.page</code>、<code>Routes.mount</code>{" "}
          などは参照の一致を検査し、混在をTypeErrorにします。
          これは入力値の検証ではなく、定義の接続を守る検査です。
        </p>
        <h2 id="service-contract">定義が要求するサービスの型</h2>
        <p>
          <code>EFFRONT&lt;ApplicationServices, AvailableServices&gt;</code>{" "}
          の2つの型引数を区別します。
          初期状態では同じですが、ApplicationServicesはアプリケーションのLayerが提供する基礎の契約で、AvailableServicesは現在のfactoryで作るPageなどが利用できるサービスの範囲です。
          <code>PageFactory</code>{" "}
          はrenderのEffectだけでなく、パラメーターSchemaのデコードに必要なサービスもAvailableServicesの範囲で受け付けます。
        </p>
        <p>
          <code>application/definition.tsx</code> の{" "}
          <code>ApplicationDefinition&lt;Services, ApplicationError&gt;</code>{" "}
          は、Applicationという種別と構築時のエラー型を保ちます。 内部の{" "}
          <code>ApplicationImplementationState</code> はコンパイル済みroutesと{" "}
          <code>Layer.Layer&lt;Services, ApplicationError, HttpRouter.HttpRouter&gt;</code>{" "}
          を持ちます。
          <code>ApplicationLayerOptions</code>{" "}
          によって、Servicesがneverならlayerは省略可能で、それ以外なら必須です。 省略時は{" "}
          <code>resolveApplicationLayer</code> が <code>Layer.empty</code> を使います。
          サービスの型を宣言するだけでインスタンスが生まれるわけではなく、実際の提供元はこのLayerです。
        </p>
        <p>
          <code>EFFRONT.make</code>{" "}
          のルート契約は、Layoutを持ち、Pageへのパスが存在し、予約領域を使わないrootを要求します。
          実装の <code>makeApplication</code> はidentityを確認して <code>compileRouteGraph</code>{" "}
          を呼び、Layerとグラフを定義として保存します。
          ここではHTTPサーバーを起動しません。ルート定義の検査とサービスの実際の獲得を分けることで、同じ定義をリクエスト処理へ渡せます。
        </p>
        <h2 id="middleware-context">middlewareで利用可能なContextを広げる</h2>
        <SourceExcerpt source={coreModelSources.middlewareScope} />
        <p>
          <code>ApplicableMiddleware</code>{" "}
          はmiddlewareの要求からAvailableServicesを除き、残りがneverであることを型で確認します。
          返り値では <code>MiddlewareProvidedServices</code> がAvailableServicesに加わります。
          実行時には種別、identity、同じスコープでの重複を検査し、新しい配列とfactory群を返します。
          元のEFFRONT値は書き換えないので、認証用middlewareを持つ枝と持たない枝を別々に定義できます。
        </p>
        <p>
          <code>application/middleware.ts</code>{" "}
          のhandlerは、HTTP応答を返すEffectを受け取り、提供するサービスの要求を満たしてから外側へ返す契約です。
          <code>provides</code>{" "}
          の型指定そのものがContextを注入するわけではありません。実際にそのサービスを提供する処理をhandlerに実装します。
          <code>withMiddleware</code>{" "}
          も登録した時点ではhandlerを実行せず、その後に作る定義へmiddlewareの鎖を記録します。
        </p>
        <p>
          middlewareの内部状態が <code>handler</code> と <code>httpMiddleware</code>{" "}
          の両方を保持する点も重要です。 PageのGET／HEADではEffect
          HTTPのネイティブなmiddlewareを組み合わせ、HEADのフォールバックなどのルーティング動作を保ちます。
          Server FunctionのPOSTでは呼ばれる参照のデコード後にスコープが判明するため、
          <code>applyMiddleware</code> がhandlerを <code>reduceRight</code> で包みます。
          先に登録したmiddlewareが外側になり、内側が必要とするサービスを提供する順序になります。
        </p>
        <h2 id="runtime-boundary">定義からリクエストの実行へ</h2>
        <p>
          <code>server/application.ts</code> はアプリケーションのLayerとrendererのLayerを構築し、
          <code>RequestContextMiddleware</code> でHTTP側のContextに構築済みサービスを合流させます。
          一方、PageやLayoutはReactから呼ばれます。その呼び出しをEffectの実行へ接続するのが{" "}
          <code>application/render-runtime.ts</code> の <code>makeRenderRuntimeContext</code> です。
          <code>bind</code> がAsyncLocalStorageに実行関数と有効なmiddlewareを束縛し、
          <code>run</code> がそのContextを取得します。
        </p>
        <p>
          <code>run</code>{" "}
          はContextが存在しない描画と、必要なmiddlewareが有効でない描画をTypeErrorとして拒否します。
          つまり型でサービスが利用可能とされた定義を、別のリクエストや不足したスコープで実行してもよいわけではありません。
          identityは定義同士を結び付け、実行時Contextはその定義を今回のリクエストへ結び付けます。
          次の <a href="/architecture/implementation/routing">03. ルートの組み立て</a>{" "}
          でmiddlewareと描画先がどうまとまるかを読み、寿命の管理は{" "}
          <a href="/architecture/implementation/request">リクエスト処理</a>、Reactとの接続は{" "}
          <a href="/architecture/implementation/rendering">描画</a> で追ってください。
        </p>
      </>
    ),
  },
  {
    slug: "/architecture/implementation/routing",
    title: "03. ルートの組み立て",
    description:
      "Routesの型と衝突検査、グラフの走査順、スコープの継承、Page Schemaによる404の境界を読みます。",
    section: "アーキテクチャ",
    group: "実装解説",
    headings: [
      { id: "route-contract", title: "パスとPageを型で結び付ける" },
      { id: "collisions", title: "衝突と予約領域を定義時に検査する" },
      { id: "compilation", title: "Routesを描画先のグラフへコンパイルする" },
      { id: "schema-and-http", title: "HTTPでの選択とSchema検証を分ける" },
    ],
    content: () => (
      <>
        <p>
          <code>application/routes.ts</code>{" "}
          のRoutesは、HTTPリクエストを直接照合するオブジェクトではありません。
          Pageのパス、子Routes、Layout、Loading、middlewareを宣言として保持し、
          <code>EFFRONT.make</code> の段階でHTTP側が利用する描画先へ変換されます。
          「定義の妥当性」「グラフの組み立て」「リクエストのパラメーター検証」を順に分けて読みます。
        </p>
        <h2 id="route-contract">パスとPageを型で結び付ける</h2>
        <p>
          <code>RoutesDefinition&lt;Services, HasLayout, Paths, Shapes&gt;</code>{" "}
          は、Layoutの有無、登録済みのパス、その照合上の形を型として蓄積します。
          <code>page</code> と <code>mount</code> は新しい定義を返し、元の定義を書き換えません。
          Pathsはマウント時のパス結合やrootが空でないことの検査に使い、Shapesは衝突検査に使います。
          <code>Routes.make</code>{" "}
          はLayoutやLoadingのidentityを確認し、新しいscopeIdを割り当てます。
        </p>
        <p>
          <code>application/route-path.ts</code> の <code>ValidRoutePath</code> と{" "}
          <code>analyzeRoutePath</code> が型と実行時の文法を対にしています。 パスは <code>/</code>{" "}
          から始まり、動的セグメントは <code>:id</code>、残りのパスを取る名前付きcatch-allは末尾の
          <code>*path</code> のように書きます。 空セグメント、末尾のスラッシュ、<code>.</code> や{" "}
          <code>..</code>{" "}
          のセグメント、catch-all以外のワイルドカード、クエリーを含む宣言は受け付けません。
          1つのパスに同名のパラメーターを繰り返すことも拒否します。
        </p>
        <p>
          <code>MatchingPageParams</code>{" "}
          は静的Pageとパラメーター付きPageを区別し、動的パスの名前がPageのSchemaの{" "}
          <code>Encoded</code> 側のキーと一致することを型で検査します。
          URLから渡る値はエンコード側で、renderが受け取る値はSchemaの <code>Type</code> 側です。
          Schemaが値やキーを変換しても、パスの名前を決めるのは変換前の契約です。 実行時の{" "}
          <code>page</code>{" "}
          はパスの文法、identity、動的パスとSchemaの有無を検査しますが、型によるキー一致検査と同じことをすべて再実行しているわけではありません。
        </p>
        <h2 id="collisions">衝突と予約領域を定義時に検査する</h2>
        <p>
          <code>RouteShape</code> と <code>analyzeRoutePath</code>{" "}
          は静的セグメントを小文字化し、パラメーター名を <code>:</code> に置き換えます。 たとえば{" "}
          <code>/items/:id</code> と <code>/items/:slug</code> は同じ形なので共存できません。
          <code>/About</code> と <code>/about</code> も衝突します。 一方、<code>/items/new</code> と{" "}
          <code>/items/:id</code>{" "}
          は別の形です。衝突検査は重複する形を拒否するもので、あり得る照合の重なりをすべて禁止する検査ではありません。
          catch-allは通常の形に加えて空のcaptureを取る接頭辞の形も登録するため、
          <code>/manual/*path</code> と <code>/manual</code> は共存できません。
        </p>
        <p>
          <code>mount</code>{" "}
          は静的な接頭辞だけを受け付け、空の子Routesや異なるidentityを拒否します。 子の各パスを{" "}
          <code>joinRoutePaths</code>{" "}
          で結合してから、親の登録済みShapesと比較するので、直接登録したPageとマウント先のPageの衝突も検出できます。
          <code>/</code> の結合は特別扱いされ、余分なスラッシュを作りません。
        </p>
        <p>
          完成したグラフでは <code>validateUnreservedPath</code> が <code>/_effront</code>{" "}
          領域を保護します。 先頭の静的セグメントが大文字小文字を無視して <code>_effront</code>{" "}
          と一致する場合に加え、先頭が動的セグメントの場合も予約領域へ一致し得るため拒否します。
          たとえば <code>/:slug</code> はこの制約に当たり、<code>/items/:slug</code>{" "}
          なら先頭がitemsなのでこの予約検査には当たりません。
          入力URLへの応答ではなく、アプリケーションを組み立てる時点のTypeErrorです。
        </p>
        <h2 id="compilation">Routesを描画先のグラフへコンパイルする</h2>
        <p>
          <code>application/route-graph.ts</code> の <code>compileRouteGraph</code>{" "}
          が出力する契約を先に読みます。
          HTTP側へ渡す1つのdestinationには、パスだけでなくPageの内部状態、middlewareの鎖、Layout／Loadingのスコープが入ります。
          グラフは先頭要素を必須にしたtupleで、少なくとも1つの描画先があることを表します。
        </p>
        <SourceExcerpt source={coreModelSources.compiledDestination} />
        <p>
          コンパイルはrootのLayoutを確認してから <code>visit</code> で走査します。
          LayoutかLoadingがあるRoutesでのみスコープを追加し、IDはscopeIdと結合済みprefixから作ります。
          どちらもなければ親のスコープ列をそのまま継承します。
          これにより、単なるパスのグループ化と、実際の描画境界を分けて表せます。
        </p>
        <SourceExcerpt source={coreModelSources.routeTraversal} />
        <p>
          この順序に注目してください。現在のRoutesのpagesを登録順に追加した後、mountsを登録順に再帰走査します。
          pagesとmountsは別配列なので、<code>page</code> と <code>mount</code>{" "}
          の呼び出しを混ぜた時間順そのものではありません。
          また、ここに静的パスと動的パスを並べ替える処理はありません。出来上がるグラフの列挙順と、HTTPルーターの照合規則は別の問題です。
        </p>
        <p>
          <code>resolveRouteMiddleware</code>{" "}
          は親から継承した鎖と現在の宣言の共通接頭辞を比較し、共有部分を重ねずに残りを結合します。
          同じmiddlewareが解決後の鎖に再び現れればTypeErrorです。
          destinationにこの鎖を保存することで、HTTP側はRoutesの木を再走査せず、必要なContextを用意してPageを描画できます。
          最後にPageが1つもないグラフを拒否し、配列をfreezeして返します。
        </p>
        <h2 id="schema-and-http">HTTPでの選択とSchema検証を分ける</h2>
        <p>
          <code>server/application.ts</code> の <code>makeRouteLayer</code> はdestinationごとに{" "}
          <code>HttpRouter.add</code> でGETとPOSTを登録します。 URLの照合はEffect
          HTTPへ委ね、core独自の先勝ちmatcherをここで実装しているわけではありません。
          PageのmiddlewareとリクエストContextを通った後、パラメーター付きPageでは{" "}
          <code>HttpRouter.params</code> を読みます。 catch-allではEffect
          HTTPが一度decodeした残りのcaptureを、宣言した名前へ入れ直します。
          空のcaptureは空文字列とします。URLの検証とcaptureのdecodeはEffect HTTPへ委ね、
          coreはcatch-allのパラメーター名だけを変換します。
          次の抜粋は、その値に対するSchema検証と描画の分岐です。
        </p>
        <SourceExcerpt source={coreModelSources.parameterValidation} />
        <p>
          非POSTのパラメーター付きPageでは、Schemaの型付き失敗を本文なしの404へ変換し、
          <code>private, no-store</code> を付けます。 成功時は <code>Decoded</code> を渡すため、
          <code>application/page.ts</code>{" "}
          のcomponentは同じ値をもう一度デコードせずrenderへ進みます。
          ルート自体に一致しない場合の404はHTTPルーター側の処理であり、このSchema失敗とは発生箇所が違います。
        </p>
        <p>
          この404の説明を「URLのデコードに失敗すれば必ず404」と一般化してはいけません。
          <code>HttpRouter.params</code> の取得はこの <code>Effect.matchEffect</code>{" "}
          より前にあり、URL処理やルーター側の失敗をこの分岐が一律に捕まえる構造ではありません。
          またPOSTはこの事前検証を通らず <code>Encoded</code>{" "}
          として描画へ進み、Page側で必要なデコードを行います。 Server
          Functionの入力や実行後の再描画まで、GETの404規則で説明しないことが重要です。
        </p>
        <p>
          次は <a href="/architecture/implementation/request">04. リクエスト処理</a>{" "}
          で、登録したルートがどのContextと寿命で実行されるかを追います。
          destinationのscopesがUIになる過程は{" "}
          <a href="/architecture/implementation/rendering">描画</a>、POST固有の分岐は{" "}
          <a href="/architecture/implementation/server-functions">Server Functions</a>{" "}
          で読み進めてください。
        </p>
      </>
    ),
  },
];

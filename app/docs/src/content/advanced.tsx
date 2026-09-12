import { CodeBlock } from "../components/code-block";
import type { DocPage } from "./types";

export const advancedPages: readonly DocPage[] = [
  {
    slug: "/advanced",
    title: "Advanced",
    description:
      "リクエストの寿命、画面遷移、更新の競合、ビルド済みアプリケーションの実行を理解します。",
    section: "Advanced",
    headings: [{ id: "chapters", title: "実行時の契約を読む" }],
    content: () => (
      <>
        <h2 id="chapters">実行時の契約を読む</h2>
        <p>
          動くアプリケーションを作った後は、レスポンスがいつ完了し、どの更新が画面に反映されるかを確認します。
          この章では、Effront の現在の Fetch
          実装とブラウザー実装に沿って、運用や設計の判断に必要な境界を説明します。
        </p>
        <ul>
          <li>
            <a href="/advanced/request-runtime-and-lifetimes">リクエスト runtime と寿命</a>: Layer
            の取得、レンダーの Scope、ストリーム終了時の解放。
          </li>
          <li>
            <a href="/advanced/client-navigation">クライアントナビゲーション</a>: ネイティブの
            Navigation API、最初の commit、履歴キャッシュ。
          </li>
          <li>
            <a href="/advanced/server-function-execution-and-refresh">
              Server Function の実行と更新
            </a>
            : 戻り値と画面更新の分離、並行呼び出し、入力境界。
          </li>
          <li>
            <a href="/advanced/production-startup">ビルド済みアプリケーションの起動</a>:
            ホストの責務と、Cloudflare Workers 成果物の独立したローカル実行。
          </li>
        </ul>
        <p>
          API の使い方は <a href="/guide/getting-started">はじめる</a>、内部の処理を追う場合は
          <a href="/architecture/implementation/overview">アーキテクチャ</a> を参照してください。
        </p>
      </>
    ),
  },
  {
    slug: "/advanced/request-runtime-and-lifetimes",
    title: "リクエスト runtime と寿命",
    description:
      "アプリケーション定義と、リクエストごとに構築されるサービスの寿命を分けて考えます。",
    section: "Advanced",
    headings: [
      { id: "request-layer", title: "Layer はリクエストごとに構築する" },
      { id: "render-scope", title: "レンダーを所有する Scope" },
      { id: "response-lifetime", title: "Response を返した後も続く寿命" },
      { id: "resource-design", title: "アプリケーション側の設計" },
    ],
    content: () => (
      <>
        <h2 id="request-layer">Layer はリクエストごとに構築する</h2>
        <p>
          <code>EFFRONT.make(&#123; routes, layer &#125;)</code> はルートグラフと Layer
          の定義を保持します。 現在の <code>createFetchHandler</code> は、HTTP リクエストごとに Web
          ハンドラーを作り、 アプリケーションの Layer
          を構築します。モジュールにアプリケーション定義を置いても、
          サービスが自動的にサーバー全体で一度だけ取得されるわけではありません。
        </p>
        <p>
          Workers の <code>env</code>、execution context、元の <code>Request</code>{" "}
          は、そのリクエストの Effect context に提供されます。Layer
          の取得中も参照でき、別リクエストの値を共有 runtime
          経由で読む構成にはなりません。バインディングの読み方は
          <a href="/platforms/cloudflare#context">Workers のリクエストコンテキスト</a>
          を参照してください。
        </p>
        <h2 id="render-scope">レンダーを所有する Scope</h2>
        <p>
          Server Function の Effect は HTTP リクエストの処理として実行します。 Flight レンダーでは親
          Scope から子の render Scope を作り、
          <code>FiberSet.makeRuntimePromise</code> で Page、Layout、Component の Effect
          を実行します。 実行関数と有効な middleware は非同期ローカルなコンテキストに束縛されます。
          これはリクエスト所有の scoped runtime
          であり、全リクエスト共通の実行サービスではありません。
        </p>
        <p>
          対応するリクエスト runtime の外でレンダーした場合や、宣言した middleware
          が有効でない場合は
          <code>TypeError</code> になります。手動で Component のレンダー関数を起動するのではなく、
          アプリケーションの Routes を通してレンダーしてください。
        </p>
        <h2 id="response-lifetime">Response を返した後も続く寿命</h2>
        <p>
          Fetch の Promise が Response に解決した時点では、Suspense の内容や Flight
          の送信が残っている可能性があります。 ハンドラーは Response body
          を包み、EOF、読み取りエラー、キャンセルのいずれかで取得済みサービスを解放します。 body
          がない場合はすぐに解放し、Response の生成自体が失敗した場合にも cleanup を実行します。
          Flight の render Scope
          もストリームの終了や解放に合わせて閉じ、未完了のレンダー処理を中断します。
        </p>
        <h2 id="resource-design">アプリケーション側の設計</h2>
        <ul>
          <li>
            リクエスト固有のリソースは Layer またはリクエスト Effect 内で取得し、
            <code>Effect.acquireRelease</code> などで解放処理を対応させます。
          </li>
          <li>
            レスポンス送信中に必要なリソースを、Response を得た直後の独自 cleanup
            で閉じないでください。 Fetch のラッパーを追加する場合も、body
            のストリーミングとキャンセルを引き継ぎます。
          </li>
          <li>
            リクエスト終了後の処理はホストが所有する寿命として明示的に設計します。 単に Promise
            を開始したり、リクエストのサービスを外側へ保存したりしても、寿命は延長されません。
          </li>
          <li>
            env は Flight や HTML に暗黙には追加されません。ただし自分で値を JSX、Client Component
            の props、 Server Function
            の戻り値に含めればブラウザーへ渡るため、秘密値を選別する責任はアプリケーション側にあります。
          </li>
        </ul>
      </>
    ),
  },
  {
    slug: "/advanced/client-navigation",
    title: "クライアントナビゲーション",
    description: "Navigation API の commit と Flight の完了を分け、履歴と画面の寿命を理解します。",
    section: "Advanced",
    headings: [
      { id: "native-navigation", title: "ブラウザーのナビゲーションを使う" },
      { id: "commit-and-stream", title: "最初の commit とストリーム完了" },
      { id: "history-cache", title: "履歴キャッシュとリダイレクト" },
      { id: "transition-scope", title: "Transition と今後の画面アニメーション" },
    ],
    content: () => (
      <>
        <h2 id="native-navigation">ブラウザーのナビゲーションを使う</h2>
        <p>
          リンクには通常の <code>a</code> 要素を使います。Effront は React Router
          ではなく、ブラウザーの Navigation API で対象の遷移を intercept します。
          <code>window.navigation</code> と <code>NavigationPrecommitController</code>{" "}
          の両方がある場合に クライアントルーターを有効にします。History API
          による代替ルーターはありません。
        </p>
        <CodeBlock code={'<a href="/settings">設定を開く</a>'} language="tsx" />
        <p>
          intercept 可能で、ハッシュだけの移動、ダウンロード、フォーム送信、reload
          ではない遷移が対象です。 対応 API がないブラウザーでも Client Components の
          hydration、Server Functions、 現在のページのストリーム更新と開発時の HMR
          は有効です。リンクはドキュメント全体を移動します。 JavaScript を無効にした場合も SSR
          のリンクとネイティブ送信するフォームを利用できます。
        </p>
        <h2 id="commit-and-stream">最初の commit とストリーム完了</h2>
        <ol>
          <li>
            React Transition 内で遷移先の Flight
            を取得します。現在の画面は後続の画面が準備される間も維持します。 共通する Layout
            の先頭部分を保ちながら、新しいツリーを別の Transition で公開します。
          </li>
          <li>
            通常のキャンセル可能な遷移では、遷移先の最初の UI commit で precommit handler
            が完了します。 ブラウザーは URL と履歴を commit
            し、標準のフォーカス移動とスクロール処理を進められます。 Suspense の全内容や Flight EOF
            を待つ必要はありません。
          </li>
          <li>
            commit 後の Flight は、EOF または React による当該レンダーの退役までブラウザー側の
            runtime が所有します。
            別のリンクを押しただけで現在の表示のストリームを閉じず、後続のレンダーへの切り替えを確認して解放します。
          </li>
        </ol>
        <p>
          commit 前の中止や後続遷移による置き換えは、未採用の画面候補を破棄して通信を解放します。
          commit 後の残りのストリームは Browser Stop の signal から切り離されます。 その後の Flight
          エラーを扱うため、アプリケーションの適切な位置に React Error Boundary を設けます。
          ブラウザーがキャンセル不可とする履歴移動では、precommit ではなく通常の intercept handler
          を使います。
        </p>
        <h2 id="history-cache">履歴キャッシュとリダイレクト</h2>
        <p>
          戻る・進むでは、遷移が commit した正確な履歴 entry id
          に紐づく完了済みツリーを再利用できます。 URL
          だけで共有するキャッシュではありません。push、replace、未キャッシュの履歴移動は新しい
          Flight を取得します。 履歴 entry の dispose
          で対応するキャッシュを削除し、ルート更新の準備時には全履歴キャッシュを無効化します。
        </p>
        <p>
          Flight のリダイレクトはレスポンスの最終 URL を確認します。同一 origin の通常遷移では
          precommit の redirect を使い、別 origin や履歴移動中の URL
          変更などではドキュメント移動へ切り替えます。 非成功レスポンスや Flight
          以外のレスポンスもドキュメント移動として扱います。
        </p>
        <p>
          フォーカスとスクロールはブラウザー標準の動作を使います。commit 後にも Suspense
          の内容が増えるため、 履歴に記録される位置は fallback 表示中の位置になり得ます。
          ストリーム完了に合わせた独自のスクロール復元は実装されていません。
        </p>
        <h2 id="transition-scope">Transition と今後の画面アニメーション</h2>
        <p>
          現在のルーターはツリーの公開に <code>startTransition</code> を使い、
          <code>addTransitionType</code> で navigation、server-function、hmr-refresh
          などの種別を付けます。 これと画面アニメーションの公開 API は別の話です。Page の
          ViewTransition 境界、 Layer
          による既定値やルート単位の上書きは今後の機能であり、現在利用できる設定としては案内しません。
        </p>
        <p>
          ネイティブ API の仕様は
          <a href="https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API">
            MDN の Navigation API
          </a>
          を参照してください。
        </p>
      </>
    ),
  },
  {
    slug: "/advanced/server-function-execution-and-refresh",
    title: "Server Function の実行と更新",
    description: "サーバー側の処理結果とルート更新を分離し、並行実行時の反映条件を確認します。",
    section: "Advanced",
    headings: [
      { id: "execution", title: "同じリクエスト内で実行して再レンダーする" },
      { id: "result-and-refresh", title: "戻り値と画面更新は別に完了する" },
      { id: "concurrency", title: "並行呼び出しと履歴の競合" },
      { id: "input-boundary", title: "入力と認可の境界" },
    ],
    content: () => (
      <>
        <h2 id="execution">同じリクエスト内で実行して再レンダーする</h2>
        <p>
          hydration 済みの呼び出しと、段階的に拡張されるネイティブフォームは、React の Server
          Function プロトコルを通って同じリクエスト所有の Effect ハンドラーを実行します。
          関数に必要な middleware を適用し、再レンダー先の Page にだけ必要な middleware を追加して、
          同じリクエストでルートツリーを作ります。
        </p>
        <p>
          hydration 済みのレスポンスには関数の結果と更新済みルートツリーを含む Flight を返します。
          ネイティブフォームの成功時は、更新済みツリーと React の form state を含む完全な HTML
          を返します。 独自の JSON transport や、別のフォーム専用 mutation API
          を実装する必要はありません。
        </p>
        <h2 id="result-and-refresh">戻り値と画面更新は別に完了する</h2>
        <p>
          クライアントが返す Promise は、Flight 内の関数結果を受け取った時点で resolve または reject
          します。 ルートツリーの commit や Flight EOF の完了を表す Promise ではありません。
          結果の通知後、React Action の完了を妨げない別の Transition で更新ツリーを公開します。
        </p>
        <p>
          公開した画面が維持される場合は React commit と Flight EOF の両方を待ち、
          その前に別のレンダーへ退役した場合は残りの通信を解放します。
          サーバー側の処理もレスポンスの寿命に従うため、クライアント切断後に未完了の処理が必ず継続するとは考えないでください。
        </p>
        <h2 id="concurrency">並行呼び出しと履歴の競合</h2>
        <p>
          hydration 済みの Server Function 呼び出しは並行して実行できます。
          レスポンスに同梱されたツリーを採用できるのは、最後に開始した呼び出しで、元の履歴 entry
          が現在も有効で、 ナビゲーションが進行中でない場合です。Navigation API がない場合は元の URL
          が現在の URL と一致するかを確認します。
        </p>
        <p>
          条件を満たさないレスポンスはツリーを捨て、ナビゲーションの完了を待って現在のルートを新しく取得します。
          条件を満たす場合も、古い現在ルートの更新を中断し、その cleanup
          後に適用条件をもう一度確認します。
          これにより、古い呼び出しの画面が新しいページへ割り込むことを防ぎます。
        </p>
        <p>
          更新ツリーの準備時に戻る・進む用のキャッシュを無効化します。 現在の実装は成功した mutation
          だけを判定して無効化するのではなく、関数結果が Failure でも
          更新ツリーの処理へ進みます。完了した更新は現在の履歴 entry 用に再キャッシュできます。
          これは UI
          の競合処理であり、サーバー側の書き込み順序、重複排除、トランザクションを保証するものではありません。
        </p>
        <h2 id="input-boundary">入力と認可の境界</h2>
        <p>
          Server Function の POST は Origin を必須とし、その URL の host と Host
          ヘッダーを比較します。 不一致は 403、React
          の通信プロトコルとして復号できない引数や不正なフォームは 400 です。 React
          の関数参照が解決できることだけでは認可にならないため、ユーザーと操作対象の権限を
          middleware やハンドラーで確認します。
        </p>
        <p>
          ボディの上限は 10 MiB です。Fetch 入口で上限を超える Content-Length を検出すると 413、
          Server Function の実読み取りで上限を超えると 400 になります。 React
          の引数デコーダーには配列サイズの上限 10,000 も設定しています。
          大きなファイル送信のためにこのプロトコルを汎用アップロードとして扱うのではなく、入力サイズと失敗時の
          UI を設計してください。
        </p>
      </>
    ),
  },
  {
    slug: "/advanced/production-startup",
    title: "ビルド済みアプリケーションの起動",
    description:
      "Vite のビルドとホストの起動を分け、生成済み Workers 成果物をローカルで確認します。",
    section: "Advanced",
    headings: [
      { id: "host-boundary", title: "起動はホスト統合が担当する" },
      { id: "workers-artifact", title: "ビルドと起動の契約を分ける" },
      { id: "startup-checks", title: "起動後に確認すること" },
    ],
    content: () => (
      <>
        <h2 id="host-boundary">起動はホスト統合が担当する</h2>
        <p>
          Effront は Web Request から Response を返すアプリケーション境界を提供します。
          リスナー、プロセスの signal、静的アセット、ホストの設定は実行環境側の責務です。
          現在のホスト統合は Cloudflare Workers で、Vite の共通プラグインと Cloudflare
          アダプターを組み合わせます。
        </p>
        <p>
          <code>src/entry.client.ts</code> はアプリケーション定義を export し、
          <code>src/entry.workers.ts</code> はそれを読み込んで Fetch を export します。 ファイル名に
          client とあっても、アプリケーションの全実装をブラウザーに公開する意味ではありません。
          React の server condition は RSC graph のみで解決し、RSC と SSR は workerd
          の環境で実行します。
        </p>
        <CodeBlock
          code={`import { createFetchHandler } from "effront/workers";
import application from "./entry.client";

export default { fetch: createFetchHandler(application) };`}
          language="ts"
        />
        <h2 id="workers-artifact">ビルドと起動の契約を分ける</h2>
        <p>
          <a href="/guide/getting-started">はじめる</a>の設定があるアプリケーションのディレクトリで
          <code>vp build</code> を実行します。ビルド時には RSC、SSR、ブラウザーの各 graph を変換し、
          ホストが実行できるコードとアセットを生成します。ビルドの成功は、リスナーの起動やリモートへの公開を意味しません。
        </p>
        <p>
          起動時は生成済みのコードとホスト設定を使います。変換前の RSC
          ソースをホスト側で再コンパイルせず、 SSR
          モジュールやブラウザーのアセットを含む成果物全体を揃えてください。 アプリケーションの
          Layer はビルド時に完成する永続サービスではなく、現在の Fetch
          実装ではリクエストごとに取得します。 env などのホスト値も実際のリクエスト context
          から読みます。
        </p>
        <p>
          現在の Cloudflare アダプターは生成した Wrangler 設定と、既定では RSC 出力配下に置く SSR
          モジュールを使います。 Vite と独立した成果物の起動コマンド、出力パス、ローカル設定は
          <a href="/platforms/cloudflare#local">Cloudflare Workers のローカル実行と検証</a>
          にまとめています。 このローカル確認には Cloudflare 認証やリモートへのデプロイは不要です。
        </p>
        <h2 id="startup-checks">起動後に確認すること</h2>
        <ul>
          <li>直接 URL を開き、SSR の HTML、スタイル、ブラウザーの hydration が成立すること。</li>
          <li>
            対象ブラウザーでリンクの Flight
            遷移と戻る・進むを試し、非対応時のドキュメント移動も確認すること。
          </li>
          <li>
            Server Function の戻り値だけでなく、更新した画面と JavaScript
            無効時のフォーム送信を確認すること。
          </li>
          <li>Suspense の遅延部分とキャンセルを試し、秘密値が HTML や Flight に含まれないこと。</li>
        </ul>
        <p>
          ビルドの成功だけでは Fetch 経路の動作確認にはなりません。 開発時の <code>vp dev</code>{" "}
          と、生成済み Wrangler 成果物の両方で利用者の操作を確認します。 Node / Bun の専用起動 API
          と、サーバー寿命で Runtime を再利用する方式は今後の設計対象です。
        </p>
      </>
    ),
  },
];

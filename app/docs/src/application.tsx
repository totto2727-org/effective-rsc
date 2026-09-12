import { Effect } from "effect";
import { Application } from "effront";
import { DocsShell } from "./components/docs-shell";
import { getPage, navigation } from "./content";
import { architectureBaseline } from "./content/architecture-baseline";

const EFFRONT = Application.effront();
const RootLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <html lang="ja" className="dark">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </head>
        <body>{children}</body>
      </html>,
    ),
});

function documentPage(slug: string) {
  const page = getPage(slug);
  const Content = page.content;
  return EFFRONT.Page.make({
    render: () =>
      Effect.succeed(
        <>
          <title>{`${page.title} | Effront`}</title>
          <meta name="description" content={page.description} />
          <DocsShell
            current={{
              slug: page.slug,
              title: page.title,
              section: page.section,
              group: page.group,
            }}
            navigation={navigation}
            headings={page.headings}
          >
            <article
              className="prose prose-neutral max-w-none dark:prose-invert"
              data-doc-page={page.slug}
            >
              <header className="not-prose mb-10 border-b pb-8">
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-emerald-700">
                  {page.section}
                </p>
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{page.title}</h1>
                <p className="mt-4 text-base leading-8 text-muted-foreground">{page.description}</p>
              </header>
              {page.section === "アーキテクチャ" && (
                <aside
                  className="not-prose mb-8 rounded-lg border p-4 text-sm leading-7 text-muted-foreground"
                  data-architecture-baseline={architectureBaseline.commit}
                >
                  <p>
                    解説対象: <code>effront@{architectureBaseline.version}</code>
                  </p>
                  <p>
                    基準コミット: <code className="break-all">{architectureBaseline.commit}</code>
                  </p>
                  <p>
                    確認日: {architectureBaseline.reviewedOn}。この版の実装を基準に解説しています。
                  </p>
                </aside>
              )}
              <Content />
            </article>
          </DocsShell>
        </>,
      ),
  });
}

// Explicit routes preserve Effront's compile-time collision checks and its native 404 handling.
export default EFFRONT.make({
  routes: EFFRONT.Routes.make({ layout: RootLayout })
    .page("/", documentPage("/"))
    .page("/guide/getting-started", documentPage("/guide/getting-started"))
    .page("/guide/routes", documentPage("/guide/routes"))
    .page("/guide/components", documentPage("/guide/components"))
    .page("/guide/effect", documentPage("/guide/effect"))
    .page("/platforms", documentPage("/platforms"))
    .page("/platforms/cloudflare", documentPage("/platforms/cloudflare"))
    .page("/guide/testing", documentPage("/guide/testing"))
    .page("/guide/server-functions", documentPage("/guide/server-functions"))
    .page("/guide/middleware", documentPage("/guide/middleware"))
    .page("/guide/http", documentPage("/guide/http"))
    .page("/advanced", documentPage("/advanced"))
    .page(
      "/advanced/request-runtime-and-lifetimes",
      documentPage("/advanced/request-runtime-and-lifetimes"),
    )
    .page("/advanced/client-navigation", documentPage("/advanced/client-navigation"))
    .page(
      "/advanced/server-function-execution-and-refresh",
      documentPage("/advanced/server-function-execution-and-refresh"),
    )
    .page("/advanced/production-startup", documentPage("/advanced/production-startup"))
    .page("/api-reference", documentPage("/api-reference"))
    .page("/api-reference/application", documentPage("/api-reference/application"))
    .page("/api-reference/components", documentPage("/api-reference/components"))
    .page("/api-reference/routing", documentPage("/api-reference/routing"))
    .page("/api-reference/server-functions", documentPage("/api-reference/server-functions"))
    .page("/api-reference/workers", documentPage("/api-reference/workers"))
    .page("/api-reference/vite", documentPage("/api-reference/vite"))
    .page(
      "/architecture/implementation/overview",
      documentPage("/architecture/implementation/overview"),
    )
    .page(
      "/architecture/implementation/application",
      documentPage("/architecture/implementation/application"),
    )
    .page(
      "/architecture/implementation/routing",
      documentPage("/architecture/implementation/routing"),
    )
    .page(
      "/architecture/implementation/request",
      documentPage("/architecture/implementation/request"),
    )
    .page(
      "/architecture/implementation/rendering",
      documentPage("/architecture/implementation/rendering"),
    )
    .page(
      "/architecture/implementation/navigation",
      documentPage("/architecture/implementation/navigation"),
    )
    .page(
      "/architecture/implementation/server-functions",
      documentPage("/architecture/implementation/server-functions"),
    ),
});

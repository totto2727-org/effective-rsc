import { Effect } from "effect";
import { Application } from "effective-rsc";
import { DocsShell } from "./components/docs-shell";
import { getPage, navigation } from "./content";

const ERSC = Application.ersc();
const RootLayout = ERSC.Layout.make({
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
  return ERSC.Page.make({
    render: () =>
      Effect.succeed(
        <>
          <title>{`${page.title} | effective-rsc`}</title>
          <meta name="description" content={page.description} />
          <DocsShell
            current={{ slug: page.slug, title: page.title, section: page.section }}
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
              <Content />
            </article>
          </DocsShell>
        </>,
      ),
  });
}

// Explicit routes preserve ERSC's compile-time collision checks and its native 404 handling.
export default ERSC.make({
  routes: ERSC.Routes.make({ layout: RootLayout })
    .page("/", documentPage("/"))
    .page("/guide/getting-started", documentPage("/guide/getting-started"))
    .page("/guide/routes", documentPage("/guide/routes"))
    .page("/guide/components", documentPage("/guide/components"))
    .page("/guide/effect", documentPage("/guide/effect"))
    .page("/guide/workers", documentPage("/guide/workers"))
    .page("/guide/testing", documentPage("/guide/testing"))
    .page("/reading/overview", documentPage("/reading/overview"))
    .page("/reading/runtime", documentPage("/reading/runtime"))
    .page("/reading/rendering", documentPage("/reading/rendering"))
    .page("/reading/tooling", documentPage("/reading/tooling"))
    .page("/reading/lifetimes", documentPage("/reading/lifetimes")),
});

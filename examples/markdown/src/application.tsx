import { Markdown, type MarkdownEntry } from "@effront/markdown";
import { Context, Effect, Schema } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { Application } from "effront";
import { manual } from "../content";
import { Shell } from "./shell";

const EFFRONT = Application.effront();
const RootLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Effront Markdown</title>
        </head>
        <body>
          <Shell>{children}</Shell>
        </body>
      </html>,
    ),
});

class CurrentEntry extends Context.Service<CurrentEntry, MarkdownEntry>()(
  "markdown-example/CurrentEntry",
) {}

const FindEntry = EFFRONT.Middleware.make<{ provides: CurrentEntry }>(
  Effect.fnUntraced(function* (httpEffect) {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const entry = manual.get(request.url);
    if (!entry) {
      return HttpServerResponse.text("Not found", { status: 404 });
    }
    return yield* httpEffect.pipe(Effect.provideService(CurrentEntry, entry));
  }),
);
const Manual = EFFRONT.withMiddleware(FindEntry);
const ManualPage = Manual.Page.make({
  params: Schema.Struct({ path: Schema.String }),
  render: () =>
    Effect.gen(function* () {
      const entry = yield* CurrentEntry;
      return (
        <article className="comark" data-markdown-page={entry.url}>
          <Markdown entry={entry} />
        </article>
      );
    }),
});

export default EFFRONT.make({
  routes: Manual.Routes.make({ layout: RootLayout }).page("/manual/*path", ManualPage),
});

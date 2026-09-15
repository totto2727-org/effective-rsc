import { MarkdownDocument } from "@comark/react/components/MarkdownDocument";
import { parseMarkdown, type MarkdownEntry } from "@effront/markdown";
import { Context, Effect, Result, Schema } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { Application } from "effront";
import { manual } from "../content";

const EFFRONT = Application.effront();
class CurrentEntry extends Context.Service<CurrentEntry, MarkdownEntry>()("e2e-dev/CurrentEntry") {}
const FindEntry = EFFRONT.Middleware.make<{ provides: CurrentEntry }>(
  Effect.fn(function* (httpEffect) {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const collection = yield* Effect.result(manual);
    if (Result.isFailure(collection))
      return HttpServerResponse.text("Invalid collection", { status: 500 });
    const entry = collection.success.get(request.url);
    if (!entry) return HttpServerResponse.text("Not found", { status: 404 });
    return yield* httpEffect.pipe(Effect.provideService(CurrentEntry, entry));
  }),
);
const Manual = EFFRONT.withMiddleware(FindEntry);
const Layout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <html lang="en">
        <head>
          <title>Markdown HMR</title>
        </head>
        <body>{children}</body>
      </html>,
    ),
});
const Page = Manual.Page.make({
  params: Schema.Struct({ path: Schema.String }),
  render: Effect.fn(function* () {
    const entry = yield* CurrentEntry;
    const document = yield* parseMarkdown(entry);
    return <MarkdownDocument value={document} />;
  }),
});
export default EFFRONT.make({
  routes: Manual.Routes.make({ layout: Layout }).page("/manual/*path", Page),
});

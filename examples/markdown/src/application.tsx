import { Markdown } from "@effront/markdown";
import { Effect } from "effect";
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

export default EFFRONT.make({
  routes: EFFRONT.Routes.fromPages(
    manual.entries.map(
      (entry) =>
        [
          entry.routePath,
          EFFRONT.Page.make({
            render: () =>
              Effect.succeed(
                <article className="comark" data-markdown-page={entry.url}>
                  <Markdown entry={entry} />
                </article>,
              ),
          }),
        ] as const,
    ),
    { layout: RootLayout },
  ),
});

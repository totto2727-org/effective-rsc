import { Effect } from "effect";
import { Application } from "effront";
import { getWorkersEnv } from "effront/workers";
import { Counter } from "./counter";
import type { Env } from "./env";
import "./styles.css";

const EFFRONT = Application.effront();

const RootLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <html lang="en">
        <head>
          <title>Effront Workers</title>
        </head>
        <body>
          <nav>
            <a href="/">Home</a> <a href="/about">About</a>
          </nav>
          <main>{children}</main>
        </body>
      </html>,
    ),
});

const HomePage = EFFRONT.Page.make({
  render: Effect.fn("HomePage.render")(function* () {
    const env = yield* getWorkersEnv<Env>();
    return (
      <>
        <h1>{env.APP_LABEL}</h1>
        <p data-testid="secret-status">
          {env.SERVER_TOKEN ? "Server secret configured" : "No server secret"}
        </p>
        <p>React Server Components on Workers, powered by Effect.</p>
        <Counter />
      </>
    );
  }),
});

const AboutPage = EFFRONT.Page.make({
  render: Effect.fn("AboutPage.render")(function* () {
    const env = yield* getWorkersEnv<Env>();
    return (
      <>
        <h1>About</h1>
        <p data-testid="label">{env.APP_LABEL}</p>
        <a href="/">Back home</a>
      </>
    );
  }),
});

export default EFFRONT.make({
  routes: EFFRONT.Routes.make({ layout: RootLayout }).page("/", HomePage).page("/about", AboutPage),
});

import { Effect } from "effect";
import { Application } from "effective-rsc";
import { getWorkersEnv } from "effective-rsc/workers";
import { Counter } from "./counter";
import type { Env } from "./env";
import "./styles.css";

const ERSC = Application.ersc();

const RootLayout = ERSC.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <html lang="en">
        <head>
          <title>ERSC Workers</title>
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

const HomePage = ERSC.Page.make({
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

const AboutPage = ERSC.Page.make({
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

export default ERSC.make({
  routes: ERSC.Routes.make({ layout: RootLayout }).page("/", HomePage).page("/about", AboutPage),
});

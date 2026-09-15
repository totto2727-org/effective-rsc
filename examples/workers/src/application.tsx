import { Effect } from "effect";
import { Application } from "effront";
import { getWorkersEnv, getWorkersRequestContext } from "./host";
import { Counter } from "./counter";
import { ExampleShell, PageNote, TransitionExampleLayout } from "./example-shell";

const EFFRONT = Application.effront();

const RootLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <html lang="en">
        <head>
          <title>Effront Workers</title>
        </head>
        <body>
          <ExampleShell>{children}</ExampleShell>
        </body>
      </html>,
    ),
});

const HomePage = EFFRONT.Page.make({
  render: Effect.fnUntraced(function* () {
    const env = yield* getWorkersEnv();
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
  render: Effect.fnUntraced(function* () {
    const context = yield* getWorkersRequestContext();
    context.executionContext.waitUntil(Promise.resolve());
    const env = yield* getWorkersEnv();
    return (
      <>
        <h1>About</h1>
        <p data-testid="label">{env.APP_LABEL}</p>
        <a href="/">Back home</a>
      </>
    );
  }),
});

const TransitionLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(<TransitionExampleLayout>{children}</TransitionExampleLayout>),
});

const transitionPage = (mode: "default" | "custom" | "typed" | "disabled", step: "a" | "b") =>
  EFFRONT.Page.make({
    ...(mode === "custom"
      ? { viewTransition: { default: "demo-slide" } }
      : mode === "typed"
        ? { viewTransition: { default: { default: "demo-slide", "demo-navigation": "demo-lift" } } }
        : mode === "disabled"
          ? { viewTransition: false as const }
          : {}),
    render: () =>
      Effect.succeed(
        <section className={`transition-card transition-card-${step}`}>
          <h1>{`${mode} page ${step.toUpperCase()}`}</h1>
          <p>
            {mode === "default"
              ? "Effront animates this page with its built-in transition, without configuration."
              : mode === "custom"
                ? "This page selects a custom transition class and supplies its animation in CSS."
                : mode === "typed"
                  ? "The next link selects a lift animation. Browser history uses the fallback slide animation."
                  : "This page opts out of the built-in page transition."}
          </p>
          <PageNote />
          <a
            href={`/transitions/${mode}-${step === "a" ? "b" : "a"}`}
            data-effront-transition-types={mode === "typed" ? "demo-navigation" : undefined}
          >
            Next example page
          </a>
        </section>,
      ),
  });

const transitionRoutes = EFFRONT.Routes.make({ layout: TransitionLayout })
  .page("/default-a", transitionPage("default", "a"))
  .page("/default-b", transitionPage("default", "b"))
  .page("/custom-a", transitionPage("custom", "a"))
  .page("/custom-b", transitionPage("custom", "b"))
  .page("/typed-a", transitionPage("typed", "a"))
  .page("/typed-b", transitionPage("typed", "b"))
  .page("/disabled-a", transitionPage("disabled", "a"))
  .page("/disabled-b", transitionPage("disabled", "b"));

export default EFFRONT.make({
  routes: EFFRONT.Routes.make({ layout: RootLayout })
    .page("/", HomePage)
    .page("/about", AboutPage)
    .mount("/transitions", transitionRoutes),
});

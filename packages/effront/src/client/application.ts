import * as BrowserHttpClient from "@effect/platform-browser/BrowserHttpClient";
import { Effect, Layer } from "effect";

import { navigationMode } from "./browser-capabilities";
import { BrowserEffectRunner } from "./browser-effect-runner";
import { BrowserRenderStatus } from "./browser-render-status";
import { BrowserRenderer } from "./browser-renderer";
import { showBrowserFailure } from "./browser-screen";
import { installCallServer } from "./call-server";
import { installClientRouter } from "./client-router";
import { FlightClient } from "./flight-client";
import { InitialFlightStream } from "./initial-flight-stream";
import { NavigationApi } from "./navigation-api";
import { ReactDOMRenderer } from "./react-dom-renderer";
import { RouteLoader } from "./route-loader";
import { installRouteRefresh, RouteRefresher } from "./route-refresh";

const BrowserServicesLayer = Layer.mergeAll(
  BrowserEffectRunner.layer,
  BrowserRenderer.layer,
  BrowserRenderStatus.layer,
  FlightClient.layer,
  NavigationApi.layer,
).pipe(Layer.provide(InitialFlightStream.layer));

const BrowserLayer = Layer.mergeAll(
  ReactDOMRenderer.layer,
  RouteLoader.layer,
  RouteRefresher.layer,
).pipe(Layer.provideMerge(BrowserServicesLayer), Layer.provide(BrowserHttpClient.layerFetch));

const renderBrowserFailure = Effect.sync(showBrowserFailure);

const activateBrowser = Effect.gen(function* () {
  const routeLoader = yield* RouteLoader;
  const reactDOMRenderer = yield* ReactDOMRenderer;

  const initialPayload = yield* routeLoader.loadInitial;
  yield* reactDOMRenderer.hydrate(document, initialPayload);
  yield* installRouteRefresh;
  yield* installCallServer;
  const mode = yield* navigationMode;
  if (mode === "Client") {
    yield* installClientRouter;
  }
});

const installViteHmr = Effect.gen(function* () {
  const hot = (
    import.meta as ImportMeta & {
      readonly hot?: {
        on: (event: string, listener: () => void) => void;
        off: (event: string, listener: () => void) => void;
      };
    }
  ).hot;
  if (hot === undefined) {
    return;
  }

  const run = yield* BrowserEffectRunner;
  const routeRefresher = yield* RouteRefresher;
  const refresh = () => {
    void run(routeRefresher.refreshCurrentRoute("hmr-refresh"));
  };
  hot.on("rsc:update", refresh);
  yield* Effect.addFinalizer(() => Effect.sync(() => hot.off("rsc:update", refresh)));
});

export const browserMain = Effect.scoped(
  Effect.gen(function* () {
    yield* activateBrowser;
    yield* installViteHmr;
    return yield* Effect.never;
  }).pipe(
    Effect.catchTags({
      FlightLoadError: () => renderBrowserFailure,
      ReactDOMHydrationError: () => renderBrowserFailure,
    }),
  ),
).pipe(Effect.provide(BrowserLayer));

import { expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { vi } from "vitest";

import { getApplicationState } from "../../src/application/definition";
import { getEFFRONTIdentity } from "../../src/application/effront-identity";
import { getPageState } from "../../src/application/page";
import { getRoutesState } from "../../src/application/routes";
import { matchServerFnInvocation } from "../../src/application/server-fn";

it.effect("composes values loaded from a duplicated framework module instance", () =>
  Effect.gen(function* () {
    vi.resetModules();
    const { Application } = yield* Effect.promise(() => import("../../src/application/effront"));
    const EFFRONT = Application.effront();
    const RootLayout = EFFRONT.Layout.make({ render: ({ children }) => Effect.succeed(children) });
    const Page = EFFRONT.Page.make({ render: () => Effect.succeed(null) });
    const ServerFn = EFFRONT.ServerFn.make({
      input: Schema.String,
      handler: (input) => Effect.succeed(input),
    });
    const Routes = EFFRONT.Routes.make({ layout: RootLayout }).page("/", Page);
    const App = EFFRONT.make({ routes: Routes });

    expect(getPageState(Page).paramsSchema).toBeNull();
    expect(getRoutesState(Routes).paths).toEqual(["/"]);
    expect(getApplicationState(App).routes).toHaveLength(1);

    const invocation = ServerFn("hello");
    expect(matchServerFnInvocation(invocation, getEFFRONTIdentity(ServerFn))._tag).toBe("Match");
  }),
);

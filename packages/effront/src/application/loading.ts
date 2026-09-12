import { type Effect } from "effect";
import type { ReactNode } from "react";

import { attachEFFRONTMember, type EFFRONTIdentity, type EFFRONTMember } from "./effront-identity";

export interface LoadingComponent<Services> extends EFFRONTMember<Services, "Loading"> {
  (): Awaited<ReactNode>;
}

type NonEffectOutput<Output> = [Extract<Output, Effect.Effect<unknown, unknown, unknown>>] extends [
  never,
]
  ? unknown
  : never;

type LoadingOptions<Output extends Awaited<ReactNode>> = {
  readonly render: (() => Output) & NonEffectOutput<Output>;
};

export type LoadingFactory<Services> = {
  readonly make: <Output extends Awaited<ReactNode>>(
    options: LoadingOptions<Output>,
  ) => LoadingComponent<Services>;
};

export const makeLoadingFactory = <Services>(
  identity: EFFRONTIdentity<Services>,
): LoadingFactory<Services> => ({
  make: ({ render }) => {
    const LoadingComponent = () => render();
    return attachEFFRONTMember(LoadingComponent, identity, "Loading");
  },
});

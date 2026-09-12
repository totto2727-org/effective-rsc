import { Effect, Schema, type Types } from "effect";
import { createElement, type ReactNode } from "react";

import { PageViewTransitionBoundary } from "../client/page-view-transition";
import {
  PageViewTransition,
  type PageViewTransitionConfig,
  resolvePageViewTransition,
} from "./page-view-transition";

import {
  type EFFRONTIdentity,
  EFFRONTIdentityTypeId,
  isEFFRONTMember,
  EFFRONTMemberKindTypeId,
  type EFFRONTStatefulMember,
  EFFRONTStateTypeId,
} from "./effront-identity";
import type { AnyMiddleware } from "./middleware";
import type { ValidRouteParamName } from "./route-path";

declare const PageContractTypeId: unique symbol;

export type PageParamsSchema<Services> = Schema.ConstraintCodec<
  Readonly<Record<string, unknown>>,
  Readonly<Record<string, unknown>>,
  Services,
  unknown
>;

type PageParamKeys<ParamsSchema> = ParamsSchema extends { readonly Encoded: infer Encoded }
  ? Extract<keyof Encoded, string>
  : never;
type NonStringPageParamKeys<ParamsSchema> = ParamsSchema extends {
  readonly Encoded: infer Encoded;
}
  ? Exclude<keyof Encoded, string>
  : never;
type InvalidPageParamName<Name extends string> =
  Name extends ValidRouteParamName<Name> ? never : Name;
type InvalidPageParamValueKeys<ParamsSchema> = ParamsSchema extends {
  readonly Encoded: infer Encoded;
}
  ? {
      [Key in Extract<keyof Encoded, string>]-?: unknown extends Encoded[Key]
        ? never
        : [Extract<Encoded[Key], string>] extends [never]
          ? Key
          : never;
    }[Extract<keyof Encoded, string>]
  : never;
type InvalidPageParamsSchema<ParamsSchema> =
  | NonStringPageParamKeys<ParamsSchema>
  | InvalidPageParamName<PageParamKeys<ParamsSchema>>
  | InvalidPageParamValueKeys<ParamsSchema>;
type ValidPageParamsSchema<ParamsSchema> = [PageParamKeys<ParamsSchema>] extends [never]
  ? never
  : string extends PageParamKeys<ParamsSchema>
    ? never
    : [InvalidPageParamsSchema<ParamsSchema>] extends [never]
      ? unknown
      : never;

export type PageConcern<
  out ParamNames extends string,
  out Mode extends "Parameterized" | "Static",
> = {
  readonly [PageContractTypeId]: {
    readonly mode: Types.Covariant<Mode>;
    readonly paramNames: Types.Covariant<ParamNames>;
  };
};

export type EncodedPageParams = Readonly<Record<string, string | undefined>>;
export type PageParams =
  | { readonly _tag: "Encoded"; readonly value: EncodedPageParams }
  | { readonly _tag: "Decoded"; readonly value: Readonly<Record<string, unknown>> };
export type PageRuntimeProps = {
  readonly params: PageParams;
};
export type PageComponent = (props: PageRuntimeProps) => Promise<Awaited<ReactNode>>;

export type StaticPageDefinition<Services> = EFFRONTStatefulMember<
  Services,
  "Page",
  PageImplementationState
> &
  PageConcern<never, "Static">;
export type ParameterizedPageDefinition<
  Services,
  ParamNames extends string = string,
> = EFFRONTStatefulMember<Services, "Page", PageImplementationState> &
  PageConcern<ParamNames, "Parameterized">;
export type AnyPageDefinition<Services> =
  | StaticPageDefinition<Services>
  | ParameterizedPageDefinition<Services>;

export type PageImplementationState<Services = unknown> = {
  readonly component: PageComponent;
  readonly boundary: (props: { readonly children: ReactNode }) => Promise<ReactNode>;
  readonly paramsSchema: PageParamsSchema<Services> | null;
};

class PageDefinitionImpl<
  Services,
  ParamNames extends string,
  Mode extends "Parameterized" | "Static",
  ParamsSchema extends PageParamsSchema<unknown> | null,
>
  implements
    EFFRONTStatefulMember<Services, "Page", PageImplementationState>,
    PageConcern<ParamNames, Mode>
{
  declare readonly [PageContractTypeId]: {
    readonly mode: Types.Covariant<Mode>;
    readonly paramNames: Types.Covariant<ParamNames>;
  };
  readonly [EFFRONTIdentityTypeId]: EFFRONTIdentity<Services>;
  readonly [EFFRONTMemberKindTypeId] = "Page" as const;
  get [EFFRONTStateTypeId](): PageImplementationState {
    return this;
  }
  readonly component: PageComponent;
  readonly boundary: (props: { readonly children: ReactNode }) => Promise<ReactNode>;
  readonly paramsSchema: ParamsSchema;

  constructor(
    identity: EFFRONTIdentity<Services>,
    component: PageComponent,
    paramsSchema: ParamsSchema,
    middleware: ReadonlyArray<AnyMiddleware<Services>>,
    viewTransition: false | PageViewTransitionConfig | undefined,
  ) {
    this[EFFRONTIdentityTypeId] = identity;
    this.component = component;
    this.paramsSchema = paramsSchema;
    this.boundary = ({ children }) =>
      identity.renderRuntime.run(
        "Page",
        Effect.map(PageViewTransition, (defaults) =>
          createElement(
            PageViewTransitionBoundary,
            {
              config: resolvePageViewTransition(defaults, viewTransition),
            },
            children,
          ),
        ),
        middleware,
      );
    Object.freeze(this);
  }
}

export function getPageState<Services>(
  page: AnyPageDefinition<Services>,
): PageImplementationState<Services>;
// The compiled destination installs the Page's complete middleware chain before decoding.
// As with scoped middleware, its provided services are erased from the application contract.
export function getPageState(page: AnyPageDefinition<unknown>): PageImplementationState {
  if (!isEFFRONTMember(page, "Page")) {
    throw new TypeError("Page must be created with EFFRONT.Page.make.");
  }
  return page[EFFRONTStateTypeId];
}

type StaticPageOptions<Error, Services> = {
  readonly params?: never;
  readonly viewTransition?: false | PageViewTransitionConfig | undefined;
  readonly render: () => Effect.Effect<Awaited<ReactNode>, Error, Services>;
};
type ParameterizedPageOptions<ParamsSchema extends PageParamsSchema<Services>, Error, Services> = {
  readonly params: ParamsSchema;
  readonly viewTransition?: false | PageViewTransitionConfig | undefined;
  readonly render: (props: {
    readonly params: ParamsSchema["Type"];
  }) => Effect.Effect<Awaited<ReactNode>, Error, Services>;
};

export type PageFactory<ApplicationServices, AvailableServices> = {
  readonly make: {
    <ParamsSchema extends PageParamsSchema<AvailableServices>, Error>(
      options: ParameterizedPageOptions<ParamsSchema, Error, AvailableServices> &
        ValidPageParamsSchema<ParamsSchema>,
    ): ParameterizedPageDefinition<ApplicationServices, PageParamKeys<ParamsSchema>>;
    <Error>(
      options: StaticPageOptions<Error, AvailableServices>,
    ): StaticPageDefinition<ApplicationServices>;
  };
};

export const makePageFactory = <ApplicationServices, AvailableServices>(
  identity: EFFRONTIdentity<ApplicationServices>,
  middleware: ReadonlyArray<AnyMiddleware<ApplicationServices>>,
): PageFactory<ApplicationServices, AvailableServices> => {
  function make<ParamsSchema extends PageParamsSchema<AvailableServices>, Error>(
    options: ParameterizedPageOptions<ParamsSchema, Error, AvailableServices> &
      ValidPageParamsSchema<ParamsSchema>,
  ): ParameterizedPageDefinition<ApplicationServices, PageParamKeys<ParamsSchema>>;
  function make<Error>(
    options: StaticPageOptions<Error, AvailableServices>,
  ): StaticPageDefinition<ApplicationServices>;
  function make<Error>(
    options:
      | Omit<StaticPageOptions<Error, AvailableServices>, "params">
      | ParameterizedPageOptions<PageParamsSchema<AvailableServices>, Error, AvailableServices>,
  ): AnyPageDefinition<ApplicationServices> {
    if ("params" in options) {
      const { params: paramsSchema, render } = options;
      const decodeParams = Schema.decodeUnknownEffect(paramsSchema);
      const component: PageComponent = ({ params }) =>
        identity.renderRuntime.run(
          "Page",
          (params._tag === "Decoded"
            ? Effect.succeed(params.value)
            : decodeParams(params.value)
          ).pipe(
            Effect.flatMap((decodedParams) =>
              Effect.suspend(() => render({ params: decodedParams })),
            ),
          ),
          middleware,
        );
      return new PageDefinitionImpl<
        ApplicationServices,
        PageParamKeys<typeof paramsSchema>,
        "Parameterized",
        typeof paramsSchema
      >(identity, component, paramsSchema, middleware, options.viewTransition);
    }

    const { render } = options;
    const component: PageComponent = () =>
      identity.renderRuntime.run("Page", Effect.suspend(render), middleware);
    return new PageDefinitionImpl<ApplicationServices, never, "Static", null>(
      identity,
      component,
      null,
      middleware,
      options.viewTransition,
    );
  }

  return { make };
};

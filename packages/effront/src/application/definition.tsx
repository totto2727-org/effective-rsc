import { Layer, type Types } from "effect";
import type { HttpRouter } from "effect/unstable/http";

import {
  type EFFRONTIdentity,
  EFFRONTIdentityTypeId,
  EFFRONTMemberKindTypeId,
  type EFFRONTStatefulMember,
  EFFRONTStateTypeId,
  getEFFRONTIdentity,
  isEFFRONTMember,
} from "./effront-identity";
import { type CompiledRouteGraph, compileRouteGraph } from "./route-graph";
import type { AbsolutePath, ReservedRoutePath } from "./route-path";
import { type AnyRoutes, type RoutesHasLayout, type RoutesPaths } from "./routes";

declare const ApplicationContractTypeId: unique symbol;

export interface ApplicationDefinition<
  Services,
  out ApplicationError = never,
> extends EFFRONTStatefulMember<
  Services,
  "Application",
  ApplicationImplementationState<Services, ApplicationError>
> {
  readonly [ApplicationContractTypeId]: {
    readonly error: Types.Covariant<ApplicationError>;
  };
}

export type ApplicationImplementationState<Services, ApplicationError> = {
  readonly layer: Layer.Layer<Services, ApplicationError, HttpRouter.HttpRouter>;
  readonly routes: CompiledRouteGraph<Services>;
};

class ApplicationDefinitionImpl<Services, ApplicationError> implements ApplicationDefinition<
  Services,
  ApplicationError
> {
  declare readonly [ApplicationContractTypeId]: {
    readonly error: Types.Covariant<ApplicationError>;
  };
  readonly [EFFRONTIdentityTypeId]: EFFRONTIdentity<Services>;
  readonly [EFFRONTMemberKindTypeId] = "Application" as const;
  get [EFFRONTStateTypeId](): ApplicationImplementationState<Services, ApplicationError> {
    return this;
  }
  readonly layer: Layer.Layer<Services, ApplicationError, HttpRouter.HttpRouter>;
  readonly routes: CompiledRouteGraph<Services>;

  constructor(
    identity: EFFRONTIdentity<Services>,
    routes: CompiledRouteGraph<Services>,
    layer: Layer.Layer<Services, ApplicationError, HttpRouter.HttpRouter>,
  ) {
    this[EFFRONTIdentityTypeId] = identity;
    this.layer = layer;
    this.routes = routes;
    Object.defineProperties(this, {
      [EFFRONTIdentityTypeId]: { configurable: false, writable: false },
      layer: { configurable: false, writable: false },
      routes: { configurable: false, writable: false },
    });
  }
}

export const getApplicationState = <Services, ApplicationError>(
  application: ApplicationDefinition<Services, ApplicationError>,
): ApplicationImplementationState<Services, ApplicationError> => {
  if (!isEFFRONTMember(application, "Application")) {
    throw new TypeError("Application must be created with EFFRONT.make.");
  }
  return application[EFFRONTStateTypeId];
};

export type ApplicationServices<Application> =
  Application extends ApplicationDefinition<infer Services, infer _ApplicationError>
    ? Services
    : never;

type ValidRootRoutes<Services, Definition extends AnyRoutes<Services>> =
  RoutesHasLayout<Definition> extends true
    ? [RoutesPaths<Definition>] extends [never]
      ? never
      : [ReservedRoutes<RoutesPaths<Definition>>] extends [never]
        ? unknown
        : never
    : never;

type ReservedRoutes<Paths> = Paths extends AbsolutePath ? ReservedRoutePath<Paths> : never;

type ApplicationLayerOptions<Services, ApplicationError> = [Services] extends [never]
  ? {
      readonly layer?: Layer.Layer<Services, ApplicationError, HttpRouter.HttpRouter>;
    }
  : {
      readonly layer: Layer.Layer<Services, ApplicationError, HttpRouter.HttpRouter>;
    };

export type EFFRONTApplicationOptions<
  Services,
  Definition extends AnyRoutes<Services>,
  ApplicationError,
> = {
  readonly routes: Definition & ValidRootRoutes<Services, Definition>;
} & ApplicationLayerOptions<Services, ApplicationError>;

export type EFFRONTMake<Services> = <
  Definition extends AnyRoutes<Services>,
  ApplicationError = never,
>(
  options: EFFRONTApplicationOptions<Services, Definition, ApplicationError>,
) => ApplicationDefinition<Services, ApplicationError>;

function resolveApplicationLayer<Services, ApplicationError>(
  layer: Layer.Layer<Services, ApplicationError, HttpRouter.HttpRouter> | undefined,
): Layer.Layer<Services, ApplicationError, HttpRouter.HttpRouter>;
function resolveApplicationLayer(layer: Layer.Any | undefined): Layer.Any {
  return layer ?? Layer.empty;
}

export const makeApplication = <
  Services,
  Definition extends AnyRoutes<Services>,
  ApplicationError = never,
>(
  identity: EFFRONTIdentity<Services>,
  { layer, routes }: EFFRONTApplicationOptions<Services, Definition, ApplicationError>,
): ApplicationDefinition<Services, ApplicationError> => {
  if (getEFFRONTIdentity(routes) !== identity) {
    throw new TypeError("Root Routes were created by a different EFFRONT module.");
  }

  return new ApplicationDefinitionImpl(
    identity,
    compileRouteGraph(routes),
    resolveApplicationLayer<Services, ApplicationError>(layer),
  );
};

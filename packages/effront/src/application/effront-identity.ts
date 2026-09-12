import { Predicate, type Types } from "effect";

import { makeRenderRuntimeContext, type RenderRuntimeContext } from "./render-runtime";

declare const EFFRONTServicesTypeId: unique symbol;

export const EFFRONTIdentityTypeId: unique symbol = Symbol.for("effront/EFFRONTIdentity");
export const EFFRONTMemberKindTypeId: unique symbol = Symbol.for("effront/EFFRONTMemberKind");
export const EFFRONTStateTypeId: unique symbol = Symbol.for("effront/EFFRONTState");

export type EFFRONTMemberKind =
  | "Application"
  | "Component"
  | "EFFRONT"
  | "Layout"
  | "Loading"
  | "Middleware"
  | "Page"
  | "Routes"
  | "ServerFn";

export type EFFRONTIdentity<Services> = {
  readonly [EFFRONTServicesTypeId]?: Types.Invariant<Services>;
  readonly renderRuntime: RenderRuntimeContext;
};

type EFFRONTMemberKindMarker<Kind extends EFFRONTMemberKind> = {
  readonly [EFFRONTMemberKindTypeId]: Kind;
};

export type EFFRONTMember<
  Services,
  Kind extends EFFRONTMemberKind = EFFRONTMemberKind,
> = EFFRONTMemberKindMarker<Kind> & {
  readonly [EFFRONTIdentityTypeId]: EFFRONTIdentity<Services>;
};

export type EFFRONTStatefulMember<Services, Kind extends EFFRONTMemberKind, State> = EFFRONTMember<
  Services,
  Kind
> & {
  readonly [EFFRONTStateTypeId]: State;
};

export const makeEFFRONTIdentity = <Services>(): EFFRONTIdentity<Services> => ({
  renderRuntime: makeRenderRuntimeContext(),
});

export const attachEFFRONTMember = <
  Member extends object,
  Services,
  const Kind extends EFFRONTMemberKind,
>(
  member: Member,
  identity: EFFRONTIdentity<Services>,
  kind: Kind,
): Member & EFFRONTMember<Services, Kind> =>
  Object.assign(member, { [EFFRONTIdentityTypeId]: identity, [EFFRONTMemberKindTypeId]: kind });

export const isEFFRONTMember = <const Kind extends EFFRONTMemberKind>(
  value: unknown,
  kind: Kind,
): value is EFFRONTMemberKindMarker<Kind> =>
  Predicate.hasProperty(value, EFFRONTMemberKindTypeId) && value[EFFRONTMemberKindTypeId] === kind;

export const getEFFRONTIdentity = <Services>(
  member: EFFRONTMember<Services>,
): EFFRONTIdentity<Services> => member[EFFRONTIdentityTypeId];

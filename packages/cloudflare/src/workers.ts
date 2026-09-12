import { createWorkersContextAccessors as createAccessors } from "effront/workers";

/** Minimal Cloudflare execution context supported by these accessors. */
export type CloudflareExecutionContext = {
  waitUntil(promise: Promise<unknown>): void;
};

/** Typed readers of the core request context with Cloudflare's fixed execution context type. */
export const createWorkersContextAccessors = <Env = unknown>() =>
  createAccessors<Env, CloudflareExecutionContext>();

export const getWorkersEnv = <Env = unknown>() =>
  createWorkersContextAccessors<Env>().getWorkersEnv();

export const getWorkersRequestContext = <Env = unknown>() =>
  createWorkersContextAccessors<Env>().getWorkersRequestContext();

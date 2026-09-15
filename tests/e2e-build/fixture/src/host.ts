import { createWorkersContextAccessors } from "@effront/cloudflare/workers";
import type { Env } from "./env";

export const { getWorkersEnv, getWorkersRequestContext } = createWorkersContextAccessors<Env>();

import type { createTemporaryReferenceSet } from "@vitejs/plugin-rsc/rsc/server";

import type { FlightPayload } from "../rsc/flight";

export type RequestOutcome = {
  readonly formState: FlightPayload["formState"];
  readonly serverFnResult: FlightPayload["serverFnResult"];
  readonly status: 200;
  readonly temporaryReferences?: ReturnType<typeof createTemporaryReferenceSet>;
};

import { createFetchHandler } from "../workers";

import application from "effective-rsc/application-entry";

const fetch = createFetchHandler(application);

export default {
  fetch(request: Request, env: unknown, executionContext: unknown): Promise<Response> {
    return fetch(request, env, executionContext);
  },
};

import { createFetchHandler } from "effront/workers";
import application from "./entry.client";

export default { fetch: createFetchHandler(application) };

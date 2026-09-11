import { createFetchHandler } from "effective-rsc/workers";
import application from "./application";

export default { fetch: createFetchHandler(application) };

import { createFetchHandler } from "effront/workers";
import application from "./application";

export default { fetch: createFetchHandler(application) };

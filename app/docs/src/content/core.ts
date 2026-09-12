import { coreModelPages, coreModelSources } from "./core-model";
import { coreRuntimePages, coreRuntimeSources } from "./core-runtime";

export const corePages = [...coreModelPages, ...coreRuntimePages];
export const coreSources = [
  ...Object.values(coreModelSources),
  ...Object.values(coreRuntimeSources),
];

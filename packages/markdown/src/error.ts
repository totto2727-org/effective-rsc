import { Data } from "effect";

/** Collection configuration, unresolved file references, or Comark parser failures. */
export class MarkdownError extends Data.TaggedError("MarkdownError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

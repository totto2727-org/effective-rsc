import { Cause, Effect, Schema } from "effect";
import { HttpServerRequest } from "effect/unstable/http";

import type { EFFRONTIdentity } from "../application/effront-identity";
import type { AnyMiddleware } from "../application/middleware";
import { matchServerFnInvocation } from "../application/server-fn";
import { ServerFnIdHeader } from "../rsc/flight";
import type { RequestOutcome } from "./request-outcome";
import { serverFnOutcome } from "./server-fn-outcome";

const ServerFnArraySizeLimit = 10_000;
const ServerFnBodySizeLimit = 10 * 1024 * 1024;
const decodeArguments = Schema.decodeUnknownEffect(Schema.Array(Schema.Unknown));
const NoMiddleware = Object.freeze([]);

export class ServerFnRequestError extends Schema.TaggedError<ServerFnRequestError>()(
  "ServerFnRequestError",
  {
    cause: Schema.Defect(),
    message: Schema.String,
    status: Schema.Literals([400, 403, 500]),
  },
) {}

class ServerFnExecutionError extends Schema.TaggedError<ServerFnExecutionError>()(
  "ServerFnExecutionError",
  { cause: Schema.Defect() },
) {}

const requestError = (message: string, status: 400 | 403 | 500, cause: unknown) =>
  new ServerFnRequestError({ cause, message, status });

const bodyReadError = (message: string, cause: unknown) => requestError(message, 400, cause);

const normalizeServerFnFailure = <Output, Error, Services>(
  effect: Effect.Effect<Output, Error, Services>,
): Effect.Effect<Output, ServerFnExecutionError, Services> =>
  effect.pipe(
    Effect.catchCause((cause) =>
      Cause.hasInterrupts(cause)
        ? Effect.interrupt
        : Effect.fail(new ServerFnExecutionError({ cause: Cause.squash(cause) })),
    ),
  );

type ServerFnOperation<ApplicationServices> = {
  readonly effect: Effect.Effect<unknown, ServerFnExecutionError, ApplicationServices>;
  readonly middleware: ReadonlyArray<AnyMiddleware<ApplicationServices>>;
};

export type PreparedServerFnRequest<ApplicationServices> = {
  readonly execute: Effect.Effect<RequestOutcome, ServerFnRequestError, ApplicationServices>;
  readonly middleware: ReadonlyArray<AnyMiddleware<ApplicationServices>>;
};

const validateOrigin = (request: HttpServerRequest.HttpServerRequest) =>
  Effect.try({
    try: () => {
      const origin = request.headers["origin"];
      if (origin === undefined) {
        throw new Error("The Origin header is missing.");
      }

      const expectedHost = request.headers["host"];
      if (expectedHost === undefined || new URL(origin).host !== expectedHost.toLowerCase()) {
        throw new Error(`Origin "${origin}" does not match host "${expectedHost ?? ""}".`);
      }
    },
    catch: (cause) => requestError("Rejected a cross-origin Server Function request.", 403, cause),
  });

const readBodyBytes = Effect.fnUntraced(function* (request: Request) {
  if (request.body === null) {
    return new Uint8Array();
  }

  const reader = request.body.getReader();
  const chunks: Array<Uint8Array> = [];
  let length = 0;
  try {
    while (true) {
      const result = yield* Effect.tryPromise({
        try: () => reader.read(),
        catch: (cause) => bodyReadError("Failed to read the Server Function request body.", cause),
      });
      if (result.done) {
        break;
      }
      length += result.value.byteLength;
      if (length > ServerFnBodySizeLimit) {
        return yield* bodyReadError(
          "The Server Function request body exceeds the 10 MiB limit.",
          new Error("Server Function request body limit exceeded."),
        );
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
});

const readBody = Effect.fnUntraced(function* (request: Request) {
  const bytes = yield* readBodyBytes(request);
  const replay = new Request(request, { body: bytes, method: request.method });
  if (request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) {
    return yield* Effect.tryPromise({
      try: () => replay.formData(),
      catch: (cause) => bodyReadError("Failed to read the Server Function request body.", cause),
    });
  }

  return yield* Effect.tryPromise({
    try: () => replay.text(),
    catch: (cause) => bodyReadError("Failed to read the Server Function request body.", cause),
  });
});

const prepareServerFnOperation = <ApplicationServices>(
  identity: EFFRONTIdentity<ApplicationServices>,
  action: (...args: ReadonlyArray<unknown>) => unknown,
  args: ReadonlyArray<unknown>,
) =>
  Effect.sync((): ServerFnOperation<ApplicationServices> => {
    const invocation = action(...args);
    const match = matchServerFnInvocation(invocation, identity);
    switch (match._tag) {
      case "Match":
        return {
          effect: normalizeServerFnFailure(match.effect),
          middleware: match.middleware,
        };
      case "IdentityMismatch":
        return {
          effect: Effect.die(
            new TypeError("Server Function was created by a different EFFRONT module."),
          ),
          middleware: NoMiddleware,
        };
      case "Native":
        return {
          effect: normalizeServerFnFailure(Effect.promise(() => Promise.resolve(invocation))),
          middleware: NoMiddleware,
        };
    }
  }).pipe(normalizeServerFnFailure);

const prepareClientServerFn = Effect.fnUntraced(function* <ApplicationServices>(
  request: Request,
  actionId: string,
  identity: EFFRONTIdentity<ApplicationServices>,
) {
  const { createTemporaryReferenceSet, decodeReply, loadServerAction } = yield* Effect.promise(
    () => import("@vitejs/plugin-rsc/rsc/server"),
  );
  const temporaryReferences = createTemporaryReferenceSet();
  const body = yield* readBody(request);
  const decoded = yield* Effect.tryPromise({
    try: () =>
      decodeReply(body, {
        arraySizeLimit: ServerFnArraySizeLimit,
        temporaryReferences,
      }),
    catch: (cause) => requestError("Failed to decode Server Function arguments.", 400, cause),
  });
  const args = yield* decodeArguments(decoded).pipe(
    Effect.mapError((cause) =>
      requestError("Expected a Server Function argument array.", 400, cause),
    ),
  );
  const action = yield* Effect.tryPromise({
    try: () => loadServerAction(actionId),
    catch: (cause) => requestError("The requested Server Function does not exist.", 400, cause),
  });
  const operation = yield* prepareServerFnOperation(
    identity,
    action as (...args: ReadonlyArray<unknown>) => unknown,
    args,
  );

  const prepared: PreparedServerFnRequest<ApplicationServices> = {
    execute: serverFnOutcome(operation.effect).pipe(
      Effect.map(
        (outcome) =>
          ({
            formState: null,
            ...outcome,
            temporaryReferences,
          }) satisfies RequestOutcome,
      ),
    ),
    middleware: operation.middleware,
  };
  return prepared;
});

const prepareProgressiveServerFn = Effect.fnUntraced(function* <ApplicationServices>(
  request: Request,
  identity: EFFRONTIdentity<ApplicationServices>,
) {
  const { decodeAction, decodeFormState } = yield* Effect.promise(
    () => import("@vitejs/plugin-rsc/rsc/server"),
  );
  const body = yield* readBody(request);
  if (!(body instanceof FormData)) {
    return yield* bodyReadError(
      "Expected a multipart Server Function form body.",
      new Error("Expected FormData from a progressive Server Function request."),
    );
  }
  const formData = body;
  const decodedAction = yield* Effect.tryPromise({
    try: () => Promise.resolve(decodeAction(formData)),
    catch: (cause) => requestError("Failed to decode the Server Function form action.", 400, cause),
  });
  if (decodedAction === null) {
    return yield* requestError(
      "The submitted form does not contain a Server Function action.",
      400,
      new Error("decodeAction returned null."),
    );
  }

  const operation = yield* prepareServerFnOperation(identity, decodedAction, []);
  const execute = Effect.gen(function* () {
    const actionResult = yield* operation.effect.pipe(
      Effect.mapError((error) =>
        requestError("The Server Function form action failed.", 500, error.cause),
      ),
    );
    const decodedFormState = yield* Effect.tryPromise({
      try: () => decodeFormState(actionResult, formData),
      catch: (cause) => requestError("Failed to decode React form state.", 500, cause),
    });

    return {
      formState: decodedFormState ?? null,
      serverFnResult: null,
      status: 200,
    } satisfies RequestOutcome;
  });

  const prepared: PreparedServerFnRequest<ApplicationServices> = {
    execute,
    middleware: operation.middleware,
  };
  return prepared;
});

export const prepareServerFnRequest = Effect.fnUntraced(function* <Services>(
  request: HttpServerRequest.HttpServerRequest,
  identity: EFFRONTIdentity<Services>,
) {
  yield* validateOrigin(request);
  const signal = yield* Effect.abortSignal;
  const webRequest = yield* HttpServerRequest.toWeb(request, { signal });
  const actionId = request.headers[ServerFnIdHeader];
  const prepareRequest =
    actionId === undefined
      ? prepareProgressiveServerFn(webRequest, identity)
      : prepareClientServerFn(webRequest, actionId, identity);

  return yield* prepareRequest;
});

export type ServerFnRequestFailure = Effect.Error<ReturnType<typeof prepareServerFnRequest>>;

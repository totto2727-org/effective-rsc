import { Context, Effect, Layer } from "effect";
import { HttpRouter } from "effect/unstable/http";

import type { ApplicationDefinition } from "./application/definition";
import { ServerApplication } from "./server/application";

/**
 * Per-request values supplied by a Fetch host.
 *
 * Environment bindings intentionally stay in the Effect context. EFFRONT never adds
 * them to Flight or HTML payloads.
 */
export type WorkersRequestContext<Env, ExecutionContext> = {
  readonly env: Env;
  readonly executionContext: ExecutionContext;
  readonly request: Request;
};

export const WorkersRequestContext = Context.Reference<WorkersRequestContext<unknown, unknown>>(
  "effront/workers/WorkersRequestContext",
  {
    defaultValue: () => {
      throw new TypeError(
        "Workers request context is only available while handling a Fetch request.",
      );
    },
  },
);

/**
 * Creates typed readers for the existing request context, without creating a new service or Layer.
 * Types describe host-supplied values; they do not validate them at runtime.
 */
export const createWorkersContextAccessors = <Env = unknown, ExecutionContext = unknown>() => {
  const getWorkersRequestContext = () =>
    Effect.map(
      WorkersRequestContext,
      (context) => context as WorkersRequestContext<Env, ExecutionContext>,
    );

  const getWorkersEnv = () => Effect.map(getWorkersRequestContext(), (context) => context.env);

  return { getWorkersEnv, getWorkersRequestContext };
};

export const getWorkersEnv = <Env = unknown>() =>
  createWorkersContextAccessors<Env>().getWorkersEnv();

export const getWorkersRequestContext = <Env = unknown, ExecutionContext = unknown>() =>
  createWorkersContextAccessors<Env, ExecutionContext>().getWorkersRequestContext();

export type FetchHandler<Env = unknown, ExecutionContext = unknown> = (
  request: Request,
  env: Env,
  executionContext: ExecutionContext,
) => Promise<Response>;

const maxRequestBodySize = 10 * 1024 * 1024;

const bodyTooLarge = (request: Request) => {
  const length = request.headers.get("content-length");
  if (length === null) {
    return false;
  }
  const value = Number(length);
  return !Number.isSafeInteger(value) || value < 0 || value > maxRequestBodySize;
};

const releaseResponseBody = async (
  response: Response,
  release: () => Promise<void>,
): Promise<Response> => {
  if (response.body === null) {
    await release();
    return response;
  }

  let released = false;
  const releaseOnce = async () => {
    if (!released) {
      released = true;
      await release();
    }
  };
  const reader = response.body.getReader();
  const body = new ReadableStream<Uint8Array>({
    async cancel(reason) {
      try {
        await reader.cancel(reason);
      } finally {
        await releaseOnce();
      }
    },
    async pull(controller) {
      try {
        const result = await reader.read();
        if (result.done) {
          controller.close();
          await releaseOnce();
          return;
        }
        controller.enqueue(result.value);
      } catch (cause) {
        controller.error(cause);
        await releaseOnce();
      }
    },
  });

  return new Response(body, response);
};

/**
 * Creates a Workers-compatible Fetch handler.
 *
 * The application Layer is deliberately built for every request. This lets page
 * and middleware services read that request's environment bindings during layer
 * acquisition, and the resulting scope remains alive until the response body
 * reaches EOF, errors, or is cancelled.
 */
export const createFetchHandler =
  <Services, ApplicationError>(
    application: ApplicationDefinition<Services, ApplicationError>,
  ): FetchHandler =>
  async (request, env, executionContext) => {
    if (bodyTooLarge(request)) {
      return new Response("Request body exceeds the 10 MiB limit.", { status: 413 });
    }

    const requestContext: WorkersRequestContext<unknown, unknown> = {
      env,
      executionContext,
      request,
    };
    const { dispose, handler } = HttpRouter.toWebHandler(
      ServerApplication.httpLayer(application).pipe(
        Layer.provide(Layer.succeed(WorkersRequestContext, requestContext)),
      ),
      { disableLogger: true },
    );

    try {
      return await releaseResponseBody(
        await handler(request, Context.make(WorkersRequestContext, requestContext)),
        dispose,
      );
    } catch (cause) {
      await dispose();
      throw cause;
    }
  };

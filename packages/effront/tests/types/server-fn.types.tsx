import { Context, Effect, Option, Schema } from "effect";
import { useActionState } from "react";

import { Application } from "../../src/application/effront";

const EFFRONT = Application.effront();
const State = Schema.Struct({ count: Schema.Finite });
const Form = Schema.fromFormData(Schema.Struct({ name: Schema.NonEmptyString }));
const action = EFFRONT.ServerFn.make({
  input: [State, Form],
  handler: (previousState, form) => {
    const stateIsNotAny: 0 extends 1 & typeof previousState ? false : true = true;
    const formIsNotAny: 0 extends 1 & typeof form ? false : true = true;
    void stateIsNotAny;
    void formIsNotAny;
    const name: string = form.name;
    void name;
    return Effect.succeed({ count: previousState.count + 1 });
  },
});
const result: Promise<{ readonly count: number }> = action({ count: 0 }, new FormData());
void result;
// @ts-expect-error The caller sends encoded FormData, not the decoded record.
void action({ count: 0 }, { name: "Nikhil" });
// @ts-expect-error Argument order is fixed by input.
void action(new FormData(), { count: 0 });
// @ts-expect-error Both arguments are required.
void action({ count: 0 });
// @ts-expect-error The declaration has exactly two arguments.
void action({ count: 0 }, new FormData(), "extra");

function ActionForm() {
  const [state, formAction] = useActionState(action, { count: 0 });
  return <form action={formAction}>{state.count}</form>;
}
void ActionForm;

const transformed = EFFRONT.ServerFn.make({
  input: [Schema.FiniteFromString, Schema.String] as const,
  handler: Effect.fn(function* (count, text) {
    const value: number = count;
    return yield* Effect.succeed(`${value}:${text}`);
  }),
});
const bound: (text: string) => Promise<string> = transformed.bind(null, "2");
void bound;
// @ts-expect-error Caller uses the encoded number string.
void transformed(2, "text");

const tuple = EFFRONT.ServerFn.make({
  input: Schema.Tuple([Schema.String, Schema.Finite]),
  handler: Effect.succeed,
});
void tuple(["text", 2]);
// @ts-expect-error A Tuple Schema still describes one argument.
void tuple("text", 2);
const noArgs = EFFRONT.ServerFn.make({ input: [], handler: () => Effect.void });
void noArgs();
// @ts-expect-error An empty schema list declares no arguments.
void noArgs("extra");

class DecoderService extends Context.Service<DecoderService, object>()(
  "effront/tests/types/server-fn/DecoderService",
) {}
const ServiceSchema = Schema.String.pipe(
  Schema.catchDecodingWithContext(() => Effect.map(DecoderService, () => Option.some("fallback"))),
);
EFFRONT.ServerFn.make({
  // @ts-expect-error Every positional decoder must fit the service universe.
  input: [Schema.String, ServiceSchema],
  handler: () => Effect.void,
});
const ProvideDecoder = EFFRONT.Middleware.make<{ provides: DecoderService }>((operation) =>
  operation.pipe(Effect.provideService(DecoderService, {})),
);
EFFRONT.withMiddleware(ProvideDecoder).ServerFn.make({
  input: [Schema.String, ServiceSchema],
  handler: (first, second) => Effect.succeed(first + second),
});

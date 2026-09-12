import { describe, expect, it } from "@effect/vitest";

import { Application } from "./effront";

const EFFRONT = Application.effront();

describe("EFFRONT.Loading.make", () => {
  it("runs the synchronous fallback renderer", () => {
    const render = () => <p>Loading...</p>;
    const RootLoading = EFFRONT.Loading.make({ render });

    expect(RootLoading()).toEqual(<p>Loading...</p>);
  });
});

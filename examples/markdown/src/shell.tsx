"use client";

import { useState, type ReactNode } from "react";
import "./styles.css";

export function Shell({ children }: { readonly children: ReactNode }) {
  const [count, setCount] = useState(0);
  return (
    <>
      <header>
        <a href="/manual">Markdown manual</a>
        <button type="button" onClick={() => setCount((value) => value + 1)}>
          Count: {count}
        </button>
      </header>
      <main>{children}</main>
    </>
  );
}

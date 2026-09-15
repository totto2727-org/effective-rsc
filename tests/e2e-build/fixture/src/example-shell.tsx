"use client";

import { useState, type ReactNode } from "react";
import { Counter } from "./counter";
import "./styles.css";

export function PageNote() {
  const [note, setNote] = useState("");
  return (
    <p>
      <label>
        Page note <input value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
    </p>
  );
}

export function ExampleShell({ children }: { readonly children: ReactNode }) {
  return (
    <>
      <nav>
        <a href="/">Home</a> <a href="/about">About</a>
        <a href="/transitions/default-a">Page transitions</a>
      </nav>
      <main>{children}</main>
    </>
  );
}

export function TransitionExampleLayout({ children }: { readonly children: ReactNode }) {
  return (
    <>
      <aside aria-label="Persistent transition layout">
        <h2>Page transitions</h2>
        <p>This counter belongs to the layout and stays mounted while the page changes.</p>
        <Counter />
        <nav aria-label="Transition examples">
          <a href="/transitions/default-a">Default transition</a>
          <a href="/transitions/custom-a">Custom transition</a>
          <a href="/transitions/typed-a">Link-selected transition</a>
          <a href="/transitions/disabled-a">Disabled transition</a>
        </nav>
      </aside>
      {children}
    </>
  );
}

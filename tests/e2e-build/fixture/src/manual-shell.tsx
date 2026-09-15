"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Counter } from "./counter";

import { pages } from "./manual-pages";

export function ManualShell({
  children,
  pathname,
}: {
  readonly children: ReactNode;
  readonly pathname: string;
}) {
  const [query, setQuery] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    dialog.current?.close();
  }, [children]);
  const current = pages.findIndex((page) => page.href === pathname);
  const links = pages.filter((page) =>
    page.title.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const navigation = (
    <>
      <label>
        ガイドを絞り込む
        <input value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <div data-sidebar="content">
        {links.map((page) => (
          <a
            key={page.href}
            href={page.href}
            data-sidebar="menu-button"
            aria-current={page.href === pathname ? "page" : undefined}
            onClick={() => dialog.current?.close()}
          >
            {page.title}
          </a>
        ))}
      </div>
    </>
  );
  return (
    <section className="manual-layout">
      <header className="manual-toolbar">
        <Counter />
        <button className="mobile-toggle" ref={toggle} onClick={() => dialog.current?.showModal()}>
          Toggle Sidebar
        </button>
      </header>
      <aside data-sidebar="sidebar" aria-label="Manual sidebar">
        {navigation}
      </aside>
      <dialog ref={dialog} aria-label="Manual navigation" onClose={() => toggle.current?.focus()}>
        {navigation}
      </dialog>
      <div className="manual-body">
        <nav aria-label="パンくずリスト">
          <a href="/manual">Manual</a>
          <span aria-current="page">{pages[current]?.title}</span>
        </nav>
        {children}
        <nav aria-label="前後のページ">
          {pages[current - 1] && <a href={pages[current - 1]?.href}>前のページ</a>}
          {pages[current + 1] && <a href={pages[current + 1]?.href}>次のページ</a>}
        </nav>
        <aside aria-label="このページ内">
          <a
            href={
              pathname === "/manual"
                ? "#features"
                : pathname.endsWith("getting-started")
                  ? "#installation"
                  : "#details"
            }
          >
            Section
          </a>
        </aside>
      </div>
    </section>
  );
}

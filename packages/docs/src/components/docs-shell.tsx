"use client";

import * as React from "react";
import { ArrowLeftIcon, ArrowRightIcon, ExternalLinkIcon, SearchIcon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "./ui/sidebar";

type NavigationItem = Readonly<{ slug: string; title: string; section: string }>;
type Heading = Readonly<{ id: string; title: string }>;

export type DocsShellProps = Readonly<{
  current: NavigationItem;
  navigation: readonly NavigationItem[];
  headings: readonly Heading[];
  children: React.ReactNode;
}>;

function DocsNavigation({ current, navigation }: Pick<DocsShellProps, "current" | "navigation">) {
  const [query, setQuery] = React.useState("");
  const { setOpenMobile } = useSidebar();
  const filtered = navigation.filter((item) =>
    item.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  const sections = [...new Set(filtered.map((item) => item.section))];

  return (
    <>
      <SidebarHeader>
        <a
          href="/"
          className="rounded-md px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <span className="block font-mono text-sm font-semibold tracking-tight">
            effective-rsc
          </span>
          <span className="block pt-0.5 text-xs text-sidebar-foreground/60">Workers edition</span>
        </a>
        <label className="relative block px-1">
          <span className="sr-only">ガイドを絞り込む</span>
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-2.5 left-3 size-3.5 text-muted-foreground"
          />
          <SidebarInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ガイドを検索"
            className="pl-7"
          />
        </label>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        {sections.map((section) => (
          <SidebarGroup key={section}>
            <SidebarGroupLabel>{section}</SidebarGroupLabel>
            <SidebarMenu>
              {filtered
                .filter((item) => item.section === section)
                .map((item) => {
                  const active = item.slug === current.slug;
                  return (
                    <SidebarMenuItem key={item.slug}>
                      <SidebarMenuButton asChild isActive={active}>
                        <a
                          href={item.slug}
                          aria-current={active ? "page" : undefined}
                          onClick={() => setOpenMobile(false)}
                        >
                          {item.title}
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
        {filtered.length === 0 && (
          <p className="px-5 py-4 text-sm text-sidebar-foreground/60">
            一致するガイドはありません。
          </p>
        )}
      </SidebarContent>
      <SidebarFooter>
        <a
          className="flex items-center gap-2 rounded-md px-2 py-2 text-xs text-sidebar-foreground/65 outline-none hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          href="https://github.com/nikhilsnayak/effective-rsc"
          target="_blank"
          rel="noreferrer"
        >
          GitHub <ExternalLinkIcon aria-hidden="true" className="size-3" />
        </a>
        <a
          className="flex items-center gap-2 rounded-md px-2 py-2 text-xs text-sidebar-foreground/65 outline-none hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          href="https://github.com/nikhilsnayak/effective-rsc/blob/main/docs/ARCHITECTURE.md"
          target="_blank"
          rel="noreferrer"
        >
          Advanced architecture <ExternalLinkIcon aria-hidden="true" className="size-3" />
        </a>
        <a
          className="flex items-center gap-2 rounded-md px-2 py-2 text-xs text-sidebar-foreground/65 outline-none hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          href="https://github.com/nikhilsnayak/effective-rsc/tree/main/packages/effective-rsc/src"
          target="_blank"
          rel="noreferrer"
        >
          Upstream API source <ExternalLinkIcon aria-hidden="true" className="size-3" />
        </a>
      </SidebarFooter>
    </>
  );
}

function PreviousNext({ current, navigation }: Pick<DocsShellProps, "current" | "navigation">) {
  const index = navigation.findIndex((item) => item.slug === current.slug);
  const previous = index > 0 ? navigation[index - 1] : undefined;
  const next = index >= 0 && index < navigation.length - 1 ? navigation[index + 1] : undefined;
  if (!previous && !next) return null;
  return (
    <nav
      aria-label="前後のページ"
      className="mt-16 grid gap-3 border-t border-border pt-7 sm:grid-cols-2"
    >
      {previous ? (
        <a
          href={previous.slug}
          className="group rounded-lg border border-border p-4 outline-none hover:border-foreground/25 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <ArrowLeftIcon className="size-3" /> 前のページ
          </span>
          <span className="mt-1 block font-medium group-hover:text-emerald-700">
            {previous.title}
          </span>
        </a>
      ) : (
        <span />
      )}
      {next && (
        <a
          href={next.slug}
          className="group rounded-lg border border-border p-4 text-right outline-none hover:border-foreground/25 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
            次のページ <ArrowRightIcon className="size-3" />
          </span>
          <span className="mt-1 block font-medium group-hover:text-emerald-700">{next.title}</span>
        </a>
      )}
    </nav>
  );
}

export function DocsShell({ current, navigation, headings, children }: DocsShellProps) {
  return (
    <SidebarProvider defaultOpen>
      <a href="#main-content" className="skip-link">
        本文へ移動
      </a>
      <Sidebar>
        <DocsNavigation current={current} navigation={navigation} />
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-15 items-center gap-3 border-b border-border/80 bg-background/90 px-4 backdrop-blur md:px-8">
          <SidebarTrigger aria-label="Toggle Sidebar" className="md:hidden" />
          <div className="min-w-0">
            <p className="truncate text-xs text-muted-foreground">
              <a
                href="/"
                className="rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                ドキュメント
              </a>
              <span aria-hidden="true"> / </span>
              {current.section}
            </p>
            <p className="truncate text-sm font-medium text-foreground">{current.title}</p>
          </div>
        </header>
        <div className="mx-auto grid w-full max-w-[90rem] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_11rem]">
          <main id="main-content" className="min-w-0 px-5 py-10 sm:px-8 sm:py-14 lg:px-14">
            <div className="max-w-3xl">{children}</div>
            <PreviousNext current={current} navigation={navigation} />
          </main>
          <aside
            aria-label="このページ内"
            className="hidden border-l border-border/70 px-6 py-14 lg:block"
          >
            {headings.length > 0 && (
              <nav className="sticky top-23">
                <p className="mb-3 text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                  このページ内
                </p>
                <ol className="space-y-2 border-l border-border text-sm">
                  {headings.map((heading) => (
                    <li key={heading.id}>
                      <a
                        className="block -ml-px border-l border-transparent py-0.5 pl-3 text-muted-foreground outline-none hover:border-emerald-600 hover:text-foreground focus-visible:border-emerald-600 focus-visible:text-foreground"
                        href={`#${heading.id}`}
                      >
                        {heading.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            )}
          </aside>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

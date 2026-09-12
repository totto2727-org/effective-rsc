import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { DocsShell, type DocsShellProps } from "./docs-shell";

const introduction = { slug: "/guide", title: "はじめに", section: "Guide" };
const chapter = {
  slug: "/architecture/implementation/runtime",
  title: "ランタイムとリクエストのライフサイクル",
  section: "アーキテクチャ",
  group: "実装解説",
};
const nextChapter = { ...chapter, slug: "/architecture/implementation/flight", title: "Flight" };
const navigation = [introduction, chapter, nextChapter];

function render(current: DocsShellProps["current"]) {
  return renderToStaticMarkup(
    <DocsShell current={current} navigation={navigation} headings={[]}>
      <h1>{current.title}</h1>
    </DocsShell>,
  );
}

describe("documentation hierarchy", () => {
  it("nests metadata-defined chapters once under their group and marks the active link", () => {
    const html = render(chapter);
    const sidebar = html.split('<header class="sticky')[0]!;
    expect(sidebar).toMatch(
      /<ul[^>]+aria-label="アーキテクチャ"><li[^>]*><span[^>]*>実装解説<\/span><ul/,
    );
    expect(sidebar.match(/aria-label="実装解説"/g)).toHaveLength(1);
    expect(sidebar).toContain(`href="${chapter.slug}" aria-current="page"`);
    expect(sidebar).toContain(`href="${nextChapter.slug}"`);
    expect(sidebar).toMatch(/aria-label="Guide"><li[^>]*><a/);
    expect(sidebar).toContain("h-auto");
  });

  it("renders an ordered breadcrumb including only the current page's ancestors", () => {
    const grouped = render(chapter).match(
      /<nav aria-label="パンくずリスト"[^>]*>(.*?)<\/nav>/,
    )?.[1];
    expect(grouped).toMatch(/<ol.*アーキテクチャ.*実装解説.*aria-current="page".*ランタイム/);
    const ungrouped = render(introduction).match(
      /<nav aria-label="パンくずリスト"[^>]*>(.*?)<\/nav>/,
    )?.[1];
    expect(ungrouped).toContain("Guide");
    expect(ungrouped).not.toContain("実装解説");
  });

  it("preserves no-JavaScript chapter links and the official upstream footer", () => {
    const html = render(chapter);
    const fallback = html.match(/<noscript>(.*?)<\/noscript>/)?.[1];
    expect(fallback).toContain(`href="${chapter.slug}" aria-current="page"`);
    expect(fallback).toContain(`アーキテクチャ: 実装解説: ${chapter.title}`);
    expect(html).toContain('href="https://effective-rsc.nikhilsnayak.dev/"');
    expect(html).not.toContain("github.com");
  });
});

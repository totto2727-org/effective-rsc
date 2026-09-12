import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";

const BrowserFailureStyles = `
  .effront-browser-failure,
  .effront-browser-failure * {
    box-sizing: border-box;
  }

  .effront-browser-failure {
    position: fixed;
    inset: 0;
    z-index: 2147483645;
    display: grid;
    min-width: 280px;
    min-height: 100svh;
    padding: 32px;
    overflow: auto;
    color: #20201e;
    color-scheme: light;
    background: #f5f4f0;
    font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    place-items: center;
  }

  .effront-browser-failure__content {
    width: min(100%, 520px);
  }

  .effront-browser-failure__icon {
    display: grid;
    width: 44px;
    height: 44px;
    margin-bottom: 24px;
    color: #c9342e;
    background: #eee0dc;
    border: 1px solid #e3c7c2;
    border-radius: 9px;
    place-items: center;
  }

  .effront-browser-failure__icon svg {
    width: 22px;
    height: 22px;
  }

  .effront-browser-failure h1 {
    max-width: 460px;
    margin: 0;
    color: #20201e;
    font-size: clamp(32px, 6vw, 44px);
    font-weight: 650;
    line-height: 1.05;
    letter-spacing: -.045em;
  }

  .effront-browser-failure__message {
    max-width: 440px;
    margin: 18px 0 0;
    color: #696761;
    font-size: 15px;
    line-height: 1.65;
  }

  .effront-browser-failure__rule {
    height: 1px;
    margin: 34px 0 20px;
    background: #dcdad3;
    border: 0;
  }

  .effront-browser-failure__reload {
    display: inline-flex;
    min-height: 40px;
    gap: 9px;
    align-items: center;
    justify-content: center;
    padding: 0 15px;
    color: #f8f8f6;
    cursor: pointer;
    background: #242422;
    border: 1px solid #242422;
    border-radius: 7px;
    box-shadow: 0 1px 1px rgb(0 0 0 / 12%);
    font: 600 13px/1 ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    transition:
      background-color 140ms ease,
      transform 140ms cubic-bezier(.23, 1, .32, 1);
  }

  .effront-browser-failure__reload svg {
    width: 15px;
    height: 15px;
  }

  .effront-browser-failure__reload:focus-visible {
    outline: 2px solid #c9342e;
    outline-offset: 3px;
  }

  .effront-browser-failure__reload:active {
    transform: scale(.97);
  }

  @media (hover: hover) and (pointer: fine) {
    .effront-browser-failure__reload:hover {
      background: #3a3936;
    }
  }

  @media (max-width: 480px) {
    .effront-browser-failure {
      padding: 24px;
      place-items: start center;
    }

    .effront-browser-failure__content {
      margin-top: max(32px, 10vh);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .effront-browser-failure__reload {
      transition-duration: 0ms;
    }
  }
`;

export function BrowserFailureScreen() {
  return (
    <main aria-labelledby="effront-browser-failure-title" className="effront-browser-failure">
      <style>{BrowserFailureStyles}</style>
      <div className="effront-browser-failure__content">
        <div aria-hidden="true" className="effront-browser-failure__icon">
          <svg fill="none" viewBox="0 0 22 22">
            <path d="M11 6.25v5.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
            <circle cx="11" cy="15.25" fill="currentColor" r=".9" />
            <path
              d="M8.93 3.33 2.18 15a2.4 2.4 0 0 0 2.08 3.6h13.48a2.4 2.4 0 0 0 2.08-3.6L13.07 3.33a2.4 2.4 0 0 0-4.14 0Z"
              stroke="currentColor"
              strokeWidth="1.7"
            />
          </svg>
        </div>
        <h1 id="effront-browser-failure-title">Something went wrong</h1>
        <p className="effront-browser-failure__message">
          This page couldn’t be displayed. Try reloading it.
        </p>
        <hr className="effront-browser-failure__rule" />
        <button
          className="effront-browser-failure__reload"
          type="button"
          onClick={() => window.location.reload()}
        >
          <svg aria-hidden="true" fill="none" viewBox="0 0 16 16">
            <path
              d="M13 5.5A5.5 5.5 0 1 0 13.15 10M13 2.75V5.5h-2.75"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.4"
            />
          </svg>
          Reload page
        </button>
      </div>
    </main>
  );
}

const renderBrowserScreen = (screen: ReactNode) => {
  const container = document.createElement("div");
  document.body.replaceChildren(container);
  createRoot(container).render(screen);
};

export const showBrowserFailure = () => renderBrowserScreen(<BrowserFailureScreen />);

# Effront

Effront is a React meta-framework built on Web standards and Effect.
Its Request/Response and Web Stream boundaries are designed for integration with execution environments and existing frameworks through compatible host adapters.
This describes an integration boundary, not a claim that every host or bundler is supported.

## Application model

Build an application from one `Application.effront()` identity using Page, Layout, Routes, Component, Middleware, and Server Function.
Provide required services with the application's Effect Layer.
The runtime keeps request resources alive until the response body completes, fails, or is cancelled.
RSC produces Flight, SSR produces initial HTML, and the browser hydrates and navigates the application.

## Package boundaries

- `effront`: application APIs and the Fetch runtime.
- `@effront/vite`: RSC/SSR/browser build integration and the native React Compiler.
- Host adapters add execution-environment integration separately.

`src/entry.client.ts` exports the application definition, usually from `application.tsx`.
`src/entry.server.ts` supplies the host entry.
The Vite integration provides browser hydration and SSR entry points.
The application definition is not a browser-only module despite the client entry filename.

## Documentation

- Common guides cover application structure, routing, components, services, and testing.
- Host setup and supported environments are isolated under the site's **Platforms** section.
- [Host architecture and current support](../../docs/WORKERS.md) documents the implemented adapter rather than imposing its setup on every application.
- [Roadmap](../../docs/ROADMAP.md) records deferred work, including Page View Transitions.
- [Code-reading provenance](../../docs/UPSTREAM.md) identifies the exact upstream and comparison commits.

The core currently uses the Vite RSC runtime protocol; alternative build integrations are not claimed to work without additional integration.
The `internal/*` exports support matching integration packages and are not application authoring APIs.

## Installation

In a VitePlus-managed application, install from the npm registry:

```sh
vp add effront
vp add -D @effront/vite @vitejs/plugin-rsc
```

Use React and Effect versions compatible with the installed package's peer dependencies.
Add the host adapter described in the Platforms documentation, then start your application with `vp dev`.

Repository development and browser acceptance commands are documented in [the contributor instructions](../../AGENTS.md), not prerequisites for consuming the package.

Effront retains the history and licensing of [nikhilsnayak/effective-rsc](https://github.com/nikhilsnayak/effective-rsc).

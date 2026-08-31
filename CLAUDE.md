# casehub-pages

## Project Type

type: ts

## Repository Role

Web application framework for the CaseHub platform — TypeScript runtime for composing applications from layouts, data pipelines, visualization, forms, hosted components, and inter-component communication.

**Tier:** Integration (UI layer consumed by application-tier repos)

## Documentation

This repo owns its own documentation, synced to parent via subtree:
- `docs/guides/consumer-guide.md` — for app builders: web components, data pipelines, layout, push protocol
- `docs/guides/contributor-guide.md` — for contributors: package architecture, build system, extension points

Update the relevant guide in the same session when implementation changes components, APIs, or protocols. Do not defer — drift compounds. Parent (`casehubio/parent`) aggregates these at `docs/repos/casehub-pages/` for RAG retrieval.

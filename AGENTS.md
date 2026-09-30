# AGENTS.md

## The algebra lives in `spec/manifest.hs`

The system's contract — every component's type signature and how they compose — is
defined as Haskell in [`spec/manifest.hs`](spec/manifest.hs). It is a *signature-level*
spec: it is not compiled and has no runtime. It exists because Haskell's types state the
algebra more precisely than the JavaScript can, and it is the single place to review the
whole system at a glance.

**It drives development.** The manifest is the source of truth; `src/` is the
implementation of it. When changing behavior:

1. Change the types in `spec/manifest.hs` first. Get the shape right there.
2. Implement `src/` to match. Names, arities, and effect boundaries should line up.
3. Keep them in sync. A divergence between the manifest and the code is a bug in one
   of them — fix it, don't let it drift.

If a design question comes up, answer it in the manifest before writing JS.

## Reading the manifest

Effects and partiality are encoded, not commented:

- `IO a` — touches the filesystem, stdin, or stdout.
- `Either Error a` — the implementation `throw`s on this path.
- `Maybe a` — the implementation returns `null`/`undefined` on this path.
- `Stream a` — an async, single-pass sequence (a Node `Readable` / async generator).

The manifest is layered: RDF core → stream carriers → formats → sources → transforms →
sinks → the `Cmd` stream algebra (the CLI verbs, kind-indexed) → the `Operation`/`Envelope`
pipeline (the library composition layer with provenance).

[`spec/claim.md`](spec/claim.md) gives the design rationale for claimers.

## Docs are generated

The command diagram and command table in `readme.md` are generated from the `Cmd`
algebra and the command metadata (`meta.description`, first sentence = purpose).
After a change to either, run `node scripts/docs.js`. `pnpm lint` fails when the
readme is out of date. The smoke test runs every code block under `## Recipes`.

## Conventions

- **Slim over complete.** Each component is one honest signature at the manifest's
  altitude. Do not surface internal variants or alternate forms just because they are
  exported — collapse to the essential operation.
- **No back-compat.** This is pre-1.0; redesign freely. Prefer deleting a wart to
  wrapping it.
- **Verify by driving.** Run the affected pipeline end to end and observe behavior, not
  just the unit tests. `pnpm test` runs `node --test` plus `tests/smoke.sh`.
- Use `pnpm`, not `npm`.

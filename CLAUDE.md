# CLAUDE.md

A JavaScript GitHub Action that copies, updates, and removes files across many repositories.

## Layout

- `lib/` holds the source. `lib/index.js` is the entrypoint.
- `dist/index.js` is the committed ncc bundle that GitHub actually runs. Never edit it by hand.
- `action.yml` holds the inputs and the `runs.using` runtime pin.

## Commands

- `npm install --legacy-peer-deps` installs. Plain `npm ci` fails, because `eslint-plugin-sonarjs@0.5.0` accepts eslint 6 at the latest while `package.json` specifies eslint 7.
- `npm test` runs eslint, then jest.
- `npm run package` rebuilds `dist/index.js`.
- `npm run gen-readme-toc` rebuilds the README table of contents after you add a heading.

Smoke test the bundle without a real workflow:

```bash
GITHUB_EVENT_NAME=push GITHUB_EVENT_PATH="$PWD/test/fake-event.json" \
  GITHUB_REPOSITORY=owner/repo node dist/index.js
```

It should reach `Input required and not supplied: github_token`. That is the expected stop when no inputs are supplied.

## Gotchas

- Every change under `lib/` needs `dist/index.js` rebuilt and committed. The `pre-commit` hook does both. Only skip it with `--no-verify` when no source file changed.
- The version in `package.json` is stale and unused. Git tags carry the real version.
- Keep the README examples on the same major version as the newest tag.

## Releasing

Releases are manual and there is no workflow for them. Tag the point release and move the floating major, because the README tells users to reference `@v3`:

```bash
git tag v3.0.1 && git push origin v3.0.1
git tag -f v3  && git push -f origin v3
gh release create v3.0.1 --title v3.0.1 --notes "..."
```

Bump the major version when `runs.using` changes. Each Node runtime has a minimum self-hosted runner version, so a runtime bump breaks anyone running an older runner.

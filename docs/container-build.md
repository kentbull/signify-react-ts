# Container build

The Docker image runs the wallet used by a KERIA+Signify W3C crosswalk stack. 
It builds from this repository plus package/image inputs.

## `SIGNIFY_TS_PACKAGE` Docker build env var customization of 'signify-ts' dependency

`SIGNIFY_TS_PACKAGE` is an optional Docker build argument that replaces the
`signify-ts` dependency in `package.json` before `pnpm install` runs:

```bash
docker build \
  --build-arg SIGNIFY_TS_PACKAGE='git+https://github.com/kentbull/signify-ts.git#<sha>' \
  -t kentbull/signify-react-ts:<sha> .
```

The override is handled by
[`scripts/set-signify-ts-package.mjs`](../scripts/set-signify-ts-package.mjs).

The helper only rewrites the copied `package.json` inside the Docker build
context. It does not modify the working tree and does not regenerate
`pnpm-lock.yaml`. Because the Dockerfile uses `pnpm install --frozen-lockfile`,
the checked-in lockfile must already be compatible with the requested
`SIGNIFY_TS_PACKAGE`.

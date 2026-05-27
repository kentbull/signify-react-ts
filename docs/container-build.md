# Container build

The Docker image runs the wallet used by a KERIA+Signify W3C crosswalk stack. 
It builds from this repository plus package/image inputs.

## Build and publish

Use the repo-owned Make targets to build or publish the wallet image:

```bash
make docker-build
make docker-publish
```

The defaults are:

| Variable                  | Default                      |
|---------------------------|------------------------------|
| `CONTAINER_ENGINE`        | `docker`                     |
| `DOCKER_IMAGE_REPOSITORY` | `kentbull/signify-react-ts`  |
| `DOCKER_IMAGE_TAG`        | current `git rev-parse HEAD` |
| `DOCKER_LATEST_TAG`       | `latest`                     |

`docker-build` tags both `DOCKER_IMAGE_REPOSITORY:DOCKER_IMAGE_TAG` and
`DOCKER_IMAGE_REPOSITORY:DOCKER_LATEST_TAG`. `docker-publish` builds and pushes
both tags.

## `SIGNIFY_TS_PACKAGE`

`SIGNIFY_TS_PACKAGE` is an optional Docker build input that replaces the
`signify-ts` dependency in `package.json` before `pnpm install` runs:

```bash
make docker-build \
  SIGNIFY_TS_PACKAGE='git+https://github.com/kentbull/signify-ts.git#<sha>'
```

The override is passed through to the Docker build and handled by
[`scripts/set-signify-ts-package.mjs`](../scripts/set-signify-ts-package.mjs).

The helper only rewrites the copied `package.json` inside the Docker build
context. It does not modify the working tree and does not regenerate
`pnpm-lock.yaml`. Because the Dockerfile uses `pnpm install --frozen-lockfile`,
the checked-in lockfile must already be compatible with the requested
`SIGNIFY_TS_PACKAGE`.

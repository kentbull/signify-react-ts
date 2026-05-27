#!/usr/bin/env bash
set -euo pipefail

command="${1:-build}"

container_engine="${CONTAINER_ENGINE:-docker}"
image_repository="${DOCKER_IMAGE_REPOSITORY:-kentbull/signify-react-ts}"
image_tag="${DOCKER_IMAGE_TAG:-$(git rev-parse HEAD)}"
latest_tag="${DOCKER_LATEST_TAG:-latest}"
dockerfile="${DOCKERFILE:-Dockerfile}"
build_context="${DOCKER_BUILD_CONTEXT:-.}"

version_image="${image_repository}:${image_tag}"
latest_image="${image_repository}:${latest_tag}"

build_image() {
  local args=(
    build
    -f "$dockerfile"
    -t "$version_image"
    -t "$latest_image"
  )

  if [[ -n "${SIGNIFY_TS_PACKAGE:-}" ]]; then
    args+=(--build-arg "SIGNIFY_TS_PACKAGE=$SIGNIFY_TS_PACKAGE")
  fi

  args+=("$build_context")
  "$container_engine" "${args[@]}"
}

push_image() {
  "$container_engine" push "$version_image"
  "$container_engine" push "$latest_image"
}

case "$command" in
  build)
    build_image
    ;;
  push)
    push_image
    ;;
  publish)
    build_image
    push_image
    ;;
  *)
    echo "usage: $0 {build|push|publish}" >&2
    exit 2
    ;;
esac

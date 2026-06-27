CONTAINER_ENGINE ?= docker
DOCKER_IMAGE_REPOSITORY ?= kentbull/signify-react-ts
DOCKER_IMAGE_TAG ?= $(shell git rev-parse HEAD)
DOCKER_LATEST_TAG ?= latest
DOCKERFILE ?= Dockerfile
DOCKER_BUILD_CONTEXT ?= .
SIGNIFY_TS_PACKAGE ?=

.PHONY: help docker-build docker-push docker-publish

help: ## Show available maintainer tasks
	@awk 'BEGIN {FS = ":.*## "}; /^[a-zA-Z0-9_-]+:.*## / {printf "%-18s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

docker-build: ## Build Docker Hub SHA and latest tags for the wallet image
	@CONTAINER_ENGINE="$(CONTAINER_ENGINE)" \
		DOCKER_IMAGE_REPOSITORY="$(DOCKER_IMAGE_REPOSITORY)" \
		DOCKER_IMAGE_TAG="$(DOCKER_IMAGE_TAG)" \
		DOCKER_LATEST_TAG="$(DOCKER_LATEST_TAG)" \
		DOCKERFILE="$(DOCKERFILE)" \
		DOCKER_BUILD_CONTEXT="$(DOCKER_BUILD_CONTEXT)" \
		SIGNIFY_TS_PACKAGE="$(SIGNIFY_TS_PACKAGE)" \
		bash scripts/container-image.sh build

docker-push: ## Push Docker Hub SHA and latest tags for the wallet image
	@CONTAINER_ENGINE="$(CONTAINER_ENGINE)" \
		DOCKER_IMAGE_REPOSITORY="$(DOCKER_IMAGE_REPOSITORY)" \
		DOCKER_IMAGE_TAG="$(DOCKER_IMAGE_TAG)" \
		DOCKER_LATEST_TAG="$(DOCKER_LATEST_TAG)" \
		bash scripts/container-image.sh push

docker-publish: docker-build docker-push ## Build and push Docker Hub wallet image tags

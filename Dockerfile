FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends chromium ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable \
    && corepack prepare pnpm@10.33.0 --activate

ARG SIGNIFY_TS_PACKAGE
ENV PUPPETEER_SKIP_DOWNLOAD=1
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Portable stack builds can pin signify-ts to an immutable Git/package input
# without editing the checked-in package.json. Keep the mutation in a source
# file so the build policy is reviewable and testable outside Docker.
COPY scripts/set-signify-ts-package.mjs scripts/set-signify-ts-package.mjs
RUN node scripts/set-signify-ts-package.mjs
RUN pnpm install --frozen-lockfile

COPY . .

ENV HOST=0.0.0.0
ENV PORT=5177

EXPOSE 5177

CMD ["pnpm", "dev", "--host", "0.0.0.0", "--port", "5177"]

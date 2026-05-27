#!/usr/bin/env node
/**
 * Apply the Docker-only signify-ts dependency override. Intended to be run by
 * an outer build orchestrator script.
 *
 * The W3C crosswalk stack builds this wallet image from a pinned
 * signify-react-ts commit while also pinning signify-ts independently. The
 * repository package.json keeps the default dependency for normal development;
 * Docker builds may pass SIGNIFY_TS_PACKAGE to test or publish a wallet image
 * against a different immutable signify-ts package, tarball, or Git SHA.
 *
 * This script runs before `pnpm install --frozen-lockfile` in the Dockerfile.
 * That means the override must already be compatible with the copied lockfile;
 * the script intentionally rewrites only package.json and does not regenerate
 * package-manager state inside the image build.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const packageOverride = process.env.SIGNIFY_TS_PACKAGE;

if (!packageOverride) {
    process.exit(0);
}

const packagePath = 'package.json';
const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
packageJson.dependencies ??= {};
packageJson.dependencies['signify-ts'] = packageOverride;

writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 4)}\n`);

import { defineConfig } from 'vitest/config';
import wasm from 'vite-plugin-wasm';
import { fileURLToPath, URL } from 'node:url';

const signifyTsSource = fileURLToPath(
    new URL('../signify-ts/src/index.ts', import.meta.url)
);

export default defineConfig({
    plugins: [wasm()],
    resolve: {
        alias: [{ find: /^signify-ts$/, replacement: signifyTsSource }],
    },
    test: {
        environment: 'node',
        fileParallelism: false,
        hookTimeout: 180_000,
        testTimeout: 180_000,
    },
});

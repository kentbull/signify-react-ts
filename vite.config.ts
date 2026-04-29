import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import { fileURLToPath, URL } from 'node:url';

const signifyTsSource = fileURLToPath(
    new URL('../signify-ts/src/index.ts', import.meta.url)
);

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react(), wasm()],
    resolve: {
        alias: [{ find: /^signify-ts$/, replacement: signifyTsSource }],
    },
    server: {
        host: '127.0.0.1',
        port: 5173,
    },
});

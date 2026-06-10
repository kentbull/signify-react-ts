import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = join(process.cwd(), 'src');
const didWebsEndpointLiteral = /['"`]\/didwebs\//;

const sourceFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
        const path = join(dir, entry);
        const stat = statSync(path);
        if (stat.isDirectory()) {
            return sourceFiles(path);
        }
        return /\.(ts|tsx)$/.test(entry) ? [path] : [];
    });

describe('did:webs endpoint usage', () => {
    it('does not call removed did:webs admin endpoints from app source', () => {
        const forbidden = sourceFiles(sourceRoot).flatMap((path) => {
            const text = readFileSync(path, 'utf8');
            return text
                .split('\n')
                .map((line, index) => ({ line, index: index + 1 }))
                .filter(({ line }) => didWebsEndpointLiteral.test(line))
                .map(
                    ({ line, index }) =>
                        `${relative(process.cwd(), path)}:${index}: ${line.trim()}`
                );
        });

        expect(forbidden).toEqual([]);
    });
});

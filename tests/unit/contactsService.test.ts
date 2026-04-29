import { describe, expect, it, vi } from 'vitest';
import type { SignifyClient } from 'signify-ts';
import { createAppRuntime } from '../../src/app/runtime';
import {
    generateIdentifierOobiService,
    readIdentifierOobiService,
    type OobiRole,
} from '../../src/services/contacts.service';

const jsonResponse = (body: unknown): Response =>
    new Response(JSON.stringify(body), {
        headers: { 'Content-Type': 'application/json' },
    });

const makeClient = ({
    oobis = ['http://127.0.0.1:3902/oobi/Eaid/agent/Eagent'],
    existingEndRoles = [],
}: {
    oobis?: string[];
    existingEndRoles?: unknown[];
} = {}) => {
    const operation = { name: 'endrole.alice.agent' };
    const addEndRole = vi.fn(async () => ({
        op: vi.fn(async () => operation),
    }));
    const fetch = vi.fn(async () => jsonResponse(existingEndRoles));
    const getOobi = vi.fn(async (_identifier: string, _role: OobiRole) => ({
        oobis,
    }));
    const wait = vi.fn(async () => ({
        ...operation,
        done: true,
    }));
    const client = {
        agent: { pre: 'Eagent' },
        fetch,
        identifiers: () => ({ addEndRole }),
        oobis: () => ({ get: getOobi }),
        operations: () => ({ wait }),
    } as unknown as SignifyClient;

    return { addEndRole, client, fetch, getOobi, wait };
};

const runService = async <T>(service: () => Generator<unknown, T, unknown>) => {
    const runtime = createAppRuntime({ storage: null });
    try {
        return await runtime.runWorkflow(service, {
            scope: 'app',
            track: false,
        });
    } finally {
        await runtime.destroy();
    }
};

describe('identifier OOBI services', () => {
    it('reads available OOBIs without authorizing the agent end-role', async () => {
        const { addEndRole, client, getOobi } = makeClient();

        const record = await runService(() =>
            readIdentifierOobiService({
                client,
                identifier: 'alice',
                role: 'agent',
            })
        );

        expect(record).toMatchObject({
            id: 'alice:agent',
            identifier: 'alice',
            role: 'agent',
            oobis: ['http://127.0.0.1:3902/oobi/Eaid/agent/Eagent'],
        });
        expect(getOobi).toHaveBeenCalledWith('alice', 'agent');
        expect(addEndRole).not.toHaveBeenCalled();
    });

    it('treats empty read-only OOBI responses as unavailable state', async () => {
        const { addEndRole, client } = makeClient({ oobis: [] });

        const record = await runService(() =>
            readIdentifierOobiService({
                client,
                identifier: 'alice',
                role: 'agent',
            })
        );

        expect(record).toBeNull();
        expect(addEndRole).not.toHaveBeenCalled();
    });

    it('keeps generated agent OOBIs as the intentional authorization path', async () => {
        const { addEndRole, client, wait } = makeClient();

        const record = await runService(() =>
            generateIdentifierOobiService({
                client,
                identifier: 'alice',
                role: 'agent',
            })
        );

        expect(record.role).toBe('agent');
        expect(addEndRole).toHaveBeenCalledWith('alice', 'agent', 'Eagent');
        expect(wait).toHaveBeenCalledOnce();
    });
});

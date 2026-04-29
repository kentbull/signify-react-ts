import { describe, expect, it, vi } from 'vitest';
import type { SignifyClient } from 'signify-ts';
import { createAppRuntime } from '../../src/app/runtime';
import { ensureAgentEndRoleService } from '../../src/services/identifiers.service';

const jsonResponse = (body: unknown): Response =>
    new Response(JSON.stringify(body), {
        headers: { 'Content-Type': 'application/json' },
    });

const makeClient = ({
    agentPre = 'Eagent',
    existingEndRoles = [],
}: {
    agentPre?: string | null;
    existingEndRoles?: unknown[];
} = {}) => {
    const operation = { name: 'endrole.alice.agent' };
    const fetch = vi.fn(async () => jsonResponse(existingEndRoles));
    const op = vi.fn(async () => operation);
    const addEndRole = vi.fn(async () => ({ op }));
    const wait = vi.fn(async () => ({
        ...operation,
        done: true,
    }));
    const client = {
        agent: agentPre === null ? undefined : { pre: agentPre },
        fetch,
        identifiers: () => ({ addEndRole }),
        operations: () => ({ wait }),
    } as unknown as SignifyClient;

    return { addEndRole, client, fetch, op, wait };
};

const runEnsureAgentEndRole = async (client: SignifyClient): Promise<void> => {
    const runtime = createAppRuntime({ storage: null });
    try {
        await runtime.runWorkflow(
            () =>
                ensureAgentEndRoleService({
                    client,
                    identifier: 'alice',
                }),
            { scope: 'app', track: false }
        );
    } finally {
        await runtime.destroy();
    }
};

describe('ensureAgentEndRoleService', () => {
    it('returns without creating a duplicate end-role when the agent is already authorized', async () => {
        const { addEndRole, client, fetch, wait } = makeClient({
            existingEndRoles: [{ role: 'agent', eid: 'Eagent' }],
        });

        await expect(runEnsureAgentEndRole(client)).resolves.toBeUndefined();

        expect(fetch).toHaveBeenCalledWith(
            '/identifiers/alice/endroles/agent',
            'GET',
            null
        );
        expect(addEndRole).not.toHaveBeenCalled();
        expect(wait).not.toHaveBeenCalled();
    });

    it('adds and waits for the agent end-role when it is missing', async () => {
        const { addEndRole, client, op, wait } = makeClient();

        await expect(runEnsureAgentEndRole(client)).resolves.toBeUndefined();

        expect(addEndRole).toHaveBeenCalledWith('alice', 'agent', 'Eagent');
        expect(op).toHaveBeenCalledOnce();
        expect(wait).toHaveBeenCalledOnce();
    });

    it('fails clearly when the connected client has no agent AID', async () => {
        const { addEndRole, client } = makeClient({ agentPre: null });

        await expect(runEnsureAgentEndRole(client)).rejects.toThrow(
            'Connected Signify client is missing its agent AID.'
        );
        expect(addEndRole).not.toHaveBeenCalled();
    });
});

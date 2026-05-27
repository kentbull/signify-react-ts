import { refreshIdentifierDidWebsOp } from '../../workflows/didwebs.op';
import type { DidWebsDidPayload } from '../../state/didwebs.slice';
import type { RuntimeCommandContext, WorkflowRunOptions } from './types';

export interface DidWebsRuntimeCommands {
    refreshIdentifierDid(
        name: string,
        aid: string,
        options?: WorkflowRunOptions
    ): Promise<DidWebsDidPayload | null>;
}

/**
 * Route-facing did:webs DID commands.
 */
export const createDidWebsRuntimeCommands = (
    context: RuntimeCommandContext
): DidWebsRuntimeCommands => ({
    refreshIdentifierDid: refreshIdentifierDid(context),
});

const refreshIdentifierDid =
    (context: RuntimeCommandContext) =>
    (
        name: string,
        aid: string,
        options: WorkflowRunOptions = {}
    ): Promise<DidWebsDidPayload | null> =>
        context.runWorkflow(() => refreshIdentifierDidWebsOp({ name, aid }), {
            ...options,
            label: options.label,
            kind: options.kind ?? 'refreshDidWebsDid',
            track: options.track ?? false,
        });

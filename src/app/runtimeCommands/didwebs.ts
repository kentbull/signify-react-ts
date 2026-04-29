import { refreshIdentifierDidWebsOp } from '../../workflows/didwebs.op';
import type { RuntimeCommandContext, WorkflowRunOptions } from './types';

export interface DidWebsRuntimeCommands {
    refreshIdentifierDid(
        name: string,
        aid: string,
        options?: WorkflowRunOptions
    ): Promise<string | null>;
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
    ): Promise<string | null> =>
        context.runWorkflow(() => refreshIdentifierDidWebsOp({ name, aid }), {
            ...options,
            label: options.label,
            kind: options.kind ?? 'refreshDidWebsDid',
            track: options.track ?? false,
        });

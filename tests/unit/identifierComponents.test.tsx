import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { IdentifierTable } from '../../src/features/identifiers/IdentifierTable';
import type { IdentifierSummary } from '../../src/domain/identifiers/identifierTypes';

const identifier = {
    name: 'alice',
    prefix: 'Ealice',
} as IdentifierSummary;

describe('identifier UI actions', () => {
    it('renders copy-agent-OOBI without a separate authorize-agent action', () => {
        const markup = renderToStaticMarkup(
            <IdentifierTable
                identifiers={[identifier]}
                onSelect={vi.fn()}
                onRotate={vi.fn()}
                isRotateDisabled={() => false}
                onCopyAgentOobi={vi.fn()}
                agentOobiCopyStatus={{}}
            />
        );

        expect(markup).toContain('aria-label="Copy agent OOBI for alice"');
        expect(markup).not.toContain('aria-label="Authorize agent for alice"');
    });
});

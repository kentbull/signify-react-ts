import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { IdentifierTable } from '../../src/features/identifiers/IdentifierTable';
import type { IdentifierSummary } from '../../src/domain/identifiers/identifierTypes';

const identifier = {
    name: 'alice',
    prefix: 'Ealice',
} as IdentifierSummary;

describe('identifier UI actions', () => {
    it('renders an explicit authorize-agent action in the identifier table', () => {
        const markup = renderToStaticMarkup(
            <IdentifierTable
                identifiers={[identifier]}
                selectedAid={null}
                onSelect={vi.fn()}
                onRotate={vi.fn()}
                isRotateDisabled={() => false}
                onAuthorizeAgent={vi.fn()}
                isAuthorizeAgentDisabled={() => false}
                onCopyAgentOobi={vi.fn()}
                agentOobiCopyStatus={{}}
            />
        );

        expect(markup).toContain('aria-label="Authorize agent for alice"');
    });

    it('marks the globally selected identifier row', () => {
        const markup = renderToStaticMarkup(
            <IdentifierTable
                identifiers={[identifier]}
                selectedAid="Ealice"
                onSelect={vi.fn()}
                onRotate={vi.fn()}
                isRotateDisabled={() => false}
                onAuthorizeAgent={vi.fn()}
                isAuthorizeAgentDisabled={() => false}
                onCopyAgentOobi={vi.fn()}
                agentOobiCopyStatus={{}}
            />
        );

        expect(markup).toContain('aria-selected="true"');
    });
});

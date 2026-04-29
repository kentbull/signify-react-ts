import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { HeldCredentialsPanel } from '../../src/features/credentials/CredentialWalletPanels';
import type {
    CredentialSummaryRecord,
    SchemaRecord,
} from '../../src/domain/credentials/credentialTypes';

const credential = {
    said: 'Ecredential',
    schemaSaid: 'Eschema',
    registryId: 'Eregistry',
    issuerAid: 'Eissuer',
    holderAid: 'Eholder',
    direction: 'held',
    status: 'admitted',
    grantSaid: null,
    admitSaid: null,
    notificationId: null,
    issuedAt: '2026-04-22T00:00:00.000Z',
    grantedAt: null,
    admittedAt: null,
    revokedAt: null,
    error: null,
    attributes: null,
    updatedAt: '2026-04-22T00:00:00.000Z',
} satisfies CredentialSummaryRecord;

const schema = {
    said: 'Eschema',
    oobi: null,
    status: 'resolved',
    title: 'Verifiable Reference Data (VRD) Credential',
    description: null,
    credentialType: 'VRDCredential',
    version: null,
    error: null,
    updatedAt: null,
} satisfies SchemaRecord;

describe('wallet credential panels', () => {
    it('renders held credential rows as detail navigation targets without inline expansion details', () => {
        const markup = renderToStaticMarkup(
            <HeldCredentialsPanel
                credentials={[credential]}
                credentialTypesBySchema={new Map()}
                schemasBySaid={new Map([['Eschema', schema]])}
                verifiers={[]}
                selectedVerifierId=""
                didWebsReady={false}
                actionRunning={false}
                onOpenCredential={vi.fn()}
                onVerifierChange={vi.fn()}
                onProject={vi.fn()}
            />
        );

        expect(markup).toContain('role="button"');
        expect(markup).toContain('Verifiable Reference Data (VRD) Credential');
        expect(markup).toContain('Ecredential');
        expect(markup).not.toContain('Schema SAID');
        expect(markup).not.toContain('Issuer');
        expect(markup).not.toContain('Holder');
    });
});

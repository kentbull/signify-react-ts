import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { HeldCredentialsPanel } from '../../src/features/credentials/CredentialWalletPanels';
import { CredentialW3CPresentationControls } from '../../src/features/credentials/CredentialW3CPresentationControls';
import { IssuedCredentialsForTypePanel } from '../../src/features/credentials/CredentialIssuerTypePanels';
import {
    selectCredentialW3CPresenter,
    W3C_PRESENTABLE_VRD_SCHEMA_SAID,
} from '../../src/domain/credentials/credentialPresentation';
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
    it('prefers holder presenters for held credentials and issuer presenters for issued credentials', () => {
        const identifiers = [
            { name: 'issuer', prefix: 'Eissuer' },
            { name: 'holder', prefix: 'Eholder' },
        ];

        expect(
            selectCredentialW3CPresenter(credential, identifiers)?.prefix
        ).toBe('Eholder');
        expect(
            selectCredentialW3CPresenter(
                { ...credential, direction: 'issued' },
                identifiers
            )?.prefix
        ).toBe('Eissuer');
    });

    it('renders held credential rows as detail navigation targets without inline expansion details', () => {
        const markup = renderToStaticMarkup(
            <HeldCredentialsPanel
                credentials={[credential]}
                credentialTypesBySchema={new Map()}
                schemasBySaid={new Map([['Eschema', schema]])}
                identifiers={[{ name: 'issuer', prefix: 'Eissuer' }]}
                didWebsReadyByAid={new Map([['Eissuer', false]])}
                verifiers={[]}
                selectedVerifierId=""
                actionRunning={false}
                onOpenCredential={vi.fn()}
                onVerifierChange={vi.fn()}
                onPresent={vi.fn()}
            />
        );

        expect(markup).toContain('role="button"');
        expect(markup).toContain('Verifiable Reference Data (VRD) Credential');
        expect(markup).toContain('Present');
        expect(markup).toContain('Ecredential');
        expect(markup).not.toContain('Schema SAID');
        expect(markup).not.toContain('Issuer');
        expect(markup).not.toContain('Holder');
    });

    it('renders the shared verifier selector and explicit W3C Present blockers', () => {
        const markup = renderToStaticMarkup(
            <CredentialW3CPresentationControls
                credential={{
                    ...credential,
                    schemaSaid: W3C_PRESENTABLE_VRD_SCHEMA_SAID,
                }}
                identifiers={[]}
                didWebsReadyByAid={new Map()}
                verifiers={[
                    {
                        id: 'isomer-python',
                        label: 'Python Isomer',
                        kind: 'isomer-python-vc-jwt',
                        verifyUrl: 'http://verifier.example/verify',
                    },
                ]}
                selectedVerifierId="isomer-python"
                actionRunning={false}
                onVerifierChange={vi.fn()}
                onPresent={vi.fn()}
            />
        );

        expect(markup).toContain('Verifier');
        expect(markup).toContain('Python Isomer');
        expect(markup).toContain('Present');
        expect(markup).toContain(
            'This wallet controls neither the credential issuer nor holder AID required for W3C Present.'
        );
    });

    it('uses a local holder as the presenter for held VRD credentials', () => {
        const markup = renderToStaticMarkup(
            <CredentialW3CPresentationControls
                credential={{
                    ...credential,
                    schemaSaid: W3C_PRESENTABLE_VRD_SCHEMA_SAID,
                }}
                identifiers={[{ name: 'holder', prefix: 'Eholder' }]}
                didWebsReadyByAid={new Map([['Eholder', true]])}
                verifiers={[
                    {
                        id: 'isomer-python',
                        label: 'Python Isomer',
                        kind: 'isomer-python-vc-jwt',
                        verifyUrl: 'http://verifier.example/verify',
                    },
                ]}
                selectedVerifierId="isomer-python"
                actionRunning={false}
                onVerifierChange={vi.fn()}
                onPresent={vi.fn()}
            />
        );

        expect(markup).toContain('Ready to present to Python Isomer.');
    });

    it('uses a local issuer as the presenter for issued VRD credentials', () => {
        const markup = renderToStaticMarkup(
            <CredentialW3CPresentationControls
                credential={{
                    ...credential,
                    direction: 'issued',
                    status: 'issued',
                    schemaSaid: W3C_PRESENTABLE_VRD_SCHEMA_SAID,
                }}
                identifiers={[{ name: 'issuer', prefix: 'Eissuer' }]}
                didWebsReadyByAid={new Map([['Eissuer', true]])}
                verifiers={[
                    {
                        id: 'isomer-python',
                        label: 'Python Isomer',
                        kind: 'isomer-python-vc-jwt',
                        verifyUrl: 'http://verifier.example/verify',
                    },
                ]}
                selectedVerifierId="isomer-python"
                actionRunning={false}
                onVerifierChange={vi.fn()}
                onPresent={vi.fn()}
            />
        );

        expect(markup).toContain('Ready to present to Python Isomer.');
    });

    it('renders W3C Present controls alongside issuer IPEX Grant controls', () => {
        const markup = renderToStaticMarkup(
            <IssuedCredentialsForTypePanel
                credentials={[
                    {
                        ...credential,
                        direction: 'issued',
                        status: 'issued',
                        schemaSaid: W3C_PRESENTABLE_VRD_SCHEMA_SAID,
                    },
                ]}
                actionRunning={false}
                credentialTypesBySchema={new Map()}
                schemasBySaid={
                    new Map([
                        [
                            W3C_PRESENTABLE_VRD_SCHEMA_SAID,
                            {
                                ...schema,
                                said: W3C_PRESENTABLE_VRD_SCHEMA_SAID,
                            },
                        ],
                    ])
                }
                identifiers={[{ name: 'issuer', prefix: 'Eissuer' }]}
                didWebsReadyByAid={new Map([['Eissuer', true]])}
                verifiers={[
                    {
                        id: 'isomer-python',
                        label: 'Python Isomer',
                        kind: 'isomer-python-vc-jwt',
                        verifyUrl: 'http://verifier.example/verify',
                    },
                ]}
                selectedVerifierId="isomer-python"
                onGrant={vi.fn()}
                onVerifierChange={vi.fn()}
                onPresent={vi.fn()}
            />
        );

        expect(markup).toContain('Grant');
        expect(markup).toContain('Present');
        expect(markup).toContain('Python Isomer');
    });
});

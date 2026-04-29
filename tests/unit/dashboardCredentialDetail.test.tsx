import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { CredentialRecordDetail } from '../../src/features/dashboard/DashboardDetailViews';
import type {
    CredentialAcdcRecord,
    CredentialChainGraphRecord,
    CredentialSummaryRecord,
    SchemaRecord,
} from '../../src/domain/credentials/credentialTypes';

const credential = {
    said: 'Eroot',
    schemaSaid: 'ErootSchema',
    registryId: 'Eregistry',
    issuerAid: 'Eissuer',
    holderAid: 'Eholder',
    direction: 'held',
    status: 'admitted',
    grantSaid: null,
    admitSaid: null,
    notificationId: null,
    issuedAt: null,
    grantedAt: null,
    admittedAt: null,
    revokedAt: null,
    error: null,
    attributes: null,
    updatedAt: '2026-04-22T00:00:00.000Z',
} satisfies CredentialSummaryRecord;

const rootAcdc = {
    said: 'Eroot',
    schemaSaid: 'ErootSchema',
    registryId: 'Eregistry',
    issuerAid: 'Eissuer',
    holderAid: 'Eholder',
    subject: {
        i: 'Eholder',
        LEI: '5493001KJTIIGC8Y1R12',
    },
    rules: {
        usage: 'demo',
    },
    edges: [
        {
            label: 'source',
            said: 'Esource',
            operator: null,
            data: { n: 'Esource' },
        },
    ],
    status: 'admitted',
    updatedAt: '2026-04-22T00:00:00.000Z',
} satisfies CredentialAcdcRecord;

const sourceAcdc = {
    ...rootAcdc,
    said: 'Esource',
    schemaSaid: 'EsourceSchema',
    issuerAid: 'EsourceIssuer',
    holderAid: 'Eholder',
    edges: [],
} satisfies CredentialAcdcRecord;

const rootSchema = {
    said: 'ErootSchema',
    oobi: null,
    status: 'resolved',
    title: 'Verifiable Reference Data (VRD) Credential',
    description: null,
    credentialType: 'VRDCredential',
    version: null,
    properties: {
        a: {
            properties: {
                LEI: {
                    title: 'Legal Entity Identifier',
                },
            },
        },
    },
    rules: {
        usageDisclaimer: {
            description: 'Usage Disclaimer',
            properties: {
                l: {
                    description: 'Associated legal language',
                    const: '',
                },
            },
        },
    },
    error: null,
    updatedAt: null,
} satisfies SchemaRecord;

const sourceSchema = {
    ...rootSchema,
    said: 'EsourceSchema',
    title: 'Legal Entity vLEI Credential',
    credentialType: 'LegalEntityvLEICredential',
} satisfies SchemaRecord;

const graph = {
    rootSaid: 'Eroot',
    nodes: [
        {
            said: 'Esource',
            schemaSaid: 'EsourceSchema',
            issuerAid: 'EsourceIssuer',
            holderAid: 'Eholder',
            unresolved: false,
            depth: 1,
        },
        {
            said: 'Eroot',
            schemaSaid: 'ErootSchema',
            issuerAid: 'Eissuer',
            holderAid: 'Eholder',
            unresolved: false,
            depth: 0,
        },
    ],
    edges: [
        {
            id: 'Esource->Eroot:source',
            from: 'Esource',
            to: 'Eroot',
            label: 'source',
            operator: null,
        },
    ],
    updatedAt: '2026-04-22T00:00:00.000Z',
} satisfies CredentialChainGraphRecord;

describe('dashboard credential detail', () => {
    it('renders generic ACDC data and a human-readable chain graph', () => {
        const markup = renderToStaticMarkup(
            <MemoryRouter>
                <CredentialRecordDetail
                    loaderData={{ status: 'ready' }}
                    credential={credential}
                    acdc={rootAcdc}
                    chainGraph={graph}
                    acdcsBySaid={{
                        Eroot: rootAcdc,
                        Esource: sourceAcdc,
                    }}
                    schemasBySaid={
                        new Map([
                            ['ErootSchema', rootSchema],
                            ['EsourceSchema', sourceSchema],
                        ])
                    }
                    schema={rootSchema}
                    registriesById={new Map()}
                    aidAliases={
                        new Map([
                            ['Eissuer', 'Issuer Alias'],
                            ['Eholder', 'Holder Alias'],
                        ])
                    }
                    activity={[]}
                />
            </MemoryRouter>
        );

        expect(markup).toContain('Verifiable Reference Data (VRD) Credential');
        expect(markup).toContain('Legal Entity vLEI Credential');
        expect(markup).toContain('Legal Entity Identifier');
        expect(markup).toContain('5493001KJTIIGC8Y1R12');
        expect(markup).toContain('ACDC rules');
        expect(markup).toContain('Schema rules');
        expect(markup).toContain('usageDisclaimer.description');
        expect(markup).toContain('Usage Disclaimer');
        expect(markup).toContain('credential-chain-graph');
        expect(markup).toContain('credential-chain-node-Esource');
    });

    it('keeps no-rule messages inside collapsed rule accordions', () => {
        const markup = renderToStaticMarkup(
            <MemoryRouter>
                <CredentialRecordDetail
                    loaderData={{ status: 'ready' }}
                    credential={credential}
                    acdc={{ ...rootAcdc, rules: null }}
                    chainGraph={graph}
                    acdcsBySaid={{
                        Eroot: { ...rootAcdc, rules: null },
                        Esource: sourceAcdc,
                    }}
                    schemasBySaid={
                        new Map([
                            ['ErootSchema', { ...rootSchema, rules: null }],
                            ['EsourceSchema', sourceSchema],
                        ])
                    }
                    schema={{ ...rootSchema, rules: null }}
                    registriesById={new Map()}
                    aidAliases={new Map()}
                    activity={[]}
                />
            </MemoryRouter>
        );

        expect(markup).toContain('ACDC rules');
        expect(markup).toContain('No credential rules.');
        expect(markup).toContain('Schema rules');
        expect(markup).toContain('No schema rules');
    });
});

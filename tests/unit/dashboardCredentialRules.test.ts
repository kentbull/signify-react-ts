import { describe, expect, it } from 'vitest';
import {
    credentialGraphNodeLabel,
    credentialRulesRows,
    credentialSubjectDataRows,
} from '../../src/features/dashboard/credentialAcdcDisplay';
import { schemaRuleViews } from '../../src/features/dashboard/schemaRules';

describe('dashboard credential schema rules', () => {
    it('flattens every schema rules leaf into dotted name and value rows', () => {
        expect(
            schemaRuleViews({
                usageDisclaimer: {
                    l: 'Usage disclaimer',
                    d: 'Use of a valid, unexpired, and non-revoked credential does not by itself grant voting rights.',
                },
                privacyPolicy: {
                    section1: {
                        parta: 'Only request necessary fields.',
                        partb: true,
                    },
                    references: ['ACDC', 'IPEX'],
                },
            })
        ).toEqual([
            {
                name: 'usageDisclaimer.l',
                value: 'Usage disclaimer',
            },
            {
                name: 'usageDisclaimer.d',
                value: 'Use of a valid, unexpired, and non-revoked credential does not by itself grant voting rights.',
            },
            {
                name: 'privacyPolicy.section1.parta',
                value: 'Only request necessary fields.',
            },
            {
                name: 'privacyPolicy.section1.partb',
                value: 'true',
            },
            {
                name: 'privacyPolicy.references.0',
                value: 'ACDC',
            },
            {
                name: 'privacyPolicy.references.1',
                value: 'IPEX',
            },
        ]);
    });

    it('preserves empty nested collections as leaf values', () => {
        expect(
            schemaRuleViews({
                emptyObject: {},
                emptyArray: [],
            })
        ).toEqual([
            { name: 'emptyObject', value: '{}' },
            { name: 'emptyArray', value: '[]' },
        ]);
    });

    it('flattens arbitrary ACDC subject data and credential rules', () => {
        const acdc = {
            said: 'Ecredential',
            schemaSaid: 'Eschema',
            registryId: 'Eregistry',
            issuerAid: 'Eissuer',
            holderAid: 'Eholder',
            subject: {
                d: 'Esubject',
                i: 'Eholder',
                LEI: '5493001KJTIIGC8Y1R12',
                flags: ['active', 'verified'],
            },
            rules: [{ usage: 'demo' }],
            edges: [],
            status: 'admitted',
            updatedAt: '2026-04-22T00:00:00.000Z',
        } as const;

        expect(
            credentialSubjectDataRows(acdc, {
                said: 'Eschema',
                oobi: null,
                status: 'resolved',
                title: 'Legal Entity vLEI Credential',
                description: null,
                credentialType: 'LegalEntityvLEICredential',
                version: null,
                properties: {
                    a: {
                        properties: {
                            LEI: {
                                title: 'Legal Entity Identifier',
                                description: 'GLEIF LEI',
                            },
                        },
                    },
                },
                error: null,
                updatedAt: null,
            })
        ).toEqual([
            {
                name: 'd',
                label: 'Subject SAID',
                value: 'Esubject',
                description: null,
            },
            {
                name: 'i',
                label: 'Subject AID',
                value: 'Eholder',
                description: null,
            },
            {
                name: 'LEI',
                label: 'Legal Entity Identifier',
                value: '5493001KJTIIGC8Y1R12',
                description: 'GLEIF LEI',
            },
            {
                name: 'flags',
                label: 'flags',
                value: JSON.stringify(['active', 'verified'], null, 2),
                description: null,
            },
        ]);
        expect(credentialRulesRows(acdc)).toEqual([
            { name: 'rules.0.usage', value: 'demo' },
        ]);
    });

    it('uses resolved human-readable type names for graph nodes', () => {
        expect(
            credentialGraphNodeLabel({
                node: {
                    said: 'Ecredential',
                    schemaSaid: 'Eschema',
                    issuerAid: 'Eissuer',
                    holderAid: 'Eholder',
                    unresolved: false,
                    depth: 0,
                },
                schemasBySaid: new Map([
                    [
                        'Eschema',
                        {
                            said: 'Eschema',
                            oobi: null,
                            status: 'resolved',
                            title: 'Verifiable Reference Data (VRD) Credential',
                            description: null,
                            credentialType: 'VRDCredential',
                            version: null,
                            error: null,
                            updatedAt: null,
                        },
                    ],
                ]),
            })
        ).toBe('Verifiable Reference Data (VRD) Credential');
    });
});

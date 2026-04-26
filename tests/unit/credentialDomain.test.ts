import { describe, expect, it } from 'vitest';
import type {
    CredentialResult,
    CredentialState,
    Registry,
    Schema,
} from 'signify-ts';
import {
    credentialAdmitFromExchange,
    credentialGrantFromExchange,
    credentialRecordFromKeriaCredential,
    registryRecordFromKeriaRegistry,
    schemaRecordFromKeriaSchema,
    statusFromCredentialState,
} from '../../src/domain/credentials/credentialMappings';
import {
    projectCredentialSubjectAttributes,
    serializeCredentialSubjectAttributes,
} from '../../src/domain/credentials/credentialProjectors';
import type { IssueableCredentialTypeRecord } from '../../src/domain/credentials/credentialCatalog';
import {
    normalizeSediVoterAttributes,
    SEDI_VOTER_ID_DEFAULT_REGISTRY_NAME,
} from '../../src/domain/credentials/sediVoterId';

const loadedAt = '2026-04-22T00:00:00.000Z';

const credentialTypes = [
    {
        key: 'sediVoterId',
        label: 'SEDI Voter ID',
        description: 'Demo credential',
        schemaSaid: 'Eschema',
        schemaOobiUrl: 'http://schema.example/oobi/Eschema',
        formKind: 'sediVoterId',
    },
] as const satisfies readonly IssueableCredentialTypeRecord[];

const credentialSubject = {
    i: 'Eholder',
    fullName: 'Ada Voter',
    voterId: 'SEDI-0001',
    precinctId: 'PCT-042',
    county: 'Demo County',
    jurisdiction: 'SEDI',
    electionId: 'SEDI-2026-DEMO',
    eligible: true,
    expires: '2026-12-31T23:59:59Z',
    dt: loadedAt,
};

const grantExchange = {
    exn: {
        r: '/ipex/grant',
        d: 'Egrant',
        i: 'Eissuer',
        rp: 'Eholder',
        dt: loadedAt,
        e: {
            acdc: {
                d: 'Ecredential',
                s: 'Eschema',
                a: credentialSubject,
            },
        },
    },
};

describe('credential domain mappings', () => {
    it('normalizes SEDI voter attributes and rejects invalid dates', () => {
        expect(
            normalizeSediVoterAttributes({
                ...credentialSubject,
                i: ' Eholder ',
                fullName: ' Ada Voter ',
            })
        ).toMatchObject({
            i: 'Eholder',
            fullName: 'Ada Voter',
            expires: '2026-12-31T23:59:59Z',
        });

        expect(() =>
            normalizeSediVoterAttributes({
                ...credentialSubject,
                expires: 'not-a-date',
            })
        ).toThrow('Expires must be an ISO date time.');
    });

    it('projects schema and registry records without Redux state coupling', () => {
        expect(
            schemaRecordFromKeriaSchema({
                schema: {
                    title: 'SEDI Voter ID',
                    description: 'Demo credential',
                    version: '1.0.0',
                    rules: { issuer: 'SEDI' },
                } as unknown as Schema,
                said: 'Eschema',
                oobi: 'http://schema.example/oobi/Eschema',
                updatedAt: loadedAt,
            })
        ).toEqual({
            said: 'Eschema',
            oobi: 'http://schema.example/oobi/Eschema',
            status: 'resolved',
            title: 'SEDI Voter ID',
            description: 'Demo credential',
            version: '1.0.0',
            rules: { issuer: 'SEDI' },
            error: null,
            updatedAt: loadedAt,
        });

        expect(
            registryRecordFromKeriaRegistry({
                registry: {
                    regk: 'Eregistry',
                    registryName: SEDI_VOTER_ID_DEFAULT_REGISTRY_NAME,
                } as unknown as Registry,
                issuerAlias: 'issuer',
                issuerAid: 'Eissuer',
                updatedAt: loadedAt,
            })
        ).toMatchObject({
            id: 'Eregistry',
            registryName: SEDI_VOTER_ID_DEFAULT_REGISTRY_NAME,
            issuerAlias: 'issuer',
            issuerAid: 'Eissuer',
            status: 'ready',
        });
    });

    it('projects KERIA credentials and credential state into local records', () => {
        const record = credentialRecordFromKeriaCredential({
            credential: {
                sad: {
                    d: 'Ecredential',
                    s: 'Eschema',
                    ri: 'Eregistry',
                    i: 'Eissuer',
                    a: credentialSubject,
                },
            } as unknown as CredentialResult,
            credentialTypes,
            direction: 'held',
            status: 'admitted',
            grantSaid: 'Egrant',
            updatedAt: loadedAt,
        });

        expect(record).toMatchObject({
            said: 'Ecredential',
            schemaSaid: 'Eschema',
            registryId: 'Eregistry',
            issuerAid: 'Eissuer',
            holderAid: 'Eholder',
            direction: 'held',
            status: 'admitted',
            grantSaid: 'Egrant',
            issuedAt: loadedAt,
            attributes: {
                fullName: 'Ada Voter',
                eligible: true,
            },
        });

        expect(
            statusFromCredentialState(
                { et: 'rev' } as unknown as CredentialState,
                true
            )
        ).toBe('revoked');
    });

    it('projects credential subjects through the schema-aware boundary', () => {
        expect(
            projectCredentialSubjectAttributes({
                subject: credentialSubject,
                context: {
                    schemaSaid: 'Eschema',
                    credentialTypes,
                },
            })
        ).toMatchObject({
            fullName: 'Ada Voter',
            eligible: true,
        });

        expect(
            serializeCredentialSubjectAttributes({
                subject: credentialSubject,
                context: {
                    schemaSaid: 'Eschema',
                    credentialTypes,
                },
            })
        ).toMatchObject({
            fullName: 'Ada Voter',
            eligible: true,
        });

        expect(
            projectCredentialSubjectAttributes({
                subject: credentialSubject,
                context: {
                    schemaSaid: 'Eunknown',
                    credentialTypes,
                },
            })
        ).toBeNull();
    });

    it('projects IPEX grant and admit exchanges with local-wallet status', () => {
        expect(
            credentialGrantFromExchange({
                notification: {
                    id: 'note-1',
                    dt: loadedAt,
                    read: false,
                    anchorSaid: 'Egrant',
                },
                exchange: grantExchange,
                localAids: new Set(['Eholder']),
                credentialTypes,
                loadedAt,
            })
        ).toMatchObject({
            notificationId: 'note-1',
            grantSaid: 'Egrant',
            issuerAid: 'Eissuer',
            holderAid: 'Eholder',
            credentialSaid: 'Ecredential',
            status: 'actionable',
        });

        expect(
            credentialAdmitFromExchange({
                notification: {
                    id: 'note-2',
                    dt: loadedAt,
                    read: false,
                    anchorSaid: 'Eadmit',
                },
                exchange: {
                    exn: {
                        r: '/ipex/admit',
                        d: 'Eadmit',
                        p: 'Egrant',
                        i: 'Eholder',
                        rp: 'Eissuer',
                        dt: loadedAt,
                    },
                },
                localAids: new Set(['Eissuer']),
                loadedAt,
            })
        ).toMatchObject({
            notificationId: 'note-2',
            admitSaid: 'Eadmit',
            grantSaid: 'Egrant',
            issuerAid: 'Eissuer',
            holderAid: 'Eholder',
            status: 'received',
        });
    });
});

import { describe, expect, it } from 'vitest';
import type { CredentialSummaryRecord } from '../../src/domain/credentials/credentialTypes';
import {
    canonicalCredentialWorkflowPath,
    legacyDashboardCredentialRedirectPath,
} from '../../src/features/dashboard/dashboardViewModels';

const heldCredential = {
    said: 'Eshared',
    schemaSaid: 'Eschema',
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

const issuedCredential = {
    ...heldCredential,
    direction: 'issued',
    status: 'issued',
} satisfies CredentialSummaryRecord;

describe('dashboard credential workflow routing', () => {
    it('routes held credentials to the holder wallet workflow', () => {
        expect(canonicalCredentialWorkflowPath(heldCredential)).toBe(
            '/credentials/Eholder/wallet'
        );
    });

    it('routes issued credentials to the issuer workflow', () => {
        expect(canonicalCredentialWorkflowPath(issuedCredential)).toBe(
            '/credentials/Eissuer/issuer'
        );
    });

    it('prefers held inventory for legacy dashboard SAID redirects', () => {
        expect(
            legacyDashboardCredentialRedirectPath({
                credentialSaid: 'Eshared',
                heldCredentials: [heldCredential],
                issuedCredentials: [issuedCredential],
            })
        ).toBe('/credentials/Eholder/wallet');
    });

    it('falls back to the held dashboard list for unknown legacy SAIDs', () => {
        expect(
            legacyDashboardCredentialRedirectPath({
                credentialSaid: 'Emissing',
                heldCredentials: [],
                issuedCredentials: [],
            })
        ).toBe('/dashboard/credentials/held');
    });
});

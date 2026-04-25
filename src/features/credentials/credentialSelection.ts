import type { ContactRecord } from '../../state/contacts.slice';
import type { RegistryRecord } from '../../domain/credentials/credentialTypes';
import { isWitnessContact } from '../../domain/contacts/contactHelpers';

/** Contacts that can safely receive issued credentials. */
export const resolvedCredentialHolderContacts = (
    contacts: readonly ContactRecord[]
): ContactRecord[] =>
    contacts.filter(
        (contact) =>
            contact.aid !== null &&
            contact.aid.trim().length > 0 &&
            !isWitnessContact(contact)
    );

/** Ready registries owned by the selected issuer AID. */
export const readyCredentialRegistriesForIssuer = (
    registries: readonly RegistryRecord[],
    issuerAid: string | null
): RegistryRecord[] => {
    if (issuerAid === null || issuerAid.trim().length === 0) {
        return [];
    }

    return registries.filter(
        (registry) =>
            registry.issuerAid === issuerAid &&
            registry.status === 'ready' &&
            registry.regk.trim().length > 0
    );
};

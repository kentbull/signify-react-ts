/** Resolution lifecycle for a contact OOBI. */
export type ContactResolutionStatus =
    | 'idle'
    | 'resolving'
    | 'resolved'
    | 'error';

/** KERIA endpoint roles surfaced from contact `ends` records. */
export type ContactEndpointRole =
    | 'agent'
    | 'controller'
    | 'witness'
    | 'registrar'
    | 'watcher'
    | 'judge'
    | 'juror'
    | 'peer'
    | 'mailbox';

/** One endpoint authorization known for a contact/component. */
export interface ContactEndpoint {
    role: ContactEndpointRole;
    eid: string;
    scheme: string;
    url: string;
}

/** One well-known record attached to a contact. */
export interface ContactWellKnown {
    url: string;
    dt: string;
}

/** Generated OOBI inventory for a local identifier. */
export interface GeneratedOobiRecord {
    id: string;
    identifier: string;
    role: 'agent' | 'witness';
    oobis: string[];
    generatedAt: string;
}

/** Local contact record created from OOBI resolution. */
export interface ContactRecord {
    id: string;
    alias: string;
    aid: string | null;
    oobi: string | null;
    endpoints: ContactEndpoint[];
    wellKnowns: ContactWellKnown[];
    componentTags: string[];
    challengeCount: number;
    authenticatedChallengeCount: number;
    resolutionStatus: ContactResolutionStatus;
    error: string | null;
    updatedAt: string | null;
}

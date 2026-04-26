import type { MultisigThresholdSpec } from './multisigThresholds';

/** Local lifecycle status for a multisig group workflow. */
export type MultisigGroupStatus =
    | 'draft'
    | 'proposed'
    | 'joining'
    | 'incepting'
    | 'authorizingAgents'
    | 'active'
    | 'interacting'
    | 'rotating'
    | 'failed';

/** One candidate member in a multisig group draft. */
export interface MultisigMemberDraft {
    aid: string;
    alias: string;
    source: 'local' | 'contact' | 'manual';
    isGroup?: boolean;
    deliveryStatus?:
        | 'local'
        | 'ready'
        | 'missingAgentOobi'
        | 'unresolvedContact'
        | 'missingKeyState';
}

/** UI-ready member candidate derived from local identifiers and contacts. */
export interface MultisigMemberOption {
    aid: string;
    alias: string;
    source: 'local' | 'contact';
    isGroup: boolean;
    isLocal: boolean;
    localName?: string;
    deliveryStatus:
        | 'local'
        | 'ready'
        | 'missingAgentOobi'
        | 'unresolvedContact'
        | 'missingKeyState';
}

/** Route-level draft for creating a multisig group identifier. */
export interface MultisigCreateDraft {
    groupAlias: string;
    localMemberName: string;
    localMemberAid: string;
    members: MultisigMemberDraft[];
    signingMemberAids: string[];
    rotationMemberAids: string[];
    signingThreshold: MultisigThresholdSpec;
    rotationThreshold: MultisigThresholdSpec;
    witnessMode: 'none' | 'demo';
}

/** Route-level draft for a multisig interaction event. */
export interface MultisigInteractionDraft {
    groupAlias: string;
    localMemberName?: string | null;
    data: unknown;
}

/** Route-level draft for rotating a multisig group. */
export interface MultisigRotationDraft {
    groupAlias: string;
    localMemberName?: string | null;
    signingMemberAids: string[];
    rotationMemberAids: string[];
    nextThreshold: MultisigThresholdSpec;
}

/** Common route input for responding to inbound multisig EXN requests. */
export interface MultisigRequestActionInput {
    notificationId?: string | null;
    exnSaid: string;
    groupAlias: string;
    localMemberName: string;
}

/** Result summary returned by multisig workflows for operation payloads. */
export interface MultisigOperationResult {
    groupAlias: string;
    groupAid: string | null;
    localMemberAid: string | null;
    exchangeSaid: string | null;
    operationNames: string[];
    completedAt: string;
}

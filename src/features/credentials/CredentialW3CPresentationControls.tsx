import {
    Button,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Typography,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import type { W3CVerifier } from 'signify-ts';
import { UI_SOUND_HOVER_VALUE } from '../../app/uiSound';
import { isW3CPresentableVrdCredential } from '../../domain/credentials/credentialPresentation';
import type { CredentialSummaryRecord } from '../../domain/credentials/credentialTypes';
import type { IdentifierSummary } from '../../domain/identifiers/identifierTypes';

interface CredentialW3CPresentationControlsProps {
    credential: CredentialSummaryRecord;
    identifiers: readonly IdentifierSummary[];
    didWebsReadyByAid: ReadonlyMap<string, boolean>;
    verifiers: readonly W3CVerifier[];
    selectedVerifierId: string;
    actionRunning: boolean;
    onVerifierChange: (verifierId: string) => void;
    onPresent: (
        credential: CredentialSummaryRecord,
        projector: IdentifierSummary,
        verifierId: string
    ) => void;
}

const controlId = (credentialSaid: string): string =>
    `w3c-verifier-${credentialSaid.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

/**
 * Shared W3C presentation controls for admitted VRD credentials.
 *
 * KERIA's current W3C endpoint owns the combined projection plus verifier
 * submission workflow. This component keeps the user-facing command named
 * "Present" while surfacing every prerequisite that can block that workflow.
 */
export const CredentialW3CPresentationControls = ({
    credential,
    identifiers,
    didWebsReadyByAid,
    verifiers,
    selectedVerifierId,
    actionRunning,
    onVerifierChange,
    onPresent,
}: CredentialW3CPresentationControlsProps) => {
    const projector =
        identifiers.find(
            (identifier) => identifier.prefix === credential.issuerAid
        ) ?? null;
    const effectiveVerifierId =
        verifiers.find((verifier) => verifier.id === selectedVerifierId)?.id ??
        verifiers[0]?.id ??
        '';
    const selectedVerifier =
        verifiers.find((verifier) => verifier.id === effectiveVerifierId) ??
        null;
    const verifierLabelId = controlId(credential.said);
    const schemaSupported = isW3CPresentableVrdCredential(credential);
    const didWebsReady =
        projector !== null && didWebsReadyByAid.get(projector.prefix) === true;

    const blocker =
        credential.status !== 'admitted'
            ? `Credential status is ${credential.status}; W3C Present requires an admitted VRD credential.`
            : !schemaSupported
              ? 'Only supported VRD credentials can be presented through W3C.'
              : projector === null
                ? 'This wallet does not control the credential issuer AID required for W3C Present.'
                : verifiers.length === 0
                    ? 'No W3C verifier is configured.'
                    : effectiveVerifierId.length === 0
                      ? 'Select a W3C verifier.'
                      : !didWebsReady
                        ? 'The credential issuer did:webs DID is not ready.'
                        : actionRunning
                          ? 'A credential command is already running.'
                          : null;

    return (
        <Stack
            spacing={0.75}
            data-testid={`w3c-presentation-controls-${credential.said}`}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
        >
            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}
            >
                <FormControl
                    size="small"
                    disabled={actionRunning || verifiers.length === 0}
                    sx={{ minWidth: 220 }}
                >
                    <InputLabel id={verifierLabelId}>Verifier</InputLabel>
                    <Select
                        labelId={verifierLabelId}
                        label="Verifier"
                        value={effectiveVerifierId}
                        onChange={(event) =>
                            onVerifierChange(event.target.value)
                        }
                    >
                        {verifiers.length === 0 ? (
                            <MenuItem value="">No verifiers</MenuItem>
                        ) : (
                            verifiers.map((verifier) => (
                                <MenuItem
                                    key={verifier.id}
                                    value={verifier.id}
                                >
                                    {verifier.label}
                                </MenuItem>
                            ))
                        )}
                    </Select>
                </FormControl>
                <Button
                    variant="outlined"
                    startIcon={<SendIcon />}
                    disabled={blocker !== null}
                    data-ui-sound={UI_SOUND_HOVER_VALUE}
                    onClick={() => {
                        if (
                            blocker === null &&
                            projector !== null &&
                            effectiveVerifierId.length > 0
                        ) {
                            onPresent(
                                credential,
                                projector,
                                effectiveVerifierId
                            );
                        }
                    }}
                >
                    Present
                </Button>
            </Stack>
            <Typography
                variant="caption"
                color={blocker === null ? 'text.secondary' : 'warning.main'}
                sx={{ overflowWrap: 'anywhere' }}
            >
                {blocker ??
                    `Ready to present to ${selectedVerifier?.label ?? 'selected verifier'}.`}
            </Typography>
        </Stack>
    );
};

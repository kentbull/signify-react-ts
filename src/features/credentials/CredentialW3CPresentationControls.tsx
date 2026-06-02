import { Button, Stack, TextField, Typography } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { UI_SOUND_HOVER_VALUE } from '../../app/uiSound';
import {
    isW3CPresentableVrdCredential,
    selectCredentialW3CPresenter,
} from '../../domain/credentials/credentialPresentation';
import type { CredentialSummaryRecord } from '../../domain/credentials/credentialTypes';
import type { IdentifierSummary } from '../../domain/identifiers/identifierTypes';
import type { CredentialActionData } from '../../app/routeData';

interface CredentialW3CPresentationControlsProps {
    credential: CredentialSummaryRecord;
    identifiers: readonly IdentifierSummary[];
    didWebsReadyByAid: ReadonlyMap<string, boolean>;
    verifiers?: readonly unknown[];
    selectedVerifierId: string;
    actionRunning: boolean;
    presentationAction?: CredentialActionData | null;
    onVerifierChange: (verifierRequestJson: string) => void;
    onPresent: (
        credential: CredentialSummaryRecord,
        presenter: IdentifierSummary,
        verifierRequestJson: string
    ) => void;
}

const controlId = (credentialSaid: string): string =>
    `w3c-verifier-request-${credentialSaid.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

const defaultVerifierRequestJson = (credentialSaid: string): string =>
    JSON.stringify(
        {
            aud: 'https://verifier.example',
            nonce: `nonce-${credentialSaid.slice(0, 12)}`,
            response_uri: 'https://verifier.example/verify',
            formats: ['vp+jwt'],
        },
        null,
        2
    );

const parseVerifierRequest = (
    value: string
): Record<string, unknown> | null => {
    try {
        const parsed = JSON.parse(value);
        return typeof parsed === 'object' &&
            parsed !== null &&
            !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : null;
    } catch {
        return null;
    }
};

/**
 * Shared W3C presentation controls for admitted VRD credentials.
 *
 * KERIA owns the presentation transaction and verifier submission workflow.
 * This component accepts a runtime verifier request descriptor instead of a
 * deployment-time verifier allowlist entry.
 */
export const CredentialW3CPresentationControls = ({
    credential,
    identifiers,
    didWebsReadyByAid,
    selectedVerifierId,
    actionRunning,
    presentationAction = null,
    onVerifierChange,
    onPresent,
}: CredentialW3CPresentationControlsProps) => {
    const presenter = selectCredentialW3CPresenter(credential, identifiers);
    const effectiveVerifierRequestJson =
        selectedVerifierId || defaultVerifierRequestJson(credential.said);
    const verifierRequest = parseVerifierRequest(effectiveVerifierRequestJson);
    const verifierLabelId = controlId(credential.said);
    const schemaSupported = isW3CPresentableVrdCredential(credential);
    const statusPresentable =
        credential.status === 'admitted' ||
        credential.status === 'issued' ||
        credential.status === 'grantSent';
    const didWebsReady =
        presenter !== null && didWebsReadyByAid.get(presenter.prefix) === true;
    const presentationActionResult =
        presentationAction?.intent === 'presentCredential'
            ? presentationAction
            : null;

    const blocker = !statusPresentable
        ? `Credential status is ${credential.status}; W3C Present requires an active issued or admitted VRD credential.`
        : !schemaSupported
          ? 'Only supported VRD credentials can be presented through W3C.'
          : presenter === null
            ? 'This wallet controls neither the credential issuer nor holder AID required for W3C Present.'
            : verifierRequest === null
              ? 'Enter a valid runtime verifier request JSON object.'
              : !didWebsReady
                ? 'The presenter did:webs DID is not ready.'
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
                <TextField
                    id={verifierLabelId}
                    label="Verifier request"
                    size="small"
                    data-testid="w3c-verifier-request-input"
                    value={effectiveVerifierRequestJson}
                    onChange={(event) => onVerifierChange(event.target.value)}
                    disabled={actionRunning}
                    multiline
                    minRows={3}
                    sx={{ minWidth: { xs: '100%', sm: 320 } }}
                />
                <Button
                    variant="outlined"
                    startIcon={<SendIcon />}
                    disabled={blocker !== null}
                    data-testid="w3c-present-button"
                    data-credential-said={credential.said}
                    data-ui-sound={UI_SOUND_HOVER_VALUE}
                    onClick={() => {
                        if (
                            blocker === null &&
                            presenter !== null &&
                            verifierRequest !== null
                        ) {
                            onPresent(
                                credential,
                                presenter,
                                effectiveVerifierRequestJson
                            );
                        }
                    }}
                >
                    Present
                </Button>
            </Stack>
            <Typography
                data-testid="w3c-presentation-status"
                data-state={blocker === null ? 'ready' : 'blocked'}
                data-presenter-aid={presenter?.prefix ?? ''}
                variant="caption"
                color={blocker === null ? 'text.secondary' : 'warning.main'}
                sx={{ overflowWrap: 'anywhere' }}
            >
                {blocker ??
                    'Ready to create a KERIA W3C presentation transaction from this verifier request.'}
            </Typography>
            {presentationActionResult !== null && (
                <Typography
                    data-testid="w3c-presentation-action-result"
                    data-state={
                        presentationActionResult.ok ? 'accepted' : 'error'
                    }
                    data-request-id={presentationActionResult.requestId ?? ''}
                    data-operation-route={
                        presentationActionResult.operationRoute ?? ''
                    }
                    variant="caption"
                    color={
                        presentationActionResult.ok
                            ? 'success.main'
                            : 'error.main'
                    }
                    sx={{ overflowWrap: 'anywhere' }}
                >
                    {presentationActionResult.message}
                </Typography>
            )}
        </Stack>
    );
};

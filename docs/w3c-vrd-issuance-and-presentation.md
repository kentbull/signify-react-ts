# W3C VRD Issuance And Presentation

This guide covers the React app's holder-based W3C VRD path. It is for
maintainers debugging the UI, Effection workflows, and Signify/KERIA boundary.

## Ownership Model

- QVI issuer wallet starts W3C issuance from the native issuer-side VRD ACDC.
- KERIA stages issuance, import, presentation, verifier submission, and durable
  state. KERIA does not sign VC-JWT or VP-JWT token material.
- The browser edge signs KERIA-staged bytes through `W3CEdgeAutomator` after
  local ownership and workflow policy checks pass.
- LE holder wallet presents only after it receives the W3C grant, imports it,
  and completes holder admit for exactly one eligible held W3C credential.

## Issuance Flow

The `Start W3C issuance` control appears only for issuer-side VRD records that
the local wallet can issue as W3C VC-JWTs. It is a QVI-side manual fallback,
not an LE holder action.

The button is enabled only when:

- the credential schema is the supported VRD schema,
- the native credential state is issuer-active,
- the connected wallet controls the issuer AID,
- the issuer did:webs DID is ready,
- no conflicting credential command is already running.

`startW3CIssuanceService` posts to
`/identifiers/{issuer}/w3c/credentials`, then runs a foreground
`W3CEdgeAutomator` scoped to that issuer alias, issuer AID, and issuance id.
That automator signs only issuer VC proof/JWT requests for the issuance it just
started.

`pending_signature` means KERIA is waiting for edge signatures. In this app,
that usually means the foreground automator did not run, the wrong wallet is
connected, did:webs state changed, or the issuer policy rejected a request
whose alias, AID, purpose, or issuance id did not match.

## Holder Presentation Flow

`presentCredentialService` starts a KERIA presentation transaction from a
runtime verifier request descriptor. KERIA matches held W3C credentials and
creates a holder VP-JWT signing request only when exactly one eligible held
credential exists.

The app records a short-lived local approval containing:

- presentation transaction id,
- holder alias and AID,
- selected native credential SAID,
- verifier audience,
- verifier nonce,
- expiry.

The background did:webs/W3C signal worker rechecks the live KERIA transaction
before signing. It verifies the holder, signing request id, audience, nonce,
and selected held credential source SAID. Holder VP signing fails closed unless
that approval still matches.

`presentation requires exactly one eligible held credential` is a KERIA wallet
state failure. The holder has either not imported/admitted the W3C VRD yet, or
has duplicate eligible held W3C credentials. Issue from the QVI first, then let
the LE holder import/admit before presenting.

## Signal And Polling Behavior

The session worker in `liveDidWebsPublicationOp` handles both did:webs and W3C
signals. SSE is the low-latency path. Polling is the durable fallback because
SSE signals are transient and KERIA remains the source of truth.

Polling does not relax edge signing. It only fetches the same durable KERIA
signing/import queues that SSE would have signaled.

## Validation

The holder-presentation smoke script uses Puppeteer against a running app and
live services. It is not a mock or fixture-only test. The script expects live
KERIA, a seeded holder wallet, a W3C credential path, and live Python, Node,
and Go verifier services.

Do not use a CLI verifier command or verifier test double as acceptance
evidence for this path.

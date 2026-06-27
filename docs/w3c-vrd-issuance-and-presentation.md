# W3C VRD Issuance And Presentation

This guide covers the React app's holder-based W3C VRD path. It is for
maintainers debugging the UI, Effection workflows, and Signify/KERIA boundary.

## Ownership Model

- QVI issuer wallet starts W3C issuance from the native issuer-side VRD ACDC.
- The browser edge assembles and signs VC-JWT and VP-JWT artifacts through
  `signify-w3c`.
- KERIA validates edge-provided artifacts, records durable state, forwards issuer
  grants, and submits holder presentations to verifier endpoints.
- LE holder wallet presents only after it receives a W3C grant and KERIA
  materializes exactly one eligible held W3C credential for the clicked source
  credential.

## Issuance Flow

The `Start W3C issuance` control appears only for issuer-side VRD records that
the local wallet can issue as W3C VC-JWTs. It is a QVI-side manual fallback,
not an LE holder action.

The button is enabled only when:

- the credential schema is the supported VRD schema,
- the native credential state is issuer-active,
- the connected wallet controls the issuer AID,
- no conflicting credential command is already running.

`startW3CIssuanceService` calls `signify-did-webs` to ensure issuer did:webs
setup, then calls `signify-w3c` to create an issuance context, build and sign
the VC-JWT at the edge, submit the VC-JWT to KERIA for validation, and sign and
submit the issuer grant EXN. The workflow uses
`/identifiers/{issuer}/w3c/issuances`.

## Holder Presentation Flow

`presentCredentialService` calls `signify-did-webs` to ensure holder did:webs
setup, resolves the clicked source credential SAID to a held W3C credential,
builds and signs the VP-JWT through `signify-w3c`, then submits one request to
`/identifiers/{holder}/w3c/presentations`. KERIA validates the VP-JWT binding
to holder DID, selected credential, audience, nonce, response endpoint, and
wallet state before forwarding it to the verifier.

If presentation cannot resolve a held W3C credential, issue from the QVI first
and wait for the holder wallet to receive the W3C grant. Duplicate or missing
held W3C records are wallet state failures, not signing-request failures.

## Foreground Setup Behavior

W3C issuance and presentation are foreground user-driven credential operations.
They ensure did:webs setup at action time and do not use a session did:webs
SSE/polling worker, background W3C signing/import queues, or local holder
approval records.

## Validation

The holder-presentation smoke script uses Puppeteer against a running app and
live services. It is not a mock or fixture-only test. The script expects live
KERIA, a seeded holder wallet, a W3C credential path, and live Python, Node,
and Go verifier services.

Do not use a CLI verifier command or verifier test double as acceptance
evidence for this path.

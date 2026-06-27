import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer';
import { SignifyClient, Tier, ready } from 'signify-ts';

/**
 * Browser smoke for the holder-based W3C VRD presentation path.
 *
 * This is attach-mode only: it requires live KERIA, a seeded holder wallet, and
 * live verifier services. It does not mock KERIA routes or verifier responses.
 */
const appUrl = process.env.W3C_HOLDER_SMOKE_URL ?? 'http://127.0.0.1:5176';
const keriaAdminUrl =
    process.env.VITE_KERIA_ADMIN_URL ?? 'http://127.0.0.1:3901';
const keriaBootUrl = process.env.VITE_KERIA_BOOT_URL ?? 'http://127.0.0.1:3903';
const dashboardUrl =
    process.env.W3C_DASHBOARD_URL ??
    process.env.W3C_HOLDER_SMOKE_DASHBOARD_URL ??
    'http://127.0.0.1:8791';
const manifestPath = process.env.W3C_HOLDER_SMOKE_MANIFEST;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const readManifest = () => {
    if (manifestPath === undefined || manifestPath.length === 0) {
        return {};
    }
    return JSON.parse(readFileSync(manifestPath, 'utf8'));
};

const parseJsonEnv = (name) => {
    const value = process.env[name];
    if (value === undefined || value.trim().length === 0) {
        return undefined;
    }
    return JSON.parse(value);
};

const firstString = (...values) => {
    for (const value of values) {
        if (typeof value === 'string' && value.trim().length > 0) {
            return value.trim();
        }
    }
    return undefined;
};

const required = (label, value) => {
    if (value === undefined) {
        throw new Error(
            `${label} is required. Set W3C_HOLDER_SMOKE_MANIFEST or the explicit W3C_HOLDER_* environment variables.`
        );
    }
    return value;
};

const logStage = (stage, details = {}) => {
    console.log(JSON.stringify({ stage, ...details }));
};

const manifest = readManifest();
const liveVerifierDescriptor = (serviceName, hostUrl, submissionUrl) => {
    if (typeof hostUrl !== 'string' || hostUrl.trim().length === 0) {
        return undefined;
    }
    const publicBase = hostUrl.trim().replace(/\/$/, '');
    const submissionBase =
        typeof submissionUrl === 'string' && submissionUrl.trim().length > 0
            ? submissionUrl.trim().replace(/\/$/, '')
            : publicBase;
    return {
        verifierId: serviceName,
        verifierLabel: `${serviceName} live verifier`,
        verifierOrigin: publicBase,
        origin: publicBase,
        format: 'vp+jwt',
        formats: ['vp+jwt'],
        aud: `${publicBase}/verify/vp`,
        response_uri: `${submissionBase}/verify/vp`,
        submissionEndpoint: `${submissionBase}/verify/vp`,
    };
};

const defaultVerifierRequests = () =>
    [
        liveVerifierDescriptor(
            'isomer-python',
            firstString(
                process.env.VITE_W3C_ISOMER_PYTHON_PUBLIC_URL,
                process.env.W3C_PYTHON_VERIFIER_URL,
                'http://127.0.0.1:8788'
            ),
            firstString(
                process.env.VITE_W3C_ISOMER_PYTHON_SUBMISSION_URL,
                process.env.W3C_PYTHON_VERIFIER_SUBMISSION_URL,
                'http://isomer-python:8788'
            )
        ),
        liveVerifierDescriptor(
            'isomer-node',
            firstString(
                process.env.VITE_W3C_ISOMER_NODE_PUBLIC_URL,
                process.env.W3C_NODE_VERIFIER_URL,
                'http://127.0.0.1:8789'
            ),
            firstString(
                process.env.VITE_W3C_ISOMER_NODE_SUBMISSION_URL,
                process.env.W3C_NODE_VERIFIER_SUBMISSION_URL,
                'http://isomer-node:8788'
            )
        ),
        liveVerifierDescriptor(
            'isomer-go',
            firstString(
                process.env.VITE_W3C_ISOMER_GO_PUBLIC_URL,
                process.env.W3C_GO_VERIFIER_URL,
                'http://127.0.0.1:8790'
            ),
            firstString(
                process.env.VITE_W3C_ISOMER_GO_SUBMISSION_URL,
                process.env.W3C_GO_VERIFIER_SUBMISSION_URL,
                'http://isomer-go:8788'
            )
        ),
    ].filter((descriptor) => descriptor !== undefined);

const verifierRequest = parseJsonEnv('W3C_VERIFIER_REQUEST_JSON');
const verifierRequests =
    parseJsonEnv('W3C_VERIFIER_REQUESTS_JSON') ??
    (verifierRequest === undefined ? undefined : [verifierRequest]) ??
    manifest.verifierRequestDescriptors ??
    manifest.verifierDescriptors ??
    (manifest.verifierDescriptor === undefined
        ? defaultVerifierRequests()
        : [manifest.verifierDescriptor]);

const holderPasscode = required(
    'holder passcode',
    firstString(
        process.env.W3C_HOLDER_PASSCODE,
        manifest.holderPasscode,
        manifest.holderWallet?.passcode
    )
);
const holderAlias = required(
    'holder alias',
    firstString(
        process.env.W3C_HOLDER_ALIAS,
        manifest.holderAlias,
        manifest.holderWallet?.name
    )
);
const holderAidHint = firstString(
    process.env.W3C_HOLDER_AID,
    manifest.holderAid,
    manifest.holderWallet?.aid
);
const issuerPasscode = required(
    'issuer passcode',
    firstString(
        process.env.W3C_ISSUER_PASSCODE,
        process.env.W3C_QVI_PASSCODE,
        manifest.issuerPasscode,
        manifest.qviWallet?.passcode
    )
);
const issuerAlias = required(
    'issuer alias',
    firstString(
        process.env.W3C_ISSUER_ALIAS,
        process.env.W3C_QVI_ALIAS,
        manifest.issuerAlias,
        manifest.qviWallet?.name
    )
);
const issuerAidHint = firstString(
    process.env.W3C_ISSUER_AID,
    process.env.W3C_QVI_AID,
    manifest.issuerAid,
    manifest.qviWallet?.aid
);
const credentialSaid = required(
    'credential SAID',
    firstString(
        process.env.W3C_CREDENTIAL_SAID,
        manifest.credentialSaid,
        manifest.sourceCredentialSaid,
        manifest.holderCredentials?.[0]?.sourceCredentialSaid
    )
);
if (!Array.isArray(verifierRequests) || verifierRequests.length === 0) {
    throw new Error(
        'At least one live verifier request descriptor is required through W3C_VERIFIER_REQUESTS_JSON, W3C_VERIFIER_REQUEST_JSON, or the manifest.'
    );
}

const canReachApp = async () => {
    try {
        const response = await fetch(appUrl);
        return response.ok;
    } catch {
        return false;
    }
};

const waitForApp = async () => {
    for (let attempt = 0; attempt < 60; attempt += 1) {
        if (await canReachApp()) {
            return;
        }
        await sleep(500);
    }
    throw new Error(`Vite app did not become reachable at ${appUrl}`);
};

const startViteIfNeeded = async () => {
    if (await canReachApp()) {
        return null;
    }

    const url = new URL(appUrl);
    const child = spawn(
        'pnpm',
        [
            'exec',
            'vite',
            '--host',
            url.hostname,
            '--port',
            url.port,
            '--strictPort',
        ],
        {
            stdio: 'ignore',
            env: {
                ...process.env,
                BROWSER: 'none',
            },
        }
    );

    await waitForApp();
    return child;
};

const setInputValue = async (page, selector, value) => {
    await waitForElement(page, selector, 10000);
    await page.evaluate(
        ({ targetSelector, nextValue }) => {
            const element = globalThis.document.querySelector(targetSelector);
            if (
                !(element instanceof globalThis.HTMLInputElement) &&
                !(element instanceof globalThis.HTMLTextAreaElement)
            ) {
                throw new Error(
                    `Input not found for selector ${targetSelector}`
                );
            }
            const valueSetter =
                element instanceof globalThis.HTMLTextAreaElement
                    ? Object.getOwnPropertyDescriptor(
                          globalThis.HTMLTextAreaElement.prototype,
                          'value'
                      )?.set
                    : Object.getOwnPropertyDescriptor(
                          globalThis.HTMLInputElement.prototype,
                          'value'
                      )?.set;
            if (valueSetter === undefined) {
                throw new Error(
                    `Unable to set input value for selector ${targetSelector}`
                );
            }
            element.focus();
            valueSetter.call(element, nextValue);
            element.dispatchEvent(
                new globalThis.Event('input', { bubbles: true })
            );
            element.dispatchEvent(
                new globalThis.Event('change', { bubbles: true })
            );
        },
        { targetSelector: selector, nextValue: value }
    );
};

const dispatchClick = async (page, selector) => {
    await waitForElement(page, selector, 10000);
    await page.evaluate((targetSelector) => {
        const element = globalThis.document.querySelector(targetSelector);
        if (!(element instanceof globalThis.HTMLElement)) {
            throw new Error(
                `Clickable element not found for ${targetSelector}`
            );
        }
        element.focus();
        element.click();
    }, selector);
};

const waitForDomState = async (
    page,
    label,
    predicate,
    timeoutMs = 30000,
    ...args
) => {
    const timeoutAt = Date.now() + timeoutMs;
    let lastState = null;
    while (Date.now() < timeoutAt) {
        try {
            lastState = await page.evaluate(predicate, ...args);
            if (lastState === true) {
                return;
            }
        } catch (error) {
            lastState = error instanceof Error ? error.message : String(error);
        }
        await sleep(250);
    }
    throw new Error(
        `Timed out waiting for ${label}. Last state: ${JSON.stringify(lastState)}`
    );
};

const waitForElement = async (page, selector, timeoutMs = 30000) =>
    waitForDomState(
        page,
        `element ${selector}`,
        (targetSelector) =>
            globalThis.document.querySelector(targetSelector) !== null,
        timeoutMs,
        selector
    );

const waitForElementAttribute = async (
    page,
    selector,
    attribute,
    expectedValue,
    label,
    timeoutMs = 30000
) =>
    waitForDomState(
        page,
        label,
        (targetSelector, targetAttribute, targetValue) => {
            const element = globalThis.document.querySelector(targetSelector);
            if (!(element instanceof globalThis.HTMLElement)) {
                return `missing element ${targetSelector}`;
            }
            const actual = element.getAttribute(targetAttribute);
            if (actual === targetValue) {
                return true;
            }
            return {
                actual,
                text: element.textContent?.trim() ?? '',
            };
        },
        timeoutMs,
        selector,
        attribute,
        expectedValue
    );

const waitForEnabledButton = async (
    page,
    selector,
    label,
    timeoutMs = 30000
) =>
    waitForDomState(
        page,
        label,
        (targetSelector) => {
            const button = globalThis.document.querySelector(targetSelector);
            if (!(button instanceof globalThis.HTMLButtonElement)) {
                return `missing button ${targetSelector}`;
            }
            if (button.disabled) {
                return {
                    disabled: true,
                    text: button.textContent?.trim() ?? '',
                };
            }
            return true;
        },
        timeoutMs,
        selector
    );

const waitForAcceptedActionResult = async (
    page,
    selector,
    label,
    timeoutMs = 30000
) =>
    waitForDomState(
        page,
        label,
        (targetSelector) => {
            const result = globalThis.document.querySelector(targetSelector);
            if (!(result instanceof globalThis.HTMLElement)) {
                return `missing action result ${targetSelector}`;
            }
            const state = result.getAttribute('data-state');
            if (state === 'accepted') {
                return true;
            }
            return {
                state,
                text: result.textContent?.trim() ?? '',
            };
        },
        timeoutMs,
        selector
    );

const relevantBrowserRequest = (request) => {
    const url = new URL(request.url());
    const method = request.method();
    if (
        url.origin === appUrl.replace(/\/$/, '') &&
        url.pathname === '/credentials' &&
        method !== 'GET'
    ) {
        return true;
    }
    if (url.origin === keriaAdminUrl.replace(/\/$/, '')) {
        return url.pathname.includes('/w3c/');
    }
    return (
        url.pathname === '/verify/vp' ||
        url.pathname.startsWith('/operations/')
    );
};

const clickWithDiagnostics = async (page, selector, label) => {
    logStage(`${label}.click.start`);
    const hitState = await page.evaluate((targetSelector) => {
        const element = globalThis.document.querySelector(targetSelector);
        if (!(element instanceof globalThis.HTMLButtonElement)) {
            return { found: false };
        }
        element.scrollIntoView({
            block: 'center',
            inline: 'center',
            behavior: 'instant',
        });
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const hit = globalThis.document.elementFromPoint(centerX, centerY);
        const hitInsideTarget =
            hit instanceof globalThis.Node ? element.contains(hit) : false;
        return {
            found: true,
            disabled: element.disabled,
            hitInsideTarget,
            text: element.textContent?.trim() ?? '',
            rect: {
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
            },
            hitTag: hit?.tagName ?? null,
            hitTestId:
                hit instanceof globalThis.HTMLElement
                    ? hit.dataset.testid ?? null
                    : null,
            hitText:
                hit instanceof globalThis.HTMLElement
                    ? hit.textContent?.trim() ?? ''
                    : '',
        };
    }, selector);
    await sleep(250);

    if (hitState.found !== true || hitState.disabled === true) {
        throw new Error(
            `Cannot click ${selector}. Hit state: ${JSON.stringify(hitState)}`
        );
    }

    await page.evaluate((targetSelector) => {
        const element = globalThis.document.querySelector(targetSelector);
        if (!(element instanceof globalThis.HTMLButtonElement)) {
            throw new Error(`Clickable button not found for ${targetSelector}`);
        }
        globalThis.setTimeout(() => element.click(), 0);
    }, selector);
    logStage(`${label}.click.dispatched`, { hitState });
};

const navigateInApp = async (page, path) => {
    await page.evaluate((nextPath) => {
        globalThis.history.pushState({}, '', nextPath);
        globalThis.dispatchEvent(
            new globalThis.PopStateEvent('popstate', {
                state: globalThis.history.state,
            })
        );
    }, path);
};

const connectBrowserWallet = async (page, passcode, role) => {
    logStage('browser.goto', { appUrl, role });
    await page.goto(appUrl, { waitUntil: 'networkidle0' });
    logStage('browser.connect.open', { role });
    await dispatchClick(page, '[data-testid="connect-open"]');
    await waitForElement(page, '[data-testid="connect-dialog"]');
    logStage('browser.connect.passcode', { role });
    await setInputValue(page, '#outlined-password-input', passcode);
    await dispatchClick(page, '[data-testid="connect-submit"]');
    logStage('browser.connect.submitted', { role });
    await waitForDomState(
        page,
        `${role} connected dashboard`,
        () =>
            globalThis.document.querySelector(
                '[data-testid="connect-dialog"]'
            ) === null &&
            globalThis.document.querySelector(
                '[data-testid="dashboard-view"]'
            ) !== null
    );
    logStage('browser.connect.ready', { role });
};

const connectKeriaClient = async (passcode) => {
    await ready();
    const client = new SignifyClient(
        keriaAdminUrl,
        passcode,
        Tier.low,
        keriaBootUrl
    );
    await client.connect();
    return client;
};

const resolveIdentifierAid = async (client, alias, aidHint) => {
    if (aidHint !== undefined) {
        return aidHint;
    }
    const hab = await client.identifiers().get(alias);
    if (typeof hab?.prefix !== 'string' || hab.prefix.length === 0) {
        throw new Error(`Unable to resolve AID for identifier ${alias}`);
    }
    return hab.prefix;
};

const getJson = async (client, path) => {
    const response = await client.fetch(path, 'GET', null);
    if (!response.ok) {
        throw new Error(
            `KERIA GET ${path} failed: ${response.status} ${response.statusText}`
        );
    }
    return response.json();
};

const descriptorAudience = (descriptor) =>
    descriptor.aud ?? descriptor.client_id ?? null;

const descriptorResponseUri = (descriptor) =>
    descriptor.response_uri ?? descriptor.submissionEndpoint ?? null;

const descriptorOperationBase = (descriptor) =>
    descriptor.verifierOperationBaseUrl ??
    descriptor.verifierOrigin ??
    descriptor.origin ??
    descriptorResponseUri(descriptor);

const uiVerifierId = (descriptor) => {
    const id = descriptor.verifierId;
    if (id === 'python') {
        return 'isomer-python';
    }
    if (id === 'node') {
        return 'isomer-node';
    }
    if (id === 'go') {
        return 'isomer-go';
    }
    return typeof id === 'string' && id.startsWith('isomer-')
        ? id
        : undefined;
};

const readVerifierRequestDescriptor = async (page, controlsSelector) =>
    page.evaluate((selector) => {
        const root = globalThis.document.querySelector(selector);
        const input = root?.querySelector(
            '[data-testid="w3c-verifier-request-input"] textarea'
        );
        if (!(input instanceof globalThis.HTMLTextAreaElement)) {
            throw new Error('W3C verifier request textarea not found');
        }
        return JSON.parse(input.value);
    }, controlsSelector);

const verifierDescriptorMatches = (actual, expected, verifierId) =>
    actual.verifierId === verifierId &&
    (descriptorAudience(expected) === null ||
        descriptorAudience(actual) === descriptorAudience(expected)) &&
    (descriptorResponseUri(expected) === null ||
        descriptorResponseUri(actual) === descriptorResponseUri(expected));

const selectVerifierPreset = async (
    page,
    verifierId,
    controlsSelector,
    presentButtonSelector,
    expectedDescriptor
) => {
    logStage('presentation.verifier.select.start', { verifierId });
    await waitForElement(page, controlsSelector, 10000);
    const currentDescriptor = await readVerifierRequestDescriptor(
        page,
        controlsSelector
    );
    const currentSelectionReady = await page.evaluate((buttonSelector) => {
        const button = globalThis.document.querySelector(buttonSelector);
        return button instanceof globalThis.HTMLButtonElement
            ? !button.disabled
            : false;
    }, presentButtonSelector);
    if (
        currentSelectionReady &&
        verifierDescriptorMatches(
            currentDescriptor,
            expectedDescriptor,
            verifierId
        )
    ) {
        logStage('presentation.verifier.select.skip', { verifierId });
        return;
    }

    logStage('presentation.verifier.select.open', { verifierId });
    await page.evaluate((selector) => {
        const root = globalThis.document.querySelector(selector);
        const trigger =
            root?.querySelector('[role="combobox"]') ??
            (root instanceof globalThis.HTMLElement ? root : null);
        if (!(trigger instanceof globalThis.HTMLElement)) {
            throw new Error(`Verifier selector trigger not found for ${selector}`);
        }
        trigger.dispatchEvent(
            new globalThis.MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                view: globalThis.window,
            })
        );
    }, `${controlsSelector} [data-testid="w3c-verifier-selector"]`);
    const optionSelector = `[data-testid="w3c-verifier-option-${verifierId}"]`;
    logStage('presentation.verifier.option.wait', { verifierId });
    await waitForDomState(
        page,
        `W3C verifier option ${verifierId}`,
        (selector) => {
            const option = globalThis.document.querySelector(selector);
            return option instanceof globalThis.HTMLElement;
        },
        30000,
        optionSelector
    );
    logStage('presentation.verifier.option.click', { verifierId });
    await dispatchClick(page, optionSelector);
    await waitForDomState(
        page,
        `W3C verifier ${verifierId} selected`,
        (expectedVerifierId, selector, buttonSelector) => {
            const root = globalThis.document.querySelector(selector);
            const input = root?.querySelector(
                '[data-testid="w3c-verifier-request-input"] textarea'
            );
            const button = globalThis.document.querySelector(buttonSelector);
            if (
                !(input instanceof globalThis.HTMLTextAreaElement) ||
                !(button instanceof globalThis.HTMLButtonElement)
            ) {
                return false;
            }
            try {
                const descriptor = JSON.parse(input.value);
                return (
                    descriptor.verifierId === expectedVerifierId &&
                    !button.disabled
                );
            } catch {
                return false;
            }
        },
        30000,
        verifierId,
        controlsSelector,
        presentButtonSelector
    );
    logStage('presentation.verifier.select.ready', { verifierId });
};

const heldW3CCredentialIds = async (client) => {
    const body = await getJson(
        client,
        `/identifiers/${encodeURIComponent(holderAlias)}/w3c/credentials`
    );
    const credentials = Array.isArray(body.credentials) ? body.credentials : [];
    return new Set(
        credentials
            .map((credential) => credential.credentialId)
            .filter((id) => typeof id === 'string' && id.length > 0)
    );
};

const waitForHolderHeldCredential = async (client, existingIds) => {
    for (let attempt = 0; attempt < 240; attempt += 1) {
        const body = await getJson(
            client,
            `/identifiers/${encodeURIComponent(holderAlias)}/w3c/credentials`
        );
        const credentials = Array.isArray(body.credentials)
            ? body.credentials
            : [];
        const admitted = credentials.filter(
            (credential) =>
                typeof credential.credentialId === 'string' &&
                credential.sourceCredentialSaid === credentialSaid &&
                credential.state === 'admitted'
        );
        const eligible = admitted.filter(
            (credential) => !existingIds.has(credential.credentialId)
        );
        if (eligible.length === 1) {
            logStage('holder.heldCredential.ready', {
                credentialId: eligible[0].credentialId,
                state: eligible[0].state,
            });
            return eligible[0];
        }
        if (eligible.length > 1) {
            throw new Error(
                `Holder has multiple eligible W3C credentials for ${credentialSaid}: ${eligible
                    .map((credential) => credential.credentialId)
                    .join(', ')}`
            );
        }
        if (
            admitted.length === 1 &&
            existingIds.has(admitted[0].credentialId)
        ) {
            logStage('holder.heldCredential.reuseExisting', {
                credentialId: admitted[0].credentialId,
                state: admitted[0].state,
            });
            return admitted[0];
        }
        if (admitted.length > 1) {
            throw new Error(
                `Holder has multiple admitted W3C credentials for ${credentialSaid}: ${admitted
                    .map((credential) => credential.credentialId)
                    .join(', ')}`
            );
        }

        await sleep(1000);
    }

    throw new Error(
        `Timed out waiting for holder W3C credential admitted from ${credentialSaid}`
    );
};

const startIssuerW3CIssuance = async (page, issuerAid) => {
    const issuanceButtonSelector = `[data-testid="w3c-start-issuance-button"][data-credential-said="${credentialSaid}"]`;
    const issuanceStatusSelector = `[data-testid="w3c-issuance-status"][data-credential-said="${credentialSaid}"]`;
    const issuanceActionResultSelector = `[data-testid="w3c-issuance-action-result"][data-credential-said="${credentialSaid}"]`;
    logStage('issuer.credential.goto', { issuerAlias, credentialSaid });
    await navigateInApp(
        page,
        `/credentials/${encodeURIComponent(issuerAid)}/issuer`
    );
    await waitForElementAttribute(
        page,
        issuanceStatusSelector,
        'data-state',
        'ready',
        'W3C issuance controls',
        120000
    );
    logStage('issuer.issuance.ready', { issuerAlias, credentialSaid });
    await waitForEnabledButton(
        page,
        issuanceButtonSelector,
        'W3C issuance button ready'
    );
    await dispatchClick(page, issuanceButtonSelector);
    await waitForAcceptedActionResult(
        page,
        issuanceActionResultSelector,
        'W3C issuance action accepted',
        30000
    );
    logStage('issuer.issuance.started', { issuerAlias, credentialSaid });
};

const openNotificationDetailByText = async (page, label, textFragment) => {
    await waitForDomState(
        page,
        `${label} notification list item`,
        (fragment) => {
            const links = [
                ...globalThis.document.querySelectorAll(
                    'a[href^="/notifications/"]'
                ),
            ];
            const link = links.find((candidate) => {
                const container =
                    candidate.closest('li') ??
                    candidate.closest('[data-testid$="notification-card"]') ??
                    candidate;
                return container.textContent?.includes(fragment) === true;
            });
            if (link instanceof globalThis.HTMLAnchorElement) {
                link.click();
                return true;
            }
            return {
                linkCount: links.length,
                body: globalThis.document.body.textContent?.slice(0, 1000),
            };
        },
        60000,
        textFragment
    );
};

const waitForHolderW3CGrantNotification = async (page) => {
    await navigateInApp(page, '/notifications');
    await waitForDomState(
        page,
        'holder W3C grant materialized notification',
        (sourceCredentialSaid) => {
            const body = globalThis.document.body.textContent ?? '';
            return (
                body.includes('W3C VC-JWT grant materialized') &&
                body.includes(sourceCredentialSaid) &&
                body.includes('materialized')
            );
        },
        120000,
        credentialSaid
    );
    await openNotificationDetailByText(
        page,
        'W3C grant',
        'W3C VC-JWT grant materialized'
    );
    await waitForDomState(
        page,
        'W3C grant detail VC-JWT payload',
        () => {
            const body = globalThis.document.body.textContent ?? '';
            return (
                body.includes('Granted VC-JWT') &&
                body.includes('JOSE header') &&
                body.includes('JWT payload') &&
                body.includes('Raw compact token')
            );
        },
        60000
    );
    logStage('holder.w3cGrant.notification.materialized', {
        credentialSaid,
    });
};

const waitForPresentationNotificationDetail = async (page) => {
    await navigateInApp(page, '/notifications');
    await waitForDomState(
        page,
        'credential presented app notification',
        () =>
            (globalThis.document.body.textContent ?? '').includes(
                'Credential presented'
            ),
        60000
    );
    await openNotificationDetailByText(
        page,
        'presentation',
        'Credential presented'
    );
    await waitForDomState(
        page,
        'presentation notification W3C artifact details',
        () => {
            const body = globalThis.document.body.textContent ?? '';
            return (
                body.includes('VP-JWT') &&
                body.includes('VC-JWT') &&
                body.includes('Verifier Request') &&
                body.includes('Nested VC-JWTs')
            );
        },
        60000
    );
    logStage('presentation.notification.artifacts.visible');
};

const presentationIds = async (client) => {
    const body = await getJson(
        client,
        `/identifiers/${encodeURIComponent(holderAlias)}/w3c/presentations`
    );
    const txs = Array.isArray(body.presentations) ? body.presentations : [];
    return new Set(
        txs
            .map((tx) => tx.presentationId)
            .filter((id) => typeof id === 'string' && id.length > 0)
    );
};

const waitForPresentationTx = async (client, descriptor, existingIds) => {
    const expectedAud = descriptorAudience(descriptor);
    const expectedResponseUri = descriptorResponseUri(descriptor);
    let lastMatchingTx = null;
    let lastLoggedTxState = null;

    for (let attempt = 0; attempt < 180; attempt += 1) {
        const body = await getJson(
            client,
            `/identifiers/${encodeURIComponent(holderAlias)}/w3c/presentations`
        );
        const txs = Array.isArray(body.presentations)
            ? body.presentations
            : [];
        const tx = txs.find((candidate) => {
            const request = candidate.requestDescriptor ?? {};
            const presentationId = candidate.presentationId;
            return (
                typeof presentationId === 'string' &&
                !existingIds.has(presentationId) &&
                candidate.aud === expectedAud &&
                candidate.responseUri === expectedResponseUri &&
                request.credentialSaid === credentialSaid
            );
        });

        if (tx !== undefined) {
            lastMatchingTx = tx;
            const presentationId = tx.presentationId ?? null;
            const stateKey = `${presentationId ?? ''}:${tx.state ?? ''}`;
            if (stateKey !== lastLoggedTxState) {
                lastLoggedTxState = stateKey;
                logStage('presentation.tx.state', {
                    presentationId,
                    state: tx.state ?? null,
                });
            }
        }
        if (tx?.state === 'failed') {
            throw new Error(
                `KERIA presentation transaction failed: ${tx.error ?? JSON.stringify(tx)}`
            );
        }
        if (
            (tx?.state === 'submitted' || tx?.state === 'verified') &&
            typeof tx.verifierResponse === 'object' &&
            tx.verifierResponse !== null
        ) {
            return tx;
        }
        await sleep(1000);
    }

    if (lastMatchingTx !== null) {
        throw new Error(
            `Timed out waiting for W3C presentation ${lastMatchingTx.presentationId}. Last state: ${lastMatchingTx.state}.`
        );
    }
    throw new Error(
        `Timed out waiting for new KERIA presentation tx for ${credentialSaid}`
    );
};

const waitForVerifierOperation = async (descriptor, tx) => {
    const operationBase = required(
        'descriptor verifier origin or response_uri',
        descriptorOperationBase(descriptor)
    );
    const operationName = tx.verifierResponse?.name;
    if (typeof operationName !== 'string' || operationName.length === 0) {
        throw new Error(
            `KERIA verifierResponse did not include an operation name: ${JSON.stringify(tx.verifierResponse)}`
        );
    }
    const operationUrl = new URL(
        `/operations/${encodeURIComponent(operationName)}`,
        operationBase
    ).toString();

    for (let attempt = 0; attempt < 180; attempt += 1) {
        const response = await fetch(operationUrl, {
            headers: { Accept: 'application/json' },
        });
        if (!response.ok) {
            throw new Error(
                `Verifier operation fetch failed: ${response.status} ${response.statusText}`
            );
        }
        const operation = await response.json();
        if (operation.done === true) {
            if (operation.error !== undefined && operation.error !== null) {
                throw new Error(
                    `Verifier operation failed: ${JSON.stringify(operation.error)}`
                );
            }
            if (
                operation.response?.ok !== true &&
                operation.response?.accepted !== true
            ) {
                throw new Error(
                    `Verifier operation did not accept the presentation: ${JSON.stringify(operation)}`
                );
            }
            return operation;
        }
        await sleep(1000);
    }

    throw new Error(
        `Timed out waiting for verifier operation ${operationName}`
    );
};

const dashboardPresentationEvents = async () => {
    const apiUrl = new URL('/api/presentations', dashboardUrl).toString();
    const response = await fetch(apiUrl, {
        headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
        throw new Error(
            `Dashboard presentation fetch failed: ${response.status} ${response.statusText}`
        );
    }
    const events = await response.json();
    if (!Array.isArray(events)) {
        throw new Error(
            `Dashboard presentation API did not return a list: ${JSON.stringify(events)}`
        );
    }
    return events;
};

const dashboardEventKey = (event) => {
    if (typeof event?.eventId === 'string' && event.eventId.length > 0) {
        return event.eventId;
    }
    const presentationId = event?.presentation?.id ?? '';
    const receivedAt = event?.receivedAt ?? '';
    return `${receivedAt}:${presentationId}`;
};

const dashboardEventKeys = async () =>
    new Set((await dashboardPresentationEvents()).map(dashboardEventKey));

const waitForDashboardPresentation = async (tx, descriptor, existingEventKeys) => {
    const expectedCredentialId = `urn:said:${credentialSaid}`;
    const expectedVerifierId = uiVerifierId(descriptor) ?? descriptor.verifierId;

    for (let attempt = 0; attempt < 120; attempt += 1) {
        const events = await dashboardPresentationEvents();
        const event = events.find((candidate) => {
            if (existingEventKeys.has(dashboardEventKey(candidate))) {
                return false;
            }
            const verifierId =
                candidate?.verifier?.id ?? candidate?.verifier?.type ?? null;
            const credentials = Array.isArray(
                candidate?.presentation?.credentials
            )
                ? candidate.presentation.credentials
                : [];
            return (
                verifierId === expectedVerifierId &&
                credentials.some(
                    (credential) => credential?.id === expectedCredentialId
                )
            );
        });
        if (event !== undefined) {
            logStage('dashboard.presentation.received', {
                presentationId: tx.presentationId,
                eventId: event.eventId ?? null,
                verifierId: event.verifier?.id ?? event.verifier?.type ?? null,
                credentialId: expectedCredentialId,
            });
            return event;
        }
        await sleep(500);
    }

    throw new Error(
        `Timed out waiting for dashboard webhook event for ${expectedCredentialId}`
    );
};

const chromeArgs =
    process.env.CI === 'true'
        ? ['--no-sandbox', '--disable-setuid-sandbox']
        : [];

const vite = await startViteIfNeeded();
const browser = await puppeteer.launch({
    headless: 'new',
    args: chromeArgs,
    protocolTimeout: 300000,
});

try {
    const preparePage = async (role) => {
        const context = await browser.createBrowserContext();
        const page = await context.newPage();
        page.setDefaultTimeout(60000);
        page.setDefaultNavigationTimeout(60000);
        page.on('pageerror', (error) => {
            console.error(
                JSON.stringify({
                    stage: 'browser.pageerror',
                    role,
                    error: error.message,
                })
            );
        });
        page.on('console', (message) => {
            if (message.type() === 'error') {
                console.error(
                    JSON.stringify({
                        stage: 'browser.console.error',
                        role,
                        text: message.text(),
                    })
                );
            }
        });
        page.on('request', (request) => {
            if (relevantBrowserRequest(request)) {
                logStage('browser.request', {
                    role,
                    method: request.method(),
                    url: request.url(),
                });
            }
        });
        page.on('response', (response) => {
            if (relevantBrowserRequest(response.request())) {
                logStage('browser.response', {
                    role,
                    status: response.status(),
                    url: response.url(),
                });
            }
        });
        return { context, page };
    };

    const issuer = await preparePage('issuer');
    const holder = await preparePage('holder');
    const issuerClient = await connectKeriaClient(issuerPasscode);
    const holderClient = await connectKeriaClient(holderPasscode);
    const issuerAid = await resolveIdentifierAid(
        issuerClient,
        issuerAlias,
        issuerAidHint
    );
    const holderAid = await resolveIdentifierAid(
        holderClient,
        holderAlias,
        holderAidHint
    );

    await connectBrowserWallet(issuer.page, issuerPasscode, 'issuer');
    await connectBrowserWallet(holder.page, holderPasscode, 'holder');
    const existingHeldCredentialIds = await heldW3CCredentialIds(holderClient);
    await startIssuerW3CIssuance(issuer.page, issuerAid);
    await waitForHolderHeldCredential(holderClient, existingHeldCredentialIds);
    await waitForHolderW3CGrantNotification(holder.page);

    const page = holder.page;
    const client = holderClient;
    const presentationControlsSelector = `[data-testid="w3c-presentation-controls-${credentialSaid}"]`;
    const presentationButtonSelector = `[data-testid="w3c-present-button"][data-credential-said="${credentialSaid}"]`;
    const presentationStatusSelector = `[data-testid="w3c-presentation-status"][data-credential-said="${credentialSaid}"]`;

    logStage('credential.goto', { credentialSaid });
    await navigateInApp(
        page,
        `/credentials/${encodeURIComponent(holderAid)}/wallet`
    );
    await waitForElementAttribute(
        page,
        presentationStatusSelector,
        'data-state',
        'ready',
        'W3C presentation controls',
    );
    logStage('credential.ready', { credentialSaid });

    for (const expectedDescriptor of verifierRequests) {
        await navigateInApp(
            page,
            `/credentials/${encodeURIComponent(holderAid)}/wallet`
        );
        await waitForElementAttribute(
            page,
            presentationStatusSelector,
            'data-state',
            'ready',
            'W3C presentation controls',
        );
        if (
            typeof expectedDescriptor !== 'object' ||
            expectedDescriptor === null
        ) {
            throw new Error(
                `Verifier descriptor must be a JSON object: ${JSON.stringify(expectedDescriptor)}`
            );
        }
        const verifierId = uiVerifierId(expectedDescriptor);
        if (verifierId === undefined) {
            throw new Error(
                `Verifier descriptor must identify one UI verifier preset: ${JSON.stringify(expectedDescriptor)}`
            );
        }

        logStage('presentation.submit', {
            verifierId,
            aud: descriptorAudience(expectedDescriptor),
        });
        await waitForEnabledButton(
            page,
            presentationButtonSelector,
            'W3C presentation button ready'
        );
        await selectVerifierPreset(
            page,
            verifierId,
            presentationControlsSelector,
            presentationButtonSelector,
            expectedDescriptor
        );
        const beforeClickDescriptor = await readVerifierRequestDescriptor(
            page,
            presentationControlsSelector
        );
        if (
            descriptorAudience(expectedDescriptor) !== null &&
            descriptorAudience(beforeClickDescriptor) !==
                descriptorAudience(expectedDescriptor)
        ) {
            throw new Error(
                `UI verifier audience mismatch: expected ${descriptorAudience(expectedDescriptor)}, got ${descriptorAudience(beforeClickDescriptor)}`
            );
        }
        if (
            descriptorResponseUri(expectedDescriptor) !== null &&
            descriptorResponseUri(beforeClickDescriptor) !==
                descriptorResponseUri(expectedDescriptor)
        ) {
            throw new Error(
                `UI verifier response_uri mismatch: expected ${descriptorResponseUri(expectedDescriptor)}, got ${descriptorResponseUri(beforeClickDescriptor)}`
            );
        }
        const existingPresentationIds = await presentationIds(client);
        const existingDashboardEventKeys = await dashboardEventKeys();
        await clickWithDiagnostics(
            page,
            presentationButtonSelector,
            'presentation'
        );
        const descriptor = beforeClickDescriptor;

        const tx = await waitForPresentationTx(
            client,
            descriptor,
            existingPresentationIds
        );
        const operation = await waitForVerifierOperation(descriptor, tx);
        await waitForDashboardPresentation(
            tx,
            descriptor,
            existingDashboardEventKeys
        );
        const binding = {
            aud: descriptorAudience(descriptor),
            responseUri: descriptorResponseUri(descriptor),
        };
        if (tx.aud !== binding.aud || tx.responseUri !== binding.responseUri) {
            throw new Error(
                `KERIA tx binding mismatch: expected ${JSON.stringify(binding)}, got ${JSON.stringify({ aud: tx.aud, responseUri: tx.responseUri })}`
            );
        }
        await waitForPresentationNotificationDetail(page);
        console.log(
            JSON.stringify({
                stage: 'presentation.accepted',
                verifierId:
                    descriptor.verifierId ?? descriptorResponseUri(descriptor),
                presentationId: tx.presentationId,
                verifierOperation: operation.name,
                accepted: true,
            })
        );
    }
} catch (error) {
    const screenshot = '/tmp/signify-react-ts-w3c-holder-smoke-failure.png';
    try {
        const pages = await browser.pages();
        const page = pages[pages.length - 1];
        if (page !== undefined) {
            await Promise.race([
                page.screenshot({ path: screenshot, fullPage: true }),
                sleep(5000),
            ]);
        }
    } catch {
        // Keep the original error as the failure signal.
    }
    console.error(
        JSON.stringify({
            stage: 'smoke.failed',
            screenshot,
            error: error instanceof Error ? error.message : String(error),
        })
    );
    throw error;
} finally {
    await browser.close();
    if (vite !== null) {
        vite.kill('SIGTERM');
    }
}

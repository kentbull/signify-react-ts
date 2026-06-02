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
const randomNonce = (serviceName) =>
    `react-smoke-${serviceName}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

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
        nonce: randomNonce(serviceName),
        response_uri: `${submissionBase}/verify/vp`,
        submissionEndpoint: `${submissionBase}/verify/vp`,
    };
};

const defaultVerifierRequests = () =>
    [
        liveVerifierDescriptor(
            'python',
            process.env.W3C_PYTHON_VERIFIER_URL,
            process.env.W3C_PYTHON_VERIFIER_SUBMISSION_URL
        ),
        liveVerifierDescriptor(
            'node',
            process.env.W3C_NODE_VERIFIER_URL,
            process.env.W3C_NODE_VERIFIER_SUBMISSION_URL
        ),
        liveVerifierDescriptor(
            'go',
            process.env.W3C_GO_VERIFIER_URL,
            process.env.W3C_GO_VERIFIER_SUBMISSION_URL
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
                !(element instanceof HTMLInputElement) &&
                !(element instanceof HTMLTextAreaElement)
            ) {
                throw new Error(
                    `Input not found for selector ${targetSelector}`
                );
            }
            const valueSetter =
                element instanceof HTMLTextAreaElement
                    ? Object.getOwnPropertyDescriptor(
                          HTMLTextAreaElement.prototype,
                          'value'
                      )?.set
                    : Object.getOwnPropertyDescriptor(
                          HTMLInputElement.prototype,
                          'value'
                      )?.set;
            if (valueSetter === undefined) {
                throw new Error(
                    `Unable to set input value for selector ${targetSelector}`
                );
            }
            element.focus();
            valueSetter.call(element, nextValue);
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
        },
        { targetSelector: selector, nextValue: value }
    );
};

const dispatchClick = async (page, selector) => {
    await waitForElement(page, selector, 10000);
    await page.evaluate((targetSelector) => {
        const element = globalThis.document.querySelector(targetSelector);
        if (!(element instanceof HTMLElement)) {
            throw new Error(
                `Clickable element not found for ${targetSelector}`
            );
        }
        element.focus();
        element.dispatchEvent(
            new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: globalThis,
            })
        );
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

const navigateInApp = async (page, path) => {
    await page.evaluate((nextPath) => {
        globalThis.history.pushState({}, '', nextPath);
        globalThis.dispatchEvent(
            new PopStateEvent('popstate', {
                state: globalThis.history.state,
            })
        );
    }, path);
};

const connectBrowserWallet = async (page) => {
    logStage('browser.goto', { appUrl });
    await page.goto(appUrl, { waitUntil: 'networkidle0' });
    logStage('browser.connect.open');
    await dispatchClick(page, '[data-testid="connect-open"]');
    await waitForElement(page, '[data-testid="connect-dialog"]');
    logStage('browser.connect.passcode');
    await setInputValue(page, '#outlined-password-input', holderPasscode);
    await dispatchClick(page, '[data-testid="connect-submit"]');
    logStage('browser.connect.submitted');
    await waitForDomState(
        page,
        'connected dashboard',
        () =>
            globalThis.document.querySelector(
                '[data-testid="connect-dialog"]'
            ) === null &&
            globalThis.document.querySelector(
                '[data-testid="dashboard-view"]'
            ) !== null
    );
    logStage('browser.connect.ready');
};

const connectKeriaClient = async () => {
    await ready();
    const client = new SignifyClient(
        keriaAdminUrl,
        holderPasscode,
        Tier.low,
        keriaBootUrl
    );
    await client.connect();
    return client;
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

const waitForPresentationTx = async (client, descriptor) => {
    const expectedAud = descriptorAudience(descriptor);
    const expectedNonce = descriptor.nonce ?? null;
    const expectedResponseUri = descriptorResponseUri(descriptor);

    for (let attempt = 0; attempt < 180; attempt += 1) {
        const body = await getJson(
            client,
            `/identifiers/${encodeURIComponent(holderAlias)}/w3c/present-txs`
        );
        const txs = Array.isArray(body.presentTxs) ? body.presentTxs : [];
        const tx = txs.find((candidate) => {
            const request = candidate.requestDescriptor ?? {};
            return (
                candidate.aud === expectedAud &&
                candidate.nonce === expectedNonce &&
                candidate.responseUri === expectedResponseUri &&
                request.credentialSaid === credentialSaid
            );
        });

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

    throw new Error(
        `Timed out waiting for KERIA presentation tx for nonce ${expectedNonce}`
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
    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);
    page.on('pageerror', (error) => {
        console.error(
            JSON.stringify({ stage: 'browser.pageerror', error: error.message })
        );
    });
    page.on('console', (message) => {
        if (message.type() === 'error') {
            console.error(
                JSON.stringify({
                    stage: 'browser.console.error',
                    text: message.text(),
                })
            );
        }
    });
    const client = await connectKeriaClient();
    await connectBrowserWallet(page);

    logStage('credential.goto', { credentialSaid });
    await navigateInApp(
        page,
        `/dashboard/credentials/${encodeURIComponent(credentialSaid)}`
    );
    await waitForDomState(
        page,
        'credential detail',
        () =>
            globalThis.document.querySelector(
                '[data-testid="dashboard-credential-detail"]'
            ) !== null
    );
    await waitForDomState(
        page,
        'W3C presentation controls',
        () =>
            globalThis.document
                .querySelector('[data-testid="w3c-presentation-status"]')
                ?.getAttribute('data-state') === 'ready'
    );
    logStage('credential.ready', { credentialSaid });

    for (const descriptor of verifierRequests) {
        if (typeof descriptor !== 'object' || descriptor === null) {
            throw new Error(
                `Verifier descriptor must be a JSON object: ${JSON.stringify(descriptor)}`
            );
        }

        logStage('presentation.submit', {
            verifierId:
                descriptor.verifierId ?? descriptorResponseUri(descriptor),
            aud: descriptorAudience(descriptor),
            nonce: descriptor.nonce ?? null,
        });
        await waitForDomState(page, 'W3C presentation button ready', () => {
            const button = globalThis.document.querySelector(
                '[data-testid="w3c-present-button"]'
            );
            return button instanceof HTMLButtonElement && !button.disabled;
        });
        const descriptorJson = JSON.stringify(descriptor, null, 2);
        await setInputValue(
            page,
            '[data-testid="w3c-verifier-request-input"] textarea',
            descriptorJson
        );
        await waitForDomState(
            page,
            'W3C verifier request input update',
            (expectedValue) => {
                const input = globalThis.document.querySelector(
                    '[data-testid="w3c-verifier-request-input"] textarea'
                );
                const button = globalThis.document.querySelector(
                    '[data-testid="w3c-present-button"]'
                );
                return (
                    input instanceof HTMLTextAreaElement &&
                    input.value === expectedValue &&
                    button instanceof HTMLButtonElement &&
                    !button.disabled
                );
            },
            30000,
            descriptorJson
        );
        await dispatchClick(page, '[data-testid="w3c-present-button"]');

        const tx = await waitForPresentationTx(client, descriptor);
        const operation = await waitForVerifierOperation(descriptor, tx);
        const binding = {
            aud: descriptorAudience(descriptor),
            nonce: descriptor.nonce ?? null,
        };
        if (tx.aud !== binding.aud || tx.nonce !== binding.nonce) {
            throw new Error(
                `KERIA tx binding mismatch: expected ${JSON.stringify(binding)}, got ${JSON.stringify({ aud: tx.aud, nonce: tx.nonce })}`
            );
        }
        console.log(
            JSON.stringify({
                stage: 'presentation.accepted',
                verifierId:
                    descriptor.verifierId ?? descriptorResponseUri(descriptor),
                presentTxId: tx.presentTxId,
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
            await page.screenshot({ path: screenshot, fullPage: true });
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

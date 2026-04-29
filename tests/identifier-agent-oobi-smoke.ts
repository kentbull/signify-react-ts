import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import puppeteer, { type ElementHandle, type Page } from 'puppeteer';
import { b, Serder, Siger, Verfer, type SignifyClient } from 'signify-ts';
import { appConfig } from '../src/config';
import { connectSignifyClient } from '../src/signify/client';

/** Browser app URL; a local Vite server is started when unreachable. */
const appUrl =
    process.env.IDENTIFIER_AGENT_OOBI_SMOKE_URL ?? 'http://127.0.0.1:5178';

/** Failure artifacts are uploaded by CI with the existing KERIA stack logs. */
const artifactDir =
    process.env.SMOKE_ARTIFACT_DIR ??
    (process.env.RUNNER_TEMP === undefined
        ? join(process.cwd(), '.smoke-artifacts')
        : join(process.env.RUNNER_TEMP, 'keri-stack', 'logs'));

/** Small polling delay helper for server, KERIA, and UI readiness checks. */
const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => {
        globalThis.setTimeout(resolve, ms);
    });

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const stringValue = (value: unknown): string | null =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

/** Check whether an existing dev server can serve the app. */
const canReachApp = async (): Promise<boolean> => {
    try {
        const response = await fetch(appUrl);
        return response.ok;
    } catch {
        return false;
    }
};

/** Wait for Vite to become reachable before browser actions start. */
const waitForApp = async (): Promise<void> => {
    for (let attempt = 0; attempt < 60; attempt += 1) {
        if (await canReachApp()) {
            return;
        }
        await sleep(500);
    }

    throw new Error(`Vite app did not become reachable at ${appUrl}`);
};

/** Reuse an existing app server or start a strict-port Vite child process. */
const startViteIfNeeded = async (): Promise<ChildProcess | null> => {
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

/** Return a required element handle with a clearer smoke-test error. */
const elementFor = async (
    page: Page,
    selector: string
): Promise<ElementHandle<Element>> => {
    const element = await page.$(selector);
    if (element === null) {
        throw new Error(`Missing element ${selector}`);
    }

    return element;
};

/** Replace a MUI input value using browser-like keyboard actions. */
const setInputValue = async (
    page: Page,
    selector: string,
    value: string
): Promise<void> => {
    const element = await elementFor(page, selector);
    await element.click({ clickCount: 3 });
    await page.keyboard.press('Backspace');
    await element.type(value);
};

/** Read the generated passcode from the MUI password input. */
const passcodeValue = (page: Page): Promise<string> =>
    page.$eval(
        '#outlined-password-input',
        (element) => (element as HTMLInputElement).value ?? ''
    );

/** Wait for a UI test id that is visible and not disabled. */
const waitForClickableTestId = (
    page: Page,
    testId: string,
    timeout = 30_000
): Promise<void> =>
    page
        .waitForFunction(
            (id) =>
                Array.from(
                    globalThis.document.querySelectorAll('[data-testid]')
                ).some((element) => {
                    if (element.getAttribute('data-testid') !== id) {
                        return false;
                    }

                    const rect = element.getBoundingClientRect();
                    const style = globalThis.getComputedStyle(element);
                    const disabled =
                        element instanceof HTMLButtonElement &&
                        element.disabled;
                    return (
                        rect.width > 0 &&
                        rect.height > 0 &&
                        style.visibility !== 'hidden' &&
                        style.display !== 'none' &&
                        !disabled
                    );
                }),
            { timeout },
            testId
        )
        .then(() => undefined);

/** Click the visible instance of a possibly duplicated responsive control. */
const clickVisibleTestId = async (
    page: Page,
    testId: string,
    timeout = 30_000
): Promise<void> => {
    await waitForClickableTestId(page, testId, timeout);
    await page.evaluate((id) => {
        const element = Array.from(
            globalThis.document.querySelectorAll('[data-testid]')
        ).find((candidate) => {
            if (candidate.getAttribute('data-testid') !== id) {
                return false;
            }

            const rect = candidate.getBoundingClientRect();
            const style = globalThis.getComputedStyle(candidate);
            const disabled =
                candidate instanceof HTMLButtonElement && candidate.disabled;
            return (
                rect.width > 0 &&
                rect.height > 0 &&
                style.visibility !== 'hidden' &&
                style.display !== 'none' &&
                !disabled
            );
        });

        if (!(element instanceof HTMLElement)) {
            throw new Error(`Missing visible element for ${id}`);
        }

        element.click();
    }, testId);
};

/** Navigate through the app drawer path used by smoke scripts. */
const navigateInApp = async (
    page: Page,
    navTestId: string,
    readySelector: string
): Promise<void> => {
    try {
        await clickVisibleTestId(page, `rail-${navTestId}`, 1_000);
    } catch {
        await clickVisibleTestId(page, 'nav-open');
        await clickVisibleTestId(page, navTestId);
    }

    await page.waitForSelector(readySelector, {
        timeout: 30_000,
    });
};

/** Wait for the read-only identifier OOBI section to leave its loading text. */
const waitForIdentifierOobiDetailsSettled = (page: Page): Promise<void> =>
    page
        .waitForFunction(
            () => {
                const modal =
                    globalThis.document.querySelector(
                        '[data-testid="identifier-details-modal"]'
                    ) ?? globalThis.document.querySelector('[role="dialog"]');
                const text = modal?.textContent ?? '';
                return (
                    text.includes(
                        'No OOBIs are available for this identifier.'
                    ) ||
                    text.includes('Unable to load identifier OOBIs:') ||
                    text.includes('agent OOBI')
                );
            },
            { timeout: 30_000 }
        )
        .then(() => undefined);

/** Boot/connect the browser wallet and return its generated passcode. */
const connectBrowserAgent = async (page: Page): Promise<string> => {
    await page.goto(appUrl, { waitUntil: 'networkidle0' });
    await page.click('[data-testid="connect-open"]');
    await page.waitForSelector('[data-testid="connect-dialog"]');
    await page.click('[data-testid="generate-passcode"]');
    await page.waitForFunction(
        () =>
            globalThis.document.querySelector('#outlined-password-input')?.value
                .length >= 21,
        { timeout: 10_000 }
    );

    const passcode = await passcodeValue(page);
    await page.click('[data-testid="connect-submit"]');
    await page.waitForSelector('[data-testid="connect-dialog"]', {
        hidden: true,
        timeout: 30_000,
    });
    await page.waitForSelector('[data-testid="dashboard-view"]', {
        timeout: 30_000,
    });

    if (!page.url().endsWith('/dashboard')) {
        throw new Error(
            `Expected post-connect /dashboard route, got ${page.url()}`
        );
    }

    return passcode;
};

/** Install script-local browser diagnostics without failing expected 404s. */
const attachPageDiagnostics = (page: Page): void => {
    page.on('console', (message) => {
        if (message.type() === 'error' || message.type() === 'warning') {
            console.error(`[browser:${message.type()}] ${message.text()}`);
        }
    });
    page.on('requestfailed', (request) => {
        console.error(
            `[browser:requestfailed] ${request.method()} ${request.url()} ${
                request.failure()?.errorText ?? 'unknown failure'
            }`
        );
    });
    page.on('response', (response) => {
        if (response.status() >= 400) {
            console.error(
                `[browser:response] ${response.status()} ${response.request().method()} ${response.url()}`
            );
        }
    });
};

/** Persist a screenshot beside KERIA logs when CI reports a smoke failure. */
const saveFailureScreenshot = async (
    page: Page,
    alias: string
): Promise<string> => {
    await mkdir(artifactDir, { recursive: true });
    const path = join(
        artifactDir,
        `identifier-agent-oobi-${alias}-failure.png`
    );
    await page.screenshot({ path, fullPage: true });
    return path;
};

const agentEndRoles = async (
    client: SignifyClient,
    alias: string
): Promise<unknown[]> => {
    const response = await client.fetch(
        `/identifiers/${encodeURIComponent(alias)}/endroles/agent`,
        'GET',
        null
    );
    const raw = (await response.json()) as unknown;
    return Array.isArray(raw) ? raw : [];
};

const hasAgentEndRole = (
    roles: readonly unknown[],
    agentPre: string
): boolean =>
    roles.some(
        (role) =>
            isRecord(role) &&
            role.role === 'agent' &&
            stringValue(role.eid) === agentPre
    );

const agentOobis = async (
    client: SignifyClient,
    alias: string
): Promise<string[]> => {
    try {
        const response = await client.oobis().get(alias, 'agent');
        return response.oobis.filter((oobi) => oobi.trim().length > 0);
    } catch {
        return [];
    }
};

/** Poll KERIA's authoritative state until both end-role and OOBI are visible. */
const waitForAgentEndRoleAndOobi = async ({
    client,
    alias,
    agentPre,
}: {
    client: SignifyClient;
    alias: string;
    agentPre: string;
}): Promise<string> => {
    const timeoutAt = Date.now() + 120_000;
    let lastState = 'not checked';

    while (Date.now() < timeoutAt) {
        const roles = await agentEndRoles(client, alias).catch(
            (error: unknown) => {
                lastState =
                    error instanceof Error ? error.message : String(error);
                return [];
            }
        );
        const hasRole = hasAgentEndRole(roles, agentPre);
        const oobis = await agentOobis(client, alias);

        if (hasRole && oobis.length > 0) {
            return oobis[0];
        }

        lastState = `hasRole=${hasRole} oobiCount=${oobis.length}`;
        await sleep(1_000);
    }

    throw new Error(
        `Timed out waiting for agent end-role and OOBI for ${alias}: ${lastState}`
    );
};

const waitForCondition = async (
    condition: () => boolean | Promise<boolean>,
    label: string,
    timeout = 30_000
): Promise<void> => {
    const timeoutAt = Date.now() + timeout;
    while (Date.now() < timeoutAt) {
        if (await condition()) {
            return;
        }
        await sleep(100);
    }

    throw new Error(`Timed out waiting for ${label}`);
};

const installClipboardProbe = (page: Page): Promise<void> =>
    page.evaluate(() => {
        const sink = globalThis as typeof globalThis & {
            __copiedAgentOobi?: string;
        };
        Object.defineProperty(globalThis.navigator, 'clipboard', {
            configurable: true,
            value: {
                writeText: (text: string): Promise<void> => {
                    sink.__copiedAgentOobi = text;
                    return Promise.resolve();
                },
            },
        });
    });

const copiedAgentOobi = (page: Page): Promise<string | null> =>
    page.evaluate(() => {
        const sink = globalThis as typeof globalThis & {
            __copiedAgentOobi?: string;
        };
        return sink.__copiedAgentOobi ?? null;
    });

const localSignatureVerification = async (
    client: SignifyClient,
    alias: string,
    body: string
): Promise<string> => {
    const parsed = JSON.parse(body) as {
        rpy?: unknown;
        sigs?: unknown;
    };
    if (!isRecord(parsed.rpy) || !Array.isArray(parsed.sigs)) {
        return 'request body is not an rpy/sigs object';
    }

    const firstSig = parsed.sigs.find((sig) => typeof sig === 'string');
    if (typeof firstSig !== 'string') {
        return 'request body has no string signature';
    }

    const hab = await client.identifiers().get(alias);
    const key = hab.state.k[0];
    if (typeof key !== 'string') {
        return 'identifier state has no current key';
    }

    const serder = new Serder(parsed.rpy);
    const siger = new Siger({ qb64: firstSig });
    const verfer = new Verfer({ qb64: key });
    return JSON.stringify({
        prefix: hab.prefix,
        key,
        verifies: verfer.verify(siger.raw, b(serder.raw)),
    });
};

const chromeArgs =
    process.env.CI === 'true'
        ? ['--no-sandbox', '--disable-setuid-sandbox']
        : [];

const alias = `ui-agent-oobi-${Date.now()}`;
const endRolePostPath = `/identifiers/${encodeURIComponent(alias)}/endroles`;
const endRolePostUrls: string[] = [];
const endRolePostBodies: string[] = [];
const endRoleFailureBodies: string[] = [];
const vite = await startViteIfNeeded();
const browser = await puppeteer.launch({
    headless: 'new',
    args: chromeArgs,
});
let page: Page | null = null;

try {
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    attachPageDiagnostics(page);
    page.on('request', (request) => {
        const url = new URL(request.url());
        if (request.method() === 'POST' && url.pathname === endRolePostPath) {
            endRolePostUrls.push(request.url());
            const body = request.postData() ?? '';
            endRolePostBodies.push(body);
            console.error(`[endrole:request] ${body}`);
        }
    });
    page.on('response', (response) => {
        const url = new URL(response.url());
        if (
            response.request().method() === 'POST' &&
            url.pathname === endRolePostPath &&
            response.status() >= 400
        ) {
            void response.text().then((body) => {
                endRoleFailureBodies.push(body);
                console.error(`[endrole:response] ${body}`);
            });
        }
    });

    const passcode = await connectBrowserAgent(page);
    const connected = await connectSignifyClient({
        adminUrl: appConfig.keria.adminUrl,
        bootUrl: appConfig.keria.bootUrl,
        passcode,
        tier: appConfig.defaultTier,
    });
    const { client } = connected;
    const agentPre = connected.state.agentPre;

    await navigateInApp(
        page,
        'nav-identifiers',
        '[data-testid="identifier-table"]'
    );
    await clickVisibleTestId(page, 'identifier-create-open');
    await page.waitForSelector('[role="dialog"]', { timeout: 10_000 });
    await setInputValue(
        page,
        '[data-testid="identifier-create-name"] input',
        alias
    );
    await clickVisibleTestId(page, 'identifier-create-submit');
    await waitForClickableTestId(
        page,
        `identifier-table-row-${alias}`,
        120_000
    );

    const postCountBeforeDetails = endRolePostUrls.length;
    await clickVisibleTestId(page, `identifier-table-row-${alias}`);
    await page.waitForSelector('[data-testid="identifier-details-modal"]', {
        timeout: 30_000,
    });
    await waitForIdentifierOobiDetailsSettled(page);
    if (endRolePostUrls.length !== postCountBeforeDetails) {
        throw new Error(
            `Opening identifier details created an agent end-role POST: ${endRolePostUrls.join(', ')}`
        );
    }
    await page.keyboard.press('Escape');
    await page.waitForSelector('[data-testid="identifier-details-modal"]', {
        hidden: true,
        timeout: 10_000,
    });

    await clickVisibleTestId(page, `identifier-authorize-agent-${alias}`);
    await waitForCondition(
        () => endRolePostUrls.length >= postCountBeforeDetails + 1,
        'authorize-agent end-role POST'
    );
    await sleep(500);
    if (endRoleFailureBodies.length > 0) {
        const verification =
            endRolePostBodies[0] === undefined
                ? 'no request body captured'
                : await localSignatureVerification(
                      client,
                      alias,
                      endRolePostBodies[0]
                  );
        throw new Error(
            `Authorize-agent end-role POST failed: ${endRoleFailureBodies.join('\n')}\nverification=${verification}\n${endRolePostBodies.join('\n')}`
        );
    }
    if (endRolePostUrls.length !== postCountBeforeDetails + 1) {
        throw new Error(
            `Expected one authorize-agent end-role POST, saw ${endRolePostUrls.length - postCountBeforeDetails}: ${endRolePostBodies.join('\n')}`
        );
    }

    const oobi = await waitForAgentEndRoleAndOobi({
        client,
        alias,
        agentPre,
    });

    await installClipboardProbe(page);
    const postCountBeforeCopy = endRolePostUrls.length;
    await clickVisibleTestId(page, `identifier-copy-agent-oobi-${alias}`);
    await waitForCondition(
        async () => (await copiedAgentOobi(page as Page)) === oobi,
        'agent OOBI clipboard write',
        60_000
    );
    if (endRolePostUrls.length !== postCountBeforeCopy) {
        throw new Error(
            `Copying the agent OOBI created another end-role POST: ${endRolePostUrls.join(', ')}`
        );
    }

    console.log(
        JSON.stringify(
            {
                status: 'passed',
                alias,
                controller: connected.state.controllerPre,
                agent: agentPre,
                oobi,
            },
            null,
            2
        )
    );
} catch (error) {
    if (page !== null) {
        const screenshotPath = await saveFailureScreenshot(page, alias);
        console.error(`Saved failure screenshot: ${screenshotPath}`);
    }
    throw error;
} finally {
    await browser.close();
    if (vite !== null) {
        vite.kill('SIGTERM');
    }
}

import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import puppeteer, { type Page } from 'puppeteer';
import { b, Serder, Siger, Verfer, type SignifyClient } from 'signify-ts';
import { appConfig } from '../src/config';
import {
    connectSignifyClient,
    randomSignifyPasscode,
} from '../src/signify/client';

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

const logStage = (stage: string, details: Record<string, unknown> = {}): void => {
    console.log(JSON.stringify({ stage, ...details }));
};

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

/** Replace a MUI input value using browser-like keyboard actions. */
const setInputValue = async (
    page: Page,
    selector: string,
    value: string
): Promise<void> => {
    await page.waitForSelector(selector, { timeout: 10_000 });
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

/** Wait for a UI test id that is visible and not disabled. */
const waitForClickableTestId = async (
    page: Page,
    testId: string,
    timeout = 30_000
): Promise<void> => {
    const timeoutAt = Date.now() + timeout;
    let lastState = 'not checked';

    const stateForTestId = async (): Promise<string> =>
        page.evaluate((id) => {
            const matches = Array.from(
                globalThis.document.querySelectorAll('[data-testid]')
            ).filter((element) => element.getAttribute('data-testid') === id);
            if (matches.length === 0) {
                return 'missing';
            }
            const visible = matches.some((element) => {
                const rect = element.getBoundingClientRect();
                const style = globalThis.getComputedStyle(element);
                const disabled =
                    element instanceof globalThis.HTMLButtonElement &&
                    element.disabled;
                return (
                    rect.width > 0 &&
                    rect.height > 0 &&
                    style.visibility !== 'hidden' &&
                    style.display !== 'none' &&
                    !disabled
                );
            });
            return visible ? 'ready' : `not-visible:${matches.length}`;
        }, testId);

    while (Date.now() < timeoutAt) {
        lastState = await stateForTestId();
        if (lastState === 'ready') {
            return;
        }
        await sleep(250);
    }

    const visibleText = await page.evaluate(
        () => globalThis.document.body.textContent?.slice(0, 4000) ?? ''
    );
    throw new Error(
        `Timed out waiting for ${testId}: ${lastState}. Visible text: ${visibleText}`
    );
};

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

/** Enable the create-dialog demo witness switch by its visible label. */
const enableDemoWitnesses = async (page: Page): Promise<void> => {
    await waitForCondition(
        async () =>
            page.evaluate(() => {
                const label = Array.from(
                    globalThis.document.querySelectorAll('label')
                ).find((candidate) =>
                    candidate.textContent?.includes('Use demo witnesses')
                );
                const input = label?.querySelector('input[type="checkbox"]');
                if (!(input instanceof globalThis.HTMLInputElement)) {
                    return false;
                }
                if (!input.checked) {
                    input.click();
                }
                return input.checked;
            }),
        'demo witness switch enabled',
        10_000
    );
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

/** Boot/connect the browser wallet and return its generated passcode. */
const connectBrowserAgent = async (page: Page): Promise<string> => {
    logStage('browser.goto', { appUrl });
    await page.goto(appUrl, { waitUntil: 'networkidle0' });
    logStage('browser.connect.open');
    await clickVisibleTestId(page, 'connect-open');
    await page.waitForSelector('[data-testid="connect-dialog"]');
    const passcode = await randomSignifyPasscode();
    await setInputValue(page, '#outlined-password-input', passcode);
    await page.waitForFunction(
        () =>
            globalThis.document.querySelector('#outlined-password-input')?.value
                .length >= 21,
        { timeout: 30_000 }
    );

    logStage('browser.connect.submit');
    await clickVisibleTestId(page, 'connect-submit');
    await page.waitForSelector('[data-testid="dashboard-view"]', {
        timeout: 120_000,
    });
    if ((await page.$('[data-testid="connect-dialog"]')) !== null) {
        await page.keyboard.press('Escape');
        await page.waitForSelector('[data-testid="connect-dialog"]', {
            hidden: true,
            timeout: 10_000,
        });
    }

    if (!page.url().endsWith('/dashboard')) {
        throw new Error(
            `Expected post-connect /dashboard route, got ${page.url()}`
        );
    }

    logStage('browser.connect.ready');
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

const waitForAgentOobiCopySuccess = (
    page: Page,
    alias: string
): Promise<void> =>
    waitForCondition(
        async () =>
            page.evaluate((identifierAlias) => {
                const button = globalThis.document.querySelector(
                    `[data-testid="identifier-copy-agent-oobi-${identifierAlias}"]`
                );
                return (
                    button instanceof globalThis.HTMLButtonElement &&
                    !button.disabled &&
                    button.classList.contains('MuiIconButton-colorSuccess')
                );
            }, alias),
        'agent OOBI copy success',
        30_000
    );

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
    protocolTimeout: 300_000,
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
    logStage('signify.connect.start');
    const connected = await connectSignifyClient({
        adminUrl: appConfig.keria.adminUrl,
        bootUrl: appConfig.keria.bootUrl,
        passcode,
        tier: appConfig.defaultTier,
    });
    const { client } = connected;
    const agentPre = connected.state.agentPre;
    logStage('signify.connect.ready', {
        controller: connected.state.controllerPre,
        agent: agentPre,
    });

    logStage('identifiers.navigate.start');
    await navigateInApp(
        page,
        'nav-identifiers',
        '[data-testid="identifier-table"]'
    );
    logStage('identifiers.navigate.ready');
    logStage('identifier.create.open');
    await clickVisibleTestId(page, 'identifier-create-open');
    await page.waitForSelector('[role="dialog"]', { timeout: 10_000 });
    logStage('identifier.create.nameInput.start', { alias });
    await setInputValue(
        page,
        '[data-testid="identifier-create-name"] input',
        alias
    );
    logStage('identifier.create.witnesses.start', { alias });
    await enableDemoWitnesses(page);
    logStage('identifier.create.witnesses.ready', { alias });
    logStage('identifier.create.submit.start', { alias });
    await clickVisibleTestId(page, 'identifier-create-submit');
    logStage('identifier.create.rowWait.start', { alias });
    await waitForClickableTestId(
        page,
        `identifier-table-row-${alias}`,
        120_000
    );
    logStage('identifier.create.ready', { alias });

    const postCountBeforeAuthorize = endRolePostUrls.length;
    logStage('identifier.authorizeAgent.start', { alias });
    await clickVisibleTestId(page, `identifier-authorize-agent-${alias}`);
    await waitForCondition(
        () => endRolePostUrls.length >= postCountBeforeAuthorize + 1,
        'authorize-agent end-role POST'
    );
    logStage('identifier.authorizeAgent.posted', { alias });
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
    if (endRolePostUrls.length !== postCountBeforeAuthorize + 1) {
        throw new Error(
            `Expected one authorize-agent end-role POST, saw ${endRolePostUrls.length - postCountBeforeAuthorize}: ${endRolePostBodies.join('\n')}`
        );
    }

    logStage('identifier.authorizeAgent.oobiWait.start', { alias });
    const oobi = await waitForAgentEndRoleAndOobi({
        client,
        alias,
        agentPre,
    });
    logStage('identifier.authorizeAgent.oobiWait.ready', { alias, oobi });

    const postCountBeforeCopy = endRolePostUrls.length;
    logStage('identifier.copyAgentOobi.start', { alias });
    await clickVisibleTestId(page, `identifier-copy-agent-oobi-${alias}`);
    logStage('identifier.copyAgentOobi.clicked', { alias });
    await waitForAgentOobiCopySuccess(page, alias);
    logStage('identifier.copyAgentOobi.ready', { alias });
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

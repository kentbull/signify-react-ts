import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import puppeteer, { type Page } from 'puppeteer';
import { b, Serder, Siger, Verfer, type SignifyClient } from 'signify-ts';
import { appConfig } from '../src/config';
import { connectSignifyClient } from '../src/signify/client';
import {
    chromeArgs,
    clickVisibleTestId,
    connectBrowserAgent,
    logStage,
    setInputValue,
    sleep,
    startViteIfNeeded,
    waitForClickableTestId,
} from './support/browserHarness';

/** Browser app URL; a local Vite server is started when unreachable. */
const appUrl =
    process.env.IDENTIFIER_AGENT_OOBI_SMOKE_URL ?? 'http://127.0.0.1:5178';

/** Failure artifacts are uploaded by CI with the existing KERIA stack logs. */
const artifactDir =
    process.env.SMOKE_ARTIFACT_DIR ??
    (process.env.RUNNER_TEMP === undefined
        ? join(process.cwd(), '.smoke-artifacts')
        : join(process.env.RUNNER_TEMP, 'keri-stack', 'logs'));

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const stringValue = (value: unknown): string | null =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

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

const alias = `ui-agent-oobi-${Date.now()}`;
const endRolePostPath = `/identifiers/${encodeURIComponent(alias)}/endroles`;
const endRolePostUrls: string[] = [];
const endRolePostBodies: string[] = [];
const endRoleFailureBodies: string[] = [];
const vite = await startViteIfNeeded(appUrl);
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

    const passcode = await connectBrowserAgent(page, {
        appUrl,
        openTarget: 'connect-open',
        submitTarget: 'connect-submit',
        clickTarget: clickVisibleTestId,
    });
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
    await enableDemoWitnesses(page);
    await clickVisibleTestId(page, 'identifier-create-submit');
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

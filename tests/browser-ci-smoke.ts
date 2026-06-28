import puppeteer, { type Page } from 'puppeteer';
import { SignifyClient, Tier, ready, type Operation } from 'signify-ts';
import { appConfig } from '../src/config';
import {
    chromeArgs,
    connectBrowserAgent,
    dispatchClick,
    logStage,
    routeUrl as appRouteUrl,
    startViteIfNeeded,
    waitForDomState,
    waitForElement,
    waitForText,
} from './support/browserHarness';
import {
    navigateInApp,
    openContactDetail,
    resolveOobiInContacts,
} from './support/contactUiHarness';

/**
 * Required CI browser smoke.
 *
 * This is the compact required-gate browser proof. The broader standalone
 * browser, responsive, and contact smokes stay available for focused debugging.
 */
const appUrl = process.env.BROWSER_CI_SMOKE_URL ?? 'http://127.0.0.1:5173';
const routeUrl = (path: string): string => appRouteUrl(appUrl, path);
const uiPreferencesStorageKey = 'signify-react-ts:ui-preferences:v1';

interface IdentifierFixture {
    alias: string;
    prefix: string;
}

interface HeaderExpectation {
    expected: string[];
    omitted: string[];
}

const textContent = (page: Page, selector: string): Promise<string> =>
    page.$eval(selector, (element) => element.textContent ?? '');

const connectClient = async (passcode: string): Promise<SignifyClient> => {
    await ready();
    const client = new SignifyClient(
        appConfig.keria.adminUrl,
        passcode,
        Tier.low,
        appConfig.keria.bootUrl
    );
    await client.connect();
    return client;
};

const waitForOperation = async (
    client: SignifyClient,
    operation: Operation,
    label: string
): Promise<void> => {
    const controller = new globalThis.AbortController();
    const timeout = globalThis.setTimeout(() => {
        controller.abort(new Error(`${label} timed out`));
    }, appConfig.operations.timeoutMs);

    try {
        await client.operations().wait(operation, {
            signal: controller.signal,
            minSleep: appConfig.operations.minSleepMs,
            maxSleep: appConfig.operations.maxSleepMs,
        });
    } catch (error) {
        throw new Error(
            `${label} failed: ${error instanceof Error ? error.message : String(error)}`,
            { cause: error }
        );
    } finally {
        globalThis.clearTimeout(timeout);
    }
};

const createIdentifierFixture = async (
    passcode: string
): Promise<IdentifierFixture> => {
    const client = await connectClient(passcode);
    const alias = `browser-ci-${new Date()
        .toISOString()
        .replace(/[-:.TZ]/g, '')
        .slice(0, 14)}`;
    const result = await client.identifiers().create(alias, {
        toad: appConfig.witnesses.toad,
        wits: appConfig.witnesses.aids,
    });
    const operation = await result.op();
    await waitForOperation(client, operation, `creating ${alias}`);
    const identifier = await client.identifiers().get(alias);

    return { alias, prefix: identifier.prefix };
};

const assertNoHorizontalOverflow = async (
    page: Page,
    label: string
): Promise<void> => {
    const metrics = await page.evaluate(() => ({
        innerWidth: globalThis.innerWidth,
        htmlScrollWidth: globalThis.document.documentElement.scrollWidth,
        bodyScrollWidth: globalThis.document.body.scrollWidth,
    }));
    const scrollWidth = Math.max(
        metrics.htmlScrollWidth,
        metrics.bodyScrollWidth
    );

    if (scrollWidth > metrics.innerWidth) {
        throw new Error(
            `${label} has horizontal overflow: scrollWidth=${scrollWidth}, innerWidth=${metrics.innerWidth}`
        );
    }
};

const assertContentStartsBelowAppBar = async (
    page: Page,
    label: string
): Promise<void> => {
    const metrics = await page.evaluate(() => {
        const appBar = globalThis.document.querySelector('.MuiAppBar-root');
        const content = globalThis.document.querySelector(
            '[data-testid="connection-required"]'
        );

        if (appBar === null || content === null) {
            return null;
        }

        const appBarRect = appBar.getBoundingClientRect();
        const contentRect = content.getBoundingClientRect();

        return {
            appBarBottom: appBarRect.bottom,
            contentTop: contentRect.top,
        };
    });

    if (metrics === null) {
        throw new Error(
            `${label} did not render the app bar and route content`
        );
    }

    if (metrics.contentTop < metrics.appBarBottom) {
        throw new Error(
            `${label} route content overlaps app bar: contentTop=${metrics.contentTop}, appBarBottom=${metrics.appBarBottom}`
        );
    }

    if (metrics.contentTop - metrics.appBarBottom > 96) {
        throw new Error(
            `${label} route content appears vertically centered: contentTop=${metrics.contentTop}, appBarBottom=${metrics.appBarBottom}`
        );
    }
};

const assertElementsFitViewport = async (
    page: Page,
    selectors: string[],
    label: string
): Promise<void> => {
    const failures = await page.evaluate((visibleSelectors) => {
        const viewportWidth = globalThis.innerWidth;

        return visibleSelectors.flatMap((selector) => {
            const element = globalThis.document.querySelector(selector);

            if (element === null) {
                return [`${selector} was not found`];
            }

            const rect = element.getBoundingClientRect();

            if (rect.left < -1 || rect.right > viewportWidth + 1) {
                return [
                    `${selector} overflows horizontally: left=${rect.left}, right=${rect.right}, viewport=${viewportWidth}`,
                ];
            }

            return [];
        });
    }, selectors);

    if (failures.length > 0) {
        throw new Error(`${label} viewport fit failed: ${failures.join('; ')}`);
    }
};

const assertVisibleControlFitsViewport = async (
    page: Page,
    ariaLabel: string,
    label: string
): Promise<void> => {
    const failures = await page.evaluate((expectedLabel) => {
        const viewportWidth = globalThis.innerWidth;
        const controls = [...globalThis.document.querySelectorAll('button')]
            .filter(
                (button) => button.getAttribute('aria-label') === expectedLabel
            )
            .filter((button) => {
                const rect = button.getBoundingClientRect();
                const style = globalThis.getComputedStyle(button);
                return (
                    rect.width > 0 &&
                    rect.height > 0 &&
                    style.display !== 'none' &&
                    style.visibility !== 'hidden'
                );
            });

        if (controls.length === 0) {
            return [`No visible control for ${expectedLabel}`];
        }

        return controls.flatMap((control) => {
            const rect = control.getBoundingClientRect();
            if (rect.left < -1 || rect.right > viewportWidth + 1) {
                return [
                    `${expectedLabel} overflows horizontally: left=${rect.left}, right=${rect.right}, viewport=${viewportWidth}`,
                ];
            }

            return [];
        });
    }, ariaLabel);

    if (failures.length > 0) {
        throw new Error(`${label} control fit failed: ${failures.join('; ')}`);
    }
};

const visibleIdentifierHeaders = async (page: Page): Promise<string[]> =>
    page.$$eval('[data-testid="identifier-table"] thead th', (headers) =>
        headers
            .filter((header) => {
                const rect = header.getBoundingClientRect();
                const style = globalThis.getComputedStyle(header);
                return (
                    rect.width > 0 &&
                    rect.height > 0 &&
                    style.display !== 'none' &&
                    style.visibility !== 'hidden'
                );
            })
            .map((header) => header.textContent?.trim() ?? '')
    );

const assertIdentifierHeaders = async (
    page: Page,
    { expected, omitted }: HeaderExpectation,
    label: string
): Promise<void> => {
    const headers = await visibleIdentifierHeaders(page);
    const missing = expected.filter((header) => !headers.includes(header));
    const unexpectedlyVisible = omitted.filter((header) =>
        headers.includes(header)
    );

    if (missing.length > 0 || unexpectedlyVisible.length > 0) {
        throw new Error(
            `${label} identifier headers mismatch: visible=${headers.join(', ')}, missing=${missing.join(', ')}, unexpectedlyVisible=${unexpectedlyVisible.join(', ')}`
        );
    }
};

const navigateToIdentifiers = async (page: Page): Promise<void> => {
    await dispatchClick(page, '[data-testid="nav-open"]');
    await waitForElement(page, '[data-testid="nav-identifiers"]', 10_000);
    await dispatchClick(page, '[data-testid="nav-identifiers"]');
    await waitForElement(page, '[data-testid="identifier-table"]', 10_000);
};

const assertProtectedMobileLayout = async (page: Page): Promise<void> => {
    for (const viewport of [
        { label: 'iPhone SE', width: 320, height: 568 },
        { label: 'mobile', width: 390, height: 844 },
    ]) {
        await page.setViewport({
            width: viewport.width,
            height: viewport.height,
            isMobile: true,
            deviceScaleFactor: 2,
        });
        await page.goto(routeUrl('/identifiers'), {
            waitUntil: 'networkidle0',
        });
        await waitForElement(
            page,
            '[data-testid="connection-required"]',
            10_000
        );
        await assertNoHorizontalOverflow(page, viewport.label);
        await assertContentStartsBelowAppBar(page, viewport.label);

        await dispatchClick(page, '[data-testid="connect-open"]');
        await waitForElement(page, '[data-testid="connect-dialog"]', 10_000);
        await assertNoHorizontalOverflow(page, `${viewport.label} dialog`);
        await assertElementsFitViewport(
            page,
            [
                '.MuiDialog-paper',
                '[data-testid="connect-submit"]',
                '[data-testid="generate-passcode"]',
                '[data-testid="connect-close"]',
            ],
            `${viewport.label} dialog`
        );
        await dispatchClick(page, '[data-testid="connect-close"]');
    }
};

const assertUiPreferences = async (page: Page): Promise<void> => {
    await page.goto(appUrl, { waitUntil: 'networkidle0' });
    await page.evaluate((key) => {
        globalThis.localStorage.removeItem(key);
    }, uiPreferencesStorageKey);
    await page.reload({ waitUntil: 'networkidle0' });
    await waitForElement(page, '[data-testid="ui-sound-toggle"]', 10_000);
    await waitForElement(page, '[data-testid="theme-mode-toggle"]', 10_000);

    await dispatchClick(page, '[data-testid="theme-mode-toggle"]');
    await waitForDomState(
        page,
        'light theme toggle',
        () =>
            globalThis.document
                .querySelector('[data-testid="theme-mode-toggle"]')
                ?.getAttribute('aria-pressed') === 'true',
        10_000
    );
    await dispatchClick(page, '[data-testid="ui-sound-toggle"]');
    await waitForDomState(
        page,
        'muted sound toggle',
        () =>
            globalThis.document
                .querySelector('[data-testid="ui-sound-toggle"]')
                ?.getAttribute('aria-pressed') === 'true',
        10_000
    );

    const persistedPreference = await page.evaluate((key) => {
        const text = globalThis.localStorage.getItem(key);
        return text === null ? null : JSON.parse(text);
    }, uiPreferencesStorageKey);
    if (persistedPreference?.hoverSoundMuted !== true) {
        throw new Error('Expected muted sound preference to persist');
    }
    if (persistedPreference?.themeMode !== 'light') {
        throw new Error('Expected light theme preference to persist');
    }
};

const assertConnectedIdentifierTable = async (
    page: Page,
    fixture: IdentifierFixture
): Promise<void> => {
    const viewports = [
        {
            label: 'compact table',
            width: 640,
            height: 800,
            headers: {
                expected: ['Name', 'AID', 'Actions'],
                omitted: ['Type', 'KIDX', 'PIDX', 'OOBI'],
            },
        },
        {
            label: 'medium table',
            width: 960,
            height: 800,
            headers: {
                expected: ['Name', 'AID', 'Type', 'Actions'],
                omitted: ['KIDX', 'PIDX', 'OOBI'],
            },
        },
    ];

    await page.setViewport({
        width: viewports[0].width,
        height: viewports[0].height,
        isMobile: false,
        deviceScaleFactor: 1,
    });
    await navigateToIdentifiers(page);

    for (const viewport of viewports) {
        await page.setViewport({
            width: viewport.width,
            height: viewport.height,
            isMobile: false,
            deviceScaleFactor: 1,
        });
        await waitForElement(page, '[data-testid="identifier-table"]', 10_000);
        await waitForDomState(
            page,
            `rotate control for ${fixture.alias}`,
            (alias) =>
                [...globalThis.document.querySelectorAll('button')].some(
                    (button) =>
                        button.getAttribute('aria-label') ===
                        `Rotate identifier ${alias}`
                ),
            10_000,
            fixture.alias
        );
        await assertNoHorizontalOverflow(page, viewport.label);
        await assertIdentifierHeaders(page, viewport.headers, viewport.label);
        await assertVisibleControlFitsViewport(
            page,
            `Rotate identifier ${fixture.alias}`,
            viewport.label
        );
        await assertVisibleControlFitsViewport(
            page,
            `Copy agent OOBI for ${fixture.alias}`,
            viewport.label
        );
    }
};

const witnessOobi = (): string => {
    const wanAid = appConfig.witnesses.aids[0];
    if (wanAid === undefined) {
        throw new Error('No configured witness AID available for UI smoke.');
    }

    return `http://127.0.0.1:5642/oobi/${wanAid}/controller?name=Wan`;
};

const assertQuickNotificationAndOperationPayload = async (
    page: Page
): Promise<void> => {
    await dispatchClick(page, '[data-testid="notifications-open"]');
    await page.waitForSelector('[data-testid="notification-quick-item"]', {
        timeout: 30_000,
    });
    await dispatchClick(page, '[data-testid="notification-quick-item"]');
    await page.waitForFunction(
        () => globalThis.location.pathname.startsWith('/operations/'),
        { timeout: 10_000 }
    );
    await page.goBack({ waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="contacts-view"]', {
        timeout: 10_000,
    });
    logStage('notification.payload.ready');
};

const assertContactOobiFlow = async (page: Page): Promise<void> => {
    const contactAlias = 'Wan witness';
    const contactOobi = witnessOobi();

    await resolveOobiInContacts(page, {
        alias: contactAlias,
        oobi: contactOobi,
        requireResolved: true,
    });
    await openContactDetail(page, contactAlias);
    await waitForText(page, '[data-testid="contact-detail"]', contactOobi);
    await page.goBack({ waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="contacts-view"]', {
        timeout: 10_000,
    });
    await assertQuickNotificationAndOperationPayload(page);
    await navigateInApp(
        page,
        'nav-dashboard',
        '[data-testid="dashboard-view"]'
    );
};

const vite = await startViteIfNeeded(appUrl);
const browser = await puppeteer.launch({
    headless: 'new',
    args: chromeArgs,
    protocolTimeout: 300_000,
});

try {
    const page = await browser.newPage();
    page.setDefaultTimeout(60_000);
    page.setDefaultNavigationTimeout(60_000);
    page.on('pageerror', (error) => {
        console.error(`[browser:pageerror] ${error.message}`);
    });
    page.on('console', (message) => {
        if (message.type() === 'error' || message.type() === 'warning') {
            console.error(`[browser:${message.type()}] ${message.text()}`);
        }
    });

    await assertUiPreferences(page);
    await assertProtectedMobileLayout(page);

    await page.setViewport({
        width: 960,
        height: 800,
        isMobile: false,
        deviceScaleFactor: 1,
    });
    const browserPasscode = await connectBrowserAgent(page, { appUrl });
    const fixture = await createIdentifierFixture(browserPasscode);
    await assertConnectedIdentifierTable(page, fixture);
    await assertContactOobiFlow(page);
    await navigateInApp(page, 'nav-client', '[data-testid="client-summary"]');

    const controller = await textContent(
        page,
        '[data-testid="controller-aid"]'
    );
    const agent = await textContent(page, '[data-testid="agent-aid"]');

    console.log(
        JSON.stringify(
            {
                status: 'passed',
                controller,
                agent,
                identifierAlias: fixture.alias,
                identifierPrefix: fixture.prefix,
            },
            null,
            2
        )
    );
} finally {
    await browser.close();
    if (vite !== null) {
        vite.kill('SIGTERM');
    }
}

import { spawn, type ChildProcess } from 'node:child_process';
import puppeteer, { type Page } from 'puppeteer';
import { appConfig } from '../src/config';
import { randomSignifyPasscode } from '../src/signify/client';

/** Browser app URL; a local Vite server is started when unreachable. */
const appUrl =
    process.env.CONTACT_OOBI_SMOKE_URL ?? 'http://127.0.0.1:5176';

/** Small polling delay helper for server and UI readiness checks. */
const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => {
        globalThis.setTimeout(resolve, ms);
    });

const logStage = (stage: string, details: Record<string, unknown> = {}): void => {
    console.log(JSON.stringify({ stage, ...details }));
};

/** Check whether an existing dev server can serve the app. */
const canReachApp = async (): Promise<boolean> => {
    try {
        const response = await fetch(appUrl);
        return response.ok;
    } catch {
        return false;
    }
};

/** Wait for Vite to become reachable before launching browser actions. */
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

/** Replace a MUI input/textarea value using browser-like keyboard actions. */
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

/** Click a visible control through DOM events to avoid Puppeteer hit-test flake. */
const dispatchClick = async (page: Page, selector: string): Promise<void> => {
    await page.waitForSelector(selector, { timeout: 10_000 });
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

/** Wait until any visible matching element contains expected text. */
const waitForText = async (
    page: Page,
    selector: string,
    expected: string,
    timeout = 120_000
): Promise<void> => {
    await page.waitForFunction(
        (visibleSelector, text) =>
            Array.from(globalThis.document.querySelectorAll(visibleSelector)).some(
                (element) => element.textContent?.includes(text)
            ),
        { timeout },
        selector,
        expected
    );
};

/** Boot/connect the browser wallet and land on the dashboard route. */
const connectBrowserAgent = async (page: Page): Promise<string> => {
    logStage('browser.goto', { appUrl });
    await page.goto(appUrl, { waitUntil: 'networkidle0' });
    logStage('browser.connect.open');
    await dispatchClick(page, '[data-testid="connect-open"]');
    await page.waitForSelector('[data-testid="connect-dialog"]');
    logStage('browser.passcode.generate.start');
    const passcode = await randomSignifyPasscode();
    logStage('browser.passcode.generate.ready');
    await setInputValue(page, '#outlined-password-input', passcode);
    await page.waitForFunction(
        () =>
            globalThis.document.querySelector('#outlined-password-input')?.value
                .length >= 21,
        { timeout: 30_000 }
    );
    await page.waitForFunction(
        () => {
            const button = globalThis.document.querySelector(
                '[data-testid="connect-submit"]'
            );
            return button instanceof HTMLButtonElement && !button.disabled;
        },
        { timeout: 30_000 }
    );

    logStage('browser.connect.submit');
    await dispatchClick(page, '[data-testid="connect-submit"]');
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
        throw new Error(`Expected post-connect /dashboard route, got ${page.url()}`);
    }

    logStage('browser.connect.ready');
    return passcode;
};

/** Navigate through the mobile drawer path used by smoke viewports. */
const navigateInApp = async (
    page: Page,
    navTestId: string,
    readySelector: string
): Promise<void> => {
    await dispatchClick(page, '[data-testid="nav-open"]');
    await page.waitForSelector(`[data-testid="${navTestId}"]`, {
        timeout: 10_000,
    });
    await dispatchClick(page, `[data-testid="${navTestId}"]`);
    await page.waitForSelector(readySelector, {
        timeout: 30_000,
    });
};

/** Submit one OOBI through the Contacts UI and wait for resolution. */
const resolveOobiInContacts = async (
    page: Page,
    oobi: string,
    alias: string
): Promise<void> => {
    logStage('contact.resolve.start', { alias });
    if ((await page.$('[data-testid="contacts-view"]')) === null) {
        await navigateInApp(
            page,
            'nav-contacts',
            '[data-testid="contacts-view"]'
        );
    }
    await setInputValue(page, '[data-testid="contact-oobi-input"] textarea', oobi);
    await setInputValue(page, '[data-testid="contact-alias-input"] input', alias);
    await dispatchClick(page, '[data-testid="contact-resolve-submit"]');
    await waitForText(page, '[data-testid="contact-card"]', alias);
    logStage('contact.resolve.ready', { alias });
};

/** Open the contact detail route by visible contact alias. */
const openContactDetail = async (page: Page, alias: string): Promise<void> => {
    logStage('contact.detail.open', { alias });
    await page.waitForFunction(
        (expectedAlias) =>
            Array.from(
                globalThis.document.querySelectorAll(
                    '[data-testid="contact-card-link"]'
                )
            ).some((element) => element.textContent?.includes(expectedAlias)),
        { timeout: 30_000 },
        alias
    );
    await page.evaluate((expectedAlias) => {
        const link = Array.from(
            globalThis.document.querySelectorAll(
                '[data-testid="contact-card-link"]'
            )
        ).find((element) => element.textContent?.includes(expectedAlias));
        if (link instanceof HTMLElement) {
            link.click();
        }
    }, alias);
    await page.waitForSelector('[data-testid="contact-detail"]', {
        timeout: 30_000,
    });
    logStage('contact.detail.ready', { alias });
};

/** Prove OOBI payload details are linked from quick notification to operation. */
const assertQuickNotificationAndOperationPayload = async (
    page: Page
): Promise<void> => {
    logStage('notification.payload.start');
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

/** Build a local witness controller OOBI from configured witness fixtures. */
const witnessOobi = (): string => {
    const wanAid = appConfig.witnesses.aids[0];
    if (wanAid === undefined) {
        throw new Error('No configured witness AID available for UI smoke.');
    }

    return `http://127.0.0.1:5642/oobi/${wanAid}/controller?name=Wan`;
};

const chromeArgs =
    process.env.CI === 'true'
        ? ['--no-sandbox', '--disable-setuid-sandbox']
        : [];

const vite = await startViteIfNeeded();
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
    const browserPasscode = await connectBrowserAgent(page);
    const contactAlias = 'Wan witness';
    const contactOobi = witnessOobi();

    await resolveOobiInContacts(page, contactOobi, contactAlias);
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

    console.log(
        JSON.stringify(
            {
                status: 'passed',
                browserPasscodeLength: browserPasscode.length,
                contactAlias,
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

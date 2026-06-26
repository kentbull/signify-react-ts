import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer';

/**
 * Browser smoke for the React connection path.
 *
 * This intentionally checks only UI wiring for the Signify boundary: generated
 * passcode, connect, connected status, and client summary rendering. KERIA
 * correctness belongs to `pnpm keria:smoke`.
 */
const appUrl = process.env.BROWSER_SMOKE_URL ?? 'http://127.0.0.1:5173';
const uiPreferencesStorageKey = 'signify-react-ts:ui-preferences:v1';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

const textContent = (page, selector) =>
    page.$eval(selector, (element) => element.textContent ?? '');

const routeUrl = (path) => new URL(path, appUrl).toString();

const passcodeValue = (page) =>
    page.$eval('#outlined-password-input', (element) => element.value ?? '');

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

const waitForElementHidden = async (page, selector, timeoutMs = 30000) =>
    waitForDomState(
        page,
        `hidden element ${selector}`,
        (targetSelector) =>
            globalThis.document.querySelector(targetSelector) === null,
        timeoutMs,
        selector
    );

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
        element.dispatchEvent(
            new globalThis.MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: globalThis,
            })
        );
    }, selector);
};

const chromeArgs =
    process.env.CI === 'true'
        ? ['--no-sandbox', '--disable-setuid-sandbox']
        : [];

const vite = await startViteIfNeeded();
const browser = await puppeteer.launch({
    headless: 'new',
    args: chromeArgs,
});

try {
    const page = await browser.newPage();

    await page.goto(appUrl, { waitUntil: 'networkidle0' });
    await page.evaluate((key) => {
        globalThis.localStorage.removeItem(key);
    }, uiPreferencesStorageKey);
    await page.reload({ waitUntil: 'networkidle0' });
    await waitForElement(page, '[data-testid="ui-sound-toggle"]', 10000);
    await waitForElement(page, '[data-testid="theme-mode-toggle"]', 10000);
    const topBarToggleOrder = await page.evaluate(() => {
        const theme = globalThis.document.querySelector(
            '[data-testid="theme-mode-toggle"]'
        );
        const toggle = globalThis.document.querySelector(
            '[data-testid="ui-sound-toggle"]'
        );
        const operations = globalThis.document.querySelector(
            '[data-testid="operations-indicator"]'
        );
        return {
            themeBeforeSound: theme?.nextElementSibling === toggle,
            soundBeforeOperations: toggle?.nextElementSibling === operations,
        };
    });
    if (!topBarToggleOrder.themeBeforeSound) {
        throw new Error(
            'Expected theme toggle immediately before sound toggle'
        );
    }
    if (!topBarToggleOrder.soundBeforeOperations) {
        throw new Error(
            'Expected sound toggle immediately before operations indicator'
        );
    }
    const defaultThemeLight = await page.$eval(
        '[data-testid="theme-mode-toggle"]',
        (element) => element.getAttribute('aria-pressed')
    );
    if (defaultThemeLight !== 'false') {
        throw new Error(
            `Expected dark theme by default, got aria-pressed=${defaultThemeLight}`
        );
    }
    const defaultSoundMuted = await page.$eval(
        '[data-testid="ui-sound-toggle"]',
        (element) => element.getAttribute('aria-pressed')
    );
    if (defaultSoundMuted !== 'false') {
        throw new Error(
            `Expected sound enabled by default, got aria-pressed=${defaultSoundMuted}`
        );
    }
    await dispatchClick(page, '[data-testid="theme-mode-toggle"]');
    await waitForDomState(
        page,
        'light theme toggle state',
        () =>
            globalThis.document
                .querySelector('[data-testid="theme-mode-toggle"]')
                ?.getAttribute('aria-pressed') === 'true',
        10000
    );
    const lightThemeIconIsDark = await page.$eval(
        '[data-testid="theme-mode-toggle"]',
        (element) => {
            const color = globalThis.getComputedStyle(element).color;
            const match = color.match(/\d+/g)?.map(Number) ?? [];
            if (match.length < 3) {
                return false;
            }
            const [red, green, blue] = match;
            return red + green + blue < 280;
        }
    );
    if (!lightThemeIconIsDark) {
        throw new Error(
            'Expected light theme top-bar icons to use a dark foreground'
        );
    }
    await dispatchClick(page, '[data-testid="ui-sound-toggle"]');
    await waitForDomState(
        page,
        'muted sound toggle state',
        () =>
            globalThis.document
                .querySelector('[data-testid="ui-sound-toggle"]')
                ?.getAttribute('aria-pressed') === 'true',
        10000
    );
    const persistedSoundPreference = await page.evaluate((key) => {
        const text = globalThis.localStorage.getItem(key);
        return text === null ? null : JSON.parse(text);
    }, uiPreferencesStorageKey);
    if (persistedSoundPreference?.hoverSoundMuted !== true) {
        throw new Error('Expected muted sound preference to persist');
    }
    if (persistedSoundPreference?.themeMode !== 'light') {
        throw new Error('Expected light theme preference to persist');
    }
    await page.reload({ waitUntil: 'networkidle0' });
    await waitForElement(page, '[data-testid="ui-sound-toggle"]', 10000);
    await waitForElement(page, '[data-testid="theme-mode-toggle"]', 10000);
    const restoredThemeLight = await page.$eval(
        '[data-testid="theme-mode-toggle"]',
        (element) => element.getAttribute('aria-pressed')
    );
    if (restoredThemeLight !== 'true') {
        throw new Error(
            `Expected light theme after reload, got ${restoredThemeLight}`
        );
    }
    const restoredSoundMuted = await page.$eval(
        '[data-testid="ui-sound-toggle"]',
        (element) => element.getAttribute('aria-pressed')
    );
    if (restoredSoundMuted !== 'true') {
        throw new Error(
            `Expected muted sound preference after reload, got ${restoredSoundMuted}`
        );
    }

    for (const path of [
        '/dashboard',
        '/contacts',
        '/identifiers',
        '/credentials',
        '/client',
    ]) {
        await page.goto(routeUrl(path), { waitUntil: 'networkidle0' });
        await waitForElement(
            page,
            '[data-testid="connection-required"]',
            10000
        );
    }

    await page.goto(appUrl, { waitUntil: 'networkidle0' });

    await dispatchClick(page, '[data-testid="connect-open"]');
    await waitForElement(page, '[data-testid="connect-dialog"]');
    await dispatchClick(page, '[data-testid="generate-passcode"]');
    await waitForDomState(
        page,
        'generated passcode',
        () =>
            globalThis.document.querySelector('#outlined-password-input')?.value
                .length >= 21
    );
    const generatedPasscode = await passcodeValue(page);
    if (generatedPasscode.length < 21) {
        throw new Error(
            `Expected generated passcode, got ${generatedPasscode}`
        );
    }
    await dispatchClick(page, '[data-testid="connect-submit"]');
    await waitForElement(page, '[data-testid="app-loading-overlay"]', 10000);
    await waitForElementHidden(page, '[data-testid="connect-dialog"]', 30000);
    await waitForElementHidden(
        page,
        '[data-testid="app-loading-overlay"]',
        10000
    );
    await waitForElement(page, '[data-testid="dashboard-view"]', 10000);
    if (!page.url().endsWith('/dashboard')) {
        throw new Error(
            `Expected post-connect /dashboard route, got ${page.url()}`
        );
    }

    await dispatchClick(page, '[data-testid="nav-open"]');
    await waitForElement(page, '[data-testid="nav-identifiers"]', 10000);
    await dispatchClick(page, '[data-testid="nav-identifiers"]');
    await waitForElement(page, '[data-testid="identifier-table"]', 10000);
    const identifierTableText = await textContent(
        page,
        '[data-testid="identifier-table"]'
    );
    for (const expectedHeader of ['Name', 'AID', 'Actions']) {
        if (!identifierTableText.includes(expectedHeader)) {
            throw new Error(
                `Identifier table is missing ${expectedHeader} header`
            );
        }
    }
    if (!page.url().endsWith('/identifiers')) {
        throw new Error(
            `Expected drawer navigation to /identifiers, got ${page.url()}`
        );
    }

    const identifierStatus = await page.$(
        '[data-testid="identifier-action-status"]'
    );
    if (identifierStatus !== null) {
        const identifierStatusText = await textContent(
            page,
            '[data-testid="identifier-action-status"]'
        );
        if (identifierStatusText.includes('Unable to load identifiers')) {
            throw new Error(identifierStatusText);
        }
    }

    await sleep(500);
    await dispatchClick(page, '[data-testid="nav-open"]');
    await waitForElement(page, '[data-testid="nav-client"]', 10000);
    await dispatchClick(page, '[data-testid="nav-client"]');
    await waitForElement(page, '[data-testid="client-summary"]', 10000);
    if (!page.url().endsWith('/client')) {
        throw new Error(
            `Expected drawer navigation to /client, got ${page.url()}`
        );
    }

    const controller = await textContent(
        page,
        '[data-testid="controller-aid"]'
    );
    const agent = await textContent(page, '[data-testid="agent-aid"]');

    if (!controller.includes('E') || !agent.includes('E')) {
        throw new Error(
            `Client summary did not render expected AIDs: controller=${controller}, agent=${agent}`
        );
    }

    console.log(
        JSON.stringify(
            {
                status: 'passed',
                controller,
                agent,
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

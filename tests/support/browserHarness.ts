import { spawn, type ChildProcess } from 'node:child_process';
import type { Page } from 'puppeteer';
import { randomSignifyPasscode } from '../../src/signify/client';

export type StageDetails = Record<string, unknown>;

type BrowserWaitUntil =
    | 'domcontentloaded'
    | 'load'
    | 'networkidle0'
    | 'networkidle2';

type ClickTarget = (
    page: Page,
    target: string,
    timeoutMs?: number
) => Promise<void>;

type ButtonState = 'missing' | 'disabled' | 'enabled';

interface PollOptions {
    label: string;
    readState: () => Promise<unknown>;
    isReady?: (state: unknown) => boolean;
    timeoutMs?: number;
    intervalMs?: number;
    formatLastState?: (state: unknown) => string;
}

export const chromeArgs =
    process.env.CI === 'true'
        ? ['--no-sandbox', '--disable-setuid-sandbox']
        : [];

const DEFAULT_POLL_INTERVAL_MS = 250;
const APP_START_ATTEMPTS = 60;
const APP_START_INTERVAL_MS = 500;
const CONNECT_DIALOG_SELECTOR = '[data-testid="connect-dialog"]';
const DASHBOARD_SELECTOR = '[data-testid="dashboard-view"]';
const PASSCODE_INPUT_SELECTOR = '#outlined-password-input';
const CONNECT_SUBMIT_SELECTOR = '[data-testid="connect-submit"]';

// Browser-context helpers passed to page.evaluate. They must be self-contained.
const selectorExistsInPage = (selector: string): boolean =>
    globalThis.document.querySelector(selector) !== null;

const selectorHiddenInPage = (selector: string): boolean =>
    globalThis.document.querySelector(selector) === null;

const bodyTextSnippetInPage = (): string =>
    globalThis.document.body.textContent?.slice(0, 4000) ?? '';

const textSnapshotsInPage = (selector: string): string[] =>
    Array.from(globalThis.document.querySelectorAll(selector)).map(
        (element) => element.textContent ?? ''
    );

const buttonStateInPage = (selector: string): ButtonState => {
    const element = globalThis.document.querySelector(selector);
    if (!(element instanceof globalThis.HTMLButtonElement)) {
        return 'missing';
    }

    return element.disabled ? 'disabled' : 'enabled';
};

const inputValueHasMinLengthInPage = ({
    selector,
    minLength,
}: {
    selector: string;
    minLength: number;
}): boolean => {
    const input = globalThis.document.querySelector(selector);
    return (
        input instanceof globalThis.HTMLInputElement &&
        input.value.length >= minLength
    );
};

const setInputValueInPage = ({
    targetSelector,
    nextValue,
}: {
    targetSelector: string;
    nextValue: string;
}): void => {
    const element = globalThis.document.querySelector(targetSelector);
    if (
        !(element instanceof globalThis.HTMLInputElement) &&
        !(element instanceof globalThis.HTMLTextAreaElement)
    ) {
        throw new Error(`Input not found for selector ${targetSelector}`);
    }

    const descriptor =
        element instanceof globalThis.HTMLTextAreaElement
            ? Object.getOwnPropertyDescriptor(
                  globalThis.HTMLTextAreaElement.prototype,
                  'value'
              )
            : Object.getOwnPropertyDescriptor(
                  globalThis.HTMLInputElement.prototype,
                  'value'
              );
    if (descriptor?.set === undefined) {
        throw new Error(
            `Unable to set input value for selector ${targetSelector}`
        );
    }

    element.focus();
    descriptor.set.call(element, nextValue);
    element.dispatchEvent(new globalThis.Event('input', { bubbles: true }));
    element.dispatchEvent(new globalThis.Event('change', { bubbles: true }));
};

const clickSelectorInPage = (selector: string): void => {
    const element = globalThis.document.querySelector(selector);
    if (!(element instanceof globalThis.HTMLElement)) {
        throw new Error(`Clickable element not found for ${selector}`);
    }

    element.focus();
    element.click();
};

const visibleTestIdStateInPage = (testId: string): string => {
    let matches = 0;

    for (const element of globalThis.document.querySelectorAll('[data-testid]')) {
        if (element.getAttribute('data-testid') !== testId) {
            continue;
        }

        matches += 1;
        const rect = element.getBoundingClientRect();
        const style = globalThis.getComputedStyle(element);
        const disabled =
            element instanceof globalThis.HTMLButtonElement && element.disabled;
        const visible =
            rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            !disabled;

        if (visible) {
            return 'ready';
        }
    }

    return matches === 0 ? 'missing' : `not-visible:${matches}`;
};

const clickVisibleTestIdInPage = (testId: string): void => {
    for (const element of globalThis.document.querySelectorAll('[data-testid]')) {
        if (element.getAttribute('data-testid') !== testId) {
            continue;
        }

        const rect = element.getBoundingClientRect();
        const style = globalThis.getComputedStyle(element);
        const disabled =
            element instanceof globalThis.HTMLButtonElement && element.disabled;
        const visible =
            rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            !disabled;

        if (visible && element instanceof globalThis.HTMLElement) {
            element.click();
            return;
        }
    }

    throw new Error(`Missing visible element for ${testId}`);
};

/** Wait for a fixed interval in browser smoke polling loops. */
export const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => {
        globalThis.setTimeout(resolve, ms);
    });

/** Emit one structured progress event for CI smoke logs. */
export const logStage = (
    stage: string,
    details: StageDetails = {}
): void => {
    console.log(JSON.stringify({ stage, ...details }));
};

/** Build an absolute app URL from a route path and the smoke server URL. */
export const routeUrl = (appUrl: string, path: string): string =>
    new URL(path, appUrl).toString();

const formatLastState = (state: unknown): string =>
    typeof state === 'string' ? state : JSON.stringify(state);

const pollUntil = async ({
    label,
    readState,
    isReady = (state) => state === true,
    timeoutMs = 30_000,
    intervalMs = DEFAULT_POLL_INTERVAL_MS,
    formatLastState: formatState = formatLastState,
}: PollOptions): Promise<unknown> => {
    const timeoutAt = Date.now() + timeoutMs;
    let lastState: unknown = null;

    while (Date.now() < timeoutAt) {
        try {
            lastState = await readState();
            if (isReady(lastState)) {
                return lastState;
            }
        } catch (error) {
            lastState = error instanceof Error ? error.message : String(error);
        }
        await sleep(intervalMs);
    }

    throw new Error(
        `Timed out waiting for ${label}. Last state: ${formatState(lastState)}`
    );
};

const canReachApp = async (appUrl: string): Promise<boolean> => {
    try {
        const response = await fetch(appUrl);
        return response.ok;
    } catch {
        return false;
    }
};

const waitForApp = async (appUrl: string): Promise<void> => {
    for (let attempt = 0; attempt < APP_START_ATTEMPTS; attempt += 1) {
        if (await canReachApp(appUrl)) {
            return;
        }
        await sleep(APP_START_INTERVAL_MS);
    }

    throw new Error(`Vite app did not become reachable at ${appUrl}`);
};

const viteArgsForUrl = (appUrl: string): string[] => {
    const url = new URL(appUrl);
    const args = ['exec', 'vite', '--host', url.hostname];

    if (url.port.length > 0) {
        args.push('--port', url.port, '--strictPort');
    }

    return args;
};

/** Reuse an existing Vite app or start one bound to the smoke URL. */
export const startViteIfNeeded = async (
    appUrl: string
): Promise<ChildProcess | null> => {
    if (await canReachApp(appUrl)) {
        return null;
    }

    const child = spawn('pnpm', viteArgsForUrl(appUrl), {
        stdio: 'ignore',
        env: {
            ...process.env,
            BROWSER: 'none',
        },
    });

    await waitForApp(appUrl);
    return child;
};

const readBodyTextSnippet = (page: Page): Promise<string> =>
    page.evaluate(bodyTextSnippetInPage);

const readButtonState = (
    page: Page,
    selector: string
): Promise<ButtonState> => page.evaluate(buttonStateInPage, selector);

const waitForButtonEnabled = async (
    page: Page,
    selector: string,
    label: string,
    timeoutMs = 30_000
): Promise<void> => {
    await pollUntil({
        label,
        timeoutMs,
        readState: () => readButtonState(page, selector),
        isReady: (state) => state === 'enabled',
    });
};

/** Poll an in-page predicate and include its last state in timeout errors. */
export const waitForDomState = async (
    page: Page,
    label: string,
    predicate: (...args: unknown[]) => unknown,
    timeoutMs = 30_000,
    ...args: unknown[]
): Promise<void> => {
    await pollUntil({
        label,
        timeoutMs,
        readState: () => page.evaluate(predicate, ...args),
    });
};

/** Wait until a selector exists in the current document. */
export const waitForElement = async (
    page: Page,
    selector: string,
    timeoutMs = 30_000
): Promise<void> => {
    await waitForDomState(
        page,
        `element ${selector}`,
        selectorExistsInPage,
        timeoutMs,
        selector
    );
};

/** Wait until a selector no longer exists in the current document. */
export const waitForElementHidden = async (
    page: Page,
    selector: string,
    timeoutMs = 30_000
): Promise<void> => {
    await waitForDomState(
        page,
        `hidden element ${selector}`,
        selectorHiddenInPage,
        timeoutMs,
        selector
    );
};

/** Set a MUI-controlled input or textarea value with input/change events. */
export const setInputValue = async (
    page: Page,
    selector: string,
    value: string
): Promise<void> => {
    await waitForElement(page, selector, 10_000);
    await page.evaluate(setInputValueInPage, {
        targetSelector: selector,
        nextValue: value,
    });
};

/** Click a control through DOM activation to avoid Puppeteer hit-test flakes. */
export const dispatchClick = async (
    page: Page,
    selector: string,
    timeoutMs = 10_000
): Promise<void> => {
    await waitForElement(page, selector, timeoutMs);
    await page.evaluate(clickSelectorInPage, selector);
};

/** Wait for a button selector to become enabled, then click it. */
export const dispatchEnabledClick = async (
    page: Page,
    selector: string,
    label: string,
    timeoutMs = 30_000
): Promise<void> => {
    await waitForButtonEnabled(page, selector, label, timeoutMs);
    await dispatchClick(page, selector);
};

/** Wait until any matching element includes the expected visible text. */
export const waitForText = async (
    page: Page,
    selector: string,
    expected: string,
    timeoutMs = 120_000
): Promise<void> => {
    await pollUntil({
        label: `${selector} to include ${expected}`,
        timeoutMs,
        readState: () => page.evaluate(textSnapshotsInPage, selector),
        isReady: (state) =>
            Array.isArray(state) &&
            state.some(
                (text) => typeof text === 'string' && text.includes(expected)
            ),
        formatLastState: (state) =>
            Array.isArray(state)
                ? state.filter((text) => typeof text === 'string').join('\n')
                : formatLastState(state),
    });
};

/** Wait for a selector with a timeout error that includes visible page text. */
export const waitForElementPresent = async (
    page: Page,
    selector: string,
    label: string,
    timeoutMs = 45_000
): Promise<void> => {
    try {
        await waitForElement(page, selector, timeoutMs);
    } catch (error) {
        const visibleText = await readBodyTextSnippet(page);
        throw new Error(`${label} did not appear. Visible text: ${visibleText}`, {
            cause: error,
        });
    }
};

/** Wait for at least one visible, enabled element with the given test id. */
export const waitForClickableTestId = async (
    page: Page,
    testId: string,
    timeoutMs = 30_000
): Promise<void> => {
    try {
        await pollUntil({
            label: testId,
            timeoutMs,
            readState: () => page.evaluate(visibleTestIdStateInPage, testId),
            isReady: (state) => state === 'ready',
        });
    } catch (error) {
        const visibleText = await readBodyTextSnippet(page);
        throw new Error(
            `Timed out waiting for ${testId}. Visible text: ${visibleText}`,
            { cause: error }
        );
    }
};

/** Click the visible instance of a test id that may exist in multiple layouts. */
export const clickVisibleTestId = async (
    page: Page,
    testId: string,
    timeoutMs = 30_000
): Promise<void> => {
    await waitForClickableTestId(page, testId, timeoutMs);
    await page.evaluate(clickVisibleTestIdInPage, testId);
};

export interface BrowserAgentConnectOptions {
    appUrl: string;
    passcode?: string;
    openTarget?: string;
    submitTarget?: string;
    clickTarget?: ClickTarget;
    waitUntil?: BrowserWaitUntil;
    requireDashboardRoute?: boolean;
    logDetails?: StageDetails;
}

const openConnectDialog = async (
    page: Page,
    {
        appUrl,
        openTarget,
        clickTarget,
        waitUntil,
    }: Required<
        Pick<
            BrowserAgentConnectOptions,
            'appUrl' | 'openTarget' | 'clickTarget' | 'waitUntil'
        >
    >
): Promise<void> => {
    await page.goto(appUrl, { waitUntil });
    await clickTarget(page, openTarget);
    await page.waitForSelector(CONNECT_DIALOG_SELECTOR, { timeout: 10_000 });
};

const resolveConnectPasscode = async (
    passcode: string | undefined
): Promise<string> => passcode ?? randomSignifyPasscode();

const enterConnectPasscode = async (
    page: Page,
    passcode: string
): Promise<void> => {
    await setInputValue(page, PASSCODE_INPUT_SELECTOR, passcode);
    await waitForDomState(
        page,
        'passcode input',
        inputValueHasMinLengthInPage,
        30_000,
        { selector: PASSCODE_INPUT_SELECTOR, minLength: 21 }
    );
};

const submitConnectDialog = async (
    page: Page,
    submitTarget: string,
    clickTarget: ClickTarget
): Promise<void> => {
    await waitForButtonEnabled(page, CONNECT_SUBMIT_SELECTOR, 'connect submit');
    await clickTarget(page, submitTarget);
    await page.waitForSelector(DASHBOARD_SELECTOR, { timeout: 120_000 });
};

const closeResidualConnectDialog = async (page: Page): Promise<void> => {
    if ((await page.$(CONNECT_DIALOG_SELECTOR)) === null) {
        return;
    }

    await page.keyboard.press('Escape');
    await page.waitForSelector(CONNECT_DIALOG_SELECTOR, {
        hidden: true,
        timeout: 10_000,
    });
};

const assertDashboardRoute = (page: Page): void => {
    if (!page.url().endsWith('/dashboard')) {
        throw new Error(`Expected post-connect /dashboard route, got ${page.url()}`);
    }
};

/** Connect the browser wallet and return the passcode used for the session. */
export const connectBrowserAgent = async (
    page: Page,
    {
        appUrl,
        passcode,
        openTarget = '[data-testid="connect-open"]',
        submitTarget = CONNECT_SUBMIT_SELECTOR,
        clickTarget = dispatchClick,
        waitUntil = 'networkidle0',
        requireDashboardRoute = true,
        logDetails = {},
    }: BrowserAgentConnectOptions
): Promise<string> => {
    await openConnectDialog(page, {
        appUrl,
        openTarget,
        clickTarget,
        waitUntil,
    });

    const browserPasscode = await resolveConnectPasscode(passcode);
    await enterConnectPasscode(page, browserPasscode);
    await submitConnectDialog(page, submitTarget, clickTarget);
    await closeResidualConnectDialog(page);

    if (requireDashboardRoute) {
        assertDashboardRoute(page);
    }

    logStage('browser.connect.ready', logDetails);
    return browserPasscode;
};

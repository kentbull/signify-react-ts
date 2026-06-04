import { spawn, type ChildProcess } from 'node:child_process';
import puppeteer, { type Page } from 'puppeteer';
import { appConfig } from '../src/config';
import {
    challengeWordsFingerprint,
    validateChallengeWords,
} from '../src/domain/challenges/challengeWords';
import {
    CHALLENGE_REQUEST_ROUTE,
    CHALLENGE_TOPIC,
    responseSaidFromChallengeOperation,
} from '../src/services/challenges.service';
import {
    connectSignifyClient,
    randomSignifyPasscode,
    waitOperation,
} from '../src/signify/client';
import {
    addAgentEndRole,
    createRole,
    createWitnessedIdentifier,
    resolveOobi,
    uniqueAlias,
    waitForEvent,
    waitForKeriaOperation,
    type Role,
} from './support/keria';

/** Browser app URL; a local Vite server is started when unreachable. */
const appUrl =
    process.env.CONTACT_CHALLENGE_SMOKE_URL ?? 'http://127.0.0.1:5177';

/** Small polling delay helper for app, exchange, and UI readiness checks. */
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

/** Click a visible control through DOM activation to avoid hit-test flake. */
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
    const timeoutAt = Date.now() + timeout;
    let lastText = '';
    while (Date.now() < timeoutAt) {
        const texts = await page.evaluate((visibleSelector) => {
            return Array.from(
                globalThis.document.querySelectorAll(visibleSelector)
            ).map((element) => element.textContent ?? '');
        }, selector);
        lastText = texts.join('\n');
        if (texts.some((text) => text.includes(expected))) {
            return;
        }
        await sleep(250);
    }

    throw new Error(
        `Timed out waiting for ${selector} to include ${expected}. Last text: ${lastText}`
    );
};

/** Wait for a button to become enabled, then click through DOM activation. */
const dispatchEnabledClick = async (
    page: Page,
    selector: string,
    label: string
): Promise<void> => {
    const timeoutAt = Date.now() + 30_000;
    let lastState = 'not checked';

    while (Date.now() < timeoutAt) {
        lastState = await page.evaluate((targetSelector) => {
            const element = globalThis.document.querySelector(targetSelector);
            if (!(element instanceof globalThis.HTMLButtonElement)) {
                return 'missing';
            }
            return element.disabled ? 'disabled' : 'enabled';
        }, selector);
        if (lastState === 'enabled') {
            await dispatchClick(page, selector);
            return;
        }
        await sleep(250);
    }

    throw new Error(`${label} did not become enabled: ${lastState}`);
};

/** Wait for an element to exist using explicit polling and visible diagnostics. */
const waitForElementPresent = async (
    page: Page,
    selector: string,
    label: string,
    timeout = 45_000
): Promise<void> => {
    const timeoutAt = Date.now() + timeout;
    while (Date.now() < timeoutAt) {
        const found = await page.evaluate(
            (targetSelector) =>
                globalThis.document.querySelector(targetSelector) !== null,
            selector
        );
        if (found) {
            return;
        }
        await sleep(250);
    }

    const visibleText = await page.evaluate(
        () => globalThis.document.body.textContent?.slice(0, 4000) ?? ''
    );
    throw new Error(`${label} did not appear. Visible text: ${visibleText}`);
};

/** Boot/connect the browser wallet and return its generated passcode. */
const connectBrowserAgent = async (page: Page): Promise<string> => {
    logStage('browser.connect.open');
    await page.goto(appUrl, { waitUntil: 'networkidle0' });
    await dispatchClick(page, '[data-testid="connect-open"]');
    await page.waitForSelector('[data-testid="connect-dialog"]');
    const passcode = await randomSignifyPasscode();
    await setInputValue(page, '#outlined-password-input', passcode);
    await page.waitForFunction(
        () =>
            globalThis.document.querySelector('#outlined-password-input')?.value
                .length >= 21,
        { timeout: 30_000 }
    );

    await dispatchClick(page, '[data-testid="connect-submit"]');
    await page.waitForSelector('[data-testid="dashboard-view"]', {
        timeout: 120_000,
    });
    logStage('browser.connect.dashboard');
    if ((await page.$('[data-testid="connect-dialog"]')) !== null) {
        await page.keyboard.press('Escape');
        await page.waitForSelector('[data-testid="connect-dialog"]', {
            hidden: true,
            timeout: 10_000,
        });
    }

    return passcode;
};

/** Build a Node Signify role for the same controller as the browser wallet. */
const roleFromPasscode = async (
    passcode: string,
    name: string
): Promise<Role> => {
    const connected = await connectSignifyClient({
        adminUrl: appConfig.keria.adminUrl,
        bootUrl: appConfig.keria.bootUrl,
        passcode,
        tier: appConfig.defaultTier,
    });

    let role: Role;
    role = {
        name,
        passcode,
        client: connected.client,
        controllerPre: connected.state.controllerPre,
        agentPre: connected.state.agentPre,
        waitEvent: async (result, label) => waitForEvent(role, result, label),
        waitOperation: async (operation, label) =>
            waitForKeriaOperation(role, operation, label),
    };

    return role;
};

/** Navigate through the mobile drawer path used by smoke viewports. */
const navigateInApp = async (
    page: Page,
    navTestId: string,
    readySelector: string
): Promise<void> => {
    logStage('nav.open.start', { navTestId });
    await dispatchClick(page, '[data-testid="nav-open"]');
    await page.waitForSelector(`[data-testid="${navTestId}"]`, {
        timeout: 10_000,
    });
    await dispatchClick(page, `[data-testid="${navTestId}"]`);
    await page.waitForSelector(readySelector, {
        timeout: 30_000,
    });
    logStage('nav.open.ready', { navTestId });
};

/** Wait until the contact card shows KERIA resolution has completed. */
const waitForResolvedContact = async (
    page: Page,
    alias: string
): Promise<void> => {
    const timeoutAt = Date.now() + 120_000;
    let cards: string[] = [];
    while (Date.now() < timeoutAt) {
        cards = await page.evaluate(() =>
            Array.from(
                globalThis.document.querySelectorAll(
                    '[data-testid="contact-card"]'
                )
            ).map((element) => element.textContent ?? '')
        );
        if (
            cards.some(
                (text) => text.includes(alias) && text.includes('resolved')
            )
        ) {
            return;
        }
        await sleep(250);
    }

    throw new Error(
        `Contact ${alias} did not reach resolved state. Cards: ${JSON.stringify(cards)}`
    );
};

/** Submit one OOBI through the Contacts UI and wait for resolution. */
const resolveOobiInContacts = async (
    page: Page,
    oobi: string,
    alias: string
): Promise<void> => {
    logStage('contacts.resolve.start', { alias });
    if ((await page.$('[data-testid="contacts-view"]')) === null) {
        logStage('contacts.navigate.start', { alias });
        await navigateInApp(
            page,
            'nav-contacts',
            '[data-testid="contacts-view"]'
        );
        logStage('contacts.navigate.ready', { alias });
    }
    logStage('contacts.resolve.oobiInput.start', { alias });
    await setInputValue(
        page,
        '[data-testid="contact-oobi-input"] textarea',
        oobi
    );
    logStage('contacts.resolve.oobiInput.ready', { alias });
    logStage('contacts.resolve.aliasInput.start', { alias });
    await setInputValue(
        page,
        '[data-testid="contact-alias-input"] input',
        alias
    );
    logStage('contacts.resolve.aliasInput.ready', { alias });
    logStage('contacts.resolve.submit.start', { alias });
    await dispatchEnabledClick(
        page,
        '[data-testid="contact-resolve-submit"]',
        'contact resolve submit'
    );
    logStage('contacts.resolve.submit.clicked', { alias });
    logStage('contacts.resolve.cardWait.start', { alias });
    await waitForText(page, '[data-testid="contact-card"]', alias);
    await waitForResolvedContact(page, alias);
    logStage('contacts.resolve.ready', { alias });
};

/** Open the contact detail route by visible contact alias. */
const openContactDetail = async (page: Page, alias: string): Promise<void> => {
    logStage('contacts.detail.open', { alias });
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
    logStage('contacts.detail.ready', { alias });
};

/** Read challenge words generated by the browser contact detail workflow. */
const generatedChallengeWords = async (page: Page): Promise<string[]> => {
    await page.waitForSelector('[data-testid="challenge-generated-words"]', {
        timeout: 30_000,
    });
    const text = await page.$eval(
        '[data-testid="challenge-generated-words"]',
        (element) => element.textContent ?? ''
    );
    const words = text.trim().split(/\s+/u).filter(Boolean);
    if (words.length !== 12 && words.length !== 24) {
        throw new Error(
            `Expected challenge words, got ${words.length} tokens.`
        );
    }

    return words;
};

/** Generate valid challenge words directly through the harness KERIA role. */
const generatedKeriaChallengeWords = async (role: Role): Promise<string[]> => {
    const challenge = await role.client.challenges().generate(128);
    const words = Array.isArray(challenge.words) ? challenge.words : [];
    const error = validateChallengeWords(words);
    if (error !== null) {
        throw new Error(error);
    }

    return words.map((word) => word.trim().toLowerCase());
};

/** Send a challenge request EXN without embedding the challenge words. */
const sendChallengeRequest = async ({
    challenger,
    challengerAlias,
    recipientAid,
    words,
}: {
    challenger: Role;
    challengerAlias: string;
    recipientAid: string;
    words: readonly string[];
}): Promise<string> => {
    const challengeId = `smoke-challenge-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;
    const hab = await challenger.client.identifiers().get(challengerAlias);
    await challenger.client.exchanges().send(
        challengerAlias,
        CHALLENGE_TOPIC,
        hab,
        CHALLENGE_REQUEST_ROUTE,
        {
            challengeId,
            wordsHash: challengeWordsFingerprint(words),
            strength: words.length === 24 ? 256 : 128,
        },
        {},
        [recipientAid]
    );

    return challengeId;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const exchangeChallengeId = (value: unknown): string | null => {
    if (!isRecord(value) || !isRecord(value.exn) || !isRecord(value.exn.a)) {
        return null;
    }

    const challengeId = value.exn.a.challengeId;
    return typeof challengeId === 'string' ? challengeId : null;
};

const exchangeSaid = (value: unknown): string | null => {
    if (!isRecord(value) || !isRecord(value.exn)) {
        return null;
    }

    const said = value.exn.d;
    return typeof said === 'string' ? said : null;
};

/** Query challenge request EXNs because synthetic notifications derive from them. */
const challengeRequestExchanges = async (role: Role): Promise<unknown[]> => {
    const response = await role.client.fetch('/exchanges/query', 'POST', {
        filter: {
            '-r': CHALLENGE_REQUEST_ROUTE,
        },
        limit: 50,
    });
    const raw: unknown = await response.json();
    return Array.isArray(raw) ? raw : [];
};

/** Wait until the recipient KERIA agent has indexed a challenge request EXN. */
const waitForChallengeRequestExchange = async (
    role: Role,
    challengeId: string
): Promise<string> => {
    for (let attempt = 0; attempt < 45; attempt += 1) {
        const exchanges = await challengeRequestExchanges(role);
        const exchange = exchanges.find(
            (candidate) => exchangeChallengeId(candidate) === challengeId
        );
        if (exchange !== undefined) {
            const said = exchangeSaid(exchange);
            if (said !== null) {
                return said;
            }
        }
        await sleep(1000);
    }

    throw new Error(`Challenge request ${challengeId} was not indexed.`);
};

/** Complete challenger-side verify/wait/responded acceptance. */
const verifyChallengeResponse = async ({
    challenger,
    responderAid,
    words,
    label,
}: {
    challenger: Role;
    responderAid: string;
    words: readonly string[];
    label: string;
}): Promise<void> => {
    const operation = await challenger.client
        .challenges()
        .verify(responderAid, [...words]);
    const completed = await waitOperation(challenger.client, operation, {
        label: `${challenger.name}: ${label}`,
        ...appConfig.operations,
        timeoutMs: 120_000,
    });
    const responseSaid = responseSaidFromChallengeOperation(completed);
    const response = await challenger.client
        .challenges()
        .responded(responderAid, responseSaid);
    if (!response.ok) {
        throw new Error(
            `KERIA rejected ${label}: ${response.status} ${response.statusText}`
        );
    }
};

/** Open the notification quick panel from any route state. */
const openNotificationsBell = async (page: Page): Promise<void> => {
    await page.keyboard.press('Escape');
    await dispatchClick(page, '[data-testid="notifications-open"]');
};

interface ChallengeNotificationCardSnapshot {
    challengeId: string | null;
    text: string;
}

/** Return visible challenge notification cards with hidden challenge ids. */
const challengeNotificationCards = (
    page: Page
): Promise<ChallengeNotificationCardSnapshot[]> =>
    page.evaluate(() =>
        Array.from(
            globalThis.document.querySelectorAll(
                '[data-testid="challenge-notification-card"]'
            )
        ).map((card) => {
            const input = card.querySelector('input[name="challengeId"]');
            return {
                challengeId:
                    input instanceof globalThis.HTMLInputElement
                        ? input.value
                        : null,
                text: card.textContent ?? '',
            };
        })
    );

/** Wait for the matching synthetic challenge notification card. */
const waitForChallengeNotificationCard = async (
    page: Page,
    challengeId: string
): Promise<void> => {
    logStage('challenge.notification.open.start');
    await openNotificationsBell(page);
    logStage('challenge.notification.open.ready');

    const timeoutAt = Date.now() + 45_000;
    let cards: ChallengeNotificationCardSnapshot[] = [];
    while (Date.now() < timeoutAt) {
        cards = await challengeNotificationCards(page);
        if (cards.some((card) => card.challengeId === challengeId)) {
            logStage('challenge.notification.card.ready', { challengeId });
            return;
        }
        await sleep(250);
    }

    const visibleText = await page.evaluate(
        () => globalThis.document.body.textContent?.slice(0, 4000) ?? ''
    );
    throw new Error(
        `Challenge notification card ${challengeId} did not appear. Cards: ${JSON.stringify(cards)} Visible text: ${visibleText}`
    );
};

/** Selector that avoids MUI's hidden autosize mirror textarea. */
const visibleChallengeResponseTextarea = (scope: string): string =>
    `${scope} [data-testid="challenge-notification-response-input"] textarea:not([aria-hidden="true"])`;

/** Set words in the matching top-bar challenge notification card. */
const setCardChallengeResponseWords = async (
    page: Page,
    challengeId: string,
    words: readonly string[]
): Promise<void> => {
    await page.evaluate(
        ({ targetChallengeId, nextValue }) => {
            const card = Array.from(
                globalThis.document.querySelectorAll(
                    '[data-testid="challenge-notification-card"]'
                )
            ).find((candidate) => {
                const input = candidate.querySelector(
                    'input[name="challengeId"]'
                );
                return (
                    input instanceof globalThis.HTMLInputElement &&
                    input.value === targetChallengeId
                );
            });
            if (!(card instanceof globalThis.HTMLElement)) {
                throw new Error(
                    `Challenge card ${targetChallengeId} was not found.`
                );
            }
            const textarea = card.querySelector(
                '[data-testid="challenge-notification-response-input"] textarea:not([aria-hidden="true"])'
            );
            if (!(textarea instanceof globalThis.HTMLTextAreaElement)) {
                throw new Error(
                    `Challenge card ${targetChallengeId} response textarea was not found.`
                );
            }
            const valueSetter = Object.getOwnPropertyDescriptor(
                globalThis.HTMLTextAreaElement.prototype,
                'value'
            )?.set;
            if (valueSetter === undefined) {
                throw new Error('Unable to set challenge response words.');
            }
            textarea.focus();
            valueSetter.call(textarea, nextValue);
            textarea.dispatchEvent(
                new globalThis.Event('input', { bubbles: true })
            );
            textarea.dispatchEvent(
                new globalThis.Event('change', { bubbles: true })
            );
        },
        { targetChallengeId: challengeId, nextValue: words.join(' ') }
    );
};

/** Click the matching top-bar challenge response submit button. */
const clickCardChallengeResponseSubmit = async (
    page: Page,
    challengeId: string
): Promise<void> => {
    const timeoutAt = Date.now() + 30_000;
    let lastState = 'not checked';

    while (Date.now() < timeoutAt) {
        lastState = await page.evaluate((targetChallengeId) => {
            const card = Array.from(
                globalThis.document.querySelectorAll(
                    '[data-testid="challenge-notification-card"]'
                )
            ).find((candidate) => {
                const input = candidate.querySelector(
                    'input[name="challengeId"]'
                );
                return (
                    input instanceof globalThis.HTMLInputElement &&
                    input.value === targetChallengeId
                );
            });
            if (!(card instanceof globalThis.HTMLElement)) {
                return 'missing-card';
            }
            const button = card.querySelector(
                '[data-testid="challenge-notification-response-submit"]'
            );
            if (!(button instanceof globalThis.HTMLButtonElement)) {
                return 'missing-button';
            }
            if (button.disabled) {
                return 'disabled';
            }
            button.click();
            return 'clicked';
        }, challengeId);
        if (lastState === 'clicked') {
            return;
        }
        await sleep(250);
    }

    throw new Error(
        `Challenge card ${challengeId} submit did not become enabled: ${lastState}`
    );
};

/** Respond to a challenge request from the top-bar notification card. */
const respondFromBellNotification = async (
    page: Page,
    words: readonly string[],
    challengeId: string
): Promise<void> => {
    logStage('challenge.bell.response.start', { challengeId });
    await waitForChallengeNotificationCard(page, challengeId);
    await setCardChallengeResponseWords(page, challengeId, words);
    await clickCardChallengeResponseSubmit(page, challengeId);
    logStage('challenge.bell.response.submitted', { challengeId });
};

/** Respond to a challenge request from the notification detail route. */
const respondFromNotificationDetail = async (
    page: Page,
    words: readonly string[],
    challengeId: string
): Promise<void> => {
    logStage('challenge.detail.response.start', { challengeId });
    await waitForChallengeNotificationCard(page, challengeId);
    logStage('challenge.detail.link.click.start');
    await page.evaluate((targetChallengeId) => {
        const card = Array.from(
            globalThis.document.querySelectorAll(
                '[data-testid="challenge-notification-card"]'
            )
        ).find((candidate) => {
            const input = candidate.querySelector('input[name="challengeId"]');
            return (
                input instanceof globalThis.HTMLInputElement &&
                input.value === targetChallengeId
            );
        });
        const link = card?.querySelector(
            '[data-testid="challenge-notification-detail-link"]'
        );
        if (!(link instanceof globalThis.HTMLElement)) {
            throw new Error(
                `Challenge detail link for ${targetChallengeId} was not found.`
            );
        }
        link.click();
    }, challengeId);
    logStage('challenge.detail.link.click.ready');
    const timeoutAt = Date.now() + 10_000;
    while (Date.now() < timeoutAt) {
        const onDetail = await page.evaluate(() =>
            globalThis.location.pathname.startsWith('/notifications/')
        );
        if (onDetail) {
            logStage('challenge.detail.route.ready', { url: page.url() });
            break;
        }
        await sleep(250);
    }
    if (
        !(await page.evaluate(() =>
            globalThis.location.pathname.startsWith('/notifications/')
        ))
    ) {
        throw new Error(`Notification detail route did not open: ${page.url()}`);
    }
    logStage('challenge.detail.textarea.wait.start');
    await waitForElementPresent(
        page,
        visibleChallengeResponseTextarea('main'),
        'Challenge notification detail textarea'
    );
    logStage('challenge.detail.textarea.wait.ready');
    logStage('challenge.detail.response.input.start');
    await setInputValue(
        page,
        visibleChallengeResponseTextarea('main'),
        words.join(' ')
    );
    logStage('challenge.detail.response.input.ready');
    logStage('challenge.detail.response.submit.start');
    await dispatchEnabledClick(
        page,
        'main [data-testid="challenge-notification-response-submit"]',
        'challenge detail response submit'
    );
    logStage('challenge.detail.response.submitted');
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
    const browserRole = await roleFromPasscode(
        browserPasscode,
        'ui-challenge-browser'
    );
    const browserAlias = uniqueAlias('ui-challenge-browser');
    logStage('browser.identifier.create.start', { browserAlias });
    const browserAid = await createWitnessedIdentifier(
        browserRole,
        browserAlias
    );
    const browserOobi = await addAgentEndRole(browserRole, browserAlias);
    logStage('browser.identifier.ready', {
        browserAlias,
        browserAid: browserAid.prefix,
    });

    const harness = await createRole('ui-challenge-harness');
    const harnessAlias = uniqueAlias('ui-challenge-harness');
    logStage('harness.identifier.create.start', { harnessAlias });
    await createWitnessedIdentifier(harness, harnessAlias);
    const harnessOobi = await addAgentEndRole(harness, harnessAlias);
    logStage('harness.identifier.ready', { harnessAlias });
    logStage('harness.resolve.browser.start', { browserAlias });
    await resolveOobi(harness, browserOobi, browserAlias);
    logStage('harness.resolve.browser.ready', { browserAlias });

    await resolveOobiInContacts(page, harnessOobi, harnessAlias);
    await openContactDetail(page, harnessAlias);
    await waitForText(page, '[data-testid="contact-detail"]', 'Unverified');

    logStage('challenge.detail.generate.start');
    await dispatchEnabledClick(
        page,
        '[data-testid="challenge-generate-submit"]',
        'challenge generate submit'
    );
    const words = await generatedChallengeWords(page);
    logStage('challenge.detail.generate.ready', { wordCount: words.length });

    logStage('harness.respond.browserChallenge.start');
    await harness.client
        .challenges()
        .respond(harnessAlias, browserAid.prefix, words);
    logStage('harness.respond.browserChallenge.submitted');
    await waitForText(
        page,
        '[data-testid="contact-detail"]',
        'Verified',
        180_000
    );
    logStage('challenge.detail.verified');
    await page.waitForFunction(
        () =>
            globalThis.document.querySelector(
                '[data-testid="challenge-generated-words"]'
            ) === null,
        { timeout: 30_000 }
    );

    const detailWords = await generatedKeriaChallengeWords(harness);
    logStage('harness.challenge.detail.send.start', {
        wordCount: detailWords.length,
    });
    const detailChallengeId = await sendChallengeRequest({
        challenger: harness,
        challengerAlias: harnessAlias,
        recipientAid: browserAid.prefix,
        words: detailWords,
    });
    logStage('harness.challenge.detail.send.ready', { detailChallengeId });
    await waitForChallengeRequestExchange(browserRole, detailChallengeId);
    logStage('browser.challenge.detail.indexed', { detailChallengeId });
    await respondFromNotificationDetail(page, detailWords, detailChallengeId);
    await verifyChallengeResponse({
        challenger: harness,
        responderAid: browserAid.prefix,
        words: detailWords,
        label: 'verifying detail challenge response',
    });
    logStage('harness.challenge.detail.verified', { detailChallengeId });

    const bellWords = await generatedKeriaChallengeWords(harness);
    logStage('harness.challenge.bell.send.start', {
        wordCount: bellWords.length,
    });
    const bellChallengeId = await sendChallengeRequest({
        challenger: harness,
        challengerAlias: harnessAlias,
        recipientAid: browserAid.prefix,
        words: bellWords,
    });
    logStage('harness.challenge.bell.send.ready', { bellChallengeId });
    await waitForChallengeRequestExchange(browserRole, bellChallengeId);
    logStage('browser.challenge.bell.indexed', { bellChallengeId });
    await respondFromBellNotification(page, bellWords, bellChallengeId);
    await verifyChallengeResponse({
        challenger: harness,
        responderAid: browserAid.prefix,
        words: bellWords,
        label: 'verifying bell challenge response',
    });
    logStage('harness.challenge.bell.verified', { bellChallengeId });

    console.log(
        JSON.stringify(
            {
                status: 'passed',
                browserAlias,
                harnessAlias,
                wordCount: words.length,
                bellWordCount: bellWords.length,
                detailWordCount: detailWords.length,
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

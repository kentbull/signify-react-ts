import type { Page } from 'puppeteer';
import {
    dispatchClick,
    dispatchEnabledClick,
    logStage,
    setInputValue,
    sleep,
    waitForText,
} from './browserHarness';

interface ResolveOobiOptions {
    alias: string;
    oobi: string;
    requireResolved?: boolean;
}

interface ContactCardState {
    cards: string[];
    resolved: boolean;
}

const CONTACTS_VIEW_SELECTOR = '[data-testid="contacts-view"]';
const CONTACT_CARD_SELECTOR = '[data-testid="contact-card"]';
const CONTACT_DETAIL_SELECTOR = '[data-testid="contact-detail"]';
const CONTACT_OOBI_INPUT_SELECTOR = '[data-testid="contact-oobi-input"] textarea';
const CONTACT_ALIAS_INPUT_SELECTOR = '[data-testid="contact-alias-input"] input';
const CONTACT_RESOLVE_SUBMIT_SELECTOR = '[data-testid="contact-resolve-submit"]';

// Browser-context helpers passed to page.evaluate. They must be self-contained.
const contactCardStateInPage = (expectedAlias: string): ContactCardState => {
    const cards = Array.from(
        globalThis.document.querySelectorAll('[data-testid="contact-card"]')
    ).map((element) => element.textContent ?? '');
    const resolved = cards.some(
        (text) => text.includes(expectedAlias) && text.includes('resolved')
    );

    return { cards, resolved };
};

const contactCardLinkExistsInPage = (expectedAlias: string): boolean =>
    Array.from(
        globalThis.document.querySelectorAll('[data-testid="contact-card-link"]')
    ).some((element) => element.textContent?.includes(expectedAlias));

const clickContactCardLinkInPage = (expectedAlias: string): void => {
    const link = Array.from(
        globalThis.document.querySelectorAll('[data-testid="contact-card-link"]')
    ).find((element) => element.textContent?.includes(expectedAlias));

    if (!(link instanceof globalThis.HTMLElement)) {
        throw new Error(`Contact link for ${expectedAlias} was not found.`);
    }

    link.click();
};

/** Navigate through the mobile drawer path used by smoke viewports. */
export const navigateInApp = async (
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

const waitForResolvedContact = async (
    page: Page,
    alias: string
): Promise<void> => {
    const timeoutAt = Date.now() + 120_000;
    let state: ContactCardState = { cards: [], resolved: false };

    while (Date.now() < timeoutAt) {
        state = await page.evaluate(contactCardStateInPage, alias);
        if (state.resolved) {
            return;
        }
        await sleep(250);
    }

    throw new Error(
        `Contact ${alias} did not reach resolved state. Cards: ${JSON.stringify(state.cards)}`
    );
};

/** Submit one OOBI through the Contacts UI and wait for the requested state. */
export const resolveOobiInContacts = async (
    page: Page,
    { oobi, alias, requireResolved = false }: ResolveOobiOptions
): Promise<void> => {
    logStage('contact.resolve.start', { alias });
    if ((await page.$(CONTACTS_VIEW_SELECTOR)) === null) {
        await navigateInApp(page, 'nav-contacts', CONTACTS_VIEW_SELECTOR);
    }

    await setInputValue(page, CONTACT_OOBI_INPUT_SELECTOR, oobi);
    await setInputValue(page, CONTACT_ALIAS_INPUT_SELECTOR, alias);
    await dispatchEnabledClick(
        page,
        CONTACT_RESOLVE_SUBMIT_SELECTOR,
        'contact resolve submit'
    );
    await waitForText(page, CONTACT_CARD_SELECTOR, alias);
    if (requireResolved) {
        await waitForResolvedContact(page, alias);
    }
    logStage('contact.resolve.ready', { alias });
};

/** Open the contact detail route by visible contact alias. */
export const openContactDetail = async (
    page: Page,
    alias: string
): Promise<void> => {
    logStage('contact.detail.open', { alias });
    await page.waitForFunction(contactCardLinkExistsInPage, {
        timeout: 30_000,
    }, alias);
    await page.evaluate(clickContactCardLinkInPage, alias);
    await page.waitForSelector(CONTACT_DETAIL_SELECTOR, {
        timeout: 30_000,
    });
    logStage('contact.detail.ready', { alias });
};

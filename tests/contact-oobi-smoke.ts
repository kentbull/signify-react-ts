import puppeteer, { type Page } from 'puppeteer';
import { appConfig } from '../src/config';
import {
    chromeArgs,
    connectBrowserAgent,
    dispatchClick,
    logStage,
    startViteIfNeeded,
    waitForText,
} from './support/browserHarness';
import {
    navigateInApp,
    openContactDetail,
    resolveOobiInContacts,
} from './support/contactUiHarness';

/** Browser app URL; a local Vite server is started when unreachable. */
const appUrl =
    process.env.CONTACT_OOBI_SMOKE_URL ?? 'http://127.0.0.1:5176';

/** Prove OOBI payload details are linked from quick notification to operation. */
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

/** Build a local witness controller OOBI from configured witness fixtures. */
const witnessOobi = (): string => {
    const wanAid = appConfig.witnesses.aids[0];
    if (wanAid === undefined) {
        throw new Error('No configured witness AID available for UI smoke.');
    }

    return `http://127.0.0.1:5642/oobi/${wanAid}/controller?name=Wan`;
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
    const browserPasscode = await connectBrowserAgent(page, { appUrl });
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

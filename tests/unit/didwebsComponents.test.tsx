import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { didWebsAssetUrlsFromDid } from '../../src/domain/didwebs/didWebsUrls';
import { DidWebsPublicationDetails } from '../../src/features/didwebs/DidWebsPublicationDetails';
import type { DidWebsDidRecord } from '../../src/state/didwebs.slice';

const readyRecord: DidWebsDidRecord = {
    aid: 'Eaid',
    loadState: 'ready',
    did: 'did:webs:example.com:dws:Eaid',
    error: null,
    updatedAt: '2026-04-29T00:00:00.000Z',
};

describe('did:webs URL derivation', () => {
    it('derives local did:webs asset URLs with http', () => {
        expect(
            didWebsAssetUrlsFromDid('did:webs:127.0.0.1%3A3902:dws:Eaid')
        ).toEqual({
            didJsonUrl: 'http://127.0.0.1:3902/dws/Eaid/did.json',
            keriCesrUrl: 'http://127.0.0.1:3902/dws/Eaid/keri.cesr',
        });
    });

    it('derives non-local did:webs asset URLs with https', () => {
        expect(
            didWebsAssetUrlsFromDid('did:webs:example.com:dws:Eaid')
        ).toEqual({
            didJsonUrl: 'https://example.com/dws/Eaid/did.json',
            keriCesrUrl: 'https://example.com/dws/Eaid/keri.cesr',
        });
    });
});

describe('did:webs DID details', () => {
    it('renders pending values without copy actions before a DID is available', () => {
        const markup = renderToStaticMarkup(
            <DidWebsPublicationDetails
                record={{
                    ...readyRecord,
                    loadState: 'pending',
                    did: null,
                }}
                testIdPrefix="identifier"
            />
        );

        expect(markup).toContain('...pending...');
        expect(markup).toContain('pending');
        expect(markup).not.toContain('aria-label="copy did:webs DID"');
    });

    it('renders ready did:webs values as copyable', () => {
        const markup = renderToStaticMarkup(
            <DidWebsPublicationDetails
                record={readyRecord}
                testIdPrefix="identifier"
            />
        );

        expect(markup).toContain('did:webs:example.com:dws:Eaid');
        expect(markup).toContain('https://example.com/dws/Eaid/did.json');
        expect(markup).toContain('aria-label="copy did:webs DID"');
        expect(markup).toContain('aria-label="copy did.json URL"');
        expect(markup).toContain('aria-label="copy keri.cesr URL"');
    });
});

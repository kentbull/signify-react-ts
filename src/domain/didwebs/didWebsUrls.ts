export interface DidWebsAssetUrls {
    didJsonUrl: string;
    keriCesrUrl: string;
}

const DID_WEBS_PREFIX = 'did:webs:';

const loopbackHost = (hostPort: string): boolean => {
    if (hostPort === '::1' || hostPort.startsWith('[::1]')) {
        return true;
    }

    const host = hostPort.startsWith('[')
        ? hostPort.slice(1, hostPort.indexOf(']'))
        : hostPort.split(':')[0];

    return (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host.startsWith('127.')
    );
};

/** Derive KERIA did:webs asset URLs from a did:webs DID. */
export const didWebsAssetUrlsFromDid = (
    did: string
): DidWebsAssetUrls | null => {
    if (!did.startsWith(DID_WEBS_PREFIX)) {
        return null;
    }

    const methodSpecificId = did.slice(DID_WEBS_PREFIX.length).split('?')[0];
    const segments = methodSpecificId.split(':').filter(Boolean);
    if (segments.length < 2) {
        return null;
    }

    const hostPort = decodeURIComponent(segments[0]);
    const path = segments.slice(1).join('/');
    const scheme = loopbackHost(hostPort) ? 'http' : 'https';
    const base = `${scheme}://${hostPort}/${path}`;

    return {
        didJsonUrl: `${base}/did.json`,
        keriCesrUrl: `${base}/keri.cesr`,
    };
};

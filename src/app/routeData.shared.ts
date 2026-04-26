/**
 * Read a form field as a string, using an empty string for missing values.
 */
export const formString = (formData: FormData, field: string): string => {
    const value = formData.get(field);
    return typeof value === 'string' ? value : '';
};

/**
 * Normalize unknown route-action failures without importing Signify readiness.
 */
export const toRouteError = (error: unknown): Error =>
    error instanceof Error ? error : new Error(String(error));

/** Guard route-submitted JSON values before narrowing command drafts. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

/** Guard route-submitted arrays used by serialized drafts. */
export const isStringArray = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every((item) => typeof item === 'string');

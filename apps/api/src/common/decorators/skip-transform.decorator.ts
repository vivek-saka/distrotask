import { SetMetadata } from '@nestjs/common';

export const SKIP_TRANSFORM_KEY = 'skipTransform';

/**
 * Use on routes that must return a raw response body (plain text, binary,
 * etc.) rather than being wrapped in the standard `{ success, data,
 * timestamp }` envelope — e.g. the Prometheus scrape endpoint, which must
 * return text-exposition format or Prometheus cannot parse it.
 */
export const SkipTransform = () => SetMetadata(SKIP_TRANSFORM_KEY, true);

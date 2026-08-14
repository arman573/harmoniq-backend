import {
  normalizeTrackingReadBaseUrl,
  readTrackingReadConfig,
} from './tracking-read.config';

describe('tracking read config', () => {
  it('is disabled by default', () => {
    expect(readTrackingReadConfig({})).toEqual({
      enabled: false,
      baseUrl: null,
      activationAllowed: false,
      reason: 'default_disabled',
    });
  });

  it.each(['TRUE', 'True', '1', 'yes', 'false']) (
    'requires the exact string true, got %s',
    (value) => {
      expect(
        readTrackingReadConfig({
          AI_ARMAN_TRACKING_READ_ENABLED: value,
          AI_ARMAN_TRACKING_READ_BASE_URL: 'https://tracking.example.test',
        }),
      ).toEqual({
        enabled: false,
        baseUrl: 'https://tracking.example.test',
        activationAllowed: false,
        reason: 'explicit_enable_required',
      });
    },
  );

  it.each([
    'http://tracking.example.test',
    'https://user:pass@tracking.example.test',
    'https://tracking.example.test/path',
    'https://tracking.example.test?x=1',
    'https://tracking.example.test#fragment',
    'not-a-url',
  ])('rejects unsafe tracking base URL %s', (baseUrl) => {
    expect(normalizeTrackingReadBaseUrl(baseUrl)).toBeNull();
  });

  it('blocks activation when enabled without a valid base URL', () => {
    expect(
      readTrackingReadConfig({
        AI_ARMAN_TRACKING_READ_ENABLED: 'true',
      }),
    ).toEqual({
      enabled: true,
      baseUrl: null,
      activationAllowed: false,
      reason: 'tracking_configuration_required',
    });
  });

  it('allows activation only for an explicit enable and HTTPS origin', () => {
    expect(
      readTrackingReadConfig({
        AI_ARMAN_TRACKING_READ_ENABLED: 'true',
        AI_ARMAN_TRACKING_READ_BASE_URL: 'https://tracking.example.test/',
      }),
    ).toEqual({
      enabled: true,
      baseUrl: 'https://tracking.example.test',
      activationAllowed: true,
      reason: 'tracking_read_allowed',
    });
  });
});

import {
  normalizeProductIntelligenceAudience,
  normalizeProductIntelligenceRequestBaseUrl,
} from './product-intelligence-url.policy';

describe('Product Intelligence URL policy', () => {
  it.each([
    ['https://service.example.test', 'https://service.example.test'],
    ['https://service.example.test/', 'https://service.example.test'],
    ['  https://service.example.test/  ', 'https://service.example.test'],
    ['https://candidate---service.example.test', 'https://candidate---service.example.test'],
  ])('normalizes safe request origins: %s', (input, expected) => {
    expect(normalizeProductIntelligenceRequestBaseUrl(input)).toBe(expected);
  });

  it.each([
    '',
    'not-a-url',
    'http://service.example.test',
    'https://user:pass@service.example.test',
    'https://service.example.test/path',
    'https://service.example.test/?query=1',
    'https://service.example.test/#fragment',
  ])('rejects unsafe request origins: %s', (input) => {
    expect(normalizeProductIntelligenceRequestBaseUrl(input)).toBeNull();
  });

  it('keeps request base and token audience independently normalized', () => {
    expect(
      normalizeProductIntelligenceRequestBaseUrl(
        'https://candidate---service.example.test/',
      ),
    ).toBe('https://candidate---service.example.test');
    expect(
      normalizeProductIntelligenceAudience('https://service.example.test/'),
    ).toBe('https://service.example.test');
  });
});

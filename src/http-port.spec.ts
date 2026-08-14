import { resolveHttpPort } from './http-port';

describe('resolveHttpPort', () => {
  it('uses port 3000 by default', () => {
    expect(resolveHttpPort({})).toBe(3000);
  });

  it('uses a valid Cloud Run PORT value', () => {
    expect(resolveHttpPort({ PORT: '8080' })).toBe(8080);
  });

  it.each(['0', '65536', '-1', 'abc', '8080.5', '  '])(
    'falls back to 3000 for invalid PORT %p',
    (PORT) => {
      expect(resolveHttpPort({ PORT })).toBe(3000);
    },
  );
});

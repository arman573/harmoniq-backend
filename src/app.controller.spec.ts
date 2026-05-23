import { AppController } from './app.controller';

describe('AppController', () => {
  it('returns the health greeting', () => {
    const controller = new AppController();

    expect(controller.getHello()).toBe('Hello World!');
  });
});

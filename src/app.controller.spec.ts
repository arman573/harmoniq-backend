import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(() => {
    appController = new AppController();
  });

  it('returns the default greeting', () => {
    expect(appController.getHello()).toBe('Hello World!');
  });
});

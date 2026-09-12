import { Test } from '@nestjs/testing';
import { AiArmanModule } from '../ai-arman.module';
import { ReturnsModuleReadClient } from './returns-module-read.client';
import { ReturnsModuleReadTools } from './returns-module-read.tools';

describe('Returns Module read wiring', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('boots the read client and tools without making a network call', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const moduleRef = await Test.createTestingModule({
      imports: [AiArmanModule],
    }).compile();

    expect(moduleRef.get(ReturnsModuleReadClient)).toBeInstanceOf(
      ReturnsModuleReadClient,
    );
    expect(moduleRef.get(ReturnsModuleReadTools)).toBeInstanceOf(
      ReturnsModuleReadTools,
    );
    expect(fetchSpy).not.toHaveBeenCalled();

    await moduleRef.close();
  });
});

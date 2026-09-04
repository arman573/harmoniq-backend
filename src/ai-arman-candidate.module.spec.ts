import { MODULE_METADATA } from '@nestjs/common/constants';
import { AiArmanModule } from './ai-arman/ai-arman.module';
import { AiArmanCandidateModule } from './ai-arman-candidate.module';


describe('AiArmanCandidateModule', () => {
  it('imports only the AI Arman module and excludes legacy application modules', () => {
    const imports = Reflect.getMetadata(
      MODULE_METADATA.IMPORTS,
      AiArmanCandidateModule,
    );

    expect(imports).toEqual([AiArmanModule]);
  });
});

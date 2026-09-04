import { NotFoundException } from '@nestjs/common';
import { AiArmanInternalPreviewDiagnosticsConfig } from './ai-arman-internal-preview-diagnostics.config';
import { AiArmanInternalPreviewPageController } from './ai-arman-internal-preview-page.controller';
import { AiArmanInternalPreviewPageService } from './ai-arman-internal-preview-page.service';

describe('AI Arman internal diagnostics preview page', () => {
  it('returns 404 unless diagnostics are explicitly enabled', () => {
    const config = { isEnabled: jest.fn(() => false) } as unknown as AiArmanInternalPreviewDiagnosticsConfig;
    const controller = new AiArmanInternalPreviewPageController(
      config,
      new AiArmanInternalPreviewPageService(),
    );

    expect(() => controller.getPage()).toThrow(NotFoundException);
  });

  it('renders only the safe diagnostics client when enabled', () => {
    const config = { isEnabled: jest.fn(() => true) } as unknown as AiArmanInternalPreviewDiagnosticsConfig;
    const controller = new AiArmanInternalPreviewPageController(
      config,
      new AiArmanInternalPreviewPageService(),
    );

    const html = controller.getPage();

    expect(html).toContain('AI Arman – intern testyta');
    expect(html).toContain('/ai-arman/internal-preview/diagnostics');
    expect(html).toContain("channel: 'internal_preview'");
    expect(html).toContain('AI intent');
    expect(html).toContain('Backend intent');
    expect(html).toContain('Backend route');
    expect(html).toContain('Authority');
    expect(html).toContain('Promotion');
    expect(html).toContain('Writes');
    expect(html).toContain('textContent');
    expect(html).not.toContain('.innerHTML');
    expect(html).not.toContain('systemPrompt');
    expect(html).not.toContain('promptVersion');
    expect(html).not.toContain('modelVersion');
    expect(html).not.toContain('rawModelText');
    expect(html).not.toContain('eval(');
    expect(html).not.toContain('document.write(');
  });
});

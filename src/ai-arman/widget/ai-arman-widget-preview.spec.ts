import { NotFoundException } from '@nestjs/common';
import { AiArmanWidgetPreviewConfig } from './ai-arman-widget-preview.config';
import { AiArmanWidgetPreviewController } from './ai-arman-widget-preview.controller';
import { AiArmanWidgetPreviewService } from './ai-arman-widget-preview.service';

describe('AI Arman Beta 0 widget preview', () => {
  it('is disabled unless explicitly enabled', () => {
    const config = new AiArmanWidgetPreviewConfig();
    expect(config.isEnabled({})).toBe(false);
    expect(config.isEnabled({ AI_ARMAN_WIDGET_PREVIEW_ENABLED: 'TRUE' })).toBe(false);
    expect(config.isEnabled({ AI_ARMAN_WIDGET_PREVIEW_ENABLED: 'true' })).toBe(true);
  });

  it('returns 404 while the preview flag is disabled', () => {
    const config = { isEnabled: jest.fn(() => false) } as unknown as AiArmanWidgetPreviewConfig;
    const preview = new AiArmanWidgetPreviewService();
    const controller = new AiArmanWidgetPreviewController(config, preview);

    expect(() => controller.getPreview()).toThrow(NotFoundException);
  });

  it('renders the Beta 0 shell only when explicitly enabled', () => {
    const config = { isEnabled: jest.fn(() => true) } as unknown as AiArmanWidgetPreviewConfig;
    const preview = new AiArmanWidgetPreviewService();
    const controller = new AiArmanWidgetPreviewController(config, preview);

    const html = controller.getPreview();

    expect(html).toContain('Fråga AI Arman');
    expect(html).toContain('/ai-arman/chat/messages');
    expect(html).toContain("channel: 'internal_preview'");
    expect(html).toContain("node.textContent = String(text || '')");
    expect(html).not.toContain('.innerHTML');
    expect(html).not.toContain('eval(');
    expect(html).not.toContain('document.write(');
  });

  it('only permits HTTPS outbound links in structured cards', () => {
    const html = new AiArmanWidgetPreviewService().render();
    expect(html).toContain('/^https:\\/\\//i.test(link.href)');
    expect(html).toContain("anchor.rel = 'noopener noreferrer'");
  });
});

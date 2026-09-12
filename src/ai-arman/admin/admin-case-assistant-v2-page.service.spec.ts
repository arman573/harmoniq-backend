import { AiArmanAdminCaseAssistantV2PageService } from './admin-case-assistant-v2-page.service';

describe('AiArmanAdminCaseAssistantV2PageService', () => {
  it('keeps analysis and discussion separate in a 410px safe drawer', () => {
    const html = new AiArmanAdminCaseAssistantV2PageService().render({ learningEnabled: true });
    expect(html).toContain('width:min(410px');
    expect(html).toContain('Förstå');
    expect(html).toContain('Lös');
    expect(html).toContain('Diskutera');
    expect(html).toContain("if(d.mode!=='analysis')");
    expect(html).toContain("if(d.mode!=='discussion')");
    expect(html).toContain('discussion:state.discussion.slice(-12)');
    expect(html).toContain('Godkänn och lär AI Arman');
    expect(html).not.toContain('.innerHTML');
    expect(html).not.toContain('document.write');
    expect(html).not.toContain('localStorage');
  });
});

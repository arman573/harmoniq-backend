import { AiArmanAdminCaseAssistantPageService } from './admin-case-assistant-page.service';

describe('AiArmanAdminCaseAssistantPageService', () => {
  it('renders a compact multi-turn drawer without unsafe model HTML rendering', () => {
    const html = new AiArmanAdminCaseAssistantPageService().render({ learningEnabled: true });
    expect(html).toContain('width:min(410px');
    expect(html).toContain('Förstå');
    expect(html).toContain('Lös');
    expect(html).toContain('Diskutera');
    expect(html).toContain('Godkänn och lär AI Arman');
    expect(html).toContain("$('summary').textContent = data.caseSummary;");
    expect(html).toContain('discussion:state.discussion.slice(-12)');
    expect(html).toContain("state.discussion.push({ role:'assistant', text:data.answerToAdmin });");
    expect(html).not.toContain('.innerHTML');
    expect(html).not.toContain('document.write');
    expect(html).not.toContain('localStorage');
  });

  it('does not activate learning when learning is disabled', () => {
    const html = new AiArmanAdminCaseAssistantPageService().render({ learningEnabled: false });
    expect(html).toContain('const learningEnabled = false;');
  });
});

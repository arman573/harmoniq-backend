import { AiArmanCustomerWidgetService } from './ai-arman-customer-widget.service';

describe('AiArmanCustomerWidgetService', () => {
  it('renders an identity-first widget with no chat request before a session token exists', () => {
    const script = new AiArmanCustomerWidgetService().renderScript();

    expect(script).toContain("'/identity/start'");
    expect(script).toContain("'/identity/verify'");
    expect(script).toContain("sessionStorage.getItem(sessionKey)");
    expect(script).toContain("sessionStorage.setItem(sessionKey, result.sessionToken)");
    expect(script).toContain("if (!token) return renderStart();");
    expect(script).toContain("'authorization': 'Bearer ' + token");
    expect(script).toContain("channel: 'web_widget'");
    expect(script).not.toContain('localStorage');
    expect(script).not.toContain('.innerHTML');
    expect(script).not.toContain('eval(');
    expect(script).not.toContain('customerId');
    expect(script).not.toContain('window.customer');
  });

  it('renders model responses only through textContent-based elements', () => {
    const script = new AiArmanCustomerWidgetService().renderScript();
    expect(script).toContain("node.textContent = String(text)");
    expect(script).not.toContain('document.write(');
  });
});

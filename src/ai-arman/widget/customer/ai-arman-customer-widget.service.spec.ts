import { AiArmanCustomerWidgetService } from './ai-arman-customer-widget.service';
import { AI_ARMAN_CUSTOMER_WIDGET_DEFAULT_PRESENTATION } from './ai-arman-customer-widget.presentation';

describe('AiArmanCustomerWidgetService', () => {
  it('renders the customer UI v1 contract with isolated responsive frontend structure', () => {
    const script = new AiArmanCustomerWidgetService().renderScript();

    expect(script).toContain('ai-arman-customer-ui-v1');
    expect(script).toContain("attachShadow({ mode: 'open' })");
    expect(script).toContain("role', 'dialog'");
    expect(script).toContain("aria-live', 'polite'");
    expect(script).toContain('prefers-reduced-motion');
    expect(script).toContain('safe-area-inset-bottom');
    expect(script).toContain('Hjälp mig hitta rätt produkt');
    expect(script).toContain('Jag behöver hjälp med min order');
    expect(script).toContain('Jag vill göra en retur');
  });

  it('keeps identity first and never sends chat before a verified session token exists', () => {
    const script = new AiArmanCustomerWidgetService().renderScript();

    expect(script).toContain("'/identity/start'");
    expect(script).toContain("'/identity/verify'");
    expect(script).toContain('sessionStorage.getItem(sessionKey)');
    expect(script).toContain('sessionStorage.setItem(sessionKey, result.sessionToken)');
    expect(script).toContain('if (!token) return renderStart();');
    expect(script).toContain("'authorization': 'Bearer ' + token");
    expect(script).toContain("channel: 'web_widget'");
    expect(script).not.toContain('localStorage');
    expect(script).not.toContain('.innerHTML');
    expect(script).not.toContain('eval(');
    expect(script).not.toContain('customerId');
    expect(script).not.toContain('window.customer');
  });

  it('renders customer and model text only through textContent-based elements', () => {
    const script = new AiArmanCustomerWidgetService().renderScript();

    expect(script).toContain('node.textContent = String(text)');
    expect(script).not.toContain('document.write(');
    expect(script).not.toContain('insertAdjacentHTML');
  });

  it('supports a bounded presentation contract for the next admin module without changing customer authority', () => {
    const custom = {
      ...AI_ARMAN_CUSTOMER_WIDGET_DEFAULT_PRESENTATION,
      launcherLabel: 'Testetikett',
      quickPrompts: ['Testfråga'],
    };

    const script = new AiArmanCustomerWidgetService().renderScript(custom);
    expect(script).toContain('Testetikett');
    expect(script).toContain('Testfråga');
    expect(script).toContain("const apiBase = String(sourceData.apiBase || '/ai-arman/customer')");
    expect(script).toContain("const avatarUrl = String(sourceData.avatarUrl || presentation.avatarUrl || '').trim()");
  });
});

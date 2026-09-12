import { AI_ARMAN_CUSTOMER_WIDGET_DEFAULT_PRESENTATION } from './ai-arman-customer-widget.presentation';
import {
  AiArmanCustomerWidgetPresentationStore,
  normalizeAiArmanCustomerWidgetPresentation,
} from './ai-arman-customer-widget-presentation.store';

function editablePresentation() {
  return JSON.parse(
    JSON.stringify(AI_ARMAN_CUSTOMER_WIDGET_DEFAULT_PRESENTATION),
  );
}

describe('AiArmanCustomerWidgetPresentationStore', () => {
  it('uses the canonical defaults when presentation storage is not configured', async () => {
    const store = new AiArmanCustomerWidgetPresentationStore();
    await expect(store.read({})).resolves.toEqual({
      configured: false,
      source: 'default',
      generation: '0',
      presentation: AI_ARMAN_CUSTOMER_WIDGET_DEFAULT_PRESENTATION,
    });
  });

  it('accepts presentation-only edits while preserving fixed action and category identities', () => {
    const input = editablePresentation();
    input.assistantSubtitle = 'Personlig hjälp från Harmoniq';
    input.actionCards[0].label = 'Hitta produkter';
    input.categories[0].label = 'Hårvård';

    const normalized = normalizeAiArmanCustomerWidgetPresentation(input);
    expect(normalized.assistantSubtitle).toBe('Personlig hjälp från Harmoniq');
    expect(normalized.actionCards.map((item) => item.id)).toEqual([
      'assortment',
      'order',
      'return',
      'ask',
    ]);
    expect(normalized.categories.map((item) => item.href)).toEqual([
      '/c/har/',
      '/c/hud/',
      '/c/doft/',
      '/c/makeup/',
      '/c/naglar/',
      '/c/man/',
    ]);
  });

  it('rejects authority expansion through a new action id', () => {
    const input = editablePresentation();
    input.actionCards[0].id = 'refund-now';
    expect(() => normalizeAiArmanCustomerWidgetPresentation(input)).toThrow(
      'customer_presentation_invalid',
    );
  });

  it('rejects arbitrary category destinations and unsafe support URLs', () => {
    const categoryInput = editablePresentation();
    categoryInput.categories[0].href = '/admin/cases';
    expect(() =>
      normalizeAiArmanCustomerWidgetPresentation(categoryInput),
    ).toThrow('customer_presentation_invalid');

    const supportInput = editablePresentation();
    supportInput.humanSupportUrl = 'javascript:alert(1)';
    expect(() =>
      normalizeAiArmanCustomerWidgetPresentation(supportInput),
    ).toThrow('customer_presentation_invalid');
  });
});

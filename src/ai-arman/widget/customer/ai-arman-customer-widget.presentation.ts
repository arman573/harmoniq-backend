import { AI_ARMAN_CUSTOMER_WIDGET_DEFAULT_AVATAR } from './ai-arman-customer-widget.avatar';

export type AiArmanCustomerWidgetActionId =
  | 'assortment'
  | 'order'
  | 'return'
  | 'ask';

export type AiArmanCustomerWidgetActionV1 = {
  id: AiArmanCustomerWidgetActionId;
  label: string;
  description: string;
  prompt?: string;
};

export type AiArmanCustomerWidgetCategoryV1 = {
  label: string;
  href: string;
  mark: string;
};

export type AiArmanCustomerWidgetPresentationV1 = {
  contractVersion: 'ai-arman-customer-ui-v1';
  assistantName: string;
  assistantSubtitle: string;
  statusIdle: string;
  statusVerified: string;
  launcherLabel: string;
  welcomeTitle: string;
  welcomeText: string;
  categoryTitle: string;
  categoryText: string;
  identityTitle: string;
  identityText: string;
  verifiedWelcome: string;
  composerPlaceholder: string;
  privacyText: string;
  humanSupportLabel: string;
  humanSupportUrl: string;
  actionCards: readonly AiArmanCustomerWidgetActionV1[];
  categories: readonly AiArmanCustomerWidgetCategoryV1[];
  quickPrompts: readonly string[];
  avatarUrl?: string;
};

export const AI_ARMAN_CUSTOMER_WIDGET_DEFAULT_PRESENTATION: AiArmanCustomerWidgetPresentationV1 =
  Object.freeze({
    contractVersion: 'ai-arman-customer-ui-v1',
    assistantName: 'AI Arman',
    assistantSubtitle: 'Din personliga skönhetsassistent',
    statusIdle: 'Säker kundchatt',
    statusVerified: 'Verifierad kundchatt',
    launcherLabel: 'Fråga AI Arman',
    welcomeTitle: 'Hej! Jag hjälper dig med produkter, order och returer.',
    welcomeText:
      'Fråga om hela Harmoniqs sortiment eller få hjälp före och efter ditt köp.',
    categoryTitle: 'Utforska sortimentet',
    categoryText: 'Hoppa direkt till våra huvudkategorier.',
    identityTitle: 'Verifiera din e-post för att fortsätta',
    identityText:
      'För att skydda dina kunduppgifter skickar vi en engångskod till din e-postadress.',
    verifiedWelcome:
      'Klart – du är verifierad. Vad vill du ha hjälp med idag?',
    composerPlaceholder: 'Skriv din fråga…',
    privacyText:
      'Säker kundchatt. AI Arman använder verifierade uppgifter för ditt köp och visar aldrig interna adminnoteringar.',
    humanSupportLabel: 'Prata med människa',
    humanSupportUrl: '/i/kundservice.html',
    actionCards: Object.freeze([
      Object.freeze({
        id: 'assortment',
        label: 'Sortiment',
        description: 'Utforska Hår, Hud, Doft, Makeup, Naglar och Man.',
      }),
      Object.freeze({
        id: 'order',
        label: 'Orderstatus',
        description: 'Få hjälp med din order och leverans.',
        prompt: 'Jag behöver hjälp med min order',
      }),
      Object.freeze({
        id: 'return',
        label: 'Returhjälp',
        description: 'Retur, byte, reklamation och återbetalning.',
        prompt: 'Jag vill göra en retur',
      }),
      Object.freeze({
        id: 'ask',
        label: 'Fråga Arman',
        description: 'Få hjälp att hitta rätt inom hela sortimentet.',
        prompt: 'Hjälp mig hitta rätt produkt',
      }),
    ]),
    categories: Object.freeze([
      Object.freeze({ label: 'Hår', href: '/c/har/', mark: 'HÅR' }),
      Object.freeze({ label: 'Hud', href: '/c/hud/', mark: 'HUD' }),
      Object.freeze({ label: 'Doft', href: '/c/doft/', mark: 'DOFT' }),
      Object.freeze({ label: 'Makeup', href: '/c/makeup/', mark: 'MAKEUP' }),
      Object.freeze({ label: 'Naglar', href: '/c/naglar/', mark: 'NAGLAR' }),
      Object.freeze({ label: 'Man', href: '/c/man/', mark: 'MAN' }),
    ]),
    quickPrompts: Object.freeze([
      'Hjälp mig hitta rätt produkt',
      'Jag behöver hjälp med min order',
      'Jag vill göra en retur',
      'Jag har en fråga om doft eller makeup',
      'Jag har en fråga om hud eller hår',
      'Jag letar efter produkter för män',
    ]),
    avatarUrl: AI_ARMAN_CUSTOMER_WIDGET_DEFAULT_AVATAR,
  });

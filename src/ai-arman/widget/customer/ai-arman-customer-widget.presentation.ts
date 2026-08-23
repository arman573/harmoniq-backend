export type AiArmanCustomerWidgetPresentationV1 = {
  contractVersion: 'ai-arman-customer-ui-v1';
  assistantName: string;
  assistantSubtitle: string;
  launcherLabel: string;
  welcomeTitle: string;
  welcomeText: string;
  identityTitle: string;
  identityText: string;
  verifiedWelcome: string;
  composerPlaceholder: string;
  privacyText: string;
  quickPrompts: readonly string[];
  avatarUrl?: string;
};

export const AI_ARMAN_CUSTOMER_WIDGET_DEFAULT_PRESENTATION: AiArmanCustomerWidgetPresentationV1 =
  Object.freeze({
    contractVersion: 'ai-arman-customer-ui-v1',
    assistantName: 'AI Arman',
    assistantSubtitle: 'Din personliga skönhetsrådgivare',
    launcherLabel: 'Fråga AI Arman',
    welcomeTitle: 'Hej! Jag är AI Arman',
    welcomeText:
      'Jag hjälper dig med produkter, hår, hud, din order, returer och reklamationer.',
    identityTitle: 'Verifiera din e-post för att börja',
    identityText:
      'För att skydda dina kunduppgifter skickar vi en engångskod till din e-postadress.',
    verifiedWelcome:
      'Klart – du är verifierad. Vad vill du ha hjälp med idag?',
    composerPlaceholder: 'Skriv din fråga…',
    privacyText:
      'AI Arman använder verifierade uppgifter när det gäller ditt köp och visar aldrig interna adminnoteringar.',
    quickPrompts: Object.freeze([
      'Hjälp mig hitta rätt produkt',
      'Jag behöver hjälp med min order',
      'Jag vill göra en retur',
      'Jag har en hud- eller hårfråga',
    ]),
  });

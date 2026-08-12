import { ChatConversationResultStore } from './chat-conversation-result.store';
import { ChatConversationStateStore } from './chat-conversation-state.store';
import { ChatConversationService } from './chat-conversation.service';
import { ChatInterpretationValidator } from './chat-interpretation.validator';
import { ChatMessagesService } from './chat-messages.service';
import { AI_ARMAN_CHAT_CONTRACT_VERSION } from './chat-messages.types';

describe('AI Arman skincare routine context v1', () => {
  function createConversationService() {
    return new ChatConversationService(
      new ChatMessagesService(),
      new ChatConversationStateStore(),
      new ChatConversationResultStore(),
    );
  }

  it('captures an existing evening retinoid without changing skincare tool safety', () => {
    const service = new ChatMessagesService();
    const result = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'skincare-routine-direct-1',
      message: {
        text: 'Jag söker ett serum för torr hud och använder retinol på kvällen.',
      },
    });

    expect(result.interpretation.primaryIntent).toBe('product_recommendation');
    expect(result.interpretation.entities.recommendationDomain).toBe('skincare');
    expect(result.interpretation.entities.requestedProductTypes).toEqual(['serum']);
    expect(result.interpretation.entities.needs).toContain('dry_skin');
    expect(result.interpretation.entities.skincareRoutineActives).toEqual([
      { active: 'retinoid', timing: 'evening' },
    ]);
    expect(result.interpretation.missingFields).toEqual([]);
    expect(result.decision.plannedTools).toEqual([]);
    expect(result.decision.reasons).toContain(
      'specialist_domain_not_enabled_for_tools',
    );
  });

  it('preserves skincare context when the customer adds retinol in a later turn', () => {
    const service = createConversationService();
    const first = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'skincare-routine-multi-1',
      message: { text: 'Jag söker ett serum för torr hud.' },
    });

    const second = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      conversationId: first.conversationId,
      clientMessageId: 'skincare-routine-multi-2',
      message: { text: 'Jag använder retinol på kvällen.' },
    });

    expect(second.interpretation.primaryIntent).toBe('product_recommendation');
    expect(second.state.remembered.recommendationDomain).toBe('skincare');
    expect(second.state.remembered.requestedProductTypes).toEqual(['serum']);
    expect(second.state.remembered.needs).toContain('dry_skin');
    expect(second.state.remembered.skincareRoutineActives).toEqual([
      { active: 'retinoid', timing: 'evening' },
    ]);
    expect(second.decision.plannedTools).toEqual([]);
    expect(second.decision.reasons).toContain(
      'specialist_domain_not_enabled_for_tools',
    );
  });

  it.each([
    ['AHA på kvällen', 'aha', 'evening'],
    ['BHA på morgonen', 'bha', 'morning'],
    ['PHA', 'pha', 'unspecified'],
    ['vitamin C på morgonen', 'vitamin_c', 'morning'],
    ['niacinamid på kvällen', 'niacinamide', 'evening'],
    ['azelainsyra', 'azelaic_acid', 'unspecified'],
    ['bensoylperoxid på kvällen', 'benzoyl_peroxide', 'evening'],
  ])('normalizes skincare active %s', (activeText, active, timing) => {
    const service = new ChatMessagesService();
    const result = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: `skincare-active-${active}`,
      message: {
        text: `Jag söker ansiktskräm för känslig hud och använder ${activeText}.`,
      },
    });

    expect(result.interpretation.entities.skincareRoutineActives).toContainEqual({
      active,
      timing,
    });
    expect(result.decision.plannedTools).toEqual([]);
  });

  it('accepts the multi-domain skincare context in the passive model schema', () => {
    const validator = new ChatInterpretationValidator();
    const candidate = {
      schemaVersion: 'ai-arman-interpretation-v1',
      source: 'model_candidate',
      locale: 'sv-SE',
      primaryIntent: 'product_recommendation',
      secondaryIntents: [],
      confidence: 0.9,
      entities: {
        requestedProductTypes: ['serum'],
        needs: ['dry_skin'],
        exclusions: [],
        orderReference: null,
        productReferences: [],
        recommendationDomain: 'skincare',
        skincareRoutineActives: [
          { active: 'retinoid', timing: 'evening' },
        ],
      },
      missingFields: [],
      requiresIdentity: false,
      requiresHumanReview: false,
    };

    expect(validator.parse(candidate)).toEqual(candidate);
  });

  it('rejects unsupported skincare actives in the passive model schema', () => {
    const validator = new ChatInterpretationValidator();
    const candidate = {
      schemaVersion: 'ai-arman-interpretation-v1',
      source: 'model_candidate',
      locale: 'sv-SE',
      primaryIntent: 'product_recommendation',
      secondaryIntents: [],
      confidence: 0.9,
      entities: {
        requestedProductTypes: ['serum'],
        needs: ['dry_skin'],
        exclusions: [],
        orderReference: null,
        productReferences: [],
        recommendationDomain: 'skincare',
        skincareRoutineActives: [
          { active: 'unknown_active', timing: 'evening' },
        ],
      },
      missingFields: [],
      requiresIdentity: false,
      requiresHumanReview: false,
    };

    expect(() => validator.parse(candidate)).toThrow(
      'interpretation_invalid:entities.skincareRoutineActives.0.active',
    );
  });
});

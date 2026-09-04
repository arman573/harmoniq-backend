import { ChatConversationStateStore } from './chat-conversation-state.store';
import { ChatMessagesService } from './chat-messages.service';
import { AI_ARMAN_CHAT_CONTRACT_VERSION } from './chat-messages.types';

describe('ChatConversationStateStore', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function createState(clientMessageId: string) {
    return new ChatMessagesService().handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId,
      message: { text: 'Jag söker schampo för tunt hår.' },
    }).state;
  }

  it('expires state after the foundation TTL', () => {
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValue(1_000);

    const store = new ChatConversationStateStore();
    const state = createState('state-ttl');
    store.save(state);

    now.mockReturnValue(1_000 + 30 * 60 * 1000 - 1);
    expect(store.get(state.conversationId)).toEqual(state);

    now.mockReturnValue(1_000 + 30 * 60 * 1000);
    expect(store.get(state.conversationId)).toBeNull();
  });

  it('evicts the least recently used state above the max size', () => {
    const store = new ChatConversationStateStore();
    const states = Array.from({ length: 1001 }, (_, index) =>
      createState(`state-${index}`),
    );

    for (const state of states.slice(0, 1000)) {
      store.save(state);
    }

    expect(store.get(states[0].conversationId)).toEqual(states[0]);
    store.save(states[1000]);

    expect(store.get(states[1].conversationId)).toBeNull();
    expect(store.get(states[0].conversationId)).toEqual(states[0]);
    expect(store.get(states[1000].conversationId)).toEqual(states[1000]);
  });

  it('returns defensive clones', () => {
    const store = new ChatConversationStateStore();
    const state = createState('state-clone');
    store.save(state);

    const first = store.get(state.conversationId);
    if (!first) throw new Error('state_missing');
    first.remembered.needs.push('mutated');

    const second = store.get(state.conversationId);
    expect(second?.remembered.needs).not.toContain('mutated');
  });
});

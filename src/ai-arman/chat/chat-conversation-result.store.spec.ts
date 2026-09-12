import { ChatConversationResultStore } from './chat-conversation-result.store';
import { ChatMessagesService } from './chat-messages.service';
import { AI_ARMAN_CHAT_CONTRACT_VERSION } from './chat-messages.types';

describe('ChatConversationResultStore', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function createResponse(clientMessageId: string) {
    return new ChatMessagesService().handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId,
      message: { text: 'Jag söker balsam för torrt hår.' },
    });
  }

  it('expires idempotency results after the foundation TTL', () => {
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValue(5_000);

    const store = new ChatConversationResultStore();
    const response = createResponse('result-ttl');
    store.save('key', 'fingerprint', response);

    now.mockReturnValue(5_000 + 30 * 60 * 1000 - 1);
    expect(store.get('key')?.response).toEqual(response);

    now.mockReturnValue(5_000 + 30 * 60 * 1000);
    expect(store.get('key')).toBeNull();
  });

  it('evicts the least recently used result above the max size', () => {
    const store = new ChatConversationResultStore();
    const responses = Array.from({ length: 2001 }, (_, index) =>
      createResponse(`result-${index}`),
    );

    for (let index = 0; index < 2000; index += 1) {
      store.save(`key-${index}`, `fingerprint-${index}`, responses[index]);
    }

    expect(store.get('key-0')?.response).toEqual(responses[0]);
    store.save('key-2000', 'fingerprint-2000', responses[2000]);

    expect(store.get('key-1')).toBeNull();
    expect(store.get('key-0')?.response).toEqual(responses[0]);
    expect(store.get('key-2000')?.response).toEqual(responses[2000]);
  });

  it('returns defensive clones', () => {
    const store = new ChatConversationResultStore();
    const response = createResponse('result-clone');
    store.save('clone-key', 'clone-fingerprint', response);

    const first = store.get('clone-key');
    if (!first) throw new Error('result_missing');
    first.response.blocks.push({ type: 'message', text: 'mutated' });

    const second = store.get('clone-key');
    expect(second?.response.blocks).not.toContainEqual({
      type: 'message',
      text: 'mutated',
    });
  });
});

import { AiArmanAdminReplyDraftRetryingService } from './admin-reply-draft-retrying.service';
import { AiArmanAdminReplyDraftService } from './admin-reply-draft.service';

const INPUT = {
  caseId: 'HQR-12345',
  caseType: 'support',
  status: 'active',
  messages: [],
};

describe('AiArmanAdminReplyDraftRetryingService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('retries once after a retryable provider failure and returns recovery', async () => {
    const base = jest
      .spyOn(AiArmanAdminReplyDraftService.prototype, 'createDraft')
      .mockResolvedValueOnce({
        ok: false,
        code: 'admin_reply_model_timeout',
      })
      .mockResolvedValueOnce({
        ok: true,
        draftText: 'Hej! Vi återkommer i ditt ärende.',
        requiresHumanDecision: false,
        decisionReasons: [],
        confidence: 0.9,
        sendsCustomerMessage: false,
        executesWrites: false,
      });

    const service = new AiArmanAdminReplyDraftRetryingService({} as never);
    const result = await service.createDraft(INPUT);

    expect(base).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ ok: true, draftText: expect.any(String) });
  });

  it('does not retry deterministic invalid output', async () => {
    const base = jest
      .spyOn(AiArmanAdminReplyDraftService.prototype, 'createDraft')
      .mockResolvedValue({
        ok: false,
        code: 'admin_reply_model_invalid',
      });

    const service = new AiArmanAdminReplyDraftRetryingService({} as never);
    const result = await service.createDraft(INPUT);

    expect(base).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: false, code: 'admin_reply_model_invalid' });
  });

  it('does not retry a successful first draft', async () => {
    const base = jest
      .spyOn(AiArmanAdminReplyDraftService.prototype, 'createDraft')
      .mockResolvedValue({
        ok: true,
        draftText: 'Hej!',
        requiresHumanDecision: false,
        decisionReasons: [],
        confidence: 0.95,
        sendsCustomerMessage: false,
        executesWrites: false,
      });

    const service = new AiArmanAdminReplyDraftRetryingService({} as never);
    const result = await service.createDraft(INPUT);

    expect(base).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ ok: true, draftText: 'Hej!' });
  });
});

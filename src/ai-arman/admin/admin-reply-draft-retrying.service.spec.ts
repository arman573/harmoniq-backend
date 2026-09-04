import { AiArmanAdminReplyDraftRetryingService } from './admin-reply-draft-retrying.service';
import { AiArmanAdminReplyDraftService } from './admin-reply-draft.service';

const INPUT = {
  caseId: 'HQR-12345',
  caseType: 'support',
  status: 'active',
  messages: [],
};

describe('AiArmanAdminReplyDraftRetryingService', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not retry a model timeout so the synchronous request stays within its outer budget', async () => {
    const base = jest
      .spyOn(AiArmanAdminReplyDraftService.prototype, 'createDraft')
      .mockResolvedValue({
        ok: false,
        code: 'admin_reply_model_timeout',
      });

    const service = new AiArmanAdminReplyDraftRetryingService({} as never);
    const result = await service.createDraft(INPUT);

    expect(base).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: false, code: 'admin_reply_model_timeout' });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(warn.mock.calls[0][0]))).toMatchObject({
      event: 'ai_arman_admin_reply_draft_failed',
      code: 'admin_reply_model_timeout',
      attempt: 1,
      durationMs: expect.any(Number),
    });
  });

  it('retries incomplete structured output once and returns recovery', async () => {
    const base = jest
      .spyOn(AiArmanAdminReplyDraftService.prototype, 'createDraft')
      .mockResolvedValueOnce({
        ok: false,
        code: 'admin_reply_model_incomplete',
      })
      .mockResolvedValueOnce({
        ok: true,
        draftText: 'Vi hjälper dig vidare med ärendet.',
        requiresHumanDecision: false,
        decisionReasons: [],
        confidence: 0.9,
        sendsCustomerMessage: false,
        executesWrites: false,
      });

    const service = new AiArmanAdminReplyDraftRetryingService({} as never);
    const result = await service.createDraft(INPUT);

    expect(base).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      ok: true,
      sendsCustomerMessage: false,
      executesWrites: false,
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(warn.mock.calls[0][0]))).toMatchObject({
      event: 'ai_arman_admin_reply_draft_failed',
      code: 'admin_reply_model_incomplete',
      attempt: 1,
    });
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
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('does not retry a completed response missing output text', async () => {
    const base = jest
      .spyOn(AiArmanAdminReplyDraftService.prototype, 'createDraft')
      .mockResolvedValue({
        ok: false,
        code: 'admin_reply_model_missing_output',
      });

    const service = new AiArmanAdminReplyDraftRetryingService({} as never);
    const result = await service.createDraft(INPUT);

    expect(base).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: false, code: 'admin_reply_model_missing_output' });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(warn.mock.calls[0][0]))).toMatchObject({
      event: 'ai_arman_admin_reply_draft_failed',
      code: 'admin_reply_model_missing_output',
      attempt: 1,
    });
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
    expect(warn).not.toHaveBeenCalled();
  });

  it('logs only allowlisted failure provenance and never request content', async () => {
    const base = jest
      .spyOn(AiArmanAdminReplyDraftService.prototype, 'createDraft')
      .mockResolvedValueOnce({
        ok: false,
        code: 'admin_reply_model_http_error',
        providerHttpStatus: 429,
      })
      .mockResolvedValueOnce({
        ok: false,
        code: 'admin_reply_model_request_failed',
      });

    const sensitiveInput = {
      caseId: 'HQR-SENSITIVE-CASE-ID',
      caseType: 'support',
      status: 'active',
      customerName: 'SENSITIVE-CUSTOMER-NAME',
      messages: [
        {
          direction: 'inbound',
          sender: 'Kund',
          text: 'SENSITIVE-CUSTOMER-MESSAGE',
        },
      ],
    };

    const service = new AiArmanAdminReplyDraftRetryingService({} as never);
    const result = await service.createDraft(sensitiveInput);

    expect(base).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      ok: false,
      code: 'admin_reply_model_request_failed',
    });
    expect(warn).toHaveBeenCalledTimes(2);

    const logs = warn.mock.calls.map(([payload]) => JSON.parse(String(payload)));
    expect(logs[0]).toMatchObject({
      event: 'ai_arman_admin_reply_draft_failed',
      code: 'admin_reply_model_http_error',
      attempt: 1,
      durationMs: expect.any(Number),
      providerHttpStatus: 429,
    });
    expect(logs[1]).toMatchObject({
      event: 'ai_arman_admin_reply_draft_failed',
      code: 'admin_reply_model_request_failed',
      attempt: 2,
      durationMs: expect.any(Number),
    });
    expect(Object.keys(logs[0]).sort()).toEqual(
      ['attempt', 'code', 'durationMs', 'event', 'providerHttpStatus'].sort(),
    );
    expect(Object.keys(logs[1]).sort()).toEqual(
      ['attempt', 'code', 'durationMs', 'event'].sort(),
    );

    const serialized = JSON.stringify(logs);
    expect(serialized).not.toContain('HQR-SENSITIVE-CASE-ID');
    expect(serialized).not.toContain('SENSITIVE-CUSTOMER-NAME');
    expect(serialized).not.toContain('SENSITIVE-CUSTOMER-MESSAGE');
  });
});

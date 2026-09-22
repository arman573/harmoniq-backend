import { Injectable } from '@nestjs/common';
import { classifyMail } from './mail-agent.classifier';
import { MailAgentDecision, MailEnvelope } from './mail-agent.types';

@Injectable()
export class MailAgentService {
  triage(message: MailEnvelope): MailAgentDecision {
    return {
      message: sanitizeEnvelope(message),
      triage: classifyMail(message),
    };
  }
}

function sanitizeEnvelope(message: MailEnvelope): MailEnvelope {
  return {
    ...message,
    from: String(message.from || '').trim(),
    to: (message.to || []).map((value) => String(value).trim()).filter(Boolean),
    cc: (message.cc || []).map((value) => String(value).trim()).filter(Boolean),
    subject: String(message.subject || '').trim(),
    body: String(message.body || ''),
    labels: (message.labels || []).map((value) => String(value).trim()).filter(Boolean),
  };
}

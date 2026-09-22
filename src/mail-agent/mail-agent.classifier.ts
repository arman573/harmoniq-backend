import {
  MailAgentCategory,
  MailAgentNextAction,
  MailAgentPriority,
  MailAgentSpecialist,
  MailEnvelope,
  MailTriageResult,
} from './mail-agent.types';

type Rule = {
  category: MailAgentCategory;
  priority: MailAgentPriority;
  nextAction: MailAgentNextAction;
  specialist: MailAgentSpecialist;
  patterns: RegExp[];
  reason: string;
  score: number;
};

const RULES: Rule[] = [
  {
    category: 'returns_claims',
    priority: 'high',
    nextAction: 'route_returns',
    specialist: 'returns-module',
    patterns: [
      /\bretur\b/i,
      /\breklamation\b/i,
      /\bclaim\b/i,
      /\bskadad\b/i,
      /\bfel vara\b/i,
      /\bwrong item\b/i,
      /\brefund\b/i,
      /\båterbetal/i,
    ],
    reason: 'Retur/reklamationssignal hittades.',
    score: 0.93,
  },
  {
    category: 'invoice_finance',
    priority: 'high',
    nextAction: 'route_finance',
    specialist: 'finance',
    patterns: [
      /\bfaktura\b/i,
      /\binvoice\b/i,
      /\binkasso\b/i,
      /\bpayment\b/i,
      /\bbetalning\b/i,
      /\bförfaller\b/i,
      /\boverdue\b/i,
      /\bnetto\b/i,
    ],
    reason: 'Ekonomi-, betalnings- eller fakturasignal hittades.',
    score: 0.9,
  },
  {
    category: 'compliance_legal',
    priority: 'high',
    nextAction: 'review',
    specialist: 'general',
    patterns: [
      /\bucpd\b/i,
      /\blegal\b/i,
      /\bcompliance\b/i,
      /\bavtal\b/i,
      /\bjurid/i,
      /\bpolicy violation\b/i,
      /\bsäkerhetsbegäran\b/i,
    ],
    reason: 'Compliance-, juridik- eller säkerhetssignal hittades.',
    score: 0.92,
  },
  {
    category: 'marketing_ads',
    priority: 'high',
    nextAction: 'route_marketing',
    specialist: 'marketing',
    patterns: [
      /\bgoogle ads\b/i,
      /\btiktok ads?\b/i,
      /\bmerchant center\b/i,
      /\bmeta ads?\b/i,
      /\bads-konto\b/i,
      /\bad(s)? (may )?not be delivering\b/i,
      /\bannons/i,
    ],
    reason: 'Annonserings- eller plattformssignal hittades.',
    score: 0.88,
  },
  {
    category: 'system_alert',
    priority: 'normal',
    nextAction: 'review',
    specialist: 'general',
    patterns: [
      /\blarm\b/i,
      /\bfailure(s)?\b/i,
      /\bfailed\b/i,
      /\berror\b/i,
      /\bgränsvärde\b/i,
      /\bsecurity alert\b/i,
    ],
    reason: 'System- eller driftsignal hittades.',
    score: 0.82,
  },
  {
    category: 'calendar_training',
    priority: 'normal',
    nextAction: 'review',
    specialist: 'general',
    patterns: [
      /\bbokning\b/i,
      /\butbildning\b/i,
      /\bwebbinarium\b/i,
      /\bwebinar\b/i,
      /\bteams meeting\b/i,
      /\bmötes-id\b/i,
      /\bmeeting id\b/i,
    ],
    reason: 'Boknings-, mötes- eller utbildningssignal hittades.',
    score: 0.8,
  },
  {
    category: 'order_purchase',
    priority: 'normal',
    nextAction: 'route_supplier_ops',
    specialist: 'supplier-ops',
    patterns: [
      /\border\s+[a-z0-9-]+\b/i,
      /\bpurchase order\b/i,
      /\bshipment\b/i,
      /\bleverans\b/i,
      /\brestorder\b/i,
      /\bbackorder\b/i,
    ],
    reason: 'Order-, inköps- eller leveranssignal hittades.',
    score: 0.79,
  },
  {
    category: 'supplier',
    priority: 'normal',
    nextAction: 'draft_reply',
    specialist: 'supplier-ops',
    patterns: [
      /\bsamarbete\b/i,
      /\bpartner\b/i,
      /\bprislista\b/i,
      /\blansering\b/i,
      /\blaunch\b/i,
      /\bkey account\b/i,
      /\båterförsälj/i,
    ],
    reason: 'Leverantörs- eller partnerskapssignal hittades.',
    score: 0.75,
  },
  {
    category: 'newsletter_promo',
    priority: 'low',
    nextAction: 'archive_candidate',
    specialist: 'none',
    patterns: [
      /\bunsubscribe\b/i,
      /\bnyhetsbrev\b/i,
      /\berbjudande\b/i,
      /\brabatt\b/i,
      /\bweekly snapshot\b/i,
      /\bmarketing email\b/i,
    ],
    reason: 'Nyhetsbrevs- eller kampanjsignal hittades.',
    score: 0.72,
  },
  {
    category: 'personal',
    priority: 'low',
    nextAction: 'archive_candidate',
    specialist: 'none',
    patterns: [
      /\bhittat!\b/i,
      /\btesla model\b/i,
      /\bporsche\b/i,
      /\bbmw\b/i,
      /\baudi\b/i,
    ],
    reason: 'Personlig bevakningssignal hittades.',
    score: 0.7,
  },
];

const CUSTOMER_SERVICE_PATTERNS = [
  /\bmin order\b/i,
  /\bmy order\b/i,
  /\bvar är min order\b/i,
  /\bkundservice\b/i,
  /\bkundtjänst\b/i,
  /\bkan ni hjälpa\b/i,
  /\bwhere is my order\b/i,
];

const PROMPT_INJECTION_PATTERNS = [
  /ignore (all|any|the) previous instructions/i,
  /ignore (all|any|the) prior instructions/i,
  /system prompt/i,
  /developer message/i,
  /reveal.*prompt/i,
  /do not follow.*instructions/i,
];

export function classifyMail(message: MailEnvelope): MailTriageResult {
  const text = normalizeMessage(message);
  const riskFlags = detectRiskFlags(text);
  const match = RULES.find((rule) => rule.patterns.some((pattern) => pattern.test(text)));

  if (match) {
    return {
      category: match.category,
      priority: escalatePriority(match.priority, text),
      confidence: match.score,
      nextAction: match.nextAction,
      specialist: match.specialist,
      requiresHumanApproval: true,
      automationAllowed: false,
      reasons: [match.reason],
      riskFlags,
    };
  }

  if (CUSTOMER_SERVICE_PATTERNS.some((pattern) => pattern.test(text))) {
    return {
      category: 'customer_service',
      priority: 'normal',
      confidence: 0.74,
      nextAction: 'draft_reply',
      specialist: 'general',
      requiresHumanApproval: true,
      automationAllowed: false,
      reasons: ['Kundservicefråga identifierades utan tydlig specialistkategori.'],
      riskFlags,
    };
  }

  return {
    category: 'unknown',
    priority: 'normal',
    confidence: 0.35,
    nextAction: 'review',
    specialist: 'general',
    requiresHumanApproval: true,
    automationAllowed: false,
    reasons: ['Ingen säker regel matchade. Ärendet ska granskas av människa.'],
    riskFlags,
  };
}

function normalizeMessage(message: MailEnvelope): string {
  return [
    message.from,
    ...(message.to || []),
    ...(message.cc || []),
    message.subject || '',
    message.body || '',
  ]
    .join('\n')
    .replace(/\s+/g, ' ')
    .trim();
}

function escalatePriority(priority: MailAgentPriority, text: string): MailAgentPriority {
  if (
    /\binkasso\b/i.test(text)
    || /\baccount suspension\b/i.test(text)
    || /\bstängas av\b/i.test(text)
    || /\bsecurity request\b/i.test(text)
    || /\bsäkerhetsbegäran\b/i.test(text)
  ) {
    return 'critical';
  }

  if (
    /\bförfaller snart\b/i.test(text)
    || /\baction required\b/i.test(text)
    || /\båtgärd krävs\b/i.test(text)
    || /\bnot delivering\b/i.test(text)
  ) {
    return 'high';
  }

  return priority;
}

function detectRiskFlags(text: string): string[] {
  const flags = ['email_body_untrusted'];

  if (PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(text))) {
    flags.push('possible_prompt_injection');
  }

  if (/\bpassword\b|\blösenord\b|\bverification code\b|\bengångskod\b/i.test(text)) {
    flags.push('possible_secret_or_credential');
  }

  return flags;
}

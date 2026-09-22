export const MAIL_AGENT_MAILBOXES = [
  {
    address: 'arman@harmoniq.se',
    role: 'executive',
    purpose: 'Bred affärsinkorg: leverantörer, partners, viktiga systemmail, avtal, order- och marknadsfrågor.',
    watch: true,
  },
  {
    address: 'inkop@harmoniq.se',
    role: 'purchasing',
    purpose: 'Inköp: leverantörer, orderbekräftelser, leveranser, restorder, prislistor och inköpsrelaterade avvikelser.',
    watch: true,
  },
  {
    address: 'ekonomi@harmoniq.se',
    role: 'finance',
    purpose: 'Ekonomi: fakturor, krediteringar, betalningar, påminnelser, inkasso och ekonomiska avvikelser.',
    watch: true,
  },
] as const;

export const MAIL_AGENT_FINANCE_KEYWORDS = [
  'faktura',
  'invoice',
  'kreditfaktura',
  'credit note',
  'betalning',
  'payment',
  'förfaller',
  'due date',
  'påminnelse',
  'reminder',
  'inkasso',
  'collection',
  'kontoavstämning',
  'statement',
];

export const MAIL_AGENT_IMPORTANT_KEYWORDS = [
  'åtgärd krävs',
  'action required',
  'urgent',
  'viktigt',
  'important',
  'suspension',
  'stängs av',
  'security',
  'säkerhet',
  'compliance',
  'avtal',
  'contract',
];

export function getConfiguredMailboxes() {
  return MAIL_AGENT_MAILBOXES.filter((mailbox) => mailbox.watch);
}

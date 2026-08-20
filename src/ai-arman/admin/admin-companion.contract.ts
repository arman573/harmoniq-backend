export const AI_ARMAN_ADMIN_COMPANION_CONTRACT_VERSION =
  'ai-arman-admin-companion-v1' as const;

export type AiArmanAdminCompanionDiscussionTurn = {
  role: 'admin' | 'assistant';
  text: string;
};

export type AiArmanAdminCompanionRequest = {
  contractVersion?: typeof AI_ARMAN_ADMIN_COMPANION_CONTRACT_VERSION;
  caseId: string;
  caseType: string;
  status?: string;
  customerName?: string;
  messages?: Array<{
    direction?: string;
    sender?: string;
    subject?: string;
    text?: string;
    date?: string;
  }>;
  adminQuestion?: string;
  discussion?: AiArmanAdminCompanionDiscussionTurn[];
};

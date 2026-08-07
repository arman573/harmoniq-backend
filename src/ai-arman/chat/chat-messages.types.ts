export const AI_ARMAN_CHAT_CONTRACT_VERSION = 'ai-arman-chat-v1' as const;
export const AI_ARMAN_CONVERSATION_STATE_VERSION =
  'ai-arman-conversation-state-v1' as const;

export type AiArmanChatChannel = 'web_widget' | 'internal_preview';

export type AiArmanChatRequest = {
  contractVersion: typeof AI_ARMAN_CHAT_CONTRACT_VERSION
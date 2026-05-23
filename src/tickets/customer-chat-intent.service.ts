import { Injectable } from '@nestjs/common';
import {
  CustomerChatIntent,
  CustomerChatIntentType,
} from './customer-chat.types';

type IntentRule = {
  type: CustomerChatIntentType;
  confidence: number;
  signals: string[];
  keywords: string[];
};

const SUPPORT_KEYWORDS = [
  'order',
  'delivery',
  'return',
  'refund',
  'invoice',
  'payment',
  'shipping',
  'bestallning',
  'leverans',
  'retur',
  'aterbetalning',
  'reklamation',
];

const RECOMMENDATION_KEYWORDS = [
  'recommend',
  'product recommendation',
  'suggest',
  'best product',
  'what should i buy',
  'which product',
  'passar mig',
  'produkt tips',
  'rekommendera',
  'tipsa',
];

const INTENT_RULES: IntentRule[] = [
  {
    type: 'unsafe_or_inappropriate',
    confidence: 0.92,
    signals: ['boundary'],
    keywords: [
      'self harm',
      'kill myself',
      'suicide',
      'harm someone',
      'hate speech',
      'sexual content',
      'explicit sexual',
    ],
  },
  {
    type: 'safety_concern',
    confidence: 0.88,
    signals: ['safety', 'escalation'],
    keywords: [
      'allergic reaction',
      'swelling',
      'chemical burn',
      'burning rash',
      'hives',
      'bleeding',
      'infection',
      'severe reaction',
    ],
  },
  {
    type: 'frustration',
    confidence: 0.84,
    signals: ['frustration', 'support'],
    keywords: [
      'angry',
      'furious',
      'frustrated',
      'upset',
      'besviken',
      'arg',
      'dalig service',
      'this is terrible',
      'not acceptable',
    ],
  },
  {
    type: 'abusive_language',
    confidence: 0.82,
    signals: ['boundary', 'abusive_language'],
    keywords: [
      'idiot',
      'stupid',
      'shut up',
      'useless',
      'moron',
      'dumb',
      'fuck you',
    ],
  },
  {
    type: 'escalation_request',
    confidence: 0.86,
    signals: ['human_support'],
    keywords: [
      'talk to a human',
      'speak to a person',
      'agent',
      'manager',
      'admin',
      'kundtjanst',
      'manniska',
      'prata med nagon',
    ],
  },
  {
    type: 'support_request',
    confidence: 0.82,
    signals: ['support'],
    keywords: SUPPORT_KEYWORDS,
  },
  {
    type: 'off_topic',
    confidence: 0.78,
    signals: ['off_topic'],
    keywords: [
      'weather',
      'football',
      'politics',
      'stock market',
      'crypto',
      'homework',
      'write code',
      'recipe',
      'movie recommendation',
    ],
  },
  {
    type: 'product_recommendation',
    confidence: 0.82,
    signals: ['recommendation'],
    keywords: RECOMMENDATION_KEYWORDS,
  },
  {
    type: 'profile_update',
    confidence: 0.72,
    signals: ['profile_signal'],
    keywords: [
      'dry skin',
      'sensitive skin',
      'acne',
      'dry hair',
      'curly hair',
      'sensitive scalp',
      'floral',
      'woody',
      'migraine',
      'fragrance free',
      'sulfate free',
      'torr hud',
      'kanslig hud',
      'torrt har',
      'lockigt har',
      'parfymfri',
    ],
  },
  {
    type: 'greeting',
    confidence: 0.65,
    signals: ['greeting'],
    keywords: ['hello', 'hi', 'hey', 'hej', 'hallo'],
  },
];

@Injectable()
export class CustomerChatIntentService {
  understand(message: string): CustomerChatIntent {
    const normalizedMessage = normalizeText(message);
    const hasSupportSignal = SUPPORT_KEYWORDS.some((keyword) =>
      normalizedMessage.includes(keyword),
    );
    const hasRecommendationSignal = RECOMMENDATION_KEYWORDS.some((keyword) =>
      normalizedMessage.includes(keyword),
    );

    if (hasSupportSignal && hasRecommendationSignal) {
      return {
        type: 'mixed_support_recommendation',
        confidence: 0.86,
        source: 'deterministic_rules',
        normalizedMessage,
        signals: ['support', 'recommendation', 'mixed_intent'],
      };
    }

    const rule = INTENT_RULES.find((candidate) =>
      candidate.keywords.some((keyword) => normalizedMessage.includes(keyword)),
    );

    if (!rule) {
      return {
        type: 'unknown',
        confidence: 0.4,
        source: 'deterministic_rules',
        normalizedMessage,
        signals: [],
      };
    }

    return {
      type: rule.type,
      confidence: rule.confidence,
      source: 'deterministic_rules',
      normalizedMessage,
      signals: rule.signals,
    };
  }
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

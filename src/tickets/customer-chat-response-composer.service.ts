import { Injectable } from '@nestjs/common';
import {
  CustomerChatComposedResponse,
  CustomerChatResponseContext,
} from './customer-chat.types';

@Injectable()
export class CustomerChatResponseComposerService {
  compose(context: CustomerChatResponseContext): CustomerChatComposedResponse {
    const domainText = this.formatDomains(context.domainsDetected);

    switch (context.policy.route) {
      case 'recommendation':
        return {
          text:
            `I can help with a recommendation using your HARMONIQ beauty profile. ` +
            `Backend scoring will use profile signals, blockers, evidence and confidence; detected domains: ${domainText}.`,
          followUpPrompts: [
            'Show profile-aware recommendations',
            'Tell me your skin, hair or fragrance preferences',
          ],
        };

      case 'profile':
        return {
          text:
            `I noted this as beauty profile context. ` +
            `Your detected domains are now: ${domainText}.`,
          followUpPrompts: [
            'View my beauty profile',
            'Get recommendations from my profile',
          ],
        };

      case 'support':
        return {
          text: 'I can route this to support. Please include an order number, product name, or the best detail you have so the team can help faster.',
          followUpPrompts: [
            'Add my order number',
            'Describe the product issue',
          ],
        };

      case 'escalation':
        if (context.policy.boundary.type === 'medical') {
          return {
            text: 'I can route this to support, but I cannot diagnose reactions or provide medical advice. If symptoms are severe or worsening, contact a medical professional or urgent care.',
            followUpPrompts: [
              'Escalate this product concern',
              'Share the product name',
            ],
          };
        }

        return {
          text: 'I am sorry this has been frustrating. I can route this to a human support flow so the issue is handled directly.',
          followUpPrompts: ['Escalate to support', 'Add more details'],
        };

      case 'boundary':
        if (context.policy.boundary.type === 'inappropriate') {
          return {
            text: 'I can help with HARMONIQ beauty recommendations, profile preferences and support when the conversation stays respectful and safe.',
            followUpPrompts: [
              'Ask a product question',
              'Ask for support respectfully',
            ],
          };
        }

        return {
          text: 'I can help with HARMONIQ beauty recommendations, profile preferences and support, but I cannot help with unsafe or inappropriate requests.',
          followUpPrompts: [
            'Ask about a product recommendation',
            'Ask for support',
          ],
        };

      case 'off_topic':
        return {
          text: 'I can only help with HARMONIQ beauty products, beauty profile preferences, recommendations and support in this chat.',
          followUpPrompts: [
            'Ask for a recommendation',
            'Update my beauty profile',
          ],
        };

      case 'guidance':
      default:
        return {
          text: 'I can help with product recommendations, beauty profile preferences, product questions or support. What would you like help with?',
          followUpPrompts: [
            'Recommend products for me',
            'Update my beauty profile',
            'Contact support',
          ],
        };
    }
  }

  private formatDomains(domains: string[]) {
    return domains.length ? domains.join(', ') : 'none yet';
  }
}

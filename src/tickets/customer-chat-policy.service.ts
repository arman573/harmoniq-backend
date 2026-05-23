import { Injectable } from '@nestjs/common';
import {
  CustomerChatIntent,
  CustomerChatNextAction,
  CustomerChatPolicyDecision,
} from './customer-chat.types';

export type CustomerChatPolicyContext = {
  repeatedFrustration?: boolean;
};

@Injectable()
export class CustomerChatPolicyService {
  decide(
    customerId: number,
    intent: CustomerChatIntent,
    context: CustomerChatPolicyContext = {},
  ) {
    const recommendationsEndpoint = `/customers/${customerId}/recommendations`;
    const profileEndpoint = `/customers/${customerId}/profile`;

    switch (intent.type) {
      case 'unsafe_or_inappropriate':
        return this.createDecision({
          route: 'boundary',
          allowed: false,
          captureCustomerFacts: false,
          reasons: ['unsafe_or_inappropriate_boundary'],
          boundary: {
            type: 'unsafe',
            reason:
              'The message asks for content outside safe customer support boundaries.',
          },
          nextActions: [
            {
              type: 'none',
              label: 'Blocked by customer chat policy',
              status: 'blocked',
            },
          ],
        });

      case 'abusive_language':
        return this.createDecision({
          route: 'boundary',
          allowed: false,
          captureCustomerFacts: false,
          reasons: ['abusive_language_boundary'],
          boundary: {
            type: 'inappropriate',
            reason:
              'The message uses abusive language and cannot be handled as a normal support or recommendation request.',
          },
          nextActions: [
            {
              type: 'ask_clarifying_question',
              label: 'Ask for a respectful beauty or support question',
              status: 'available',
            },
          ],
        });

      case 'safety_concern':
        return this.createDecision({
          route: 'escalation',
          allowed: true,
          captureCustomerFacts: false,
          reasons: ['product_safety_or_medical_boundary'],
          boundary: {
            type: 'medical',
            reason:
              'HARMONIQ can route product concerns but cannot diagnose or provide medical advice.',
          },
          escalation: {
            required: true,
            priority: 'high',
            reason: 'Customer reported a possible product safety concern.',
          },
          nextActions: [
            {
              type: 'support_handoff',
              label: 'Escalate to support',
              status: 'placeholder',
            },
          ],
        });

      case 'frustration':
        return this.createDecision({
          route: 'escalation',
          allowed: true,
          captureCustomerFacts: false,
          reasons: context.repeatedFrustration
            ? ['customer_frustration_detected', 'repeated_customer_frustration']
            : ['customer_frustration_detected'],
          escalation: {
            required: true,
            priority: context.repeatedFrustration ? 'high' : 'medium',
            reason: context.repeatedFrustration
              ? 'Customer has repeated frustration signals in this conversation.'
              : 'Customer appears frustrated and should be offered support.',
          },
          nextActions: [
            {
              type: 'support_handoff',
              label: 'Offer support handoff',
              status: 'placeholder',
            },
          ],
        });

      case 'escalation_request':
        return this.createDecision({
          route: 'escalation',
          allowed: true,
          captureCustomerFacts: false,
          reasons: ['customer_requested_human'],
          escalation: {
            required: true,
            priority: 'high',
            reason: 'Customer explicitly requested a human handoff.',
          },
          nextActions: [
            {
              type: 'support_handoff',
              label: 'Connect to support',
              status: 'placeholder',
            },
          ],
        });

      case 'mixed_support_recommendation':
        return this.createDecision({
          route: 'support',
          allowed: true,
          captureCustomerFacts: false,
          reasons: [
            'mixed_support_recommendation_intent',
            'support_takes_priority',
          ],
          escalation: {
            required: true,
            priority: 'low',
            reason:
              'Customer asked for both support and recommendations; support routing takes priority.',
          },
          nextActions: [
            {
              type: 'support_handoff',
              label: 'Route support issue first',
              status: 'placeholder',
            },
          ],
        });

      case 'support_request':
        return this.createDecision({
          route: 'support',
          allowed: true,
          captureCustomerFacts: false,
          reasons: ['support_intent_detected'],
          escalation: {
            required: true,
            priority: 'low',
            reason: 'Customer asked for support or order help.',
          },
          nextActions: [
            {
              type: 'support_handoff',
              label: 'Route to support',
              status: 'placeholder',
            },
          ],
        });

      case 'product_recommendation':
        return this.createDecision({
          route: 'recommendation',
          allowed: true,
          captureCustomerFacts: true,
          reasons: ['recommendation_intent_detected'],
          nextActions: [
            {
              type: 'fetch_recommendations',
              label: 'Fetch profile-aware recommendations',
              status: 'available',
              endpoint: recommendationsEndpoint,
            },
          ],
        });

      case 'profile_update':
        return this.createDecision({
          route: 'profile',
          allowed: true,
          captureCustomerFacts: true,
          reasons: ['profile_signal_detected'],
          nextActions: [
            {
              type: 'view_profile',
              label: 'View unified beauty profile',
              status: 'available',
              endpoint: profileEndpoint,
            },
          ],
        });

      case 'off_topic':
        return this.createDecision({
          route: 'off_topic',
          allowed: false,
          captureCustomerFacts: false,
          reasons: ['off_topic_for_customer_core'],
          nextActions: [
            {
              type: 'ask_clarifying_question',
              label: 'Ask for a beauty or support question',
              status: 'available',
            },
          ],
        });

      case 'greeting':
      case 'unknown':
      default:
        return this.createDecision({
          route: 'guidance',
          allowed: true,
          captureCustomerFacts: false,
          reasons: ['customer_core_guidance'],
          nextActions: [
            {
              type: 'ask_clarifying_question',
              label: 'Ask what the customer needs',
              status: 'available',
            },
          ],
        });
    }
  }

  private createDecision(
    decision: Partial<CustomerChatPolicyDecision> &
      Pick<
        CustomerChatPolicyDecision,
        'route' | 'allowed' | 'captureCustomerFacts' | 'reasons'
      > & {
        nextActions: CustomerChatNextAction[];
      },
  ): CustomerChatPolicyDecision {
    return {
      boundary: { type: 'none' },
      escalation: { required: false, priority: 'none' },
      ...decision,
    };
  }
}

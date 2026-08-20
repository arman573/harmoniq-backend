import { Injectable } from '@nestjs/common';
import { AiArmanAdminCaseAssistantFastService } from './admin-case-assistant-fast.service';
import {
  AiArmanAdminToolRegistryService,
  type AiArmanAdminToolResult,
} from './admin-tool-registry.service';

const TRACKING_PATTERN = /(sändnings.?id|spår|tracking|paket|leverans|skickad|schenker|nshift)/i;
const ORDER_PATTERN = /(order|beställning|status|skickad|leverans|sändnings.?id|spår|tracking)/i;
const PRODUCT_PATTERN = /(produkt|inci|ingrediens|hud|hår|schampo|serum|kräm|cream|shampoo|conditioner)/i;

@Injectable()
export class AiArmanAdminCaseAssistantOrchestratorService {
  constructor(
    private readonly tools: AiArmanAdminToolRegistryService,
    private readonly assistant: AiArmanAdminCaseAssistantFastService,
  ) {}

  async assist(input: unknown) {
    const normalized = normalizeToolInput(input);
    if (!normalized) return this.assistant.assist(input);

    const toolResults: AiArmanAdminToolResult[] = [];
    toolResults.push(await this.tools.readCase(normalized.caseContext));

    const intentText = [
      normalized.adminQuestion,
      ...normalized.messages.map((message) => message.text),
    ]
      .filter(Boolean)
      .join(' ');

    if (normalized.orderId && ORDER_PATTERN.test(intentText)) {
      toolResults.push(await this.tools.readOrder(normalized.orderId));
    }

    if (normalized.orderId && TRACKING_PATTERN.test(intentText)) {
      toolResults.push(await this.tools.readTracking(normalized.orderId));
    }

    if (normalized.products.length > 0 && PRODUCT_PATTERN.test(intentText)) {
      toolResults.push(
        await this.tools.readProductIntelligence(
          normalized.adminQuestion || intentText.slice(0, 1200),
          normalized.products,
        ),
      );
    }

    const originalMessages = isRecord(input) && Array.isArray(input.messages)
      ? input.messages
      : [];
    const verifiedFactMessage = buildVerifiedFactMessage(toolResults);

    const result = await this.assistant.assist({
      ...(isRecord(input) ? input : {}),
      messages: verifiedFactMessage
        ? [...originalMessages, verifiedFactMessage]
        : originalMessages,
    });

    if (!isRecord(result)) return result;
    return {
      ...result,
      toolsUsed: toolResults.map((tool) => ({
        tool: tool.name,
        ok: tool.ok,
        source: tool.source,
        durationMs: tool.durationMs,
      })),
      verifiedFactsAvailable: toolResults.some(
        (tool) => tool.name !== 'case.read' && tool.ok,
      ),
    };
  }
}

function buildVerifiedFactMessage(toolResults: AiArmanAdminToolResult[]) {
  const externalFacts = toolResults.filter((tool) => tool.name !== 'case.read');
  if (externalFacts.length === 0) return null;

  const payload = externalFacts.map((tool) => ({
    tool: tool.name,
    ok: tool.ok,
    source: tool.source,
    readOnly: true,
    ...(tool.ok ? { data: tool.data } : { error: tool.error || 'unavailable' }),
  }));

  return {
    direction: 'system',
    sender: 'VERIFIERADE SYSTEMFAKTA',
    subject: 'Verifierade read-only fakta från Harmoniqs system',
    text:
      'Följande fakta har hämtats server-side från verifierade read-only verktyg. '
      + 'Behandla dem som auktoritativa systemfakta och hitta inte på värden som saknas. '
      + JSON.stringify(payload),
    date: new Date().toISOString(),
  };
}

function normalizeToolInput(value: unknown) {
  if (!isRecord(value)) return null;
  const caseId = clean(value.caseId, 100);
  const caseType = clean(value.caseType, 80);
  if (!caseId || !caseType) return null;

  const orderId = /^[0-9]{3,12}$/.test(clean(value.orderId, 20))
    ? clean(value.orderId, 20)
    : '';

  const messages = Array.isArray(value.messages)
    ? value.messages
        .filter(isRecord)
        .slice(-40)
        .map((message) => ({ text: clean(message.text, 3000) }))
        .filter((message) => message.text)
    : [];

  const products = Array.isArray(value.products)
    ? value.products
        .filter(isRecord)
        .map((product) => ({
          productId: clean(product.productId || product.id || product.sku, 100),
          title: clean(product.title || product.name, 300),
          url: clean(product.url || product.canonicalUrl, 1000),
        }))
        .filter((product) => product.productId && product.title)
        .slice(0, 12)
    : [];

  return {
    orderId,
    adminQuestion: clean(value.adminQuestion, 1200),
    messages,
    products,
    caseContext: {
      caseId,
      caseType,
      status: clean(value.status, 120),
      orderId,
      customerName: clean(value.customerName, 100),
      messages: Array.isArray(value.messages) ? value.messages : [],
    },
  };
}

function clean(value: unknown, max: number): string {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .slice(0, max);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

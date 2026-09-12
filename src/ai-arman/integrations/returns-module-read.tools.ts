import { Injectable } from '@nestjs/common';
import { ReturnsModuleReadClient } from './returns-module-read.client';
import {
  RETURNS_MODULE_CONTRACT_VERSION,
  ReturnsModuleCaseMessage,
  ReturnsModuleCustomerCase,
  ReturnsModuleVerifiedCustomerContext,
} from './returns-module.types';

export type ReturnsModuleReadToolInput = {
  verification: ReturnsModuleVerifiedCustomerContext;
  orderId: string;
  caseId?: string;
};

export type GetCaseStatusToolResult =
  | {
      ok: true;
      caseId: string;
      orderId: string;
      caseType: ReturnsModuleCustomerCase['caseType'];
      status: string;
      statusLabel: string;
      updatedAt: string;
    }
  | {
      ok: false;
      error:
        | 'case_not_found'
        | 'case_selection_ambiguous'
        | 'returns_module_unavailable';
    };

export type GetCaseMessagesToolResult =
  | {
      ok: true;
      caseId: string;
      orderId: string;
      messages: ReturnsModuleCaseMessage[];
    }
  | {
      ok: false;
      error:
        | 'case_not_found'
        | 'case_selection_ambiguous'
        | 'returns_module_unavailable';
    };

@Injectable()
export class ReturnsModuleReadTools {
  constructor(private readonly client: ReturnsModuleReadClient) {}

  async getCaseStatus(
    input: ReturnsModuleReadToolInput,
  ): Promise<GetCaseStatusToolResult> {
    const selected = await this.readSingleCase(input);
    if (!selected.ok) return selected;

    const item = selected.case;
    return {
      ok: true,
      caseId: item.caseId,
      orderId: item.orderId,
      caseType: item.caseType,
      status: item.status,
      statusLabel: item.statusLabel,
      updatedAt: item.updatedAt,
    };
  }

  async getCaseMessages(
    input: ReturnsModuleReadToolInput,
  ): Promise<GetCaseMessagesToolResult> {
    const selected = await this.readSingleCase(input);
    if (!selected.ok) return selected;

    return {
      ok: true,
      caseId: selected.case.caseId,
      orderId: selected.case.orderId,
      messages: selected.case.messages,
    };
  }

  private async readSingleCase(
    input: ReturnsModuleReadToolInput,
  ): Promise<
    | { ok: true; case: ReturnsModuleCustomerCase }
    | {
        ok: false;
        error:
          | 'case_not_found'
          | 'case_selection_ambiguous'
          | 'returns_module_unavailable';
      }
  > {
    const result = await this.client.getCaseContext({
      contractVersion: RETURNS_MODULE_CONTRACT_VERSION,
      verification: input.verification,
      orderId: input.orderId,
      ...(input.caseId ? { caseId: input.caseId } : {}),
    });

    if (!result.ok) {
      return { ok: false, error: 'returns_module_unavailable' };
    }

    const cases = result.response.cases;
    if (cases.length === 0) {
      return { ok: false, error: 'case_not_found' };
    }

    if (input.caseId) {
      const exact = cases.find((item) => item.caseId === input.caseId);
      return exact
        ? { ok: true, case: exact }
        : { ok: false, error: 'case_not_found' };
    }

    if (cases.length !== 1) {
      return { ok: false, error: 'case_selection_ambiguous' };
    }

    return { ok: true, case: cases[0] };
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MailAgentGptHelpService, MailAgentWorkstylePreview } from './mail-agent-gpt-help.service';
import { MailAgentWorkstyle } from './mail-agent-workstyle.entity';

@Injectable()
export class MailAgentWorkstyleService {
  constructor(
    @InjectRepository(MailAgentWorkstyle)
    private readonly repository: Repository<MailAgentWorkstyle>,
    private readonly gptHelp: MailAgentGptHelpService,
  ) {}

  async preview(instruction: string) {
    const clean = String(instruction || '').trim();
    if (!clean || clean.length > 4000) {
      return {
        ok: false,
        code: 'invalid_instruction',
        error: 'Skriv en instruktion på högst 4000 tecken.',
      };
    }

    const result = await this.gptHelp.preview(clean);
    if (!result.ok || !result.preview) return result;

    return {
      ok: true,
      instruction: clean,
      model: result.model,
      summary: result.preview.summary,
      preview: result.preview,
      executesWrites: false,
      requiresExplicitApproval: true,
    };
  }

  async approve(input: {
    instruction?: string;
    preview?: MailAgentWorkstylePreview;
    model?: string;
    approved?: boolean;
  }) {
    if (input?.approved !== true) {
      return {
        ok: false,
        code: 'explicit_approval_required',
        error: 'Arbetssättet måste godkännas uttryckligen innan det sparas.',
      };
    }

    const instruction = String(input.instruction || '').trim();
    if (!instruction || instruction.length > 4000) {
      return {
        ok: false,
        code: 'invalid_instruction',
        error: 'Instruktionen saknas eller är för lång.',
      };
    }

    const preview = input.preview;
    if (!preview || !String(preview.summary || '').trim()) {
      return {
        ok: false,
        code: 'invalid_preview',
        error: 'En giltig GPT-preview krävs för att spara arbetssättet.',
      };
    }

    const entity = this.repository.create({
      instruction,
      summary: String(preview.summary).trim(),
      status: 'active',
      scope: preview.scope,
      conditions: preview.conditions,
      actions: preview.actions,
      warnings: Array.isArray(preview.warnings) ? preview.warnings : [],
      interpreter: 'openai_responses',
      model: String(input.model || '').trim() || undefined,
      approvedAt: new Date(),
    });

    const saved = await this.repository.save(entity);

    return {
      ok: true,
      item: saved,
      executesImmediately: false,
      note: 'Arbetssättet är sparat och kan nu användas av mailagentens policylager.',
    };
  }

  async list() {
    const items = await this.repository.find({
      order: { createdAt: 'DESC' },
      take: 250,
    });
    return { ok: true, items };
  }

  async disable(id: number) {
    const item = await this.repository.findOne({ where: { id } });
    if (!item) return { ok: false, code: 'not_found' };

    item.status = 'disabled';
    item.disabledAt = new Date();
    const saved = await this.repository.save(item);
    return { ok: true, item: saved };
  }
}

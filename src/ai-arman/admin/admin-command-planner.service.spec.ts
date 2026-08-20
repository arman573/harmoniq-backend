import { AiArmanAdminCommandPlannerService } from './admin-command-planner.service';

describe('AiArmanAdminCommandPlannerService', () => {
  const planner = new AiArmanAdminCommandPlannerService();

  it('plans explicit pause as an approved write', () => {
    expect(planner.plan('Öppna HQR-12345 och pausa ärendet.', '')).toEqual({
      caseId: 'HQR-12345',
      readCase: true,
      readOrderContext: false,
      writeAction: 'pause',
      explicitAdminApproval: true,
    });
  });

  it('does not execute a deliberative pause question', () => {
    expect(planner.plan('Borde vi pausa HQR-12345?', '')).toEqual({
      caseId: 'HQR-12345',
      readCase: true,
      readOrderContext: false,
      writeAction: null,
      explicitAdminApproval: false,
    });
  });

  it('plans order and tracking as read-only context', () => {
    expect(planner.plan('Kontrollera order och sändnings-id för ärendet.', 'HQR-2494077')).toEqual({
      caseId: 'HQR-2494077',
      readCase: true,
      readOrderContext: true,
      writeAction: null,
      explicitAdminApproval: false,
    });
  });

  it('plans explicit complete command', () => {
    expect(planner.plan('Klarmarkera ärendet', 'HQR-12345')).toEqual({
      caseId: 'HQR-12345',
      readCase: true,
      readOrderContext: false,
      writeAction: 'complete',
      explicitAdminApproval: true,
    });
  });

  it('fails closed on ambiguous writes', () => {
    expect(planner.plan('Pausa och klarmarkera HQR-12345', '')).toEqual({
      caseId: 'HQR-12345',
      readCase: true,
      readOrderContext: false,
      writeAction: null,
      explicitAdminApproval: false,
    });
  });
});

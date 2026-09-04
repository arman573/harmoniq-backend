import { projectVendreOrderStatus } from './vendre-order-status.projection';

describe('projectVendreOrderStatus', () => {
  it('returns only the whitelisted order status facts', () => {
    const result = projectVendreOrderStatus(
      {
        id: 90250,
        status_id: 3,
        status_name: 'Skickad',
        date_added: '2026-08-12T10:00:00Z',
        shipping_date: '2026-08-13T09:00:00Z',
        extra_field: 'must-not-leave-projection',
        nested_extra: { value: 'must-not-leave-projection' },
      },
      '90250',
    );

    expect(result).toEqual({
      orderId: '90250',
      status: 'Skickad',
      statusId: 3,
      createdAt: '2026-08-12T10:00:00Z',
      shippingDate: '2026-08-13T09:00:00Z',
      dispatchState: 'dispatched',
    });
    expect(JSON.stringify(result)).not.toContain('must-not-leave-projection');
  });

  it('classifies explicit early order states as not dispatched', () => {
    expect(
      projectVendreOrderStatus(
        { id: 90250, status_id: 2, status_name: 'Packas' },
        '90250',
      )?.dispatchState,
    ).toBe('not_dispatched');
  });

  it('keeps dispatch unknown when Vendre evidence is insufficient', () => {
    expect(
      projectVendreOrderStatus(
        { id: 90250, status_id: 9, status_name: 'Specialstatus' },
        '90250',
      )?.dispatchState,
    ).toBe('unknown');
  });

  it('rejects a payload for a different order', () => {
    expect(projectVendreOrderStatus({ id: 90251 }, '90250')).toBeNull();
  });
});

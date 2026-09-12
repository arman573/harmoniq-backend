import { projectVendreOrderStatus } from './vendre-order-status.projection';

describe('projectVendreOrderStatus', () => {
  it('returns only the whitelisted order and tracking facts', () => {
    const result = projectVendreOrderStatus(
      {
        id: 90250,
        status_id: 3,
        status_name: 'Skickad',
        date_added: '2026-08-12T10:00:00Z',
        shipping_date: '2026-08-13T09:00:00Z',
        shipment: {
          shipmentStatus: 'På väg',
          trackingUrl:
            'https://www.dbschenker.com/app/tracking-public?refNumber=373325386504796634',
        },
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
      trackingNumber: '373325386504796634',
      trackingUrl:
        'https://www.dbschenker.com/app/tracking-public?refNumber=373325386504796634',
      shipmentStatus: 'På väg',
    });
    expect(JSON.stringify(result)).not.toContain('must-not-leave-projection');
  });

  it('normalizes tracking aliases from nested Vendre structures', () => {
    expect(
      projectVendreOrderStatus(
        {
          id: 90250,
          orders_status_name: 'Skickad',
          delivery: {
            tracking: {
              parcel_no: 'PKG-12345',
              url: 'https://carrier.example.test/track/PKG-12345',
              tracking_status: 'Terminalhanterad',
            },
          },
        },
        '90250',
      ),
    ).toMatchObject({
      status: 'Skickad',
      dispatchState: 'dispatched',
      trackingNumber: 'PKG-12345',
      trackingUrl: 'https://carrier.example.test/track/PKG-12345',
      shipmentStatus: 'Terminalhanterad',
    });
  });

  it('prefers an explicit parcel number over a number derived from the URL', () => {
    expect(
      projectVendreOrderStatus(
        {
          id: 90250,
          tracking_number: 'EXPLICIT-123',
          tracking_url:
            'https://carrier.example.test/track?trackingNumber=URL-456',
        },
        '90250',
      )?.trackingNumber,
    ).toBe('EXPLICIT-123');
  });

  it('does not expose unsafe tracking URLs', () => {
    expect(
      projectVendreOrderStatus(
        {
          id: 90250,
          tracking_number: 'PKG-12345',
          tracking_url: 'javascript:alert(1)',
        },
        '90250',
      ),
    ).toMatchObject({
      trackingNumber: 'PKG-12345',
      trackingUrl: '',
    });
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

import { config } from './config';
import { logInfo } from './logger';

export async function fetchOrders() {
  const url = `${config.vendreBaseUrl}/api/orders`;

  logInfo('Fetching orders', {
    url,
    dryRun: config.dryRun,
  });

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${config.vendreApiKey}`,
      Accept: 'application/json',
    },
  });

  const text = await response.text();

  logInfo('Orders response received', {
    status: response.status,
    ok: response.ok,
    preview: text.slice(0, 1000),
  });

  return {
    status: response.status,
    body: text,
  };
}

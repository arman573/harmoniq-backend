import { fetchOrders } from '../lib/vendreClient';
import { logError, logInfo } from '../lib/logger';

async function main() {
  try {
    logInfo('Starting pickup status dry-run');

    const result = await fetchOrders();

    logInfo('Dry-run completed', {
      status: result.status,
    });
  } catch (error) {
    logError('Dry-run failed', error);
    process.exit(1);
  }
}

void main();

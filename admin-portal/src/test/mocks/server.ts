import { setupServer } from 'msw/node';

import { braceletHandlers } from './bracelet-handlers';

export const server = setupServer(...braceletHandlers);

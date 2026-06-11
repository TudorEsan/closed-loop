// Operator-set bounds on offline exposure. A terminal that dies before
// syncing loses at most OFFLINE_QUEUE_CAP * OFFLINE_MAX_AMOUNT_CENTS worth
// of unattributed sales, so the product of the two is the worst-case loss
// per terminal the festival accepts ahead of time.
export const OFFLINE_QUEUE_CAP = 50;

// Per-transaction ceiling while offline, in cents. Online charges are not
// limited here; the server validates those.
export const OFFLINE_MAX_AMOUNT_CENTS = 10000;

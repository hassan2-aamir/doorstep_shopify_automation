// Closed vocabularies shared by the flows and the app (Backend schema doc, "Closed vocabularies").
// A callback naming anything outside these lists is rejected by the receiver.

export const WORKFLOW_A = 'orders-to-fulfillment';
export const WORKFLOW_B = 'tracking-to-shopify-and-buyer';
export const WORKFLOWS = [WORKFLOW_A, WORKFLOW_B];

export const WORKFLOW_LABELS = {
  [WORKFLOW_A]: 'Order intake',
  [WORKFLOW_B]: 'Shipping updates',
};

export const OUTCOMES = ['success', 'skipped', 'failed'];
export const ERROR_KINDS = ['connection', 'data', 'other'];

// system is the key the app uses for ?focus= on Connections: store | sheet | email
export const STEPS = {
  read_order:         { system: 'store', label: 'Reading the order' },
  apply_conditions:   { system: null,    label: 'Checking the order rules' },
  dedupe_check:       { system: null,    label: 'Checking it was not already handled' },
  upsert_row:         { system: 'sheet', label: 'Adding the order to the sheet' },
  read_rows:          { system: 'sheet', label: 'Reading tracking numbers' },
  create_fulfillment: { system: 'store', label: 'Creating the Shopify fulfillment' },
  send_buyer_email:   { system: 'email', label: 'Emailing the buyer' },
  update_status:      { system: 'sheet', label: 'Marking the row Notified' },
  send_alert:         { system: 'email', label: 'Sending the failure alert' },
};
export const STEP_NAMES = Object.keys(STEPS);

export const SYSTEM_NAMES = { store: 'Shopify', sheet: 'Google Sheets', email: 'Email' };

export function systemForStep(step) {
  return STEPS[step]?.system ?? null;
}

// The sentence shown to Sara for a failed event. Raw `error` stays behind a Details disclosure.
export function reasonFor({ outcome, errorKind, step }) {
  if (outcome !== 'failed') return null;
  if (errorKind === 'connection') {
    const system = systemForStep(step);
    return system ? `${SYSTEM_NAMES[system]} needs reconnecting` : 'A connection needs reconnecting';
  }
  if (errorKind === 'data') {
    if (step === 'send_buyer_email') return 'This order has no buyer email, so we could not notify them';
    if (step === 'upsert_row') return 'This order is missing information the sheet needs';
    return 'This order is missing information we need';
  }
  return 'Something went wrong on our side. We will retry automatically.';
}

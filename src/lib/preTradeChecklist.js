const SKIP_KEY = 'nexatrader_skip_pre_trade_checklist';

export function shouldSkipPreTradeChecklist() {
  try {
    return localStorage.getItem(SKIP_KEY) === '1';
  } catch {
    return false;
  }
}

export function setSkipPreTradeChecklist(enabled) {
  try {
    if (enabled) localStorage.setItem(SKIP_KEY, '1');
    else localStorage.removeItem(SKIP_KEY);
  } catch {
    /* ignore */
  }
}

export { SKIP_KEY };

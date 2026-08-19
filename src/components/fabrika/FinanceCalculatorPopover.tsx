'use client';

import {
  ArrowDownUp,
  Calculator,
  Coins,
  Delete,
  RefreshCw,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import styles from './FinanceCalculatorPopover.module.css';

type ExchangeRate = {
  code: string;
  name: string;
  buying: number;
  selling: number;
};

type ExchangeRateResponse = {
  success: boolean;
  source?: string;
  publishedDate?: string;
  fetchedAt?: string;
  rates?: ExchangeRate[];
  error?: string;
};

type Operator = '+' | '-' | '×' | '÷';

const formatter = new Intl.NumberFormat('tr-TR', {
  maximumFractionDigits: 4,
});

const fetchedAtFormatter = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: '2-digit',
  timeZone: 'Europe/Istanbul',
  year: 'numeric',
});

export const EXCHANGE_RATE_REFRESH_MS = 2 * 60 * 60 * 1000;

export function formatExchangeRateFetchedAt(fetchedAt?: string | null) {
  if (!fetchedAt) return null;
  const date = new Date(fetchedAt);
  return Number.isNaN(date.getTime()) ? null : fetchedAtFormatter.format(date);
}
export function calculateBinary(left: number, right: number, operator: Operator) {
  if (operator === '+') return left + right;
  if (operator === '-') return left - right;
  if (operator === '×') return left * right;
  return right === 0 ? null : left / right;
}

function useExchangeRates(enabled = true) {
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      try {
        const response = await fetch('/api/fabrika/exchange-rates', {
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = (await response.json()) as ExchangeRateResponse;
        if (!response.ok || !payload.success || !payload.rates) {
          throw new Error(payload.error || 'Kurlar yüklenemedi.');
        }
        if (active) {
          setRates(payload.rates);
          setFetchedAt(payload.fetchedAt || null);
          setError(null);
        }
      } catch (loadError) {
        if (active && !controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : 'Kurlar yüklenemedi.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    const interval = window.setInterval(load, EXCHANGE_RATE_REFRESH_MS);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
    };
  }, [enabled]);

  return { error, fetchedAt, loading, rates };
}

export function LiveExchangeRates() {
  const { error, fetchedAt, loading, rates } = useExchangeRates();
  const usd = rates.find((rate) => rate.code === 'USD');
  const eur = rates.find((rate) => rate.code === 'EUR');
  const fetchedAtLabel = formatExchangeRateFetchedAt(fetchedAt);

  return (
    <section aria-label="Güncel döviz kurları" className={styles.liveRates}>
      <span className={styles.liveRatesTitle}>
        <Coins aria-hidden="true" />
        <strong>Güncel Kur</strong>
        <small>TCMB</small>
      </span>
      {loading && !rates.length ? <span className={styles.rateLoading}>Yükleniyor…</span> : null}
      {error && !rates.length ? <span className={styles.rateError}>Kur alınamadı</span> : null}
      {usd && eur ? (
        <span className={styles.liveRateValues}>
          <span><b>USD</b> ₺{formatter.format(usd.selling)}</span>
          <span><b>EUR</b> ₺{formatter.format(eur.selling)}</span>
        </span>
      ) : null}
      {fetchedAtLabel ? (
        <small className={styles.rateDate}>
          Son veri çekimi: <time dateTime={fetchedAt || undefined}>{fetchedAtLabel}</time>
        </small>
      ) : null}
    </section>
  );
}

export default function FinanceCalculatorPopover() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'calculator' | 'exchange'>('calculator');
  const [display, setDisplay] = useState('0');
  const [stored, setStored] = useState<number | null>(null);
  const [operator, setOperator] = useState<Operator | null>(null);
  const [replaceDisplay, setReplaceDisplay] = useState(false);
  const [amount, setAmount] = useState('1');
  const [fromCode, setFromCode] = useState('USD');
  const [toCode, setToCode] = useState('TRY');
  const { error, fetchedAt, loading, rates } = useExchangeRates(open);
  const fetchedAtLabel = formatExchangeRateFetchedAt(fetchedAt);

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  const currencyOptions = useMemo(
    () => [{ code: 'TRY', name: 'Türk Lirası', buying: 1, selling: 1 }, ...rates],
    [rates]
  );

  const converted = useMemo(() => {
    const input = Number(amount.replace(',', '.'));
    const from = currencyOptions.find((rate) => rate.code === fromCode);
    const to = currencyOptions.find((rate) => rate.code === toCode);
    if (!Number.isFinite(input) || !from || !to) return null;
    return (input * from.selling) / to.selling;
  }, [amount, currencyOptions, fromCode, toCode]);

  function enterDigit(digit: string) {
    setDisplay((current) => {
      if (replaceDisplay || current === 'Hata') {
        setReplaceDisplay(false);
        return digit === ',' ? '0,' : digit;
      }
      if (digit === ',' && current.includes(',')) return current;
      if (current === '0' && digit !== ',') return digit;
      return current.length >= 14 ? current : `${current}${digit}`;
    });
  }

  function chooseOperator(nextOperator: Operator) {
    const current = Number(display.replace(',', '.'));
    if (stored !== null && operator && !replaceDisplay) {
      const result = calculateBinary(stored, current, operator);
      if (result === null) {
        setDisplay('Hata');
        setStored(null);
        setOperator(null);
        setReplaceDisplay(true);
        return;
      }
      setStored(result);
      setDisplay(String(Number(result.toFixed(10))).replace('.', ','));
    } else {
      setStored(current);
    }
    setOperator(nextOperator);
    setReplaceDisplay(true);
  }

  function equals() {
    if (stored === null || !operator) return;
    const current = Number(display.replace(',', '.'));
    const result = calculateBinary(stored, current, operator);
    setDisplay(result === null ? 'Hata' : String(Number(result.toFixed(10))).replace('.', ','));
    setStored(null);
    setOperator(null);
    setReplaceDisplay(true);
  }

  function clear() {
    setDisplay('0');
    setStored(null);
    setOperator(null);
    setReplaceDisplay(false);
  }

  return (
    <>
      <button
        aria-label="Hesap makinesi ve kur çeviriciyi aç"
        className={styles.trigger}
        onClick={() => setOpen(true)}
        type="button"
      >
        <Calculator aria-hidden="true" />
        <span>Hesapla</span>
      </button>

      {open && typeof document !== 'undefined' ? createPortal((
        <div className={styles.layer}>
          <button
            aria-label="Hesaplama panelini kapat"
            className={styles.backdrop}
            onClick={() => setOpen(false)}
            type="button"
          />
          <section
            aria-labelledby="finance-calculator-title"
            aria-modal="true"
            className={styles.panel}
            role="dialog"
          >
            <header className={styles.panelHeader}>
              <span>
                <Calculator aria-hidden="true" />
                <span>
                  <strong id="finance-calculator-title">Hızlı Hesaplama</strong>
                  <small>Hesap makinesi ve resmi TCMB kurları</small>
                </span>
              </span>
              <button aria-label="Kapat" onClick={() => setOpen(false)} type="button">
                <X aria-hidden="true" />
              </button>
            </header>

            <div aria-label="Hesaplama türü" className={styles.tabs} role="tablist">
              <button
                aria-selected={tab === 'calculator'}
                data-active={tab === 'calculator'}
                onClick={() => setTab('calculator')}
                role="tab"
                type="button"
              >
                <Calculator aria-hidden="true" /> Hesap Makinesi
              </button>
              <button
                aria-selected={tab === 'exchange'}
                data-active={tab === 'exchange'}
                onClick={() => setTab('exchange')}
                role="tab"
                type="button"
              >
                <Coins aria-hidden="true" /> Kur Çevirici
              </button>
            </div>

            {tab === 'calculator' ? (
              <div className={styles.calculatorPage} role="tabpanel">
                <div aria-live="polite" className={styles.display}>
                  <small>{stored !== null && operator ? `${String(stored).replace('.', ',')} ${operator}` : 'Sonuç'}</small>
                  <strong>{display}</strong>
                </div>
                <div className={styles.keypad}>
                  <button className={styles.clearKey} onClick={clear} type="button">C</button>
                  <button
                    aria-label="Son basamağı sil"
                    onClick={() => setDisplay((value) => value.length > 1 ? value.slice(0, -1) : '0')}
                    type="button"
                  ><Delete aria-hidden="true" /></button>
                  <button onClick={() => setDisplay((value) => String(Number(value.replace(',', '.')) / 100).replace('.', ','))} type="button">%</button>
                  <button className={styles.operatorKey} onClick={() => chooseOperator('÷')} type="button">÷</button>
                  {['7', '8', '9'].map((key) => <button key={key} onClick={() => enterDigit(key)} type="button">{key}</button>)}
                  <button className={styles.operatorKey} onClick={() => chooseOperator('×')} type="button">×</button>
                  {['4', '5', '6'].map((key) => <button key={key} onClick={() => enterDigit(key)} type="button">{key}</button>)}
                  <button className={styles.operatorKey} onClick={() => chooseOperator('-')} type="button">−</button>
                  {['1', '2', '3'].map((key) => <button key={key} onClick={() => enterDigit(key)} type="button">{key}</button>)}
                  <button className={styles.operatorKey} onClick={() => chooseOperator('+')} type="button">+</button>
                  <button className={styles.zeroKey} onClick={() => enterDigit('0')} type="button">0</button>
                  <button onClick={() => enterDigit(',')} type="button">,</button>
                  <button className={styles.equalsKey} onClick={equals} type="button">=</button>
                </div>
              </div>
            ) : (
              <div className={styles.exchangePage} role="tabpanel">
                <label>
                  <span>Tutar</span>
                  <input
                    inputMode="decimal"
                    onChange={(event) => setAmount(event.target.value)}
                    value={amount}
                  />
                </label>
                <div className={styles.currencyRow}>
                  <label>
                    <span>Şundan</span>
                    <select onChange={(event) => setFromCode(event.target.value)} value={fromCode}>
                      {currencyOptions.map((rate) => <option key={rate.code} value={rate.code}>{rate.code} · {rate.name}</option>)}
                    </select>
                  </label>
                  <button
                    aria-label="Para birimlerini değiştir"
                    onClick={() => {
                      setFromCode(toCode);
                      setToCode(fromCode);
                    }}
                    type="button"
                  ><ArrowDownUp aria-hidden="true" /></button>
                  <label>
                    <span>Şuna</span>
                    <select onChange={(event) => setToCode(event.target.value)} value={toCode}>
                      {currencyOptions.map((rate) => <option key={rate.code} value={rate.code}>{rate.code} · {rate.name}</option>)}
                    </select>
                  </label>
                </div>
                <div aria-live="polite" className={styles.exchangeResult}>
                  <small>Hesaplanan tutar</small>
                  <strong>{converted === null ? '—' : `${formatter.format(converted)} ${toCode}`}</strong>
                </div>
                <p className={styles.sourceNote}>
                  {loading ? <><RefreshCw className={styles.spin} aria-hidden="true" /> Kurlar yükleniyor…</> : null}
                  {error ? error : null}
                  {!loading && !error ? (
                    <>
                      TCMB döviz satış kuru
                      {fetchedAtLabel ? (
                        <> · Son veri çekimi: <time dateTime={fetchedAt || undefined}>{fetchedAtLabel}</time></>
                      ) : null}
                    </>
                  ) : null}
                </p>
              </div>
            )}
          </section>
        </div>
      ), document.body) : null}
    </>
  );
}

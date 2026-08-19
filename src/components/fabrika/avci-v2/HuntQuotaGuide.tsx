import {
  BedDouble,
  BriefcaseBusiness,
  Building,
  Building2,
  CheckCircle2,
  Home,
  KeyRound,
  Map as MapIcon,
} from 'lucide-react';
import {
  HUNT_PROPERTY_TYPE_OPTIONS,
  type HuntPropertyType,
} from '@/lib/hunting-v2/property-types';

const HUNT_RULES: Record<
  HuntPropertyType,
  { perRunLimit: number; monthlyLimit: number }
> = {
  KONUT: { perRunLimit: 50, monthlyLimit: 500 },
  ISYERI: { perRunLimit: 5, monthlyLimit: 15 },
  ARSA: { perRunLimit: 5, monthlyLimit: 15 },
  KONUT_PROJELERI: { perRunLimit: 5, monthlyLimit: 15 },
  BINA: { perRunLimit: 5, monthlyLimit: 15 },
  DEVREN_MULK: { perRunLimit: 5, monthlyLimit: 15 },
  TURISTIK_TESIS: { perRunLimit: 5, monthlyLimit: 15 },
};

const PROPERTY_TYPE_ALIASES: Record<string, HuntPropertyType> = {
  KONUT: 'KONUT',
  RESIDENTIAL: 'KONUT',
  HOUSE: 'KONUT',
  ISYERI: 'ISYERI',
  IS_YERI: 'ISYERI',
  COMMERCIAL: 'ISYERI',
  ARSA: 'ARSA',
  LAND: 'ARSA',
  KONUT_PROJELERI: 'KONUT_PROJELERI',
  KONUT_PROJESI: 'KONUT_PROJELERI',
  PROJECT: 'KONUT_PROJELERI',
  BINA: 'BINA',
  BUILDING: 'BINA',
  DEVREN_MULK: 'DEVREN_MULK',
  DEVREMULK: 'DEVREN_MULK',
  TIMESHARE: 'DEVREN_MULK',
  TURISTIK_TESIS: 'TURISTIK_TESIS',
  TOURISM: 'TURISTIK_TESIS',
  TOURISTIC_FACILITY: 'TURISTIK_TESIS',
};

const PROPERTY_TYPE_ICONS = {
  KONUT: Home,
  ISYERI: BriefcaseBusiness,
  ARSA: MapIcon,
  KONUT_PROJELERI: Building2,
  BINA: Building,
  DEVREN_MULK: KeyRound,
  TURISTIK_TESIS: BedDouble,
} satisfies Record<HuntPropertyType, typeof Home>;

export type HuntQuotaView = {
  propertyType: HuntPropertyType;
  perRunLimit: number;
  monthlyLimit: number;
  used: number | null;
  remaining: number | null;
  periodStart: string | null;
  periodEnd: string | null;
};

export type HuntScanContext = HuntQuotaView & {
  label: string;
  jobId: string | null;
  requestedResults: number;
};

type HuntCategoryPickerProps = {
  disabled?: boolean;
  loading?: boolean;
  onSelect: (propertyType: HuntPropertyType) => void;
  quotas: HuntQuotaView[];
  selected: HuntPropertyType | '';
};

function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstValue(
  sources: Array<Record<string, unknown> | null>,
  keys: string[]
) {
  for (const source of sources) {
    if (!source) continue;
    for (const key of keys) {
      if (source[key] !== undefined && source[key] !== null) {
        return source[key];
      }
    }
  }
  return undefined;
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.max(0, Math.floor(parsed));
  }
  return null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

export function normalizeHuntPropertyType(
  value: unknown
): HuntPropertyType | null {
  if (typeof value !== 'string') return null;
  const normalized = value
    .trim()
    .toLocaleUpperCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[İI]/g, 'I')
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return PROPERTY_TYPE_ALIASES[normalized] || null;
}

export function getHuntRule(propertyType: HuntPropertyType) {
  return HUNT_RULES[propertyType];
}

export function getHuntPropertyLabel(propertyType: HuntPropertyType) {
  return (
    HUNT_PROPERTY_TYPE_OPTIONS.find((option) => option.value === propertyType)
      ?.label || propertyType
  );
}

function defaultQuota(propertyType: HuntPropertyType): HuntQuotaView {
  const rule = getHuntRule(propertyType);
  return {
    propertyType,
    perRunLimit: rule.perRunLimit,
    monthlyLimit: rule.monthlyLimit,
    used: null,
    remaining: null,
    periodStart: null,
    periodEnd: null,
  };
}

function normalizeQuotaItem(
  value: unknown,
  fallbackPropertyType?: HuntPropertyType | null
): HuntQuotaView | null {
  const source = recordOf(value);
  if (!source) return null;
  const quota = recordOf(source.quota);
  const usage = recordOf(source.usage);
  const limits = recordOf(source.limits);
  const sources = [source, quota, usage, limits];
  const propertyType =
    normalizeHuntPropertyType(
      firstValue(sources, [
        'propertyType',
        'property_type',
        'category',
        'categoryId',
        'type',
      ])
    ) || fallbackPropertyType;
  if (!propertyType) return null;

  const defaults = getHuntRule(propertyType);
  const perRunLimit =
    numberValue(
      firstValue(sources, [
        'perRunLimit',
        'perRun',
        'perClickLimit',
        'batchSize',
        'requestedResults',
        'runLimit',
      ])
    ) ?? defaults.perRunLimit;
  const monthlyLimit =
    numberValue(
      firstValue(sources, [
        'monthlyLimit',
        'monthLimit',
        'limitPerMonth',
        'monthlyTotal',
        'limit',
      ])
    ) ?? defaults.monthlyLimit;
  const explicitUsed = numberValue(
    firstValue(sources, [
      'used',
      'monthlyUsed',
      'usedThisMonth',
      'consumed',
      'usageCount',
    ])
  );
  const explicitRemaining = numberValue(
    firstValue(sources, [
      'remaining',
      'monthlyRemaining',
      'remainingThisMonth',
      'available',
      'left',
    ])
  );
  const remaining =
    explicitRemaining ??
    (explicitUsed === null ? null : Math.max(0, monthlyLimit - explicitUsed));
  const used =
    explicitUsed ??
    (remaining === null ? null : Math.max(0, monthlyLimit - remaining));

  return {
    propertyType,
    perRunLimit,
    monthlyLimit,
    used,
    remaining,
    periodStart: stringValue(
      firstValue(sources, ['periodStart', 'period_start', 'startsAt'])
    ),
    periodEnd: stringValue(
      firstValue(sources, ['periodEnd', 'period_end', 'endsAt', 'resetsAt'])
    ),
  };
}

function quotaCandidates(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const root = recordOf(payload);
  if (!root) return [];
  const data = recordOf(root.data);
  const candidates = [root.items, root.quotas, data?.items, data?.quotas];
  const collection = candidates.find(Array.isArray);
  if (Array.isArray(collection)) return collection;
  if (root.quota) return [root.quota];
  if (data?.quota) return [data.quota];
  return [];
}

export function normalizeHuntQuotaResponse(payload: unknown): HuntQuotaView[] {
  const parsed = new Map<HuntPropertyType, HuntQuotaView>();
  quotaCandidates(payload).forEach((item) => {
    const quota = normalizeQuotaItem(item);
    if (quota) parsed.set(quota.propertyType, quota);
  });

  return HUNT_PROPERTY_TYPE_OPTIONS.map(
    ({ value }) => parsed.get(value) || defaultQuota(value)
  );
}

export function normalizeHuntQuotaSnapshot(
  payload: unknown,
  fallbackPropertyType?: HuntPropertyType | null
) {
  const root = recordOf(payload);
  const data = recordOf(root?.data);
  const propertyType =
    normalizeHuntPropertyType(
      firstValue([root, data], ['propertyType', 'property_type', 'category'])
    ) || fallbackPropertyType;
  return normalizeQuotaItem(data?.quota || root?.quota || payload, propertyType);
}

export function mergeHuntQuota(
  quotas: HuntQuotaView[],
  nextQuota: HuntQuotaView | null
) {
  if (!nextQuota) return quotas;
  return HUNT_PROPERTY_TYPE_OPTIONS.map(({ value }) =>
    value === nextQuota.propertyType
      ? nextQuota
      : quotas.find((quota) => quota.propertyType === value) ||
        defaultQuota(value)
  );
}

export function HuntCategoryPicker({
  disabled = false,
  onSelect,
  selected,
}: HuntCategoryPickerProps) {
  return (
    <fieldset className="space-y-3" data-avci-step="2">
      <legend className="text-sm font-semibold text-slate-100">
        2. Ne tür gayrimenkul arıyorsunuz?
      </legend>

      <div
        className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        data-avci-category-grid
      >
        {HUNT_PROPERTY_TYPE_OPTIONS.map((option) => {
          const isSelected = selected === option.value;
          const isOwnerSourceUnavailable =
            option.value === 'KONUT_PROJELERI';
          const PropertyIcon = PROPERTY_TYPE_ICONS[option.value];
          return (
            <label
              className={`relative flex min-h-20 cursor-pointer flex-col justify-center rounded-xl border p-3.5 transition-colors focus-within:ring-2 focus-within:ring-emerald-300/70 ${
                isSelected
                  ? 'border-emerald-400 bg-emerald-500/12 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.14)]'
                  : 'border-slate-700 bg-slate-950/65 hover:border-slate-600 hover:bg-slate-950'
              } ${
                disabled || isOwnerSourceUnavailable
                  ? 'cursor-not-allowed opacity-55'
                  : ''
              }`}
              data-avci-category
              data-disabled={isOwnerSourceUnavailable || undefined}
              data-selected={isSelected || undefined}
              key={option.value}
            >
              <input
                checked={isSelected}
                className="sr-only"
                disabled={disabled || isOwnerSourceUnavailable}
                name="propertyType"
                onChange={() => onSelect(option.value)}
                type="radio"
                value={option.value}
              />
              <span className="flex items-start justify-between gap-3">
                <span className="flex items-center gap-2.5 font-semibold text-white">
                  <PropertyIcon aria-hidden="true" data-avci-category-icon />
                  {option.label}
                </span>
                {isSelected ? (
                  <CheckCircle2
                    aria-hidden="true"
                    className="h-5 w-5 shrink-0 text-emerald-300"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="h-5 w-5 shrink-0 rounded-full border border-slate-600"
                  />
                )}
              </span>
              {isOwnerSourceUnavailable && (
                <span className="mt-3 grid gap-1">
                  <strong className="text-sm text-amber-200">
                    Yalnız bireysel ilan kaynağı doğrulanamadığı için kapalı
                  </strong>
                </span>
              )}
            </label>
          );
        })}
      </div>

    </fieldset>
  );
}

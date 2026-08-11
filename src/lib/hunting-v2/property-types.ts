export const HUNT_PROPERTY_TYPE_VALUES = [
  'KONUT',
  'ISYERI',
  'ARSA',
  'KONUT_PROJELERI',
  'BINA',
  'DEVREN_MULK',
  'TURISTIK_TESIS',
] as const;

export type HuntPropertyType = (typeof HUNT_PROPERTY_TYPE_VALUES)[number];

export const HUNT_PROPERTY_TYPE_OPTIONS: ReadonlyArray<{
  value: HuntPropertyType;
  label: string;
}> = [
  { value: 'KONUT', label: 'Konut' },
  { value: 'ISYERI', label: 'İşyeri' },
  { value: 'ARSA', label: 'Arsa' },
  { value: 'KONUT_PROJELERI', label: 'Konut Projeleri' },
  { value: 'BINA', label: 'Bina' },
  { value: 'DEVREN_MULK', label: 'Devren Mülk' },
  { value: 'TURISTIK_TESIS', label: 'Turistik Tesis' },
];

export const HUNT_PROPERTY_TYPE_PATHS: Record<HuntPropertyType, string> = {
  KONUT: 'emlak-konut',
  ISYERI: 'is-yeri',
  ARSA: 'arsa',
  KONUT_PROJELERI: 'emlak-projeler',
  BINA: 'bina',
  DEVREN_MULK: 'devre-mulk',
  TURISTIK_TESIS: 'emlak-turistik-tesis',
};

/**
 * Kosovo city constants
 * These constants define the valid cities available in the system
 */
export const CITIES = {
  PRISHTINA: 'Prishtina',
  PRIZREN: 'Prizren',
  GJILAN: 'Gjilan',
  FERIZAJ: 'Ferizaj',
  FUSHE_KOSOVA: 'Fushë Kosova',
  MITROVICE: 'Mitrovicë',
  GJAKOVE: 'Gjakovë',
  PEJA: 'Peja',
  VUSHTRRI: 'Vushtrri',
  PODUJEVA: 'Podujeva',
  RAHOVEC: 'Rahovec',
  LIPJAN: 'Lipjan',
  SUHAREKE: 'Suharekë',
  KACANIK: 'Kaçanik',
  SKENDERAJ: 'Skenderaj',
  OBILIQ: 'Obiliq',
  SHTIME: 'Shtime',
  DRENAS: 'Drenas',
  VITI: 'Viti',
  KLINE: 'Klinë',
  ISTOG: 'Istog',
  KAMENICE: 'Kamenicë',
  GRACANICE: 'Graçanicë',
  MALISHEVE: 'Malishevë',
  DECAN: 'Deçan',
  SHTERPCE: 'Shtërpcë',
  DRAGASH: 'Dragash',
} as const;

export const CITY_VALUES = Object.values(CITIES);

export type City = typeof CITY_VALUES[number];

export default { CITIES, CITY_VALUES };

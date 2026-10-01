export interface AirportProfile {
  country: string;
  latitude: number;
  longitude: number;
  utcOffset: number;
  carriers: string[];
}

// Illustrative carrier pools and airport geography, not live route inventory.
export const AIRPORT_PROFILES: Record<string, AirportProfile> = {
  DEL: { country: 'IN', latitude: 28.6, longitude: 77.1, utcOffset: 330, carriers: ['AI', '6E', 'SG'] },
  BOM: { country: 'IN', latitude: 19.1, longitude: 72.9, utcOffset: 330, carriers: ['AI', '6E', 'QP'] },
  BLR: { country: 'IN', latitude: 13.2, longitude: 77.7, utcOffset: 330, carriers: ['6E', 'QP', 'AI'] },
  MAA: { country: 'IN', latitude: 13, longitude: 80.2, utcOffset: 330, carriers: ['6E', 'IX', 'AI'] },
  CCU: { country: 'IN', latitude: 22.7, longitude: 88.4, utcOffset: 330, carriers: ['6E', 'AI', 'SG'] },
  HYD: { country: 'IN', latitude: 17.2, longitude: 78.4, utcOffset: 330, carriers: ['6E', 'QP', 'AI'] },
  GOI: { country: 'IN', latitude: 15.4, longitude: 73.8, utcOffset: 330, carriers: ['6E', 'IX', 'SG'] },
  COK: { country: 'IN', latitude: 10.2, longitude: 76.4, utcOffset: 330, carriers: ['IX', '6E', 'AI'] },
  AMD: { country: 'IN', latitude: 23.1, longitude: 72.6, utcOffset: 330, carriers: ['6E', 'QP', 'AI'] },
  PNQ: { country: 'IN', latitude: 18.6, longitude: 73.9, utcOffset: 330, carriers: ['6E', 'QP', 'SG'] },
  DXB: { country: 'AE', latitude: 25.3, longitude: 55.4, utcOffset: 240, carriers: ['EK', 'FZ'] },
  AUH: { country: 'AE', latitude: 24.4, longitude: 54.7, utcOffset: 240, carriers: ['EY', '3L'] },
  DOH: { country: 'QA', latitude: 25.3, longitude: 51.6, utcOffset: 180, carriers: ['QR'] },
  JED: { country: 'SA', latitude: 21.7, longitude: 39.2, utcOffset: 180, carriers: ['SV', 'XY'] },
  RUH: { country: 'SA', latitude: 24.9, longitude: 46.7, utcOffset: 180, carriers: ['SV', 'XY'] },
  LHR: { country: 'GB', latitude: 51.5, longitude: -0.5, utcOffset: 0, carriers: ['BA', 'VS'] },
  LGW: { country: 'GB', latitude: 51.1, longitude: -0.2, utcOffset: 0, carriers: ['BA', 'U2'] },
  MAN: { country: 'GB', latitude: 53.4, longitude: -2.3, utcOffset: 0, carriers: ['BA', 'U2'] },
  CDG: { country: 'FR', latitude: 49, longitude: 2.5, utcOffset: 60, carriers: ['AF'] },
  ORY: { country: 'FR', latitude: 48.7, longitude: 2.4, utcOffset: 60, carriers: ['AF', 'TO'] },
  FRA: { country: 'DE', latitude: 50, longitude: 8.6, utcOffset: 60, carriers: ['LH', 'DE'] },
  MUC: { country: 'DE', latitude: 48.4, longitude: 11.8, utcOffset: 60, carriers: ['LH', 'EW'] },
  AMS: { country: 'NL', latitude: 52.3, longitude: 4.8, utcOffset: 60, carriers: ['KL', 'HV'] },
  MAD: { country: 'ES', latitude: 40.5, longitude: -3.6, utcOffset: 60, carriers: ['IB', 'UX'] },
  BCN: { country: 'ES', latitude: 41.3, longitude: 2.1, utcOffset: 60, carriers: ['VY', 'IB'] },
  FCO: { country: 'IT', latitude: 41.8, longitude: 12.3, utcOffset: 60, carriers: ['AZ'] },
  ZRH: { country: 'CH', latitude: 47.5, longitude: 8.5, utcOffset: 60, carriers: ['LX'] },
  IST: { country: 'TR', latitude: 41.3, longitude: 28.7, utcOffset: 180, carriers: ['TK', 'PC'] },
  JFK: { country: 'US', latitude: 40.6, longitude: -73.8, utcOffset: -300, carriers: ['DL', 'AA', 'B6'] },
  EWR: { country: 'US', latitude: 40.7, longitude: -74.2, utcOffset: -300, carriers: ['UA'] },
  LAX: { country: 'US', latitude: 33.9, longitude: -118.4, utcOffset: -480, carriers: ['AA', 'DL', 'UA'] },
  SFO: { country: 'US', latitude: 37.6, longitude: -122.4, utcOffset: -480, carriers: ['UA', 'AS'] },
  ORD: { country: 'US', latitude: 42, longitude: -87.9, utcOffset: -360, carriers: ['UA', 'AA'] },
  ATL: { country: 'US', latitude: 33.6, longitude: -84.4, utcOffset: -300, carriers: ['DL', 'WN'] },
  MIA: { country: 'US', latitude: 25.8, longitude: -80.3, utcOffset: -300, carriers: ['AA', 'DL'] },
  YYZ: { country: 'CA', latitude: 43.7, longitude: -79.6, utcOffset: -300, carriers: ['AC', 'WS'] },
  YVR: { country: 'CA', latitude: 49.2, longitude: -123.2, utcOffset: -480, carriers: ['AC', 'WS'] },
  SIN: { country: 'SG', latitude: 1.4, longitude: 104, utcOffset: 480, carriers: ['SQ', 'TR'] },
  BKK: { country: 'TH', latitude: 13.7, longitude: 100.8, utcOffset: 420, carriers: ['TG', 'VZ'] },
  DMK: { country: 'TH', latitude: 13.9, longitude: 100.6, utcOffset: 420, carriers: ['FD', 'DD'] },
  KUL: { country: 'MY', latitude: 2.7, longitude: 101.7, utcOffset: 480, carriers: ['MH', 'AK'] },
  HKG: { country: 'HK', latitude: 22.3, longitude: 113.9, utcOffset: 480, carriers: ['CX', 'UO'] },
  HND: { country: 'JP', latitude: 35.5, longitude: 139.8, utcOffset: 540, carriers: ['NH', 'JL'] },
  NRT: { country: 'JP', latitude: 35.8, longitude: 140.4, utcOffset: 540, carriers: ['JL', 'NH'] },
  KIX: { country: 'JP', latitude: 34.4, longitude: 135.2, utcOffset: 540, carriers: ['NH', 'JL', 'MM'] },
  ICN: { country: 'KR', latitude: 37.5, longitude: 126.5, utcOffset: 540, carriers: ['KE', 'OZ'] },
  PEK: { country: 'CN', latitude: 40.1, longitude: 116.6, utcOffset: 480, carriers: ['CA', 'HU'] },
  PVG: { country: 'CN', latitude: 31.1, longitude: 121.8, utcOffset: 480, carriers: ['MU', 'CA'] },
  SYD: { country: 'AU', latitude: -33.9, longitude: 151.2, utcOffset: 600, carriers: ['QF', 'VA', 'JQ'] },
  MEL: { country: 'AU', latitude: -37.7, longitude: 144.8, utcOffset: 600, carriers: ['QF', 'JQ', 'VA'] },
  BNE: { country: 'AU', latitude: -27.4, longitude: 153.1, utcOffset: 600, carriers: ['VA', 'QF', 'JQ'] },
  AKL: { country: 'NZ', latitude: -37, longitude: 174.8, utcOffset: 720, carriers: ['NZ', 'JQ'] },
  JNB: { country: 'ZA', latitude: -26.1, longitude: 28.2, utcOffset: 120, carriers: ['SA', '4Z'] },
  CPT: { country: 'ZA', latitude: -34, longitude: 18.6, utcOffset: 120, carriers: ['4Z', 'SA'] },
  ADD: { country: 'ET', latitude: 9, longitude: 38.8, utcOffset: 180, carriers: ['ET'] },
  NBO: { country: 'KE', latitude: -1.3, longitude: 36.9, utcOffset: 180, carriers: ['KQ'] },
  GRU: { country: 'BR', latitude: -23.4, longitude: -46.5, utcOffset: -180, carriers: ['LA', 'G3'] },
};

export const SIMULATED_CARRIERS: Record<string, string> = {
  FZ: 'FLYDUBAI', EY: 'ETIHAD AIRWAYS', '3L': 'AIR ARABIA ABU DHABI', SV: 'SAUDIA', XY: 'FLYNAS',
  VS: 'VIRGIN ATLANTIC', U2: 'EASYJET', TO: 'TRANSAVIA FRANCE', DE: 'CONDOR', EW: 'EUROWINGS',
  KL: 'KLM', HV: 'TRANSAVIA', IB: 'IBERIA', UX: 'AIR EUROPA', VY: 'VUELING', AZ: 'ITA AIRWAYS', LX: 'SWISS', TK: 'TURKISH AIRLINES', PC: 'PEGASUS',
  DL: 'DELTA AIR LINES', B6: 'JETBLUE', UA: 'UNITED AIRLINES', AS: 'ALASKA AIRLINES', WN: 'SOUTHWEST', AC: 'AIR CANADA', WS: 'WESTJET',
  TR: 'SCOOT', TG: 'THAI AIRWAYS', VZ: 'THAI VIETJET', FD: 'THAI AIRASIA', DD: 'NOK AIR', MH: 'MALAYSIA AIRLINES', AK: 'AIRASIA', CX: 'CATHAY PACIFIC', UO: 'HK EXPRESS',
  NH: 'ANA', JL: 'JAPAN AIRLINES', MM: 'PEACH', KE: 'KOREAN AIR', OZ: 'ASIANA', CA: 'AIR CHINA', HU: 'HAINAN AIRLINES', MU: 'CHINA EASTERN',
  QF: 'QANTAS', VA: 'VIRGIN AUSTRALIA', JQ: 'JETSTAR', NZ: 'AIR NEW ZEALAND', SA: 'SOUTH AFRICAN AIRWAYS', '4Z': 'AIRLINK', ET: 'ETHIOPIAN AIRLINES', KQ: 'KENYA AIRWAYS', LA: 'LATAM', G3: 'GOL',
};

export const ECONOMY_ONLY_CARRIERS = new Set(['6E', 'QP', 'IX', 'SG', 'FZ', '3L', 'XY', 'U2', 'TO', 'EW', 'HV', 'VY', 'PC', 'WN', 'TR', 'VZ', 'FD', 'DD', 'AK', 'UO', 'MM', 'JQ', 'G3']);

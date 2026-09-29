import { PnrState, SimulatorSession } from '../types/gds';

export const AIRPORTS: Record<string, { city: string; country: string; name: string }> = {
  DEL: { city: 'DELHI', country: 'INDIA', name: 'Indira Gandhi Intl' },
  BOM: { city: 'MUMBAI', country: 'INDIA', name: 'Chhatrapati Shivaji Intl' },
  BLR: { city: 'BENGALURU', country: 'INDIA', name: 'Kempegowda Intl' },
  MAA: { city: 'CHENNAI', country: 'INDIA', name: 'Chennai Intl' },
  CCU: { city: 'KOLKATA', country: 'INDIA', name: 'Netaji Subhas Chandra Bose' },
  DXB: { city: 'DUBAI', country: 'UAE', name: 'Dubai Intl' },
  LHR: { city: 'LONDON', country: 'UK', name: 'Heathrow' },
  JFK: { city: 'NEW YORK', country: 'USA', name: 'John F Kennedy' },
  SIN: { city: 'SINGAPORE', country: 'SINGAPORE', name: 'Changi Intl' },
  CDG: { city: 'PARIS', country: 'FRANCE', name: 'Charles de Gaulle' },
  FRA: { city: 'FRANKFURT', country: 'GERMANY', name: 'Frankfurt Airport' },
  DOH: { city: 'DOHA', country: 'QATAR', name: 'Hamad Intl' },
  BKK: { city: 'BANGKOK', country: 'THAILAND', name: 'Suvarnabhumi' },
  SYD: { city: 'SYDNEY', country: 'AUSTRALIA', name: 'Kingsford Smith' },
  HND: { city: 'TOKYO', country: 'JAPAN', name: 'Haneda Airport' },
};

export const AIRLINES: Record<string, { name: string; ticketPrefix: string }> = {
  AI: { name: 'AIR INDIA', ticketPrefix: '098' },
  '6E': { name: 'INDIGO', ticketPrefix: '312' },
  UK: { name: 'VISTARA', ticketPrefix: '228' },
  BA: { name: 'BRITISH AIRWAYS', ticketPrefix: '125' },
  EK: { name: 'EMIRATES', ticketPrefix: '176' },
  SQ: { name: 'SINGAPORE AIRLINES', ticketPrefix: '618' },
  QR: { name: 'QATAR AIRWAYS', ticketPrefix: '157' },
  AF: { name: 'AIR FRANCE', ticketPrefix: '057' },
  LH: { name: 'LUFTHANSA', ticketPrefix: '220' },
  AA: { name: 'AMERICAN AIRLINES', ticketPrefix: '001' },
};

export const INITIAL_PNR: PnrState = {
  recordLocator: null,
  status: 'IN_CREATION',
  passengers: [],
  segments: [],
  contacts: [],
  ticketingArrangement: null,
  receivedFrom: null,
  fare: {
    priced: false,
    baseFarePerPax: 0,
    taxesPerPax: 0,
    totalPerPax: 0,
    totalAllPax: 0,
    currency: 'INR',
    fareBasis: '',
    pricingCommand: '',
  },
  ticket: {
    issued: false,
    ticketNumbers: [],
    status: 'OPEN',
  },
  ssrs: [],
  osis: [],
  remarks: [],
  lastUpdated: new Date().toISOString(),
  historyLog: [],
};

export function generateRecordLocator(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function generateTicketNumber(airlineCode: string): string {
  const prefix = AIRLINES[airlineCode]?.ticketPrefix || '098';
  const randomTen = Math.floor(1000000000 + Math.random() * 9000000000);
  return `${prefix}-${randomTen}`;
}

export function createInitialSession(sessionId?: string, title?: string): SimulatorSession {
  const now = new Date().toISOString();
  return {
    id: sessionId || 'session_' + Math.random().toString(36).substring(2, 9),
    title: title || 'Session ' + new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
    createdAt: now,
    updatedAt: now,
    pnr: JSON.parse(JSON.stringify(INITIAL_PNR)),
    terminalHistory: [
      {
        id: 'welcome-1',
        timestamp: new Date().toLocaleTimeString(),
        command: 'HE',
        response: `--- AMADEUS GDS SIMULATION ENVIRONMENT ---
ALL FLIGHT DATA, FARES, PNRS, AND TICKETS ARE SIMULATED.
TERMINAL SIGN-IN OK: 1234AA/SU DEL1A0987 - AAA ACTIVE.

Type HELP or select a training module on the right.
Quick start: AN15AUGDELBOM -> SS1Y1 -> NM1SMITH/JOHN MR
             -> AP DEL 9876543210 -> TKTL15AUG -> RF JOHN -> FXP -> ER -> TTP`,
        isAiGenerated: false,
        status: 'info',
        category: 'SYSTEM',
        explanation: 'Amadeus terminal initialized. Enter cryptic commands at the prompt below.',
      },
    ],
    lastAvailability: [],
    commandQueue: [],
  };
}

// Types for Amadeus GDS Data Structures and Simulation

export interface FlightAvailabilityOption {
  line: number;
  airlineCode: string;
  airlineName: string;
  flightNumber: string;
  classes: { code: string; seats: string }[];
  origin: string;
  destination: string;
  depTime: string;
  arrTime: string;
  aircraft: string;
  duration: string;
  dateStr: string;
  stops: number;
}

export interface PnrPassenger {
  id: string;
  line: number;
  lastName: string;
  firstName: string;
  title: string;
  type?: 'ADT' | 'CHD' | 'INF';
}

export interface PnrSegment {
  id: string;
  line: number;
  airlineCode: string;
  flightNumber: string;
  bookingClass: string;
  seats: number;
  status: 'HK' | 'SS' | 'RR' | 'TK' | 'HX';
  origin: string;
  destination: string;
  depDate: string;
  depTime: string;
  arrTime: string;
  aircraft?: string;
}

export interface PnrContact {
  id: string;
  city: string;
  numberOrEmail: string;
  type: 'PHONE' | 'EMAIL';
}

export interface PnrFare {
  priced: boolean;
  baseFarePerPax: number;
  taxesPerPax: number;
  totalPerPax: number;
  totalAllPax: number;
  currency: string;
  fareBasis: string;
  pricingCommand: string;
  pricedAt?: string;
}

export interface PnrTicket {
  issued: boolean;
  ticketNumbers: { passengerId: string; passengerName: string; number: string }[];
  issuedAt?: string;
  agentRef?: string;
  status: 'OPEN' | 'ISSUED' | 'VOID';
}

export interface PnrSSR {
  id: string;
  code: string;
  details: string;
  status?: string;
}

export interface PnrOSI {
  id: string;
  airline: string;
  text: string;
}

export interface PnrRemark {
  id: string;
  type: 'RM' | 'RC' | 'RI';
  text: string;
}

export interface PnrState {
  recordLocator: string | null;
  status: 'IN_CREATION' | 'SAVED' | 'TICKETED' | 'CANCELLED';
  passengers: PnrPassenger[];
  segments: PnrSegment[];
  contacts: PnrContact[];
  ticketingArrangement: string | null; // e.g. TK TL 15AUG OR TK OK
  receivedFrom: string | null;
  fare: PnrFare;
  ticket: PnrTicket;
  ssrs: PnrSSR[];
  osis: PnrOSI[];
  remarks: PnrRemark[];
  queueRef?: string | null;
  lastUpdated: string;
  historyLog: string[];
}

export interface TerminalEntry {
  id: string;
  timestamp: string;
  command: string;
  response: string;
  isAiGenerated: boolean;
  status: 'success' | 'error' | 'warning' | 'info';
  category?: string;
  explanation?: string;
}

export interface SimulatorSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  pnr: PnrState;
  savedPnr?: PnrState;
  terminalHistory: TerminalEntry[];
  lastAvailability: FlightAvailabilityOption[];
  commandQueue: string[];
}

export interface SimulatorUser {
  id: string;
  email: string;
  name: string;
  agencyName: string;
  sineCode: string; // e.g. 1234AA
  pcc: string; // e.g. DEL1A0987
  isGuest: boolean;
}

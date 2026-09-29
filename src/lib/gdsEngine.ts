import {
  FlightAvailabilityOption,
  PnrSegment,
  PnrState,
} from '../types/gds';
import {
  AIRPORTS,
  AIRLINES,
  generateRecordLocator,
  generateTicketNumber,
  INITIAL_PNR,
} from './gdsConstants';

export interface CommandExecutionResult {
  output: string;
  updatedPnr: PnrState;
  updatedAvailability?: FlightAvailabilityOption[];
  status: 'success' | 'error' | 'warning' | 'info';
  explanation?: string;
  category: string;
  shouldAskAi?: boolean;
}

// Generate deterministic mock availability
export function generateMockAvailability(
  dateStr: string,
  origin: string,
  dest: string,
  airlineFilter?: string
): FlightAvailabilityOption[] {
  const originCode = origin.toUpperCase();
  const destCode = dest.toUpperCase();
  const formattedDate = dateStr.toUpperCase();

  const flightTemplates = [
    {
      airline: 'AI',
      number: '865',
      dep: '0750',
      arr: '0950',
      craft: '32N',
      dur: '2:00',
      stops: 0,
      classes: 'J9 C9 D9 I9 Y9 B9 M9 H9 K9',
    },
    {
      airline: '6E',
      number: '533',
      dep: '0930',
      arr: '1140',
      craft: '320',
      dur: '2:10',
      stops: 0,
      classes: 'J9 C9 D9 I9 Y9 B9 M9 H9 K9',
    },
    {
      airline: 'UK',
      number: '995',
      dep: '1215',
      arr: '1425',
      craft: '789',
      dur: '2:10',
      stops: 0,
      classes: 'J4 C4 D2 Y9 B9 M9 H9 Q4 V0',
    },
    {
      airline: 'AI',
      number: '887',
      dep: '1600',
      arr: '1810',
      craft: '77W',
      dur: '2:10',
      stops: 0,
      classes: 'F2 A2 J6 C4 Y9 B9 M9 H9 K9',
    },
    {
      airline: '6E',
      number: '201',
      dep: '1945',
      arr: '2155',
      craft: '321',
      dur: '2:10',
      stops: 0,
      classes: 'Y9 B9 M9 H9 K9 Q9 L9 V0',
    },
    {
      airline: 'BA',
      number: '142',
      dep: '0315',
      arr: '0830',
      craft: '777',
      dur: '9:45',
      stops: 0,
      classes: 'F4 J9 C9 W9 Y9 B9 M9',
    },
    {
      airline: 'EK',
      number: '511',
      dep: '1030',
      arr: '1245',
      craft: '388',
      dur: '3:45',
      stops: 0,
      classes: 'F4 A2 J7 C7 Y9 B9 M9',
    },
  ];

  const filtered = airlineFilter
    ? flightTemplates.filter((f) => f.airline.toUpperCase() === airlineFilter.toUpperCase())
    : flightTemplates;

  return filtered.slice(0, 5).map((t, idx) => {
    const classTokens = t.classes.split(' ').map((tok) => ({
      code: tok.charAt(0),
      seats: tok.substring(1),
    }));
    return {
      line: idx + 1,
      airlineCode: t.airline,
      airlineName: AIRLINES[t.airline]?.name || t.airline,
      flightNumber: t.number,
      classes: classTokens,
      origin: originCode,
      destination: destCode,
      depTime: t.dep,
      arrTime: t.arr,
      aircraft: t.craft,
      duration: t.dur,
      dateStr: formattedDate,
      stops: t.stops,
    };
  });
}

// Format availability screen in true Amadeus monospace style
export function formatAvailabilityScreen(
  dateStr: string,
  origin: string,
  dest: string,
  flights: FlightAvailabilityOption[]
): string {
  const originInfo = AIRPORTS[origin] ? `${origin}` : origin;
  const destInfo = AIRPORTS[dest] ? `${dest}` : dest;

  let output = `${dateStr.toUpperCase()} ${originInfo} ${destInfo} \n\n** AMADEUS AVAILABILITY - AN **\n\n`;

  flights.forEach((f) => {
    const classStr = f.classes.map((c) => `${c.code}${c.seats}`).join(' ');
    output += `${f.line} ${f.airlineCode} ${f.flightNumber.padEnd(4, ' ')} ${classStr}\n`;
    output += `  ${f.origin} ${f.destination} ${f.depTime} ${f.arrTime} ${f.aircraft} ${f.duration}\n\n`;
  });

  output += `SIMULATED SCHEDULES - NOT LIVE GDS DATA`;
  return output;
}

// Format PNR in realistic Amadeus cryptic format (RT display)
export function formatPnrDisplay(pnr: PnrState): string {
  if (
    pnr.passengers.length === 0 &&
    pnr.segments.length === 0 &&
    pnr.contacts.length === 0
  ) {
    return 'NO PNR IN AAA';
  }

  const locator = pnr.recordLocator || '---/---';
  let lines: string[] = [];

  // PNR Header line
  lines.push(`--- RLR ---`);
  lines.push(`RP/DEL1A0987/1234AA            ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()}  ${locator}`);

  // Passengers
  pnr.passengers.forEach((p, idx) => {
    lines.push(` ${idx + 1}.${p.lastName}/${p.firstName} ${p.title}`);
  });

  // Flight Segments
  let segIdx = pnr.passengers.length;
  pnr.segments.forEach((s) => {
    segIdx += 1;
    lines.push(
      ` ${segIdx}  ${s.airlineCode} ${s.flightNumber.padEnd(4, ' ')} ${s.bookingClass} ${s.depDate}  ${s.origin}${s.destination} ${s.status}${s.seats}  ${s.depTime} ${s.arrTime}  ${s.aircraft || '320'}`
    );
  });

  // Contacts (AP)
  pnr.contacts.forEach((c) => {
    segIdx += 1;
    lines.push(` ${segIdx} AP ${c.city} ${c.numberOrEmail}`);
  });

  // Ticketing (TK)
  if (pnr.ticketingArrangement) {
    segIdx += 1;
    lines.push(` ${segIdx} TK ${pnr.ticketingArrangement}`);
  }

  // SSRs
  pnr.ssrs.forEach((ssr) => {
    segIdx += 1;
    lines.push(` ${segIdx} SSR ${ssr.code} ${ssr.details}`);
  });

  // OSIs
  pnr.osis.forEach((osi) => {
    segIdx += 1;
    lines.push(` ${segIdx} OS ${osi.airline} ${osi.text}`);
  });

  // Remarks
  pnr.remarks.forEach((rm) => {
    segIdx += 1;
    lines.push(` ${segIdx} ${rm.type} ${rm.text}`);
  });

  // Received from
  if (pnr.receivedFrom) {
    lines.push(`\nRECEIVED FROM - ${pnr.receivedFrom}`);
  }

  // Pricing summary if priced
  if (pnr.fare.priced) {
    lines.push(`\n** TST 00001 CREATED - ${pnr.fare.fareBasis} **`);
    lines.push(
      `FARE: ${pnr.fare.currency} ${pnr.fare.baseFarePerPax}  TAX: ${pnr.fare.currency} ${pnr.fare.taxesPerPax}  TOTAL: ${pnr.fare.currency} ${pnr.fare.totalPerPax} PER PAX`
    );
  }

  // Ticket status
  if (pnr.ticket.issued) {
    lines.push(`\n** ELECTRONIC TICKETS ISSUED **`);
    pnr.ticket.ticketNumbers.forEach((t) => {
      lines.push(`FA PAX ${t.passengerName} ETKT ${t.number}`);
    });
  }

  lines.push(`\nSIMULATED PNR - TRAINING PURPOSES ONLY`);
  return lines.join('\n');
}

// Format Fare Quote Pricing (FXP / FXX)
export function formatFareQuote(pnr: PnrState, storeTst: boolean): string {
  if (pnr.segments.length === 0) {
    return 'NO ITINERARY TO PRICE';
  }
  if (pnr.passengers.length === 0) {
    return 'NO PASSENGER IN PNR';
  }

  const paxCount = pnr.passengers.length;
  const baseRate = 6500;
  const taxes = 1250;
  const totalSingle = baseRate + taxes;
  const grandTotal = totalSingle * paxCount;

  let out = `--------------------------------------------------\n`;
  out += `AMADEUS FARE QUOTATION - SIMULATED PRICING\n`;
  out += `--------------------------------------------------\n`;
  out += `PAX  ITIN                FARE BASIS    CURR  BASE     TAX     TOTAL\n`;
  out += `01   ${pnr.segments.map((s) => s.origin + s.destination).join('/')}   YFLEXIN       INR   ${baseRate}     ${taxes}    ${totalSingle}\n`;

  if (paxCount > 1) {
    out += `TOTAL FOR ${paxCount} PASSENGERS: INR ${grandTotal}\n`;
  } else {
    out += `GRAND TOTAL: INR ${totalSingle}\n`;
  }

  out += `BAGGAGE ALLOWANCE: 1PC 15KG\n`;
  out += `PENALTIES: CHANGES INR 2500 / CANCEL INR 3500\n`;

  if (storeTst) {
    out += `\nTST 00001 STORED SUCCESSFULLY.\nREADY FOR TICKETING (TTP).`;
  } else {
    out += `\nNO TST STORED (INFORMATIONAL FARE DISPLAY).`;
  }
  return out;
}

// Core deterministic GDS command execution
export function executeGdsCommand(
  rawCmd: string,
  currentPnr: PnrState,
  lastAvailability: FlightAvailabilityOption[],
  savedPnr?: PnrState
): CommandExecutionResult {
  const cmd = rawCmd.trim().toUpperCase();
  const pnr = JSON.parse(JSON.stringify(currentPnr)) as PnrState;

  if (!cmd) {
    return {
      output: 'ENTER A VALID AMADEUS COMMAND (OR TYPE HELP)',
      updatedPnr: pnr,
      status: 'warning',
      category: 'GENERAL',
    };
  }

  // 1. HELP / HE
  if (cmd === 'HELP' || cmd === 'HE' || cmd.startsWith('HELP ')) {
    return {
      output: `================ AMADEUS CRYPTIC COMMAND CHEAT SHEET ================
AVAILABILITY:
  AN15AUGDELBOM         - Flight Availability on 15AUG DEL to BOM
  AN20SEPBOMDEL/AI      - Availability filtered for Air India (AI)

SELL SEGMENT:
  SS1Y1                 - Sell 1 seat in Y class from availability line 1
  SS2J3                 - Sell 2 seats in J class from availability line 3

PASSENGERS:
  NM1SMITH/JOHN MR      - Add 1 passenger: MR JOHN SMITH
  NM2YADAV/SIMS MS/YADAV/RAHUL MR - Add 2 passengers

CONTACT & TICKETING:
  AP DEL 9876543210     - Add agency contact phone in Delhi
  APE AGENT@TRAVEL.COM  - Add contact email
  TKTL15AUG             - Set ticketing time limit to 15AUG
  TKOK                  - Mark ticketing arrangement OK

RECEIVED FROM & END TRANSACTION:
  RF JOHN               - Received From passenger or agent John
  ER                    - End and Retrieve (saves PNR & assigns Record Locator)
  ET                    - End Transaction (saves without immediate display)
  RT                    - Retrieve active PNR in AAA work area
  IR                    - Ignore and Retrieve active PNR
  IG                    - Ignore transaction (clears unsaved changes)

PRICING & TICKETING:
  FXP                   - Price current itinerary & store TST
  FXX                   - Price without storing TST (Informational)
  TTP                   - Issue simulated electronic tickets (requires stored TST)

CANCEL / REMOVE:
  XE1                   - Cancel segment or element number 1
  XI                    - Cancel entire flight itinerary

SPECIAL REQUESTS & REMARKS:
  SR VGML               - Special Service Request: Vegetarian Meal
  SR WCHR               - Special Service Request: Wheelchair
  OS YY VIP PASSENGER   - Other Service Information
  RM PASSENGER CELEBRATING ANNIVERSARY - General remark

INFO & CONVERSIONS:
  DD DEL                - Airport / City information
  DC 100USD/INR         - Currency converter simulation
======================================================================`,
      updatedPnr: pnr,
      status: 'info',
      category: 'HELP',
      explanation: 'Cryptic command manual for trainees and travel professionals.',
    };
  }

  // 2. AVAILABILITY (AN, AD, SN)
  // Format: AN<DATE><ORIGIN><DEST>[/AIRLINE] e.g. AN15AUGDELBOM or AN15AUGDELBOM/AI
  const anMatch = cmd.match(/^(?:AN|AD|SN)(\d{1,2}[A-Z]{3})([A-Z]{3})([A-Z]{3})(?:\/([A-Z0-9]{2}))?$/);
  if (anMatch) {
    const [, dateStr, origin, dest, airlineFilter] = anMatch;
    const month = dateStr.slice(-3);
    const day = Number(dateStr.slice(0, -3));
    if (!'JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC'.split(' ').includes(month) || day < 1 || day > 31 || origin === dest || !AIRPORTS[origin] || !AIRPORTS[dest]) {
      return { output: 'INVALID DATE OR CITY PAIR', updatedPnr: pnr, status: 'error', category: 'AVAILABILITY' };
    }
    const flights = generateMockAvailability(dateStr, origin, dest, airlineFilter);
    const screen = flights.length ? formatAvailabilityScreen(dateStr, origin, dest, flights) : `NO FLIGHTS FOUND FOR CARRIER ${airlineFilter} - SIMULATED DATA`;
    return {
      output: screen,
      updatedPnr: pnr,
      updatedAvailability: flights,
      status: 'success',
      category: 'AVAILABILITY',
      explanation: `Availability retrieved for ${origin} to ${dest} on ${dateStr}${airlineFilter ? ` via ${airlineFilter}` : ''}. Use SS to sell seats (e.g., SS1Y1).`,
    };
  }

  // Alternate AN format without date (defaults to today + 7 days)
  const anNoDateMatch = cmd.match(/^(?:AN|AD|SN)([A-Z]{3})([A-Z]{3})$/);
  if (anNoDateMatch) {
    const [, origin, dest] = anNoDateMatch;
    const today = new Date();
    today.setDate(today.getDate() + 7);
    const defaultDate = today.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase().replace(' ', '');
    const flights = generateMockAvailability(defaultDate, origin, dest);
    return {
      output: formatAvailabilityScreen(defaultDate, origin, dest, flights),
      updatedPnr: pnr,
      updatedAvailability: flights,
      status: 'success',
      category: 'AVAILABILITY',
      explanation: `Default 7-day advance availability displayed for ${origin}-${dest}.`,
    };
  }

  // 3. SELL SEGMENT (SS)
  // Format: SS<seats><class><line> e.g. SS1Y1 or SS3J2
  const ssMatch = cmd.match(/^SS(\d+)([A-Z])(\d+)$/);
  if (ssMatch) {
    const seats = parseInt(ssMatch[1], 10);
    const bookingClass = ssMatch[2];
    const lineNum = parseInt(ssMatch[3], 10);

    if (lastAvailability.length === 0) {
      return {
        output: 'NO ACTIVE AVAILABILITY DISPLAY. RUN AN<DATE><ORG><DST> FIRST (e.g. AN15AUGDELBOM)',
        updatedPnr: pnr,
        status: 'error',
        category: 'SELL',
        explanation: 'Before selling seats with SS, search for flights using the AN command.',
      };
    }

    const flightOpt = lastAvailability.find((f) => f.line === lineNum);
    if (!flightOpt) {
      return {
        output: `INVALID LINE NUMBER ${lineNum}. CURRENT DISPLAY HAS 1-${lastAvailability.length} LINES`,
        updatedPnr: pnr,
        status: 'error',
        category: 'SELL',
      };
    }

    const classFound = flightOpt.classes.find((c) => c.code === bookingClass);
    if (!classFound || seats < 1 || seats > Number(classFound.seats)) {
      return {
        output: `SEGMENT NOT AVAILABLE - ${seats} SEAT(S) IN CLASS ${bookingClass} ON LINE ${lineNum}`,
        updatedPnr: pnr,
        status: 'error',
        category: 'SELL',
      };
    }
    if (pnr.ticket.issued) return { output: 'TICKETED PNR - CANNOT MODIFY ITINERARY', updatedPnr: pnr, status: 'error', category: 'SELL' };

    const newSegment: PnrSegment = {
      id: 'seg_' + Math.random().toString(36).substring(2, 7),
      line: pnr.segments.length + 1,
      airlineCode: flightOpt.airlineCode,
      flightNumber: flightOpt.flightNumber,
      bookingClass,
      seats,
      status: 'HK',
      origin: flightOpt.origin,
      destination: flightOpt.destination,
      depDate: flightOpt.dateStr,
      depTime: flightOpt.depTime,
      arrTime: flightOpt.arrTime,
      aircraft: flightOpt.aircraft,
    };

    pnr.segments.push(newSegment);
    pnr.fare.priced = false; // Reset pricing on itinerary change
    pnr.lastUpdated = new Date().toISOString();

    const segIndex = pnr.passengers.length + pnr.segments.length;
    return {
      output: `${segIndex} ${newSegment.airlineCode} ${newSegment.flightNumber.padEnd(4, ' ')} ${newSegment.bookingClass} ${newSegment.depDate} ${newSegment.origin}${newSegment.destination} HK${newSegment.seats} ${newSegment.depTime} ${newSegment.arrTime}`,
      updatedPnr: pnr,
      status: 'success',
      category: 'SELL',
      explanation: `Successfully sold ${seats} seat(s) in class ${bookingClass}. Add passenger name with NM1... if not done yet.`,
    };
  }

  // 4. PASSENGER NAMES (NM)
  // Format: NM1<LASTNAME>/<FIRSTNAME> <TITLE> or multi pax NM2...
  if (cmd.startsWith('NM')) {
    const rawPax = cmd.substring(2).trim();
    if (!rawPax) {
      return {
        output: 'INVALID FORMAT. USE: NM1LASTNAME/FIRSTNAME MR',
        updatedPnr: pnr,
        status: 'error',
        category: 'NAME',
      };
    }

    // Check count prefix e.g. 1SMITH/JOHN MR or 2DOE/JANE MS/DOE/JOHN MR
    const countMatch = rawPax.match(/^(\d)(.*)$/);
    if (!countMatch) {
      return {
        output: 'INVALID NUMBER OF NAMES. EXPECTED NM1... OR NM2...',
        updatedPnr: pnr,
        status: 'error',
        category: 'NAME',
      };
    }

    const expectedCount = parseInt(countMatch[1], 10);
    const namesPart = countMatch[2];
    const matches = [...namesPart.matchAll(/\/?([A-Z][A-Z'-]*)\/([A-Z][A-Z '-]*?)\s+(MR|MS|MRS|MISS|MSTR|DR)(?=\/|$)/g)];
    const parsedPassengers = matches.map((match) => ({ lastName: match[1], firstName: match[2].trim(), title: match[3] }));
    const consumed = matches.map((match) => match[0]).join('');
    if (expectedCount < 1 || parsedPassengers.length !== expectedCount || consumed !== namesPart) {
      return {
        output: 'INVALID NUMBER OF NAMES OR NAME FORMAT. USE NM1SMITH/JOHN MR',
        updatedPnr: pnr,
        status: 'error',
        category: 'NAME',
      };
    }

    parsedPassengers.forEach((p) => {
      pnr.passengers.push({
        id: 'pax_' + Math.random().toString(36).substring(2, 7),
        line: pnr.passengers.length + 1,
        lastName: p.lastName,
        firstName: p.firstName,
        title: p.title,
      });
    });

    pnr.lastUpdated = new Date().toISOString();
    let out = '';
    pnr.passengers.forEach((p, idx) => {
      out += ` ${idx + 1}.${p.lastName}/${p.firstName} ${p.title}\n`;
    });

    return {
      output: out.trimEnd(),
      updatedPnr: pnr,
      status: 'success',
      category: 'NAME',
      explanation: `Added ${parsedPassengers.length} passenger(s) to PNR.`,
    };
  }

  // 5. CONTACT (AP / APE)
  if (cmd.startsWith('AP')) {
    const isEmail = cmd.startsWith('APE');
    const content = (isEmail ? cmd.substring(3) : cmd.substring(2)).trim();
    if (!content) {
      return {
        output: 'INVALID FORMAT. USE: AP DEL 9876543210 OR APE AGENT@AIR.COM',
        updatedPnr: pnr,
        status: 'error',
        category: 'CONTACT',
      };
    }

    const tokens = content.split(' ');
    const city = tokens[0].length === 3 ? tokens[0] : 'DEL';
    const contactVal = tokens.slice(tokens[0].length === 3 ? 1 : 0).join(' ') || content;

    pnr.contacts.push({
      id: 'cnt_' + Math.random().toString(36).substring(2, 7),
      city,
      numberOrEmail: contactVal,
      type: isEmail ? 'EMAIL' : 'PHONE',
    });

    const index = pnr.passengers.length + pnr.segments.length + pnr.contacts.length;
    return {
      output: ` ${index} AP ${city} ${contactVal}`,
      updatedPnr: pnr,
      status: 'success',
      category: 'CONTACT',
      explanation: 'Contact element added to PNR.',
    };
  }

  // 6. TICKETING ARRANGEMENT (TK)
  if (cmd.startsWith('TK')) {
    const arrangement = cmd.substring(2).trim();
    if (!arrangement) {
      return {
        output: 'INVALID FORMAT. USE TKTL15AUG OR TKOK',
        updatedPnr: pnr,
        status: 'error',
        category: 'TICKETING',
      };
    }
    pnr.ticketingArrangement = arrangement;
    pnr.lastUpdated = new Date().toISOString();
    return {
      output: `TK ${arrangement}`,
      updatedPnr: pnr,
      status: 'success',
      category: 'TICKETING',
      explanation: `Ticketing arrangement set to ${arrangement}.`,
    };
  }

  // 7. RECEIVED FROM (RF)
  if (cmd.startsWith('RF')) {
    const receivedFrom = cmd.substring(2).trim();
    if (!receivedFrom) {
      return {
        output: 'INVALID RECEIVED FROM ENTRY. USE: RF JOHN OR RF PAX',
        updatedPnr: pnr,
        status: 'error',
        category: 'TRANSACTION',
      };
    }
    pnr.receivedFrom = receivedFrom;
    return {
      output: `RF ${receivedFrom}`,
      updatedPnr: pnr,
      status: 'success',
      category: 'TRANSACTION',
      explanation: `Received From field set. You can now end transaction with ER or ET.`,
    };
  }

  // 8. END TRANSACTION & RETRIEVE (ER, ET)
  if (cmd === 'ER' || cmd === 'ET') {
    // Validate mandatory Amadeus PNR elements: Names, Segments, Contacts, Ticketing, Received-from
    const missing: string[] = [];
    if (pnr.passengers.length === 0) missing.push('NAME (NM)');
    if (pnr.segments.length === 0) missing.push('ITINERARY (SS)');
    if (pnr.contacts.length === 0) missing.push('CONTACT (AP)');
    if (!pnr.ticketingArrangement) missing.push('TICKETING ARRANGEMENT (TKTL/TKOK)');
    if (!pnr.receivedFrom) missing.push('RECEIVED FROM (RF)');

    if (missing.length > 0) {
      return {
        output: `TRANSACTION REJECTED - MISSING MANDATORY ELEMENT:\n* ${missing.join('\n* ')}`,
        updatedPnr: pnr,
        status: 'error',
        category: 'TRANSACTION',
        explanation: 'Amadeus requires all 5 basic PNR elements (PRINT rule) before ER can complete.',
      };
    }

    if (!pnr.recordLocator) {
      pnr.recordLocator = generateRecordLocator();
    }
    if (!pnr.ticket.issued) pnr.status = 'SAVED';
    pnr.lastUpdated = new Date().toISOString();

    if (cmd === 'ET') {
      return {
        output: `TRANSACTION COMPLETED - RECORD LOCATOR: ${pnr.recordLocator}`,
        updatedPnr: pnr,
        status: 'success',
        category: 'TRANSACTION',
        explanation: `Transaction ended. Record Locator ${pnr.recordLocator} generated. Use RT to view.`,
      };
    }

    // ER displays the PNR immediately
    return {
      output: formatPnrDisplay(pnr),
      updatedPnr: pnr,
      status: 'success',
      category: 'TRANSACTION',
      explanation: `PNR confirmed with simulated Record Locator ${pnr.recordLocator}.`,
    };
  }

  // 9. RETRIEVE PNR (RT)
  if (cmd === 'RT' || cmd.startsWith('RT ')) {
    const pnrDisp = formatPnrDisplay(pnr);
    return {
      output: pnrDisp,
      updatedPnr: pnr,
      status: 'info',
      category: 'PNR_RETRIEVE',
      explanation: 'Active PNR retrieved from AAA work area.',
    };
  }

  // 10. IGNORE (IG, IR)
  if (cmd === 'IG') {
    return {
      output: savedPnr ? `TRANSACTION IGNORED - PNR ${savedPnr.recordLocator} RESTORED` : 'TRANSACTION IGNORED - AAA WORK AREA CLEARED',
      updatedPnr: JSON.parse(JSON.stringify(savedPnr || INITIAL_PNR)),
      status: 'warning',
      category: 'TRANSACTION',
      explanation: 'Unsaved changes discarded. Last saved state restored.',
    };
  }

  if (cmd === 'IR') {
    return {
      output: savedPnr ? formatPnrDisplay(savedPnr) : 'IGNORED - NO SAVED PNR IN AAA',
      updatedPnr: JSON.parse(JSON.stringify(savedPnr || INITIAL_PNR)),
      status: 'warning',
      category: 'TRANSACTION',
      explanation: 'Unsaved changes discarded; saved PNR retrieved.',
    };
  }

  // 11. PRICING (FXP, FXX, FQD)
  if (cmd === 'FXP' || cmd === 'FXX') {
    const storeTst = cmd === 'FXP';
    if (pnr.segments.length === 0) {
      return {
        output: 'NO ITINERARY TO PRICE',
        updatedPnr: pnr,
        status: 'error',
        category: 'PRICING',
      };
    }
    if (pnr.passengers.length === 0) {
      return {
        output: 'NO PASSENGER IN PNR',
        updatedPnr: pnr,
        status: 'error',
        category: 'PRICING',
      };
    }

    const paxCount = pnr.passengers.length;
    const baseRate = 6500;
    const taxes = 1250;
    const totalSingle = baseRate + taxes;

    if (storeTst) {
      pnr.fare = {
        priced: true,
        baseFarePerPax: baseRate,
        taxesPerPax: taxes,
        totalPerPax: totalSingle,
        totalAllPax: totalSingle * paxCount,
        currency: 'INR',
        fareBasis: 'YFLEXIN',
        pricingCommand: cmd,
        pricedAt: new Date().toISOString(),
      };
    }

    return {
      output: formatFareQuote(pnr, storeTst),
      updatedPnr: pnr,
      status: 'success',
      category: 'PRICING',
      explanation: storeTst
        ? 'Itinerary priced and TST created. Next step: Issue tickets with TTP.'
        : 'Informational fare quote generated. TST was not stored (use FXP to store).',
    };
  }

  // 12. TICKETING (TTP)
  if (cmd === 'TTP') {
    if (pnr.ticket.issued) return { output: 'TICKET ALREADY ISSUED - NO DUPLICATE TICKET CREATED', updatedPnr: pnr, status: 'error', category: 'TICKETING' };
    if (!pnr.recordLocator) {
      return {
        output: 'CANNOT ISSUE TICKET - RECORD LOCATOR DOES NOT EXIST (RUN ER FIRST)',
        updatedPnr: pnr,
        status: 'error',
        category: 'TICKETING',
      };
    }
    if (!pnr.fare.priced) {
      return {
        output: 'CANNOT ISSUE TICKET - NO STORED TST. PRICE WITH FXP FIRST',
        updatedPnr: pnr,
        status: 'error',
        category: 'TICKETING',
      };
    }
    if (pnr.passengers.length === 0 || pnr.segments.length === 0) {
      return {
        output: 'INCOMPLETE PNR - CANNOT PROCEED WITH TICKETING',
        updatedPnr: pnr,
        status: 'error',
        category: 'TICKETING',
      };
    }

    // Generate simulated ticket numbers for all passengers
    const mainAirline = pnr.segments[0].airlineCode;
    const generatedTkts = pnr.passengers.map((p) => ({
      passengerId: p.id,
      passengerName: `${p.lastName}/${p.firstName} ${p.title}`,
      number: generateTicketNumber(mainAirline),
    }));

    pnr.ticket = {
      issued: true,
      ticketNumbers: generatedTkts,
      issuedAt: new Date().toISOString(),
      agentRef: '1234AA/DEL',
      status: 'ISSUED',
    };
    pnr.status = 'TICKETED';
    pnr.lastUpdated = new Date().toISOString();

    let out = `** OK ETICKET ISSUED **\n`;
    out += `TRANSACTION RECORDED: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()} ${new Date().toLocaleTimeString()}\n`;
    generatedTkts.forEach((t) => {
      out += `FA PAX ${t.passengerName} ETKT ${t.number}\n`;
    });
    out += `\nSIMULATED TICKET NUMBERS FOR TRAINING - NOT A VALID AIRLINE FLIGHT COUPON`;

    return {
      output: out,
      updatedPnr: pnr,
      status: 'success',
      category: 'TICKETING',
      explanation: 'Electronic tickets simulated and stored in PNR.',
    };
  }

  // 13. CANCEL / DELETE (XE, XI)
  if (cmd === 'XI') {
    if (pnr.ticket.issued) return { output: 'TICKETED PNR - VOID TICKET BEFORE CANCELLING ITINERARY', updatedPnr: pnr, status: 'error', category: 'CANCEL' };
    pnr.segments = [];
    pnr.fare.priced = false;
    pnr.lastUpdated = new Date().toISOString();
    return {
      output: 'ITINERARY CANCELLED - ENTER ER TO SAVE OR IG TO ABORT',
      updatedPnr: pnr,
      status: 'warning',
      category: 'CANCEL',
      explanation: 'All flight segments removed from itinerary.',
    };
  }

  if (cmd.startsWith('XE')) {
    if (pnr.ticket.issued) return { output: 'TICKETED PNR - VOID TICKET BEFORE DELETING ELEMENTS', updatedPnr: pnr, status: 'error', category: 'CANCEL' };
    const lineNum = /^XE\d+$/.test(cmd) ? Number(cmd.slice(2)) : NaN;
    if (isNaN(lineNum) || lineNum < 1) {
      return {
        output: 'INVALID FORMAT. USE XE1 OR XE2',
        updatedPnr: pnr,
        status: 'error',
        category: 'CANCEL',
      };
    }
    // Match line number against segments or passengers
    if (lineNum <= pnr.passengers.length && pnr.passengers.length > 0) {
      const removed = pnr.passengers.splice(lineNum - 1, 1);
      return {
        output: `PASSENGER ${removed[0]?.lastName} REMOVED FROM PNR`,
        updatedPnr: pnr,
        status: 'warning',
        category: 'CANCEL',
      };
    } else {
      const segIndex = lineNum - pnr.passengers.length - 1;
      if (segIndex >= 0 && segIndex < pnr.segments.length) {
        const removed = pnr.segments.splice(segIndex, 1);
        pnr.fare.priced = false;
        return {
          output: `SEGMENT ${removed[0]?.airlineCode}${removed[0]?.flightNumber} CANCELLED`,
          updatedPnr: pnr,
          status: 'warning',
          category: 'CANCEL',
        };
      }
    }
    return {
      output: `ELEMENT ${lineNum} NOT FOUND FOR DELETION`,
      updatedPnr: pnr,
      status: 'error',
      category: 'CANCEL',
    };
  }

  // 14. SSR (SR) & OSI (OS)
  if (cmd.startsWith('SR')) {
    const details = cmd.substring(2).trim();
    pnr.ssrs.push({
      id: 'ssr_' + Math.random().toString(36).substring(2, 7),
      code: details.substring(0, 4),
      details,
    });
    return {
      output: `SSR ${details} HK1`,
      updatedPnr: pnr,
      status: 'success',
      category: 'SSR',
      explanation: 'Special Service Request added to PNR.',
    };
  }

  if (cmd.startsWith('OS')) {
    const osiText = cmd.substring(2).trim();
    pnr.osis.push({
      id: 'osi_' + Math.random().toString(36).substring(2, 7),
      airline: osiText.substring(0, 2),
      text: osiText,
    });
    return {
      output: `OS ${osiText}`,
      updatedPnr: pnr,
      status: 'success',
      category: 'OSI',
    };
  }

  // 15. REMARKS (RM, RC, RI)
  if (cmd.startsWith('RM') || cmd.startsWith('RC') || cmd.startsWith('RI')) {
    const type = cmd.substring(0, 2) as 'RM' | 'RC' | 'RI';
    const text = cmd.substring(2).trim();
    pnr.remarks.push({
      id: 'rm_' + Math.random().toString(36).substring(2, 7),
      type,
      text,
    });
    return {
      output: `${type} ${text}`,
      updatedPnr: pnr,
      status: 'success',
      category: 'REMARK',
    };
  }

  // 16. ENCODE / DECODE (DD, DC, DAC, DAN)
  if (cmd.startsWith('DD')) {
    const query = cmd.substring(2).trim();
    const airport = AIRPORTS[query];
    if (airport) {
      return {
        output: `AIRPORT ENCODE/DECODE:
CITY: ${airport.city} (${query})
COUNTRY: ${airport.country}
AIRPORT NAME: ${airport.name}
TIME ZONE: LOCAL AIRPORT TIME`,
        updatedPnr: pnr,
        status: 'info',
        category: 'INFO',
      };
    }
    return {
      output: `AIRPORT/CITY ${query} NOT FOUND IN LOCAL SIMULATOR DATABASE`,
      updatedPnr: pnr,
      status: 'warning',
      category: 'INFO',
      shouldAskAi: true,
    };
  }

  if (cmd.startsWith('DC')) {
    const match = cmd.match(/^DC\s*(\d+(?:\.\d{1,2})?)(USD|EUR|GBP|INR)\/(USD|EUR|GBP|INR)$/);
    if (!match) return { output: 'INVALID FORMAT. USE DC 100USD/INR', updatedPnr: pnr, status: 'error', category: 'INFO' };
    const rates: Record<string, number> = { USD: 83, EUR: 90, GBP: 105, INR: 1 };
    const result = Number(match[1]) * rates[match[2]] / rates[match[3]];
    return { output: `${match[1]} ${match[2]} = ${result.toFixed(2)} ${match[3]}\nILLUSTRATIVE RATE ONLY - NOT LIVE FX DATA`, updatedPnr: pnr, status: 'info', category: 'INFO' };
  }

  if (cmd.startsWith('FQD')) {
    const match = cmd.match(/^FQD([A-Z]{3})([A-Z]{3})$/);
    if (!match) return { output: 'INVALID FORMAT. USE FQDDELBOM', updatedPnr: pnr, status: 'error', category: 'PRICING' };
    return { output: `FARE DISPLAY ${match[1]}-${match[2]}\nYFLEXIN  INR 6500 + TAXES INR 1250\nTOTAL INR 7750 PER ADULT\nSIMULATED FARES - NOT LIVE PRICES`, updatedPnr: pnr, status: 'info', category: 'PRICING' };
  }
  if (cmd.startsWith('FQN')) {
    return { output: 'SIMULATED FARE RULES - YFLEXIN\nCHANGES: INR 2500 BEFORE DEPARTURE\nREFUND: INR 3500 PENALTY BEFORE DEPARTURE\nBAGGAGE: 1PC / 15KG\nILLUSTRATIVE RULES ONLY - NOT LIVE AIRLINE POLICY', updatedPnr: pnr, status: 'info', category: 'PRICING' };
  }
  if (cmd === 'TRDC') {
    if (!pnr.ticket.issued) return { output: 'NO TICKET TO VOID IN PNR', updatedPnr: pnr, status: 'error', category: 'TICKETING' };
    pnr.ticket = { ...pnr.ticket, issued: false, status: 'VOID' };
    pnr.status = 'SAVED';
    return { output: 'SIMULATED TICKET VOIDED - NO REAL TICKET WAS AFFECTED', updatedPnr: pnr, status: 'warning', category: 'TICKETING' };
  }
  if (cmd.startsWith('QE')) {
    if (!pnr.recordLocator) return { output: 'NO SAVED PNR TO PLACE ON QUEUE', updatedPnr: pnr, status: 'error', category: 'QUEUE' };
    pnr.queueRef = cmd.slice(2).trim() || 'Q1';
    return { output: `PNR ${pnr.recordLocator} PLACED ON SIMULATED QUEUE ${pnr.queueRef}`, updatedPnr: pnr, status: 'success', category: 'QUEUE' };
  }
  if (cmd === 'QS' || cmd === 'QN') return { output: pnr.queueRef ? `SIMULATED QUEUE ${pnr.queueRef} - PNR ${pnr.recordLocator}` : 'SIMULATED QUEUE EMPTY', updatedPnr: pnr, status: 'info', category: 'QUEUE' };
  if (/^(AN|AD|SN|SS|AP|TK|NM|SR|OS|RM|RC|RI|XE|RF)/.test(cmd)) {
    return { output: 'INVALID FORMAT - TYPE HELP FOR COMMAND SYNTAX', updatedPnr: pnr, status: 'error', category: 'GENERAL' };
  }
  return { output: 'PROCESSING VIA AMADEUS AI ENGINE...', updatedPnr: pnr, status: 'info', category: 'AI_COMMAND', shouldAskAi: true };
}

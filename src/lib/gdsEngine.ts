import { FlightAvailabilityOption, PnrSegment, PnrState } from '../types/gds';
import { AIRPORT_PROFILES, SIMULATED_CARRIERS, ECONOMY_ONLY_CARRIERS } from './airportProfiles';
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

// Simulated inventory is stable for a route and date, but varies between searches.
export function generateMockAvailability(
  dateStr: string,
  origin: string,
  dest: string,
  airlineFilter?: string
): FlightAvailabilityOption[] {
  const originCode = origin.toUpperCase();
  const destCode = dest.toUpperCase();
  const formattedDate = dateStr.toUpperCase();
  const route = originCode + destCode;
  const hash = (value: string) => {
    let result = 2166136261;
    for (const char of value) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
    return result >>> 0;
  };
  const clock = (minutes: number) => {
    const day = Math.floor(minutes / 1440);
    const time = ((minutes % 1440) + 1440) % 1440;
    return String(Math.floor(time / 60)).padStart(2, '0') + String(time % 60).padStart(2, '0') + (day === 0 ? '' : day > 0 ? '+' + day : String(day));
  };

  const departureAirport = AIRPORT_PROFILES[originCode];
  const arrivalAirport = AIRPORT_PROFILES[destCode];
  if (!departureAirport || !arrivalAirport || originCode === destCode) return [];

  const carriers = [...new Set([...departureAirport.carriers, ...arrivalAirport.carriers])];
  const radians = Math.PI / 180;
  const latDifference = (arrivalAirport.latitude - departureAirport.latitude) * radians;
  const lonDifference = (arrivalAirport.longitude - departureAirport.longitude) * radians;
  const arc = Math.sin(latDifference / 2) ** 2 + Math.cos(departureAirport.latitude * radians) * Math.cos(arrivalAirport.latitude * radians) * Math.sin(lonDifference / 2) ** 2;
  const distanceKm = 12742 * Math.asin(Math.sqrt(Math.min(1, arc)));
  const baseDuration = Math.max(45, Math.round(distanceKm / 780 * 60 + 35));
  const timeZoneDifference = arrivalAirport.utcOffset - departureAirport.utcOffset;

  const seed = hash(formattedDate + route);
  const flights = Array.from({ length: 6 }, (_, index) => {
    const airline = carriers[(index + seed % carriers.length) % carriers.length];
    const variation = hash(route + formattedDate + airline + index);
    const dep = 290 + index * 160 + variation % 70;
    const durationMinutes = baseDuration + (variation >>> 8) % 35;
    const classCodes = ECONOMY_ONLY_CARRIERS.has(airline) ? ['Y', 'B', 'M', 'H', 'K', 'Q', 'L', 'V'] : ['J', 'C', 'D', 'Y', 'B', 'M', 'H', 'K'];
    const bookingClasses = classCodes.map((code, classIndex) => ({
      code,
      seats: String(3 + (hash(route + formattedDate + airline + index + code + classIndex) % 7)),
    }));

    return {
      line: index + 1,
      airlineCode: airline,
      airlineName: AIRLINES[airline]?.name || SIMULATED_CARRIERS[airline] || airline,
      flightNumber: String(101 + hash(route + formattedDate + airline + index) % 850),
      classes: bookingClasses,
      origin: originCode,
      destination: destCode,
      depTime: clock(dep),
      arrTime: clock(dep + durationMinutes + timeZoneDifference),
      aircraft: baseDuration >= 480 ? ['788', '77W', '789'][variation % 3] : ['32N', '320', '738'][variation % 3],
      duration: Math.floor(durationMinutes / 60) + ':' + String(durationMinutes % 60).padStart(2, '0'),
      dateStr: formattedDate,
      stops: 0,
    };
  });

  return flights.filter(flight => !airlineFilter || flight.airlineCode === airlineFilter.toUpperCase())
    .map((flight, index) => ({ ...flight, line: index + 1 }));
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
  lastAvailability: FlightAvailabilityOption[]
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
  const anMatch = cmd.match(/^(?:A[ND]|SN)(\d{1,2}[A-Z]{3})([A-Z]{3})([A-Z]{3})(?:\/([A-Z0-9]{2}))?$/);
  if (anMatch) {
    const [, dateStr, origin, dest, airlineFilter] = anMatch;
    if (!AIRPORT_PROFILES[origin] || !AIRPORT_PROFILES[dest] || origin === dest) {
      return {
        output: origin === dest ? 'INVALID ROUTE - ORIGIN AND DESTINATION MUST DIFFER' : `AIRPORT NOT SUPPORTED: ${[origin, dest].filter(code => !AIRPORT_PROFILES[code]).join(', ')}\nSUPPORTED SIMULATION AIRPORTS: ${Object.keys(AIRPORT_PROFILES).join(' ')}`,
        updatedPnr: pnr, updatedAvailability: [], status: 'error', category: 'AVAILABILITY',
      };
    }
    const flights = generateMockAvailability(dateStr, origin, dest, airlineFilter);
    const screen = flights.length ? formatAvailabilityScreen(dateStr, origin, dest, flights) : `NO FLIGHTS FOUND FOR CARRIER ${airlineFilter} ON ${origin}-${dest} - SIMULATED DATA`;
    return {
      output: screen,
      updatedPnr: pnr,
      updatedAvailability: flights,
      status: flights.length ? 'success' : 'warning',
      category: 'AVAILABILITY',
      explanation: flights.length
        ? `Availability retrieved for ${origin} to ${dest} on ${dateStr}${airlineFilter ? ` via ${airlineFilter}` : ''}. Use SS to sell seats (e.g., SS1Y1).`
        : 'No simulated flights match this airline filter. Try another carrier or search without a filter.',
    };
  }

  // Alternate AN format without date (defaults to today + 7 days)
  const anNoDateMatch = cmd.match(/^(?:A[ND]|SN)([A-Z]{3})([A-Z]{3})$/);
  if (anNoDateMatch) {
    const [, origin, dest] = anNoDateMatch;
    const today = new Date();
    today.setDate(today.getDate() + 7);
    const defaultDate = today.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase().replace(' ', '');
    return executeGdsCommand(`${cmd.slice(0, 2)}${defaultDate}${origin}${dest}`, pnr, lastAvailability);
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
    if (!classFound || seats < 1 || seats > 9 || Number(classFound.seats) < seats) {
      return {
        output: `SEGMENT NOT AVAILABLE - CLASS ${bookingClass} HAS INSUFFICIENT SEATS ON LINE ${lineNum}`,
        updatedPnr: pnr,
        status: 'error',
        category: 'SELL',
      };
    }

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

    // If format is NM1SMITH/JOHN MR -> tokens will be [SMITH, JOHN MR]
    // If multi: NM2YADAV/SIMS MS/YADAV/RAHUL MR
    const parsedPassengers: { lastName: string; firstName: string; title: string }[] = [];

    if (expectedCount === 1) {
      const slashIdx = namesPart.indexOf('/');
      if (slashIdx === -1) {
        return {
          output: 'INVALID NAME FORMAT. MUST CONTAIN LASTNAME/FIRSTNAME TITLE',
          updatedPnr: pnr,
          status: 'error',
          category: 'NAME',
        };
      }
      const lastName = namesPart.substring(0, slashIdx).trim();
      const rest = namesPart.substring(slashIdx + 1).trim();
      const spaceIdx = rest.lastIndexOf(' ');
      let firstName = rest;
      let title = 'MR';
      if (spaceIdx !== -1) {
        firstName = rest.substring(0, spaceIdx).trim();
        title = rest.substring(spaceIdx + 1).trim();
      }
      parsedPassengers.push({ lastName, firstName, title });
    } else {
      // General multi-passenger split
      // Example: YADAV/SIMS MS/YADAV/RAHUL MR
      const chunks = namesPart.split('/');
      // Expect pairs of [lastName, firstName+title, lastName, firstName+title]
      if (chunks.length < 2) {
        return {
          output: 'INVALID MULTI-PASSENGER FORMAT',
          updatedPnr: pnr,
          status: 'error',
          category: 'NAME',
        };
      }
      for (let i = 0; i < chunks.length - 1; i += 2) {
        const lastName = chunks[i].trim();
        const firstAndTitle = chunks[i + 1].trim();
        const sp = firstAndTitle.lastIndexOf(' ');
        let firstName = firstAndTitle;
        let title = 'MR';
        if (sp !== -1) {
          firstName = firstAndTitle.substring(0, sp).trim();
          title = firstAndTitle.substring(sp + 1).trim();
        }
        parsedPassengers.push({ lastName, firstName, title });
      }
    }

    if (parsedPassengers.length !== expectedCount || parsedPassengers.some(p => !/^[A-Z][A-Z -]*$/.test(p.lastName) || !/^[A-Z][A-Z -]*$/.test(p.firstName) || !/^(MR|MRS|MS|MISS|MSTR|DR)$/.test(p.title))) {
      return {
        output: 'INVALID NUMBER OF NAMES OR NAME FORMAT. USE NM1LASTNAME/FIRSTNAME MR',
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
    const contactVal = tokens.slice(tokens[0].length === 3 ? 1 : 0).join(' ');
    if (!contactVal || (isEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactVal))) return { output: 'INVALID CONTACT FORMAT', updatedPnr: pnr, status: 'error', category: 'CONTACT' };

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
    if (!/^(OK|TL\d{1,2}[A-Z]{3})$/.test(arrangement)) {
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
    pnr.status = 'SAVED';
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
    // Saved records remain accessible when the work area is ignored.
    return {
      output: pnr.recordLocator ? 'TRANSACTION IGNORED - SAVED PNR RETAINED IN AAA' : 'TRANSACTION IGNORED - AAA WORK AREA CLEARED',
      updatedPnr: pnr.recordLocator ? pnr : JSON.parse(JSON.stringify(INITIAL_PNR)),
      status: 'warning',
      category: 'TRANSACTION',
      explanation: 'Work area cleared. Start fresh with AN command.',
    };
  }

  if (cmd === 'IR') {
    return {
      output: pnr.recordLocator ? formatPnrDisplay(pnr) : 'IGNORED - NO PNR IN AAA',
      updatedPnr: pnr,
      status: 'warning',
      category: 'TRANSACTION',
      explanation: 'Ignore and retrieve re-displays saved state.',
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
    if (pnr.ticket.issued) return { output: 'TICKETED PNR - VOID TICKETS WITH TRDC BEFORE CANCELLATION', updatedPnr: pnr, status: 'error', category: 'CANCEL' };
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
    const lineNum = parseInt(cmd.substring(2).trim(), 10);
    if (isNaN(lineNum)) {
      return {
        output: 'INVALID FORMAT. USE XE1 OR XE2',
        updatedPnr: pnr,
        status: 'error',
        category: 'CANCEL',
      };
    }
    if (pnr.ticket.issued) return { output: 'TICKETED PNR - VOID TICKETS WITH TRDC BEFORE DELETION', updatedPnr: pnr, status: 'error', category: 'CANCEL' };
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
    if (!/^[A-Z0-9]{4}(?: .*)?$/.test(details)) return { output: 'INVALID SSR FORMAT. USE SR VGML OR SR WCHR', updatedPnr: pnr, status: 'error', category: 'SSR' };
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
    if (!/^[A-Z0-9]{2} .+/.test(osiText)) return { output: 'INVALID OSI FORMAT. USE OS YY TEXT', updatedPnr: pnr, status: 'error', category: 'OSI' };
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
    if (!text) return { output: 'INVALID REMARK FORMAT', updatedPnr: pnr, status: 'error', category: 'REMARK' };
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

  // Fare rules, informational fare displays, queue functions and currency conversion
  if (cmd.startsWith('FQD')) {
    const route = cmd.substring(3).trim();
    if (!/^[A-Z]{6}$/.test(route)) return { output: 'INVALID FARE DISPLAY FORMAT. USE FQDDELBOM', updatedPnr: pnr, status: 'error', category: 'PRICING' };
    return { output: `FARE DISPLAY ${route.slice(0,3)}-${route.slice(3)}
YFLEXIN INR 6500 + TAXES
SIMULATED FARE DISPLAY - NOT LIVE PRICING`, updatedPnr: pnr, status: 'info', category: 'PRICING' };
  }
  if (cmd.startsWith('FQN')) return { output: 'FARE RULES - SIMULATED\nCHANGES: INR 2500 + FARE DIFFERENCE\nCANCELLATIONS: INR 3500 BEFORE DEPARTURE\nNO SHOW: NOT PERMITTED\nSIMULATED FARE RULES - NOT VALID FOR TRAVEL', updatedPnr: pnr, status: 'info', category: 'PRICING' };
  if (cmd === 'TRDC') {
    if (!pnr.ticket.issued) return { output: 'NO TICKET TO VOID', updatedPnr: pnr, status: 'error', category: 'TICKETING' };
    pnr.ticket.status = 'VOID'; pnr.ticket.issued = false; pnr.status = 'SAVED';
    return { output: 'SIMULATED TICKET VOID COMPLETE - NO REAL TICKETS AFFECTED', updatedPnr: pnr, status: 'warning', category: 'TICKETING' };
  }
  if (/^Q[ESN]/.test(cmd)) return { output: `SIMULATED QUEUE OPERATION ${cmd.slice(0,2)} - NO LIVE QUEUE MESSAGES`, updatedPnr: pnr, status: 'info', category: 'QUEUE' };
  const currencyMatch = cmd.match(/^DC(\d+(?:\.\d{1,2})?)(USD|EUR|GBP|INR)\/(USD|EUR|GBP|INR)$/);
  if (currencyMatch) {
    const rates: Record<string, number> = { USD: 83, EUR: 90, GBP: 105, INR: 1 };
    const amount = Number(currencyMatch[1]);
    return { output: `${amount.toFixed(2)} ${currencyMatch[2]} = ${(amount * rates[currencyMatch[2]] / rates[currencyMatch[3]]).toFixed(2)} ${currencyMatch[3]}
INDICATIVE SIMULATED RATE ONLY`, updatedPnr: pnr, status: 'info', category: 'INFO' };
  }
  if (/^(AN|AD|SN|SS|NM|AP|TK|RF|FXP|FXX|FQD|FQN|TTP|XE|SR|OS|RM|RC|RI|DD|DC|QE|QS|QN)/.test(cmd)) {
    return { output: 'INVALID FORMAT - TYPE HELP FOR COMMAND SYNTAX', updatedPnr: pnr, status: 'error', category: 'FORMAT', explanation: 'Check the command syntax and try a valid example from the training guide.' };
  }

  // 17. Unknown or natural language command -> Delegate to AI engine
  return {
    output: `PROCESSING VIA AMADEUS AI ENGINE...`,
    updatedPnr: pnr,
    status: 'info',
    category: 'AI_COMMAND',
    shouldAskAi: true,
  };
}

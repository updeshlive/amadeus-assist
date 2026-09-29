import { useEffect, useRef, useState } from 'react';
import { BookOpen, Check, ChevronDown, ChevronRight, CircleHelp, Command, Copy, FileText, History, PanelRight, PanelRightClose, Plus, RotateCcw, Send, Sparkles, Terminal, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { createInitialSession } from '@/lib/gdsConstants';
import { executeGdsCommand } from '@/lib/gdsEngine';
import type { SimulatorSession, TerminalEntry } from '@/types/gds';

const STORAGE_KEY = 'amadeus-assist-sessions-v1';
const ACTIVE_KEY = 'amadeus-assist-active-v1';
const examples = ['AN15AUGDELBOM', 'SS1Y1', 'NM1SMITH/JOHN MR', 'AP DEL 9876543210', 'TKTL15AUG', 'RF JOHN', 'FXP', 'ER', 'TTP'];
const training = [
  { title: 'Search availability', command: 'AN15AUGDELBOM', hint: 'AN + date + origin + destination. Browse the flights and booking classes returned.' },
  { title: 'Sell a flight', command: 'SS1Y1', hint: 'SS + seats + class + line. SS1Y1 sells 1 seat in Y class from line 1.' },
  { title: 'Add passenger', command: 'NM1SMITH/JOHN MR', hint: 'NM + quantity + surname/first name + title. Passenger names become part of the PNR.' },
  { title: 'Add contact details', command: 'AP DEL 9876543210', hint: 'Add a telephone with AP or an email with APE.' },
  { title: 'Set ticketing arrangement', command: 'TKTL15AUG', hint: 'TKTL sets a ticketing time limit; TKOK marks ticketing as OK.' },
  { title: 'Set received from', command: 'RF JOHN', hint: 'RF identifies who authorized the changes before you end the transaction.' },
  { title: 'Price the itinerary', command: 'FXP', hint: 'FXP stores a simulated fare quote; FXX displays a quote without storing it.' },
  { title: 'Save and retrieve', command: 'ER', hint: 'ER saves the PNR and generates a fictional record locator. All mandatory elements are required.' },
  { title: 'Simulate ticketing', command: 'TTP', hint: 'TTP requires a saved PNR and a stored fare quote. It never issues a real ticket.' },
];

function loadSessions(): SimulatorSession[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : null;
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch { /* Start fresh if browser storage is unavailable */ }
  return [createInitialSession()];
}

function formatTime(timestamp: string) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? timestamp : date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function PnrSection({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return <section className="border-t border-[#E8EDEF] py-4 first:border-t-0 first:pt-0">
    <div className="mb-2 flex items-center justify-between"><h3 className="text-[10px] font-bold uppercase tracking-[.16em] text-[#8C99A4]">{title}</h3>{count !== undefined && <span className="text-[10px] font-semibold text-[#A0ABB3]">{String(count).padStart(2, '0')}</span>}</div>
    {children}
  </section>;
}

export default function Index() {
  const [sessions, setSessions] = useState<SimulatorSession[]>(loadSessions);
  const [activeId, setActiveId] = useState(() => localStorage.getItem(ACTIVE_KEY) || '');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [aiConnected, setAiConnected] = useState(false);
  const [showPnr, setShowPnr] = useState(true);
  const [showTraining, setShowTraining] = useState(true);
  const [showSessions, setShowSessions] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [copySuccess, setCopySuccess] = useState(false);
  const [trainingStep, setTrainingStep] = useState(0);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const active = sessions.find(s => s.id === activeId) || sessions[0];
  const pnr = active.pnr;

  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions)); } catch { /* Keep the in-memory session usable */ } }, [sessions]);
  useEffect(() => { localStorage.setItem(ACTIVE_KEY, active.id); }, [active.id]);
  useEffect(() => { terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [active.terminalHistory.length, active.id, busy]);
  useEffect(() => {
    fetch('/api/ai-status').then(r => r.json()).then(d => setAiConnected(Boolean(d.connected))).catch(() => setAiConnected(false));
  }, []);

  function updateSession(next: SimulatorSession) { setSessions(prev => prev.map(s => s.id === next.id ? next : s)); }
  function newSession() { const next = createInitialSession(); setSessions(prev => [next, ...prev]); setActiveId(next.id); setInput(''); setShowSessions(false); setTrainingStep(0); inputRef.current?.focus(); }
  function resetSession() { if (!window.confirm('Reset this session? This will erase its PNR and command history.')) return; updateSession(createInitialSession(active.id, active.title)); setInput(''); setTrainingStep(0); }
  function clearTerminal() { updateSession({ ...active, terminalHistory: [], updatedAt: new Date().toISOString() }); }
  function deleteSession(id: string) {
    if (sessions.length === 1 || !window.confirm('Delete this session and its PNR?')) return;
    const next = sessions.filter(s => s.id !== id);
    setSessions(next);
    if (id === active.id) setActiveId(next[0].id);
  }

  async function runCommand(value = input) {
    const command = value.trim().toUpperCase();
    if (!command || busy) return;
    setBusy(true); setInput(''); setHistoryIndex(-1);
    const result = executeGdsCommand(command, active.pnr, active.lastAvailability);
    const entry: TerminalEntry = {
      id: crypto.randomUUID(), timestamp: new Date().toISOString(), command, response: result.output,
      isAiGenerated: false, status: result.status, category: result.category, explanation: result.explanation,
    };
    const pending: SimulatorSession = {
      ...active, pnr: result.updatedPnr, lastAvailability: result.updatedAvailability || active.lastAvailability,
      commandQueue: [...active.commandQueue, command].slice(-100),
      terminalHistory: [...active.terminalHistory, entry], updatedAt: new Date().toISOString(),
    };
    updateSession(pending);
    const stepIndex = training.findIndex(step => step.command.split(' ')[0] === command.split(' ')[0]);
    if (stepIndex === trainingStep && result.status === 'success') setTrainingStep(Math.min(trainingStep + 1, training.length));
    if (result.shouldAskAi) {
      try {
        const response = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command, pnr: result.updatedPnr, context: active.terminalHistory.slice(-4).map(e => ({ command: e.command, response: e.response })) }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.statusMessage || data?.message || 'AI is unavailable.');
        entry.response = data.response;
        entry.isAiGenerated = true;
        entry.status = 'info';
        entry.category = 'AI ASSIST';
        entry.explanation = 'AI-generated training response. PNR state is controlled by the command simulator.';
      } catch (error) {
        entry.response = `${command.length < 12 && !command.includes(' ') ? 'INVALID FORMAT OR UNSUPPORTED COMMAND' : 'AI ASSIST UNAVAILABLE'}\n${error instanceof Error ? error.message : 'Unable to connect to AI service.'}\nType HELP to view supported commands. Known commands remain available in simulation mode.`;
        entry.status = 'error';
      }
      updateSession({ ...pending, terminalHistory: [...active.terminalHistory, { ...entry }] });
    }
    setBusy(false);
    inputRef.current?.focus();
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); void runCommand(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); const index = Math.min(historyIndex + 1, active.commandQueue.length - 1); if (index >= 0) { setHistoryIndex(index); setInput(active.commandQueue[active.commandQueue.length - 1 - index]); } }
    else if (e.key === 'ArrowDown') { e.preventDefault(); const index = historyIndex - 1; setHistoryIndex(index); setInput(index < 0 ? '' : active.commandQueue[active.commandQueue.length - 1 - index]); }
  }

  async function copyPnr() {
    await navigator.clipboard.writeText(active.terminalHistory.filter(e => e.command === 'RT' || e.command === 'ER').at(-1)?.response || JSON.stringify(pnr, null, 2));
    setCopySuccess(true); setTimeout(() => setCopySuccess(false), 1500);
  }

  const statusText = busy ? 'PROCESSING' : aiConnected ? 'AI CONNECTED' : 'SIMULATION MODE';
  const statusColor = busy ? 'bg-amber-400' : aiConnected ? 'bg-[#19AC72]' : 'bg-[#75AFA2]';

  const sessionsList = <div className="space-y-2">{sessions.map(s => <div key={s.id} className={`group flex items-center gap-2 rounded-xl border px-3 py-2.5 transition ${s.id === active.id ? 'border-[#B9E6D5] bg-[#ECF8F3]' : 'border-transparent hover:bg-[#F4F7F8]'}`}>
    <button onClick={() => { setActiveId(s.id); setShowSessions(false); }} className="min-w-0 flex-1 text-left"><span className="block truncate text-xs font-semibold text-[#243641]">{s.pnr.recordLocator || s.title}</span><span className="text-[10px] text-[#8998A1]">{s.pnr.passengers.length} pax · {s.pnr.segments.length} segments · {new Date(s.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span></button>
    {sessions.length > 1 && <button title="Delete session" aria-label="Delete session" onClick={() => deleteSession(s.id)} className="text-[#9AA7AE] opacity-60 hover:text-red-500 group-hover:opacity-100"><X size={14} /></button>}
  </div>)}</div>;

  const pnrContent = <div className="space-y-0 px-5 pb-7">
    <div className="mb-5 flex items-center justify-between rounded-xl bg-[#F0F7F4] px-3.5 py-3"><div><p className="text-[10px] font-bold uppercase tracking-wider text-[#7B9A8D]">Record locator</p><p className="font-terminal mt-1 text-lg font-bold tracking-[.14em] text-[#23634B]">{pnr.recordLocator || '— — — — — —'}</p></div><span className="rounded-md bg-white px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[#418467]">{pnr.status.replace('_', ' ')}</span></div>
    <PnrSection title="Passengers" count={pnr.passengers.length}>{pnr.passengers.length ? pnr.passengers.map((p, i) => <div key={p.id} className="flex gap-2 py-1.5"><span className="font-terminal text-xs text-[#95A1A9]">{String(i + 1).padStart(2, '0')}</span><span className="font-terminal text-xs font-semibold text-[#344955]">{p.lastName}/{p.firstName} {p.title}</span></div>) : <p className="text-xs italic text-[#A4AFB6]">No passengers added yet</p>}</PnrSection>
    <PnrSection title="Itinerary" count={pnr.segments.length}>{pnr.segments.length ? pnr.segments.map(s => <div key={s.id} className="my-2 rounded-lg border border-[#E5EEEE] bg-[#FBFDFD] p-3"><div className="flex items-center justify-between"><span className="font-terminal text-xs font-bold text-[#315244]">{s.origin} <span className="px-1 text-[#7AAA91]">→</span> {s.destination}</span><span className="rounded bg-[#E7F6EE] px-1.5 py-0.5 font-terminal text-[10px] font-bold text-[#16895D]">{s.status}{s.seats}</span></div><p className="font-terminal mt-1.5 text-[10px] text-[#7A8B94]">{s.airlineCode} {s.flightNumber} · {s.bookingClass} · {s.depDate} · {s.depTime}—{s.arrTime}</p></div>) : <p className="text-xs italic text-[#A4AFB6]">No flights selected yet</p>}</PnrSection>
    <PnrSection title="Contact details" count={pnr.contacts.length}>{pnr.contacts.length ? pnr.contacts.map(c => <p key={c.id} className="font-terminal break-all py-1 text-xs text-[#536570]">{c.city} · {c.numberOrEmail}</p>) : <p className="text-xs italic text-[#A4AFB6]">No contact on file</p>}</PnrSection>
    <PnrSection title="Fare details"><div className="flex justify-between text-xs"><span className="text-[#85939C]">Total fare</span><span className="font-terminal font-semibold text-[#344955]">{pnr.fare.priced ? `${pnr.fare.currency} ${pnr.fare.totalAllPax.toLocaleString('en-IN')}` : 'Not priced'}</span></div>{pnr.fare.priced && <p className="mt-1 font-terminal text-[10px] text-[#8B9AA3]">BASE {pnr.fare.baseFarePerPax} + TAX {pnr.fare.taxesPerPax} / PAX</p>}</PnrSection>
    <PnrSection title="Ticketing status"><div className="flex items-center gap-2"><span className={`h-1.5 w-1.5 rounded-full ${pnr.ticket.issued ? 'bg-[#15A874]' : 'bg-[#B1BCC2]'}`} /><span className="text-xs font-medium text-[#5B6D77]">{pnr.ticket.issued ? 'Simulated tickets issued' : pnr.ticketingArrangement || 'Not ticketed'}</span></div>{pnr.ticket.ticketNumbers.map(t => <p key={t.passengerId} className="font-terminal mt-1 text-[10px] text-[#70858D]">{t.number} (FICTIONAL)</p>)}</PnrSection>
    <PnrSection title="SSR / OSI" count={pnr.ssrs.length + pnr.osis.length}>{pnr.ssrs.length + pnr.osis.length ? [...pnr.ssrs.map(s => `SR ${s.details}`), ...pnr.osis.map(o => `OS ${o.text}`)].map((text, i) => <p key={i} className="font-terminal py-1 text-[11px] text-[#526873]">{text}</p>) : <p className="text-xs italic text-[#A4AFB6]">None recorded</p>}</PnrSection>
    <PnrSection title="Remarks" count={pnr.remarks.length}>{pnr.remarks.length ? pnr.remarks.map(r => <p key={r.id} className="font-terminal py-1 text-[11px] text-[#526873]">{r.type} {r.text}</p>) : <p className="text-xs italic text-[#A4AFB6]">No remarks added</p>}</PnrSection>
    <button onClick={copyPnr} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-[#DCE6E3] py-2.5 text-xs font-semibold text-[#39725C] hover:bg-[#F0F8F4]">{copySuccess ? <Check size={13} /> : <Copy size={13} />}{copySuccess ? 'Copied' : 'Copy PNR data'}</button>
  </div>;

  return <div className="min-h-screen bg-[#F4F6F8] font-sans text-[#253640]">
    <header className="sticky top-0 z-30 flex h-[70px] items-center justify-between border-b border-[#E3E9EC] bg-white/95 px-4 backdrop-blur md:px-7">
      <div className="flex items-center gap-3"><img src="/assets/amadeus-assist-logo.png" alt="Amadeus Assist logo" className="h-10 w-10 rounded-xl object-cover shadow-sm" /><div><div className="flex items-center gap-2"><h1 className="text-[17px] font-extrabold tracking-[-.035em] text-[#163B32]">amadeus<span className="text-[#087F5B]">assist</span></h1><span className="hidden rounded bg-[#E7F4ED] px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider text-[#268467] sm:block">BETA</span></div><p className="text-[9px] font-bold uppercase tracking-[.19em] text-[#94A2AA]">AI-POWERED GDS TRAINING SIMULATOR</p></div></div>
      <div className="flex items-center gap-2 sm:gap-3"><div className="hidden items-center gap-2 rounded-full border border-[#DEE9E6] bg-[#F7FAF8] px-3 py-1.5 sm:flex"><span className={`h-2 w-2 rounded-full ${statusColor}`} /><span className="text-[10px] font-bold tracking-[.08em] text-[#527265]">{statusText}</span></div><button onClick={() => setShowHelp(true)} className="hidden items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-[#5E7279] hover:bg-[#F2F7F4] hover:text-[#087F5B] md:flex"><CircleHelp size={16} /> Help</button><div className="hidden h-6 w-px bg-[#E2E7E9] md:block" /><button onClick={() => setShowSessions(true)} className="flex items-center gap-2 rounded-lg border border-[#E0E8E6] bg-white px-3 py-2 text-xs font-semibold text-[#31484A] hover:border-[#B5D9C9]"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#D8EFE4] text-[10px] font-bold text-[#167553]">GS</span><span className="hidden md:inline">Guest workspace</span><ChevronDown size={13} className="text-[#90A19D]" /></button></div>
    </header>
    <main className="mx-auto max-w-[1760px] px-3 pb-4 pt-5 md:px-7 md:pt-7">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.17em] text-[#89979E]"><span>WORKSPACE</span><ChevronRight size={12} /><span className="text-[#087F5B]">TERMINAL</span></div><h2 className="text-[23px] font-bold tracking-[-.035em] text-[#233A40] md:text-[26px]">Cryptic terminal <span className="font-normal text-[#A0ADB1]">/</span> <span className="text-[#627980]">Training desk</span></h2><p className="mt-1 text-xs text-[#8A9AA3]">Practice the command line. Build a PNR. Learn as you go.</p></div><div className="flex items-center gap-2"><button onClick={() => setShowTraining(!showTraining)} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-semibold transition ${showTraining ? 'border-[#BBD9CD] bg-[#EAF6EF] text-[#087F5B]' : 'border-[#DFE6E7] bg-white text-[#61757B] hover:text-[#087F5B]'}`}><BookOpen size={14} /> Training <span className="hidden sm:inline">guide</span></button><button onClick={() => setShowPnr(!showPnr)} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-semibold transition ${showPnr ? 'border-[#BBD9CD] bg-[#EAF6EF] text-[#087F5B]' : 'border-[#DFE6E7] bg-white text-[#61757B] hover:text-[#087F5B]'}`}><PanelRight size={14} /> <span className="hidden sm:inline">PNR inspector</span><span className="sm:hidden">PNR</span></button></div></div>
      <div className="flex min-h-[690px] flex-col gap-4 xl:flex-row">
        {showTraining && <aside className="order-2 w-full shrink-0 overflow-hidden rounded-2xl border border-[#E2E9E9] bg-white shadow-[0_2px_12px_rgba(20,52,47,.03)] xl:order-1 xl:w-[246px] 2xl:w-[268px]"><div className="border-b border-[#EFF2F2] p-4"><div className="mb-1 flex items-center justify-between"><span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-[#53776A]"><BookOpen size={14} /> TRAINING GUIDE</span><button onClick={() => setShowTraining(false)} className="text-[#A1B1B3] hover:text-[#365949]" aria-label="Close training guide"><PanelRightClose size={15} /></button></div><h3 className="mt-3 text-base font-bold tracking-[-.03em] text-[#243C40]">Your first booking</h3><p className="mt-1 text-[11px] leading-relaxed text-[#87979C]">Follow the steps below to learn the full booking workflow.</p><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#E6EFEB]"><div className="h-full rounded-full bg-[#087F5B] transition-all" style={{ width: `${trainingStep / training.length * 100}%` }} /></div><p className="mt-2 text-[10px] font-semibold text-[#9AA9AB]">{Math.min(trainingStep, training.length)} / {training.length} STEPS COMPLETE</p></div><div className="max-h-[380px] overflow-y-auto p-2.5 xl:max-h-none">{training.map((step, index) => <button key={step.title} onClick={() => { setTrainingStep(index); setInput(step.command); inputRef.current?.focus(); }} className={`group mb-0.5 flex w-full gap-2.5 rounded-xl p-2.5 text-left transition ${index === trainingStep ? 'bg-[#EFF8F2]' : 'hover:bg-[#F7F9F8]'}`}><span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${index < trainingStep ? 'border-[#21A674] bg-[#21A674] text-white' : index === trainingStep ? 'border-[#2AA16D] text-[#188758]' : 'border-[#D9E4E0] text-[#A5B3AF]'}`}>{index < trainingStep ? <Check size={11} /> : index + 1}</span><span className="min-w-0"><span className={`block text-[11px] font-semibold ${index === trainingStep ? 'text-[#267554]' : 'text-[#607278]'}`}>{step.title}</span><span className="font-terminal mt-1 block truncate text-[9px] text-[#9AA9AE]">{step.command}</span></span></button>)}</div><div className="mx-3.5 mb-4 rounded-xl border border-[#DDECE4] bg-[#F2FAF5] p-3.5"><p className="flex items-center gap-1.5 text-[10px] font-bold text-[#24805A]"><Sparkles size={13} /> NEXT STEP HINT</p><p className="mt-2 text-[11px] leading-[1.55] text-[#5F7A6B]">{training[trainingStep]?.hint || 'Excellent work! You have completed the full booking simulation.'}</p><button onClick={() => { setInput(training[trainingStep]?.command || 'HELP'); inputRef.current?.focus(); }} className="mt-2.5 text-[10px] font-bold text-[#148055] hover:underline">Try command →</button></div><div className="relative mx-3.5 mb-4 h-28 overflow-hidden rounded-xl bg-[#ECF6F2]"><img src="/assets/aviation-routes.png" alt="Illustrated flight route network" className="h-full w-full object-cover opacity-90" /></div></aside>}
        <section className="order-1 flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#203C34] bg-[#07120E] shadow-[0_18px_50px_rgba(12,44,33,.13)] xl:order-2"><div className="flex h-[54px] shrink-0 items-center justify-between border-b border-[#1B382B] bg-[#0E2018] px-4 md:px-5"><div className="flex items-center gap-3"><div className="flex items-center gap-1.5"><span className="h-[7px] w-[7px] rounded-full bg-[#DE806F]" /><span className="h-[7px] w-[7px] rounded-full bg-[#D8B66C]" /><span className="h-[7px] w-[7px] rounded-full bg-[#4AAE78]" /></div><div className="h-4 w-px bg-[#244233]" /><Terminal size={14} className="text-[#59BA82]" /><span className="font-terminal text-[11px] font-bold tracking-[.1em] text-[#CEDCD1]">AMADEUS <span className="hidden text-[#7EA28E] sm:inline">/</span> CRYPTIC TERMINAL</span></div><div className="flex items-center gap-3"><span className="hidden font-terminal text-[10px] text-[#69907B] sm:inline">DEL1A0987 · 1234AA</span><span className="flex h-5 items-center gap-1.5 rounded border border-[#2B5B42] bg-[#143825] px-2 font-terminal text-[9px] font-semibold text-[#65C78A]"><span className="h-1.5 w-1.5 rounded-full bg-[#42C97C]" /> ONLINE</span></div></div>
          <div className="flex items-center justify-between border-b border-[#173327] bg-[#0B1B14] px-4 py-2.5 md:px-5"><div className="flex items-center gap-2 font-terminal text-[10px] text-[#699A7C]"><span className="text-[#77D595]">●</span> LIVE SESSION <span className="text-[#355D47]">/</span> {active.pnr.recordLocator || active.id.slice(-7).toUpperCase()} <span className="hidden text-[#42624D] sm:inline">· {active.terminalHistory.length} ENTRIES</span></div><div className="flex items-center gap-1"><Tooltip><TooltipTrigger asChild><button aria-label="Clear terminal" onClick={clearTerminal} className="rounded p-1.5 text-[#668A73] hover:bg-[#1B3928] hover:text-[#AFE5BB]"><Trash2 size={14} /></button></TooltipTrigger><TooltipContent>Clear output (keeps PNR)</TooltipContent></Tooltip><Tooltip><TooltipTrigger asChild><button aria-label="Reset session" onClick={resetSession} className="rounded p-1.5 text-[#668A73] hover:bg-[#1B3928] hover:text-[#AFE5BB]"><RotateCcw size={14} /></button></TooltipTrigger><TooltipContent>Reset session and PNR</TooltipContent></Tooltip><Tooltip><TooltipTrigger asChild><button aria-label="Help" onClick={() => void runCommand('HELP')} className="rounded p-1.5 text-[#668A73] hover:bg-[#1B3928] hover:text-[#AFE5BB]"><CircleHelp size={14} /></button></TooltipTrigger><TooltipContent>Show command reference</TooltipContent></Tooltip></div></div>
          <div className="terminal-scroll min-h-[420px] flex-1 overflow-x-auto overflow-y-auto px-4 py-5 md:px-7" style={{ maxHeight: 'min(63vh, 720px)' }} role="log" aria-label="Terminal output" aria-live="polite"><div className="min-w-[390px] space-y-5 font-terminal text-[11px] leading-[1.7] md:text-[12px]">{active.terminalHistory.length === 0 && <p className="text-[#699A7C]">TERMINAL CLEARED. PNR DATA IS STILL ACTIVE.<br />ENTER RT TO DISPLAY THE CURRENT RECORD.</p>}{active.terminalHistory.map((entry, idx) => <div key={entry.id} className={idx === 0 ? '' : 'border-t border-[#142A1F] pt-4'}><div className="mb-2 flex items-center gap-2"><span className="text-[#378A5A]">&gt;</span><span className="font-bold tracking-[.07em] text-[#70E29C]">{entry.command}</span><span className="ml-auto shrink-0 text-[9px] text-[#496855]">{formatTime(entry.timestamp)}</span></div><pre className={`whitespace-pre-wrap break-words font-terminal text-[11px] leading-[1.8] md:text-[12px] ${entry.status === 'error' ? 'text-[#FF927E]' : entry.status === 'warning' ? 'text-[#F1CF82]' : 'text-[#DAEBDE]'}`}>{entry.response}</pre>{entry.isAiGenerated && <span className="mt-2 inline-flex items-center gap-1 rounded border border-[#365949] px-1.5 py-0.5 text-[9px] text-[#81BE9D]"><Sparkles size={10} /> AI TRAINING RESPONSE</span>}{entry.status === 'error' && entry.explanation && <p className="mt-2 border-l-2 border-[#E8B777] pl-2 text-[10px] text-[#A9C1AD]">TIP: {entry.explanation}</p>}</div>)}{busy && <div className="flex items-center gap-2 text-[#8FCFA8]"><span className="animate-pulse">●</span> PROCESSING COMMAND...</div>}<div ref={terminalEndRef} /></div></div>
          <div className="shrink-0 border-t border-[#245036] bg-[#0C2117] p-3 md:p-4"><div className="flex items-center gap-2 rounded-lg border border-[#2C6344] bg-[#07180F] p-1.5 pl-3 focus-within:border-[#54C27E] focus-within:ring-1 focus-within:ring-[#54C27E]/30"><span className="shrink-0 font-terminal text-sm font-bold text-[#42C97D]">&gt;</span><input ref={inputRef} autoFocus aria-label="Amadeus command" value={input} onChange={e => setInput(e.target.value.toUpperCase())} onKeyDown={onInputKeyDown} placeholder="Enter an Amadeus command..." disabled={busy} autoComplete="off" spellCheck={false} className="min-w-0 flex-1 border-0 bg-transparent px-2 py-2.5 font-terminal text-xs uppercase tracking-wider text-[#DFF3E4] outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-[#577363] md:text-sm" /><Button onClick={() => void runCommand()} disabled={!input.trim() || busy} className="h-9 shrink-0 rounded-md bg-[#087F5B] px-3 text-xs font-bold text-white shadow-none hover:bg-[#0D9A68] disabled:opacity-40"><span className="hidden sm:inline">EXECUTE</span><Send size={14} className="sm:ml-2" /></Button></div><div className="mt-2.5 flex items-center justify-between gap-2 font-terminal text-[9px] text-[#61816B]"><span><span className="text-[#8AB39A]">↑ ↓</span> HISTORY <span className="mx-2 text-[#37513F]">·</span> <span className="text-[#8AB39A]">↵</span> EXECUTE</span><button onClick={() => setShowCommands(!showCommands)} className="flex items-center gap-1 text-[#83B799] hover:text-[#C9ECD3]"><Command size={11} /> QUICK COMMANDS <ChevronDown size={11} className={showCommands ? 'rotate-180' : ''} /></button></div>{showCommands && <div className="mt-3 flex flex-wrap gap-1.5">{examples.map(command => <button key={command} onClick={() => { setInput(command); inputRef.current?.focus(); }} className="rounded-md border border-[#315A40] bg-[#173625] px-2 py-1 font-terminal text-[10px] text-[#A6D8B2] hover:border-[#6BC48A] hover:text-white">{command}</button>)}</div>}</div>
        </section>
        {showPnr && <aside className="order-3 w-full shrink-0 overflow-hidden rounded-2xl border border-[#E2E9E9] bg-white shadow-[0_2px_12px_rgba(20,52,47,.03)] xl:w-[270px] 2xl:w-[294px]"><div className="flex items-center justify-between border-b border-[#EFF2F2] px-5 py-4"><div><div className="flex items-center gap-2 text-[#2E7359]"><FileText size={15} /><h3 className="text-xs font-bold tracking-[-.01em]">Live PNR inspector</h3></div><p className="mt-1 pl-[23px] text-[10px] text-[#9AA8A8]">Updates with every command</p></div><button onClick={() => setShowPnr(false)} aria-label="Close PNR inspector" className="rounded p-1 text-[#A3B1B1] hover:bg-[#F2F6F4] hover:text-[#2C6851]"><PanelRightClose size={16} /></button></div><div className="max-h-[780px] overflow-y-auto pt-5">{pnrContent}</div></aside>}
      </div>
      <footer className="mt-4 flex flex-col items-start justify-between gap-2 text-[10px] font-semibold uppercase tracking-[.14em] text-[#98A6A9] sm:flex-row sm:items-center"><span>AMADEUS TRAINING SIMULATOR — ALL DATA IS SIMULATED</span><span>NOT AFFILIATED WITH AMADEUS IT GROUP</span></footer>
    </main>
    <Sheet open={showSessions} onOpenChange={setShowSessions}><SheetContent className="w-[340px] border-l border-[#E0EAE7] bg-white p-0"><div className="border-b border-[#EAEFEE] px-5 pb-4 pt-7"><div className="flex items-center gap-2"><History size={18} className="text-[#087F5B]" /><h2 className="text-lg font-bold text-[#23463A]">Sessions</h2></div><p className="mt-1 text-xs leading-relaxed text-[#8C9D9B]">Independent practice workspaces, saved in this browser only.</p></div><div className="p-4"><button onClick={newSession} className="mb-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#087F5B] py-2.5 text-xs font-bold text-white hover:bg-[#076A4D]"><Plus size={15} /> New session</button>{sessionsList}<p className="mt-5 rounded-lg bg-[#F7F9F8] p-3 text-[10px] leading-relaxed text-[#80928B]">Account sync is unavailable without a connected database. Clearing browser storage will erase these local sessions.</p></div></SheetContent></Sheet>
    <Sheet open={showHelp} onOpenChange={setShowHelp}><SheetContent className="w-[360px] overflow-y-auto border-l border-[#E0EAE7] bg-white p-0"><div className="p-6"><div className="flex items-center gap-2 text-[#087F5B]"><CircleHelp size={19} /><h2 className="text-lg font-bold text-[#26463B]">Command reference</h2></div><p className="mt-2 text-xs leading-relaxed text-[#879895]">Explore cryptic commands for the booking workflow. Click an example to fill the terminal input.</p><div className="mt-6 space-y-5">{[{ name: '01 · Availability', commands: [['AN15AUGDELBOM','Search flight availability'],['AN15AUGDELBOM/AI','Filter by airline']] },{ name: '02 · Build PNR', commands: [['SS1Y1','Sell a seat from line 1'],['NM1SMITH/JOHN MR','Add passenger'],['AP DEL 9876543210','Add contact'],['TKTL15AUG','Set ticketing limit'],['RF JOHN','Set received from']] },{ name: '03 · Price & ticket', commands: [['FXP','Price and store TST'],['ER','End and retrieve PNR'],['TTP','Simulate ticket issuance']] },{ name: '04 · Manage', commands: [['RT','Retrieve current PNR'],['XE1','Delete element 1'],['XI','Cancel itinerary'],['SR VGML','Request vegetarian meal'],['DD DEL','Decode airport']] }].map(group => <section key={group.name}><h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#97A5A4]">{group.name}</h3><div className="space-y-1">{group.commands.map(([cmd, desc]) => <button key={cmd} onClick={() => { setInput(cmd); setShowHelp(false); inputRef.current?.focus(); }} className="w-full rounded-lg border border-[#E9EFEB] bg-[#FBFCFB] p-2.5 text-left hover:border-[#A6D7BB] hover:bg-[#F1F9F4]"><span className="font-terminal block text-[11px] font-bold text-[#177452]">{cmd}</span><span className="mt-1 block text-[10px] text-[#8A9A98]">{desc}</span></button>)}</div></section>)}</div><button onClick={() => { setShowHelp(false); void runCommand('HELP'); }} className="mt-6 w-full rounded-lg border border-[#CDE5D8] py-2.5 text-xs font-semibold text-[#087F5B] hover:bg-[#EFF8F2]">View full terminal help</button></div></SheetContent></Sheet>
  </div>;
}

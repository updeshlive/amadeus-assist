import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, BookOpen, ChevronLeft, ChevronRight, CircleHelp, Eraser, FileText, History, PanelRight, Menu, Plane, Plus, RotateCcw, Send, ShieldCheck, Sparkles, Terminal, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { createInitialSession } from '@/lib/gdsConstants';
import { executeGdsCommand, type CommandExecutionResult } from '@/lib/gdsEngine';
import type { SimulatorSession, TerminalEntry, PnrState } from '@/types/gds';

const STORAGE_KEY = 'amadeus-assist-sessions-v1';
const ACTIVE_KEY = 'amadeus-assist-active-v1';
const trainingSteps = [
  { title: 'Search availability', command: 'AN15AUGDELBOM', hint: 'Search for flights between Delhi and Mumbai on 15 August.', check: (p: PnrState, s: SimulatorSession) => s.lastAvailability.length > 0 },
  { title: 'Sell a flight segment', command: 'SS1Y1', hint: 'Sell one Y-class seat from the first availability line. For two seats on line 2 in J class, try SS2J2.', check: (p: PnrState) => p.segments.length > 0 },
  { title: 'Add a passenger', command: 'NM1ACHE/KEYMON MR', hint: 'Enter a surname, given name and title. The number after NM is the passenger count.', check: (p: PnrState) => p.passengers.length > 0 },
  { title: 'Add contact details', command: 'AP DEL 9876543210', hint: 'A phone or email contact is required for a complete booking.', check: (p: PnrState) => p.contacts.length > 0 },
  { title: 'Set ticketing', command: 'TKTL15AUG', hint: 'Set the ticketing time limit before ending the transaction.', check: (p: PnrState) => Boolean(p.ticketingArrangement) },
  { title: 'Price the itinerary', command: 'FXP', hint: 'FXP stores a simulated fare quotation; FXX only displays one.', check: (p: PnrState) => p.fare.priced },
  { title: 'Save the PNR', command: 'RF JOHN  →  ER', hint: 'Set Received From using RF JOHN, then enter ER to save and retrieve.', check: (p: PnrState) => Boolean(p.recordLocator) },
  { title: 'Issue a practice ticket', command: 'TTP', hint: 'A saved PNR with passenger, segment and stored fare is required.', check: (p: PnrState) => p.ticket.issued },
];

const quickCommands = [
  { label: 'Availability', cmd: 'AN15AUGDELBOM' },
  { label: 'Retrieve PNR', cmd: 'RT' },
  { label: 'Price itinerary', cmd: 'FXP' },
  { label: 'Help', cmd: 'HELP' },
];

function readSessions(): SimulatorSession[] {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (Array.isArray(stored) && stored.length > 0) return stored as SimulatorSession[];
  } catch { /* Use a fresh local session if browser storage is unavailable. */ }
  return [createInitialSession()];
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function terminalTone(status: TerminalEntry['status']) {
  return status === 'error' ? 'text-[#FF8F8F]' : status === 'warning' ? 'text-[#F4CA76]' : status === 'info' ? 'text-[#B7C8BF]' : 'text-[#D7EFE3]';
}

function InfoBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="border-b border-[#E8ECEB] py-4 last:border-0"><h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.17em] text-[#83938C]">{label}</h3>{children}</div>;
}

export default function Index() {
  const [sessions, setSessions] = useState<SimulatorSession[]>(readSessions);
  const [activeId, setActiveId] = useState(() => localStorage.getItem(ACTIVE_KEY) || '');
  const [input, setInput] = useState('');
  const [historyCursor, setHistoryCursor] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [aiConnected, setAiConnected] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showNav, setShowNav] = useState(false);
  const [sideTab, setSideTab] = useState<'pnr' | 'training'>('pnr');
  const [showHint, setShowHint] = useState<number | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const active = sessions.find((s) => s.id === activeId) || sessions[0];
  const pnr = active.pnr;

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions)); } catch { toast.error('Browser storage is full. This session may not persist after refresh.'); }
  }, [sessions]);
  useEffect(() => { localStorage.setItem(ACTIVE_KEY, active.id); }, [active.id]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [active.terminalHistory.length, active.id, busy]);
  useEffect(() => {
    fetch('/api/status').then((r) => r.ok ? r.json() : null).then((data) => setAiConnected(Boolean(data?.aiConfigured))).catch(() => setAiConnected(false));
  }, []);

  const updateSession = useCallback((id: string, updater: (session: SimulatorSession) => SimulatorSession) => {
    setSessions((all) => all.map((s) => s.id === id ? updater(s) : s));
  }, []);

  const submit = async (value = input) => {
    const command = value.trim().toUpperCase();
    if (!command || busy) return;
    const sessionId = active.id;
    const result = executeGdsCommand(command, active.pnr, active.lastAvailability, active.savedPnr);
    setInput('');
    setHistoryCursor(-1);
    setBusy(result.shouldAskAi === true);
    let output = result.output;
    let status = result.status;
    let explanation = result.explanation;
    let isAiGenerated = false;
    if (result.shouldAskAi) {
      try {
        const response = await fetch('/api/assist', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command, pnr: result.updatedPnr, history: active.terminalHistory.slice(-8).map((e) => ({ command: e.command, response: e.response })) }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.statusMessage || data.message || 'AI request failed');
        output = data.response;
        isAiGenerated = true;
        status = 'info';
        explanation = 'AI-generated explanation only. PNR state is unchanged.';
      } catch (error) {
        output = `INVALID FORMAT / AI DISCONNECTED\n${error instanceof Error ? error.message : 'Connection failed.'}\nUSE HELP FOR SUPPORTED COMMANDS. BUILT-IN COMMANDS STILL WORK.`;
        status = 'error';
        explanation = 'The AI service is not available. Deterministic simulator commands remain available.';
      }
    }
    const entry: TerminalEntry = { id: crypto.randomUUID(), timestamp: formatTime(new Date().toISOString()), command, response: output, isAiGenerated, status, category: result.category, explanation };
    updateSession(sessionId, (session) => ({
      ...session,
      pnr: result.updatedPnr,
      savedPnr: status !== 'error' && ['ER', 'ET', 'TTP', 'TRDC'].includes(command) ? structuredClone(result.updatedPnr) : session.savedPnr,
      lastAvailability: result.updatedAvailability ?? session.lastAvailability,
      commandQueue: [...session.commandQueue, command].slice(-100),
      terminalHistory: [...session.terminalHistory, entry].slice(-150),
      updatedAt: new Date().toISOString(),
    }));
    setBusy(false);
    inputRef.current?.focus();
  };

  const handleKeys = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') { event.preventDefault(); void submit(); }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      const commands = active.commandQueue;
      if (!commands.length) return;
      const next = event.key === 'ArrowUp' ? Math.min(commands.length - 1, historyCursor + 1) : Math.max(-1, historyCursor - 1);
      setHistoryCursor(next);
      setInput(next === -1 ? '' : commands[commands.length - 1 - next]);
    }
  };

  const newSession = () => {
    const created = createInitialSession();
    setSessions((all) => [created, ...all]);
    setActiveId(created.id);
    setShowNav(false);
    setInput('');
    toast.success('New training session started');
  };

  const resetSession = () => {
    if (!window.confirm('Reset this session? The current PNR, history and availability will be deleted.')) return;
    updateSession(active.id, () => createInitialSession(active.id, active.title));
    setInput('');
    toast.success('Session reset');
  };

  const clearTerminal = () => {
    updateSession(active.id, (s) => ({ ...s, terminalHistory: [], updatedAt: new Date().toISOString() }));
    toast.success('Terminal cleared. PNR data was kept.');
  };

  const removeSession = (id: string) => {
    if (sessions.length === 1) return toast.error('Keep at least one session open.');
    if (!window.confirm('Delete this session and its local data?')) return;
    setSessions((all) => all.filter((s) => s.id !== id));
    if (activeId === id) setActiveId(sessions.find((s) => s.id !== id)!.id);
  };

  return <div className="flex min-h-screen flex-col bg-[#F4F6F8] text-[#172B23] lg:h-screen lg:overflow-hidden">
    <header className="z-20 flex h-[72px] shrink-0 items-center justify-between border-b border-[#E4E9E7] bg-white px-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <button aria-label="Toggle sessions" className="rounded-lg p-2 text-[#567167] hover:bg-[#F1F5F2] lg:hidden" onClick={() => setShowNav(!showNav)}><Menu size={21} /></button>
        <img src="/assets/amadeus-assist-logo.png" alt="Amadeus Assist" className="h-10 w-10 rounded-xl object-cover shadow-sm" />
        <div><div className="text-[17px] font-extrabold leading-tight tracking-[-0.045em] text-[#16382B]">AMADEUS<span className="text-[#087F5B]">ASSIST</span></div><div className="text-[9px] font-semibold uppercase tracking-[0.17em] text-[#80918A]">AI-powered GDS training simulator</div></div>
        <div className="ml-5 hidden h-7 w-px bg-[#E4E9E7] xl:block" />
        <span className="ml-1 hidden rounded-full bg-[#E9F5EE] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#087F5B] xl:inline-flex">Training workspace</span>
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        <div className="hidden items-center gap-2 sm:flex"><span className={`h-2 w-2 rounded-full ${busy ? 'animate-pulse bg-amber-400' : aiConnected ? 'bg-[#16A56F]' : 'bg-[#94A3A0]'}`} /><span className="text-xs font-semibold text-[#5F7369]">{busy ? 'PROCESSING' : aiConnected ? 'AI CONNECTED' : 'SIMULATION MODE'}</span></div>
        <div className="hidden h-7 w-px bg-[#E4E9E7] sm:block" />
        <button onClick={() => setShowHelp(!showHelp)} className="flex h-9 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#486358] hover:bg-[#F1F5F2] sm:px-3"><CircleHelp size={17} /><span className="hidden sm:inline">Help</span></button>
        <button onClick={() => { setShowSidebar(!showSidebar); setSideTab('pnr'); }} className={`flex h-9 items-center gap-2 rounded-lg px-2 text-sm font-semibold sm:px-3 ${showSidebar ? 'bg-[#E9F5EE] text-[#087F5B]' : 'text-[#486358] hover:bg-[#F1F5F2]'}`}><PanelRight size={17} /><span className="hidden sm:inline">PNR panel</span></button>
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#D5E9DC] bg-[#E9F5EE] text-xs font-bold text-[#087F5B]">TA</span>
      </div>
    </header>

    {showHelp && <div className="relative z-10 flex items-center justify-between gap-4 border-b border-[#C6E7D4] bg-[#E9F5EE] px-5 py-3 text-sm text-[#265642]"><span><strong>Getting started:</strong> Run <code className="font-bold">AN15AUGDELBOM</code>, select a flight with <code className="font-bold">SS1Y1</code>, then add a passenger with <code className="font-bold">NM1SMITH/JOHN MR</code>. Type <code className="font-bold">HELP</code> for all commands.</span><button onClick={() => setShowHelp(false)} aria-label="Close help"><X size={16} /></button></div>}

    <div className="relative flex min-h-0 flex-1">
      {showNav && <div className="fixed inset-0 z-20 bg-black/30 lg:hidden" onClick={() => setShowNav(false)} />}
      <aside className={`${showNav ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} fixed inset-y-0 left-0 z-30 flex w-[245px] shrink-0 flex-col border-r border-[#E5EBE7] bg-white transition-transform duration-200 lg:static lg:inset-auto lg:z-auto`}>
        <div className="flex items-center justify-between px-5 pb-4 pt-7"><div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.15em] text-[#72867B]"><History size={15} /> Sessions <span className="rounded-md bg-[#EEF3F0] px-1.5 text-[#52735E]">{sessions.length}</span></div><button onClick={() => setShowNav(false)} className="lg:hidden"><X size={18} /></button></div>
        <div className="px-4"><Button onClick={newSession} className="h-10 w-full justify-start gap-2 rounded-xl bg-[#087F5B] px-4 text-xs font-bold shadow-none hover:bg-[#066B4D]"><Plus size={16} /> New session</Button></div>
        <div className="mt-6 px-5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#9AA9A0]">YOUR WORKSPACES</div>
        <ScrollArea className="mt-2 flex-1 px-3"><div className="space-y-1 pb-4">{sessions.map((s) => <div key={s.id} className={`group flex w-full items-center gap-1 rounded-xl pr-1 ${s.id === active.id ? 'bg-[#EAF5ED]' : 'hover:bg-[#F7F9F8]'}`}><button onClick={() => { setActiveId(s.id); setInput(''); setShowNav(false); }} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${s.id === active.id ? 'bg-white text-[#087F5B]' : 'bg-[#F3F6F4] text-[#82968B]'}`}><Terminal size={15} /></span><span className="min-w-0 flex-1"><span className={`block truncate text-xs font-semibold ${s.id === active.id ? 'text-[#14583F]' : 'text-[#52685D]'}`}>{s.pnr.recordLocator || s.title}</span><span className="mt-0.5 block text-[10px] text-[#95A39A]">{s.pnr.passengers.length ? `${s.pnr.passengers.length} passenger${s.pnr.passengers.length > 1 ? 's' : ''}` : 'No PNR yet'} · {formatTime(s.updatedAt)}</span></span></button><button title="Delete session" aria-label={`Delete ${s.title}`} onClick={() => removeSession(s.id)} className="rounded-md p-1 text-[#A0B0A5] opacity-0 hover:text-red-500 focus:opacity-100 group-hover:opacity-100"><Trash2 size={13} /></button></div>)}</div></ScrollArea>
        <div className="border-t border-[#ECF0EC] p-4"><div className="rounded-xl border border-[#E2ECE6] bg-[#F7FAF8] p-3"><div className="flex items-center gap-2 text-[11px] font-bold text-[#336449]"><ShieldCheck size={15} /> Local workspace</div><p className="mt-1.5 text-[10px] leading-relaxed text-[#85998A]">Sessions are stored in this browser only. No account or cross-device sync.</p></div></div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden px-3 pb-3 pt-4 sm:px-5 sm:pb-5 lg:px-6 lg:pt-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#81948A]"><span className="h-1.5 w-1.5 rounded-full bg-[#0BAE73]" /> LIVE WORKSPACE <ChevronRight size={12} /> {active.title.toUpperCase()}</div><h1 className="text-[24px] font-bold tracking-[-0.045em] text-[#193A2C] sm:text-[28px]">Cryptic terminal<span className="text-[#94AFA0]">.</span></h1><p className="mt-0.5 text-xs text-[#84978C]">Practice real-world GDS workflows in a safe, simulated environment.</p></div><div className="flex items-center gap-2"><button onClick={clearTerminal} title="Clear output without changing PNR" className="flex h-9 items-center gap-2 rounded-lg border border-[#DDE7E0] bg-white px-3 text-[11px] font-semibold text-[#547062] hover:bg-[#F4F9F5]"><Eraser size={14} /> Clear</button><button onClick={resetSession} title="Reset entire session" className="flex h-9 items-center gap-2 rounded-lg border border-[#DDE7E0] bg-white px-3 text-[11px] font-semibold text-[#547062] hover:bg-[#F4F9F5]"><RotateCcw size={14} /> Reset</button></div></div>

        <div className="flex min-h-[540px] flex-1 flex-col overflow-hidden rounded-[17px] border border-[#142F26] bg-[#081C15] shadow-[0_18px_50px_-22px_rgba(16,57,38,0.45)] lg:min-h-0">
          <div className="flex h-[51px] shrink-0 items-center justify-between border-b border-[#234338] bg-[#102C21] px-4 sm:px-5"><div className="flex items-center gap-3"><div className="flex gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#FF756C]" /><span className="h-2.5 w-2.5 rounded-full bg-[#E6B951]" /><span className="h-2.5 w-2.5 rounded-full bg-[#52B980]" /></div><span className="h-4 w-px bg-[#365847]" /><span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#B5D9C1]"><Terminal size={14} className="text-[#67D28D]" /> AMADEUS / CRYPTIC</span></div><span className="hidden font-terminal text-[10px] text-[#789987] sm:block">DEL1A0987 · 1234AA/SU</span><span className="rounded bg-[#19432D] px-2 py-1 font-terminal text-[9px] font-bold tracking-widest text-[#80E6A3] sm:hidden">ONLINE</span></div>
          <div className="flex items-center justify-between border-b border-[#244232] bg-[#0D241A] px-4 py-2.5 text-[10px] font-medium sm:px-5"><div className="flex items-center gap-2 text-[#8FC9A0]"><Activity size={13} /><span>{busy ? 'PROCESSING REQUEST' : aiConnected ? 'AI CONNECTED · SIMULATION MODE' : 'AI DISCONNECTED · SIMULATION MODE'}</span></div><div className="flex items-center gap-3 font-terminal text-[#749987]"><span>{active.terminalHistory.length} ENTRIES</span><span className="hidden sm:inline">|</span><span className="hidden sm:inline">SESSION {active.id.slice(-6).toUpperCase()}</span></div></div>
          <div ref={scrollRef} className="terminal-scroll min-h-0 flex-1 space-y-7 overflow-y-auto px-4 py-6 font-terminal text-[11px] leading-[1.8] sm:px-7 sm:text-[12px] lg:text-[13px]">{active.terminalHistory.length === 0 && <div className="text-[#75A78A]">TERMINAL CLEARED. ENTER A COMMAND TO CONTINUE.<br />PNR STATE REMAINS ACTIVE.</div>}{active.terminalHistory.map((entry) => <div key={entry.id} className="animate-in fade-in duration-300"><div className="mb-3 flex flex-wrap items-center gap-2 text-[#64C88B]"><span className="font-bold text-[#74E5A0]">&gt;</span><span className="break-all font-bold tracking-wide">{entry.command}</span><span className="ml-auto text-[9px] text-[#597966]">{entry.timestamp}</span></div><pre className={`overflow-x-auto whitespace-pre-wrap break-words font-terminal leading-[1.85] ${terminalTone(entry.status)}`}>{entry.response}</pre>{entry.isAiGenerated && <span className="mt-2 inline-flex items-center gap-1 rounded bg-[#173D2C] px-2 py-0.5 text-[9px] text-[#93CFA9]"><Sparkles size={10} /> AI RESPONSE · PNR UNCHANGED</span>}</div>)}{busy && <div className="flex items-center gap-2 text-xs text-[#85E1A3]"><span className="animate-pulse">●</span> PROCESSING...</div>}</div>
          <div className="shrink-0 border-t border-[#28513B] bg-[#0B2118] px-3 pb-3 pt-3 sm:px-5"><div className="mb-3 flex gap-2 overflow-x-auto pb-1">{quickCommands.map((item) => <button key={item.cmd} onClick={() => { setInput(item.cmd); inputRef.current?.focus(); }} className="shrink-0 rounded-md border border-[#315440] bg-[#163527] px-2.5 py-1.5 font-terminal text-[10px] text-[#9FCBAA] transition hover:border-[#5AA874] hover:text-[#D2F7D9]">{item.label} <span className="ml-1 text-[#5E9E73]">↗</span></button>)}</div><div className="flex items-center gap-3 rounded-xl border border-[#3D6B51] bg-[#102F20] px-3 py-2 shadow-inner"><span className="font-terminal text-lg font-bold text-[#69DA92]">&gt;</span><Input ref={inputRef} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="Enter Amadeus command..." value={input} onChange={(e) => { setInput(e.target.value.toUpperCase()); setHistoryCursor(-1); }} onKeyDown={handleKeys} disabled={busy} className="h-9 min-w-0 flex-1 border-0 bg-transparent px-0 font-terminal text-[13px] font-semibold tracking-[0.03em] text-[#E7FFEB] placeholder:text-[#638A6F] focus-visible:ring-0 sm:text-[14px]" aria-label="Amadeus command input" /><button disabled={!input.trim() || busy} onClick={() => void submit()} className="flex h-9 shrink-0 items-center gap-2 rounded-lg bg-[#10A569] px-3 text-[11px] font-bold text-white transition hover:bg-[#12B974] disabled:cursor-not-allowed disabled:opacity-40 sm:px-4"><Send size={14} /><span className="hidden sm:inline">Execute</span></button></div><div className="mt-2.5 flex items-center justify-between px-1 text-[9px] text-[#6E9980]"><span><kbd className="text-[#A4CFB1]">ENTER</kbd> to execute <span className="mx-1">·</span> <kbd className="text-[#A4CFB1]">↑ ↓</kbd> for command history</span><span>ALL DATA SIMULATED</span></div></div>
        </div>
        <footer className="mt-3 flex flex-wrap items-center justify-between gap-1 px-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#8A9C91]"><span>AMADEUS TRAINING SIMULATOR — ALL DATA IS SIMULATED</span><span>NOT AFFILIATED WITH AMADEUS IT GROUP</span></footer>
      </main>

      {showSidebar && <aside className="flex w-full shrink-0 flex-col border-t border-[#E5EBE7] bg-white lg:w-[315px] lg:border-l lg:border-t-0 xl:w-[340px]"><div className="flex h-16 items-center justify-between border-b border-[#EEF1EF] px-5"><div><h2 className="flex items-center gap-2 text-[13px] font-bold text-[#1C382B]"><FileText size={15} className="text-[#087F5B]" /> Live inspector</h2><p className="mt-0.5 text-[10px] text-[#9AA99D]">Your PNR, at a glance</p></div><button onClick={() => setShowSidebar(false)} title="Collapse inspector" className="rounded-lg p-2 text-[#9AA99D] hover:bg-[#F1F5F2] hover:text-[#087F5B]"><ChevronRight size={17} /></button></div><Tabs value={sideTab} onValueChange={(v) => setSideTab(v as 'pnr' | 'training')} className="flex min-h-0 flex-1 flex-col"><TabsList className="mx-4 mt-4 grid h-10 grid-cols-2 rounded-xl bg-[#F1F5F2] p-1"><TabsTrigger value="pnr" className="h-8 rounded-lg text-[11px] font-bold data-[state=active]:bg-white data-[state=active]:text-[#087F5B] data-[state=active]:shadow-sm"><FileText size={13} className="mr-1.5" /> Current PNR</TabsTrigger><TabsTrigger value="training" className="h-8 rounded-lg text-[11px] font-bold data-[state=active]:bg-white data-[state=active]:text-[#087F5B] data-[state=active]:shadow-sm"><BookOpen size={13} className="mr-1.5" /> Training</TabsTrigger></TabsList>
          <TabsContent value="pnr" className="mt-0 min-h-0 flex-1 overflow-y-auto px-5 pb-5"><div className="mt-4 rounded-xl border border-[#DAEBDE] bg-[#EFF8F1] p-4"><div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#6A9577]">Record locator</span><span className={`h-2 w-2 rounded-full ${pnr.recordLocator ? 'bg-[#0CA96B]' : 'bg-[#BBC8BB]'}`} /></div><div className="mt-1 font-terminal text-[22px] font-bold tracking-[0.14em] text-[#165E3C]">{pnr.recordLocator || '------'}</div><div className="mt-1 text-[10px] text-[#759383]">{pnr.recordLocator ? 'SIMULATED · ' + pnr.status : 'Unsaved booking · In creation'}</div></div>
            <InfoBlock label={`Passengers · ${pnr.passengers.length}`}>{pnr.passengers.length ? <div className="space-y-2">{pnr.passengers.map((p, i) => <div key={p.id} className="flex items-center gap-2.5"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#EAF2EB] text-[10px] font-bold text-[#4D8260]">{i + 1}</span><span className="font-terminal text-[11px] font-bold text-[#2D4635]">{p.lastName}/{p.firstName} <span className="text-[#90A298]">{p.title}</span></span></div>)}</div> : <p className="text-[11px] text-[#A4AFA6]">No passengers added yet.</p>}</InfoBlock>
            <InfoBlock label={`Itinerary · ${pnr.segments.length} segment${pnr.segments.length === 1 ? '' : 's'}`}>{pnr.segments.length ? <div className="space-y-3">{pnr.segments.map((s) => <div key={s.id} className="rounded-xl border border-[#E5ECE6] p-3"><div className="mb-2 flex items-center justify-between"><span className="font-terminal text-xs font-bold text-[#235640]">{s.airlineCode} {s.flightNumber} <span className="text-[#9AAB9E]">{s.bookingClass}</span></span><span className="rounded bg-[#E5F5E8] px-1.5 py-0.5 font-terminal text-[10px] text-[#168553]">{s.status}{s.seats}</span></div><div className="flex items-center gap-2 font-terminal text-[13px] font-bold text-[#243A2C]">{s.origin} <span className="h-px flex-1 bg-[#D3E5D6]" /><Plane size={13} className="text-[#087F5B]" /><span className="h-px flex-1 bg-[#D3E5D6]" /> {s.destination}</div><div className="mt-2 flex justify-between text-[10px] text-[#8A9A8C]"><span>{s.depDate} · {s.depTime}</span><span>{s.arrTime}</span></div></div>)}</div> : <p className="text-[11px] text-[#A4AFA6]">No flights sold. Try AN15AUGDELBOM.</p>}</InfoBlock>
            <InfoBlock label="Contact details">{pnr.contacts.length ? pnr.contacts.map((c) => <p key={c.id} className="break-all font-terminal text-[11px] text-[#344D3A]">{c.type === 'EMAIL' ? '✉' : '☎'} {c.city} {c.numberOrEmail}</p>) : <p className="text-[11px] text-[#A4AFA6]">No contact details added.</p>}</InfoBlock>
            <InfoBlock label="Fare details">{pnr.fare.priced ? <div className="flex items-baseline justify-between"><span className="text-[11px] text-[#6C806E]">Stored TST · {pnr.fare.currency}</span><span className="font-terminal text-[16px] font-bold text-[#087F5B]">{pnr.fare.totalAllPax.toLocaleString('en-IN')}</span></div> : <p className="text-[11px] text-[#A4AFA6]">Not yet priced. Run FXP.</p>}</InfoBlock>
            <InfoBlock label="Ticketing status"><div className="flex items-center justify-between"><span className="text-[11px] text-[#62776B]">{pnr.ticketingArrangement ? `TK ${pnr.ticketingArrangement}` : 'No arrangement'}</span><Badge className={`rounded-md px-2 py-0.5 text-[9px] font-bold shadow-none ${pnr.ticket.issued ? 'bg-[#E3F6E8] text-[#087F5B]' : 'bg-[#F2F4F2] text-[#8A9B90]'}`}>{pnr.ticket.issued ? 'SIMULATED ISSUED' : 'NOT TICKETED'}</Badge></div>{pnr.ticket.ticketNumbers.map((t) => <p key={t.passengerId} className="mt-2 font-terminal text-[10px] text-[#50735E]">{t.number}</p>)}</InfoBlock>
            <InfoBlock label="SSR / OSI">{pnr.ssrs.length || pnr.osis.length ? [...pnr.ssrs.map((s) => `SSR ${s.details}`), ...pnr.osis.map((o) => `OSI ${o.text}`)].map((v, i) => <p key={i} className="text-[11px] text-[#425D48]">{v}</p>) : <p className="text-[11px] text-[#A4AFA6]">No special requests.</p>}</InfoBlock>
            <InfoBlock label="Remarks">{pnr.remarks.length ? pnr.remarks.map((r) => <p key={r.id} className="text-[11px] text-[#425D48]">{r.type} {r.text}</p>) : <p className="text-[11px] text-[#A4AFA6]">No remarks added.</p>}</InfoBlock>
          </TabsContent>
          <TabsContent value="training" className="mt-0 min-h-0 flex-1 overflow-y-auto px-5 pb-5"><div className="mt-4 overflow-hidden rounded-xl border border-[#DBE9DE]"><img src="/assets/aviation-routes.png" alt="Illustrated route network" className="h-24 w-full object-cover" /><div className="p-3"><h3 className="text-[12px] font-bold text-[#214935]">Your first booking, step by step.</h3><p className="mt-1 text-[10px] leading-relaxed text-[#87988A]">Follow the workflow below. Each step checks your live session automatically.</p></div></div><div className="mt-4 flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-widest text-[#8FA093]">BOOKING WORKFLOW</span><span className="font-terminal text-[10px] font-bold text-[#087F5B]">{trainingSteps.filter((step) => step.check(pnr, active)).length}/8 COMPLETE</span></div><div className="mt-3 space-y-2">{trainingSteps.map((step, index) => { const done = step.check(pnr, active); return <div key={step.title} className={`rounded-xl border p-3 ${done ? 'border-[#BFE4C9] bg-[#F3FAF4]' : 'border-[#E8ECE8] bg-white'}`}><div className="flex items-start gap-2.5"><span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${done ? 'bg-[#0CA66B] text-white' : 'bg-[#EEF2EE] text-[#8D9D90]'}`}>{done ? '✓' : index + 1}</span><div className="min-w-0 flex-1"><div className="text-[11px] font-bold text-[#365544]">{step.title}</div><div className="mt-1 break-all font-terminal text-[10px] text-[#087F5B]">{step.command}</div></div></div><div className="mt-2 flex gap-3 pl-7"><button onClick={() => setShowHint(showHint === index ? null : index)} className="text-[10px] font-semibold text-[#82968A] hover:text-[#087F5B]">{showHint === index ? 'Hide hint' : 'Show hint'}</button>{index !== 6 && <button onClick={() => { setInput(step.command); inputRef.current?.focus(); }} className="text-[10px] font-semibold text-[#087F5B] hover:underline">Use command ↗</button>}</div>{showHint === index && <p className="mt-2 pl-7 text-[10px] leading-relaxed text-[#6A806F]">{step.hint}</p>}</div>; })}</div></TabsContent>
        </Tabs></aside>}
      {!showSidebar && <button title="Open live inspector" onClick={() => setShowSidebar(true)} className="absolute right-0 top-6 z-10 flex h-12 w-8 items-center justify-center rounded-l-lg bg-white text-[#087F5B] shadow-md hover:w-10"><ChevronLeft size={18} /></button>}
    </div>
  </div>;
}

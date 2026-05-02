import { useEffect, useMemo, useState } from "react";

export function DeckFooter({ packetCount }: { packetCount: number }) {
  const uptime = useUptime();
  const ioRate = useMemo(() => {
    const wave = 8 + ((packetCount * 17) % 96) / 10;
    return `${wave.toFixed(1)}kB/s`;
  }, [packetCount]);
  const load = useMemo(() => 28 + ((packetCount * 9) % 62), [packetCount]);

  return (
    <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-[color:var(--chassis-edge)] bg-[color:var(--screen-void)] px-3 py-1 text-[color:var(--phosphor-mid)] shadow-[0_-8px_22px_rgba(0,0,0,0.35)]">
      <div className="console-mono mx-auto flex max-w-[1680px] flex-wrap items-center gap-x-5 gap-y-1 text-[9px] uppercase tracking-[0.14em]">
        <span>MODEL: ASMR-DECK-II</span>
        <span>FW: 0.1.0</span>
        <span>IO: {ioRate} ▲</span>
        <span>░ {load}%</span>
        <span className="ml-auto">UPTIME: {uptime}</span>
      </div>
    </footer>
  );
}

function useUptime() {
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

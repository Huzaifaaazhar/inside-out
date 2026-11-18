import { useEffect, useRef } from 'react';
import { EMOTIONS, EMOTION_ORDER } from './game/content/emotions';
import { Game, getGame, setGame } from './game/Game';
import type { OpeningScene } from './game/scenes/OpeningScene';
import { useGame } from './state/store';
import { ConsolePanel } from './ui/ConsolePanel';
import { DialogueBox } from './ui/DialogueBox';
import { Hud } from './ui/Hud';
import { MindAtlas } from './ui/MindAtlas';
import { MoodDial, canSwitch } from './ui/MoodDial';
import { HelpSheet, InspectCard, PauseMenu } from './ui/Sheets';
import { Captions, TitleScreen } from './ui/Title';
import { MemoryTheatre } from './ui/MemoryTheatre';
import { ActivityPanel, Journal, MindReport, NightReport } from './ui/MindSheets';
import { EndingScreen } from './ui/FinaleUI';

function useGlobalKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const s = useGame.getState();
      if (s.phase === 'opening') {
        if (e.code === 'Escape') (getGame()?.scenes.opening as OpeningScene | undefined)?.skip();
        return;
      }
      if (s.phase !== 'playing') return;
      if (e.code === 'Escape') {
        if (s.nightReport) return;
        if (s.endingOpen) return s.setEndingOpen(false);
        if (s.theatre) s.setTheatre(null);
        else if (s.journalOpen) s.setJournal(false);
        else if (s.reportOpen) s.setReport(false);
        else if (s.inspect) s.setInspect(null);
        else if (s.mapOpen) s.setMap(false);
        else if (s.helpOpen) s.setHelp(false);
        else s.setMenu(!s.menuOpen);
        return;
      }
      const overlay = s.menuOpen || s.helpOpen || s.inspect || s.mapOpen || s.theatre || s.journalOpen || s.reportOpen || s.nightReport || s.endingOpen || s.consoleStage === 'reflect';
      if (overlay) {
        if (e.code === 'KeyJ' && s.journalOpen && !s.theatre) s.setJournal(false);
        if (e.code === 'KeyR' && s.reportOpen) s.setReport(false);
        if (e.code === 'KeyM' && s.mapOpen) s.setMap(false);
        if (e.code === 'KeyH' && s.helpOpen) s.setHelp(false);
        return;
      }
      const num = /^(?:Digit|Numpad)([1-5])$/.exec(e.code);
      if (num && canSwitch(s)) {
        s.setActive(EMOTION_ORDER[Number(num[1]) - 1]);
        return;
      }
      if (e.code === 'KeyM' && s.consoleStage === 'off' && !s.dialogue && !s.transitioning && !s.activity) s.setMap(true);
      if (e.code === 'KeyH' && !s.dialogue) s.setHelp(true);
      if (s.mind && !s.dialogue && !s.activity && s.consoleStage === 'off') {
        if (e.code === 'KeyJ') s.setJournal(true);
        if (e.code === 'KeyR') s.setReport(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phase = useGame((s) => s.phase);
  const active = useGame((s) => s.active);
  const reduced = useGame((s) => s.reducedMotion);
  useGlobalKeys();

  useEffect(() => {
    const g = new Game(canvasRef.current!);
    setGame(g);
    g.start();
    // expose for debugging and automated tests
    (window as unknown as { __game: Game; __store: typeof useGame }).__game = g;
    (window as unknown as { __store: typeof useGame }).__store = useGame;
    return () => {
      g.dispose();
      setGame(null);
    };
  }, []);

  useEffect(() => {
    const E = EMOTIONS[active];
    document.documentElement.style.setProperty('--accent', E.color);
  }, [active]);

  useEffect(() => {
    document.documentElement.dataset.reduced = String(reduced);
  }, [reduced]);

  return (
    <>
      <canvas ref={canvasRef} className="stage" aria-label="Riley's mind. Use the controls below, or press H for keyboard controls." role="img" />
      <div className="overlay">
        {phase === 'title' && <TitleScreen />}
        {phase === 'opening' && <Captions />}
        {phase === 'playing' && (
          <>
            <Hud />
            <ConsolePanel />
            <DialogueBox />
            <MoodDial />
            <ActivityPanel />
            <MindAtlas />
            <Journal />
            <MindReport />
            <MemoryTheatre />
            <NightReport />
            <EndingScreen />
            <InspectCard />
            <HelpSheet />
            <PauseMenu />
          </>
        )}
      </div>
    </>
  );
}

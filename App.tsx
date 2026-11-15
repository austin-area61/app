import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, useColorScheme, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Board from './src/components/Board';
import { Level, arrowShape, buildLevel, difficulty, hitTest, isBlocked } from './src/game/logic';
import { hapticError, hapticTap, hapticWin, setMuted as setAudioMuted, sfx } from './src/lib/audio';

type Status = 'play' | 'won' | 'lost';

export default function App() {
  const dark = useColorScheme() === 'dark';
  const C = { bg: dark ? '#10142a' : '#ffffff', fg: dark ? '#e6e9ff' : '#14183a', chip: dark ? '#1c2244' : '#eef1f6', acc: '#2f7cf0', bad: '#e5384f', mut: '#8a90a8' };
  const { width, height } = useWindowDimensions();

  const [level, setLevel] = useState(1);
  const levelRef = useRef(1);
  const lv = useRef<Level>(buildLevel(1));
  const [, setTick] = useState(0);
  const [hearts, setHearts] = useState(3);
  const heartsRef = useRef(3);
  const [hints, setHints] = useState(3);
  const [hintId, setHintId] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>('play');
  const statusRef = useRef<Status>('play');
  const [muted, setMuted] = useState(false);
  const flashUntil = useRef(0);
  const pop = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;

  const L = lv.current;
  const cs = Math.max(8, Math.floor(Math.min((Math.min(width, 480) - 24) / L.cols, (height - 300) / L.rows)));

  const setStatusBoth = (s: Status) => { statusRef.current = s; setStatus(s); };

  const start = useCallback((n: number) => {
    lv.current = buildLevel(n);
    levelRef.current = n;
    heartsRef.current = 3;
    setLevel(n); setHearts(3); setHints(3); setHintId(null);
    statusRef.current = 'play'; setStatus('play');
    pop.setValue(0);
    setTick((t) => t + 1);
  }, [pop]);

  useEffect(() => {
    AsyncStorage.getItem('ae_level').then((v) => { const n = Number(v); if (n > 1) start(n); }).catch(() => {});
  }, [start]);

  // Frame loop: advances sliding arrows, flashes and win detection
  useEffect(() => {
    let raf = 0, last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(40, now - last);
      last = now;
      const cur = lv.current;
      let busy = false;
      for (const a of cur.arrows) {
        if (!a.sliding) continue;
        busy = true;
        a.s += dt * cs * 0.028;
        const sh = arrowShape(a, cs, cur.cols, cur.rows);
        if (!sh || a.s > sh.travel) a.sliding = false;
      }
      if (busy || now < flashUntil.current || hintId !== null) setTick((t) => t + 1);
      if (statusRef.current === 'play' && !busy && cur.arrows.length && cur.arrows.every((a) => a.out)) {
        setStatusBoth('won');
        sfx('win'); hapticWin();
        AsyncStorage.setItem('ae_level', String(levelRef.current + 1)).catch(() => {});
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [cs, hintId]);

  useEffect(() => {
    if (status === 'play') return;
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, friction: 6, useNativeDriver: true }).start();
  }, [status, pop]);

  const onTap = (x: number, y: number) => {
    if (statusRef.current !== 'play') return;
    const a = hitTest(lv.current, x, y, cs);
    if (!a) return;
    setHintId(null);
    if (isBlocked(lv.current, a)) {
      a.bad = performance.now();
      flashUntil.current = a.bad + 450;
      sfx('blocked'); hapticError();
      shake.setValue(0);
      Animated.sequence([-8, 8, -6, 6, 0].map((v) => Animated.timing(shake, { toValue: v, duration: 50, useNativeDriver: true }))).start();
      heartsRef.current -= 1;
      setHearts(heartsRef.current);
      if (heartsRef.current <= 0) { setStatusBoth('lost'); setTimeout(() => sfx('lose'), 350); }
    } else {
      a.out = true; a.sliding = true; a.s = 0;
      sfx('swoosh'); hapticTap();
      setTick((t) => t + 1);
    }
  };

  const hint = () => {
    if (statusRef.current !== 'play' || hints <= 0) return;
    const free = lv.current.arrows.filter((a) => !a.out && !isBlocked(lv.current, a));
    if (!free.length) return;
    setHintId(free[Math.floor(Math.random() * free.length)].id);
    setHints((h) => h - 1);
  };

  const toggleMute = () => { setMuted((m) => { setAudioMuted(!m); return !m; }); };
  const remaining = lv.current.arrows.filter((a) => !a.out).length;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[s.root, { backgroundColor: C.bg }]}>
        <StatusBar style={dark ? 'light' : 'dark'} />
        <Text style={[s.title, { color: C.fg }]}>Level {level}</Text>
        <View style={s.top}>
          <Chip C={C} text={`➶ ${remaining}`} />
          <Animated.View style={{ flexDirection: 'row', transform: [{ translateX: shake }] }}>
            {[0, 1, 2].map((i) => (
              <Text key={i} style={{ fontSize: 28, marginHorizontal: 3, color: i < hearts ? C.bad : C.mut, opacity: i < hearts ? 1 : 0.4 }}>♥</Text>
            ))}
          </Animated.View>
          <Chip C={C} text={difficulty(level)} />
        </View>
        <View style={s.boardWrap}>
          <Board level={lv.current} cs={cs} fg={C.fg} acc={C.acc} bad={C.bad} hintId={hintId} now={performance.now()} onTap={onTap} />
        </View>
        <View style={s.bar}>
          <Btn C={C} label={`💡 Hint ${hints}`} onPress={hint} />
          <Btn C={C} label="↻ Restart" onPress={() => start(level)} />
          <Btn C={C} label={muted ? '🔇' : '🔊'} onPress={toggleMute} />
        </View>
        {status !== 'play' && (
          <View style={s.overlay}>
            <Animated.View style={[s.card, { backgroundColor: C.bg, transform: [{ scale: pop }], opacity: pop }]}>
              <Text style={[s.cardTitle, { color: C.fg }]}>{status === 'won' ? 'Level complete' : 'Out of hearts'}</Text>
              <Text style={{ color: C.mut, marginBottom: 18, textAlign: 'center' }}>
                {status === 'won' ? 'Every arrow escaped.' : 'That one was blocked. Give it another go.'}
              </Text>
              <Pressable style={[s.cta, { backgroundColor: C.acc }]} onPress={() => start(status === 'won' ? level + 1 : level)}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{status === 'won' ? 'Next level' : 'Try again'}</Text>
              </Pressable>
            </Animated.View>
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const Chip = ({ C, text }: { C: any; text: string }) => (
  <View style={[s.chip, { backgroundColor: C.chip }]}><Text style={{ color: C.fg, fontWeight: '600', fontSize: 15 }}>{text}</Text></View>
);
const Btn = ({ C, label, onPress }: { C: any; label: string; onPress: () => void }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [s.btn, { backgroundColor: C.chip, transform: [{ scale: pressed ? 0.96 : 1 }] }]}>
    <Text style={{ color: C.fg, fontWeight: '600', fontSize: 16 }}>{label}</Text>
  </Pressable>
);

const s = StyleSheet.create({
  root: { flex: 1, alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '600', marginTop: 10, marginBottom: 8 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '92%', maxWidth: 480, marginBottom: 10 },
  chip: { borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, minWidth: 64, alignItems: 'center' },
  boardWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  bar: { flexDirection: 'row', gap: 12, paddingVertical: 12 },
  btn: { borderRadius: 999, paddingVertical: 12, paddingHorizontal: 20 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,14,40,.55)', alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 20, paddingVertical: 26, paddingHorizontal: 30, alignItems: 'center', maxWidth: 300 },
  cardTitle: { fontSize: 22, fontWeight: '700', marginBottom: 6 },
  cta: { borderRadius: 999, paddingVertical: 12, paddingHorizontal: 28 },
});

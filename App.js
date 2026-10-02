import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

const STORAGE_KEY = 'oct-2026-plan-tracker-v1';

const C = {
  bg: '#F3F5F9',
  card: '#FFFFFF',
  ink: '#14213D',
  sub: '#5B6577',
  faint: '#A3ACBC',
  line: '#D9DEE7',
  blue: '#2E5BBA',
  blueSoft: '#E3EBFA',
  gold: '#E9A23B',
  goldSoft: '#FCEFD9',
  danger: '#B3261E',
  scrim: 'rgba(20, 33, 61, 0.45)',
};

// PLAN-START
const pad = (n) => String(n).padStart(2, '0');
const keyFor = (d) => `2026-10-${pad(d)}`;
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function lift(id, name, sets, target, rest, opts = {}) {
  return { id, name, sets, target, rest, kind: 'lift', unit: 'reps', weighted: true, ...opts };
}

function task(id, name, sets, target, kind) {
  return { id, name, sets, target, rest: null, kind, unit: null, weighted: false };
}

const WORKOUTS = {
  UA: {
    title: 'Upper A',
    items: [
      lift('floor-press', 'Dumbbell floor press', 5, '8–12 reps', '2–3 min'),
      lift('one-arm-row', 'One-arm dumbbell row', 5, '8–12 reps each side', '2 min'),
      lift('overhead-press', 'Standing overhead press', 5, '8–12 reps', '2–3 min'),
      lift('push-ups', 'Push-ups', 5, '1–2 reps short of failure', '2 min', { weighted: false }),
      lift('db-curl', 'Dumbbell curl', 5, '10–15 reps', '1–2 min'),
      lift('oh-triceps', 'Overhead triceps extension', 5, '10–15 reps', '1–2 min'),
    ],
  },
  LA: {
    title: 'Lower A',
    items: [
      lift('goblet-squat', 'Goblet squat', 5, '8–15 reps', '2–3 min'),
      lift('rdl', 'Romanian deadlift', 5, '8–12 reps', '2–3 min'),
      lift('split-squat', 'Bulgarian split squat', 5, '8–12 reps each leg', '2 min'),
      lift('calf-raise', 'Single-leg calf raise', 5, '10–20 reps each leg', '1 min'),
      lift('plank', 'Plank', 5, '30–60 sec', '1 min', { unit: 'sec', weighted: false }),
    ],
  },
  UB: {
    title: 'Upper B',
    items: [
      lift('push-ups', 'Push-ups', 5, '1–2 reps short of failure', '2 min', { weighted: false }),
      lift('bent-row', 'Bent-over row', 5, '8–12 reps', '2 min'),
      lift('floor-fly', 'Dumbbell floor fly', 5, '10–15 reps', '1–2 min'),
      lift('pullover', 'Dumbbell pullover', 5, '10–15 reps', '1–2 min'),
      lift('lateral-raise', 'Lateral raise', 5, '12–20 reps', '1–2 min'),
      lift('rear-fly', 'Bent-over rear-delt fly', 5, '12–20 reps', '1 min'),
      lift('hammer-curl', 'Hammer curl', 5, '10–15 reps', '1–2 min'),
      lift('skull-crusher', 'Lying skull crusher', 5, '10–15 reps', '1–2 min'),
    ],
  },
  LB: {
    title: 'Lower B',
    items: [
      lift('reverse-lunge', 'Reverse lunge', 5, '8–12 reps each leg', '2 min'),
      lift('sl-rdl', 'Single-leg Romanian deadlift', 5, '8–12 reps each leg', '2 min'),
      lift('hip-thrust', 'Dumbbell hip thrust', 5, '10–15 reps', '2 min'),
      lift('paused-goblet', 'Paused goblet squat', 5, '10–15 reps', '2 min'),
      lift('calf-raise', 'Single-leg calf raise', 5, '10–20 reps each leg', '1 min'),
      lift('leg-raise', 'Lying leg raise', 5, '10–15 reps', '1 min', { weighted: false }),
    ],
  },
};

function weekFor(d) {
  if (d <= 4) {
    return { label: 'Kickoff', effort: 'Find your starting weights. Stop 2–3 reps short of failure.', rounds: 6, roundMin: 2, steady: '25 min', extra: 0 };
  }
  if (d <= 11) {
    return { label: 'Week 1', effort: 'Learn the movements. Stop 2–3 reps short of failure.', rounds: 6, roundMin: 2, steady: '25 min', extra: 0 };
  }
  if (d <= 18) {
    return { label: 'Week 2', effort: 'Stop 1–2 reps short of failure and start adding reps or weight.', rounds: 6, roundMin: 3, steady: '30 min', extra: 0 };
  }
  if (d <= 25) {
    return { label: 'Week 3', effort: 'Stop 1–2 reps short of failure and keep adding reps or weight.', rounds: 8, roundMin: 3, steady: '30–35 min', extra: 0 };
  }
  return { label: 'Week 4', effort: 'Take the last set of each exercise to 0–1 reps short of failure.', rounds: 8, roundMin: 3, steady: '30–35 min', extra: 0 };
}

const KICKOFF = { 2: 'UA', 3: 'LA', 4: 'REST' };
const BY_WEEKDAY = { 0: 'REST', 1: 'UA', 2: 'LA', 3: 'BOXI', 4: 'UB', 5: 'LB', 6: 'BOXS' };
const SHORT = { UA: 'Up A', LA: 'Lo A', UB: 'Up B', LB: 'Lo B', BOXI: 'Box', BOXS: 'Box', REST: 'Rest' };

function buildDay(d) {
  const date = new Date(2026, 9, d);
  const wd = date.getDay();
  const code = d <= 4 ? KICKOFF[d] : BY_WEEKDAY[wd];
  const wk = weekFor(d);
  let title;
  let note;
  let items = [];

  if (WORKOUTS[code]) {
    title = WORKOUTS[code].title;
    note = wk.effort;
    items = WORKOUTS[code].items.map((it, i) => ({ ...it, sets: it.sets + (i < 2 ? wk.extra : 0) }));
  } else if (code === 'BOXI') {
    title = 'Boxing intervals';
    note = 'Warm up for 5 minutes. A hard round means you could only say a few words.' +
      (d >= 26 ? ' Add 2 rounds if you have more in you.' : '');
    items = [task('box-intervals', 'Thrill of the Fight 2 rounds', wk.rounds, `${wk.roundMin} min hard, 1 min rest`, 'round')];
  } else if (code === 'BOXS') {
    title = 'Boxing, steady';
    note = 'Hold a pace you can keep for the whole session. Fewer all-out flurries.';
    items = [task('box-steady', 'Thrill of the Fight 2 steady session', 1, wk.steady, 'check')];
  } else {
    title = 'Rest';
    note = 'Recovery day. Just the walk.';
  }

  if (d === 2) {
    items.unshift(task('check-in', 'Check-in: body weight, waist, photo', 1, 'Your baseline for Oct 30', 'check'));
  }
  if (d === 30) {
    items.push(task('check-in', 'Check-in: body weight, waist, photo', 1, 'Compare with Oct 2', 'check'));
  }
  items.push(task('walk', 'Walk', 1, '20–30 min, ideally after a meal', 'check'));

  return { d, key: keyFor(d), weekday: WEEKDAY_NAMES[wd], weekdayShort: WEEKDAY_SHORT[wd], code, short: SHORT[code], title, note, week: wk.label, items };
}

const PLAN = Array.from({ length: 29 }, (_, i) => buildDay(i + 2));
const PLAN_BY_KEY = Object.fromEntries(PLAN.map((day) => [day.key, day]));
// PLAN-END

// LOGIC-START
function readEntry(logs, dayKey, item) {
  const raw = logs[dayKey] && logs[dayKey][item.id];
  const sets = Array.from({ length: item.sets }, (_, i) => (raw && raw.sets && raw.sets[i]) || { done: false });
  const done = !!(raw && raw.done) && sets.every((s) => s.done);
  return { sets, done };
}

function dayProgress(logs, day) {
  const total = day.items.length;
  const done = day.items.filter((item) => readEntry(logs, day.key, item).done).length;
  return { done, total };
}

function lastPerformance(logs, beforeKey, itemId, setIdx) {
  const keys = PLAN.map((p) => p.key).filter((k) => k < beforeKey).reverse();
  for (const k of keys) {
    const raw = logs[k] && logs[k][itemId];
    const done = raw && raw.sets ? raw.sets.filter((s) => s && s.done && s.reps != null) : [];
    if (done.length) {
      const exact = raw.sets[setIdx];
      const s = exact && exact.done && exact.reps != null ? exact : done[done.length - 1];
      return { key: k, ...s };
    }
  }
  return null;
}
// LOGIC-END

function fmtSet(s, item) {
  const amount = item.unit === 'sec' ? `${s.reps} s` : `${s.reps}`;
  if (!s.weight) return item.unit === 'sec' ? amount : `${s.reps} reps`;
  return `${amount} × ${s.weight} ${s.unit}`;
}

function fmtDay(key) {
  const day = PLAN_BY_KEY[key];
  return day ? `${day.weekdayShort}, Oct ${day.d}` : key;
}

function describe(item) {
  if (item.kind === 'lift') return `${item.sets} sets, ${item.target}, rest ${item.rest}`;
  if (item.kind === 'round') return `${item.sets} rounds, ${item.target}`;
  return item.target;
}

function setLabel(item, i) {
  return item.kind === 'round' ? `Round ${i + 1}` : `Set ${i + 1}`;
}

function setNoun(item, n) {
  if (item.kind === 'round') return n === 1 ? 'round' : 'rounds';
  return n === 1 ? 'set' : 'sets';
}

function defaultKey() {
  const now = new Date();
  if (now.getFullYear() < 2026 || (now.getFullYear() === 2026 && (now.getMonth() < 9 || (now.getMonth() === 9 && now.getDate() < 2)))) {
    return keyFor(2);
  }
  if (now.getFullYear() === 2026 && now.getMonth() === 9 && now.getDate() <= 30) {
    return keyFor(now.getDate());
  }
  return keyFor(30);
}

function todayKey() {
  const now = new Date();
  if (now.getFullYear() === 2026 && now.getMonth() === 9) {
    const k = keyFor(now.getDate());
    return PLAN_BY_KEY[k] ? k : null;
  }
  return null;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Tracker />
    </SafeAreaProvider>
  );
}

function Tracker() {
  const [logs, setLogs] = useState({});
  const [lastUnit, setLastUnit] = useState('lbs');
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState('calendar');
  const [selectedKey, setSelectedKey] = useState(defaultKey);
  const [prompt, setPrompt] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          setLogs(parsed.logs || {});
          if (parsed.lastUnit === 'lbs' || parsed.lastUnit === 'kg') setLastUnit(parsed.lastUnit);
        }
      } catch (e) {
        Alert.alert('Saved log could not be read', 'The tracker started with an empty log.');
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ logs, lastUnit })).catch(() => {
      Alert.alert('Not saved', 'Your last change could not be saved to the phone. Try again.');
    });
  }, [logs, lastUnit, loaded]);

  const updateEntry = useCallback((dayKey, item, change) => {
    setLogs((prev) => {
      const current = readEntry(prev, dayKey, item);
      const next = change({ sets: current.sets.map((s) => ({ ...s })), done: current.done });
      return { ...prev, [dayKey]: { ...(prev[dayKey] || {}), [item.id]: next } };
    });
  }, []);

  const onSetPress = (day, item, idx) => {
    const entry = readEntry(logs, day.key, item);
    if (item.kind !== 'lift') {
      updateEntry(day.key, item, (e) => {
        e.sets[idx] = e.sets[idx].done ? { done: false } : { done: true };
        if (!e.sets[idx].done) e.done = false;
        return e;
      });
      return;
    }
    setPrompt({
      dayKey: day.key,
      item,
      idx,
      existing: entry.sets[idx].done ? entry.sets[idx] : null,
      last: lastPerformance(logs, day.key, item.id, idx),
    });
  };

  const onItemPress = (day, item) => {
    const entry = readEntry(logs, day.key, item);
    if (item.kind === 'check') {
      updateEntry(day.key, item, (e) => {
        const on = !entry.done;
        return { sets: e.sets.map(() => ({ done: on })), done: on };
      });
      return;
    }
    if (entry.done) {
      updateEntry(day.key, item, (e) => ({ ...e, done: false }));
      return;
    }
    const left = entry.sets.filter((s) => !s.done).length;
    if (left > 0) {
      Alert.alert(
        'Finish the sets first',
        `${left} of ${item.sets} ${setNoun(item, item.sets)} still open on ${item.name}. Check them off, then check off the exercise.`
      );
      return;
    }
    updateEntry(day.key, item, (e) => ({ ...e, done: true }));
  };

  const saveSet = ({ reps, weight, unit }) => {
    const { dayKey, item, idx } = prompt;
    updateEntry(dayKey, item, (e) => {
      e.sets[idx] = { done: true, reps, weight, unit };
      return e;
    });
    setLastUnit(unit);
    setPrompt(null);
  };

  const uncheckSet = () => {
    const { dayKey, item, idx } = prompt;
    updateEntry(dayKey, item, (e) => {
      e.sets[idx] = { done: false };
      e.done = false;
      return e;
    });
    setPrompt(null);
  };

  const eraseAll = () => {
    Alert.alert('Erase all logged data?', 'Every checked set, rep and weight will be deleted from this phone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Erase', style: 'destructive', onPress: () => setLogs({}) },
    ]);
  };

  if (!loaded) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.loading}>Loading your log…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      {tab === 'calendar' ? (
        <CalendarScreen
          logs={logs}
          selectedKey={selectedKey}
          onSelect={setSelectedKey}
          onSetPress={onSetPress}
          onItemPress={onItemPress}
        />
      ) : (
        <HistoryScreen logs={logs} onErase={eraseAll} />
      )}
      <TabBar tab={tab} onChange={setTab} />
      <SetPrompt
        prompt={prompt}
        lastUnit={lastUnit}
        onSave={saveSet}
        onUncheck={uncheckSet}
        onCancel={() => setPrompt(null)}
      />
    </SafeAreaView>
  );
}

function CalendarScreen({ logs, selectedKey, onSelect, onSetPress, onItemPress }) {
  const day = PLAN_BY_KEY[selectedKey];
  const today = todayKey();
  const completeDays = PLAN.filter((p) => {
    const { done, total } = dayProgress(logs, p);
    return done === total;
  }).length;

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.monthHead}>
        <Text style={styles.month}>October 2026</Text>
        <Text style={styles.monthSub}>
          {completeDays} of {PLAN.length} days complete
        </Text>
      </View>

      <MonthGrid logs={logs} selectedKey={selectedKey} todayKey={today} onSelect={onSelect} />

      {today && today !== selectedKey ? (
        <Pressable onPress={() => onSelect(today)} style={styles.todayLink} accessibilityRole="button">
          <Text style={styles.todayLinkText}>Go to today</Text>
        </Pressable>
      ) : null}

      {day ? (
        <View>
          <View style={styles.dayHead}>
            <Text style={styles.dayDate}>
              {day.weekday}, October {day.d}
            </Text>
            <Text style={styles.dayTitle}>{day.title}</Text>
            <Text style={styles.dayNote}>
              <Text style={styles.dayWeek}>{day.week}. </Text>
              {day.note}
            </Text>
          </View>
          {day.items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              entry={readEntry(logs, day.key, item)}
              onItemPress={() => onItemPress(day, item)}
              onSetPress={(i) => onSetPress(day, item, i)}
            />
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

function MonthGrid({ logs, selectedKey, todayKey: today, onSelect }) {
  const lead = (new Date(2026, 9, 1).getDay() + 6) % 7;
  const cells = [...Array(lead).fill(null), ...Array.from({ length: 31 }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  return (
    <View style={styles.grid}>
      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((w) => (
        <Text key={w} style={styles.gridHead}>
          {w}
        </Text>
      ))}
      {cells.map((d, i) => {
        if (!d) return <View key={`blank-${i}`} style={styles.cell} />;
        const day = PLAN_BY_KEY[keyFor(d)];
        if (!day) {
          return (
            <View key={d} style={styles.cell}>
              <View style={styles.cellInner}>
                <Text style={styles.cellNumOff}>{d}</Text>
              </View>
            </View>
          );
        }
        const { done, total } = dayProgress(logs, day);
        const complete = done === total;
        const selected = day.key === selectedKey;
        const isToday = day.key === today;
        return (
          <View key={d} style={styles.cell}>
            <Pressable
              onPress={() => onSelect(day.key)}
              style={[styles.cellInner, isToday && styles.cellToday, selected && styles.cellSelected]}
              accessibilityRole="button"
              accessibilityLabel={`${day.weekday} October ${d}, ${day.title}, ${done} of ${total} done`}
            >
              <Text style={[styles.cellNum, selected && styles.cellTextSelected]}>{d}</Text>
              <Text style={[styles.cellCode, day.code === 'REST' && styles.cellCodeRest, selected && styles.cellTextSelected]}>
                {day.short}
              </Text>
              <View style={[styles.meter, selected && styles.meterSelected]}>
                <View
                  style={[
                    styles.meterFill,
                    { width: `${Math.round((done / total) * 100)}%` },
                    complete && styles.meterFillDone,
                  ]}
                />
              </View>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

function ItemRow({ item, entry, onItemPress, onSetPress }) {
  const open = entry.sets.filter((s) => !s.done).length;
  const locked = item.kind !== 'check' && open > 0;

  return (
    <View style={[styles.item, entry.done && styles.itemDone]}>
      <View style={styles.itemTop}>
        <Pressable
          onPress={onItemPress}
          hitSlop={10}
          style={[styles.box, locked && styles.boxLocked, entry.done && styles.boxDone]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: entry.done, disabled: locked }}
          accessibilityLabel={`${item.name}${locked ? `, ${open} ${setNoun(item, open)} left` : ''}`}
        >
          {entry.done ? <Text style={styles.boxTick}>✓</Text> : null}
        </Pressable>
        <View style={styles.itemText}>
          <Text style={[styles.itemName, entry.done && styles.itemNameDone]}>{item.name}</Text>
          <Text style={styles.itemMeta}>{describe(item)}</Text>
          {locked && open < item.sets ? (
            <Text style={styles.itemLeft}>
              {open} {setNoun(item, open)} left
            </Text>
          ) : null}
        </View>
      </View>

      {item.kind !== 'check' ? (
        <View style={styles.sets}>
          {entry.sets.map((s, i) => (
            <Pressable
              key={i}
              onPress={() => onSetPress(i)}
              style={[styles.pill, item.kind === 'round' && styles.pillRound, s.done && styles.pillDone]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: !!s.done }}
              accessibilityLabel={s.done && item.kind === 'lift' ? `${setLabel(item, i)}, ${fmtSet(s, item)}` : setLabel(item, i)}
            >
              <Text style={[styles.pillLabel, s.done && styles.pillLabelDone]}>
                {item.kind === 'round' ? `${i + 1}` : setLabel(item, i)}
              </Text>
              {item.kind === 'lift' ? (
                <Text style={[styles.pillValue, s.done && styles.pillValueDone]}>
                  {s.done ? fmtSet(s, item) : 'Tap to log'}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function SetPrompt({ prompt, lastUnit, onSave, onUncheck, onCancel }) {
  const insets = useSafeAreaInsets();
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [unit, setUnit] = useState(lastUnit);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!prompt) return;
    const { existing, last } = prompt;
    setReps(existing ? String(existing.reps) : '');
    if (existing) setWeight(existing.weight ? String(existing.weight) : '');
    else setWeight(last && last.weight ? String(last.weight) : '');
    setUnit((existing && existing.unit) || (last && last.unit) || lastUnit);
    setError('');
  }, [prompt, lastUnit]);

  const item = prompt ? prompt.item : null;
  const isSec = item && item.unit === 'sec';

  const save = () => {
    const r = parseInt(reps, 10);
    if (!Number.isFinite(r) || r <= 0) {
      setError(isSec ? 'Enter how many seconds you held it.' : 'Enter how many reps you did.');
      return;
    }
    const text = weight.replace(',', '.').trim();
    let w = 0;
    if (text) {
      w = Number(text);
      if (!Number.isFinite(w) || w < 0) {
        setError('Weight must be a number, like 25 or 12.5.');
        return;
      }
    } else if (item.weighted) {
      setError('Enter the weight you used, per dumbbell.');
      return;
    }
    onSave({ reps: r, weight: w, unit });
  };

  return (
    <Modal visible={!!prompt} transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetWrap}>
        <Pressable style={styles.scrim} onPress={onCancel} accessibilityLabel="Close" />
        {item ? (
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
            <Text style={styles.sheetTitle}>{item.name}</Text>
            <Text style={styles.sheetSub}>
              Set {prompt.idx + 1} of {item.sets}. Target {item.target}.
            </Text>
            <Text style={styles.sheetLast}>
              {prompt.last ? `Last time, ${fmtDay(prompt.last.key)}: ${fmtSet(prompt.last, item)}` : 'First time logging this exercise.'}
            </Text>

            <View style={styles.fields}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{isSec ? 'Seconds' : 'Reps'}</Text>
                <TextInput
                  value={reps}
                  onChangeText={(t) => setReps(t.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  autoFocus
                  maxLength={3}
                  placeholder="0"
                  placeholderTextColor={C.faint}
                  style={styles.input}
                  accessibilityLabel={isSec ? 'Seconds' : 'Reps'}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{item.weighted ? 'Weight per dumbbell' : 'Added weight'}</Text>
                <TextInput
                  value={weight}
                  onChangeText={(t) => setWeight(t.replace(/[^0-9.,]/g, ''))}
                  keyboardType="decimal-pad"
                  maxLength={6}
                  placeholder={item.weighted ? '0' : 'Optional'}
                  placeholderTextColor={C.faint}
                  style={styles.input}
                  accessibilityLabel="Weight"
                />
                <View style={styles.seg}>
                  {['lbs', 'kg'].map((u) => (
                    <Pressable
                      key={u}
                      onPress={() => setUnit(u)}
                      style={[styles.segBtn, unit === u && styles.segBtnOn]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: unit === u }}
                    >
                      <Text style={[styles.segText, unit === u && styles.segTextOn]}>{u}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.actions}>
              <Pressable onPress={onCancel} style={styles.secondary} accessibilityRole="button">
                <Text style={styles.secondaryText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={save} style={styles.primary} accessibilityRole="button">
                <Text style={styles.primaryText}>{prompt.existing ? 'Save changes' : 'Check off set'}</Text>
              </Pressable>
            </View>
            {prompt.existing ? (
              <Pressable onPress={onUncheck} style={styles.uncheck} accessibilityRole="button">
                <Text style={styles.uncheckText}>Uncheck this set</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function HistoryScreen({ logs, onErase }) {
  const groups = useMemo(() => {
    const map = new Map();
    for (const day of [...PLAN].reverse()) {
      for (const item of day.items) {
        if (item.kind !== 'lift') continue;
        const raw = logs[day.key] && logs[day.key][item.id];
        const sets = raw && raw.sets ? raw.sets.filter((s) => s && s.done && s.reps != null) : [];
        if (!sets.length) continue;
        if (!map.has(item.id)) map.set(item.id, { item, sessions: [] });
        map.get(item.id).sessions.push({ key: day.key, sets });
      }
    }
    return [...map.values()];
  }, [logs]);

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.monthHead}>
        <Text style={styles.month}>History</Text>
        <Text style={styles.monthSub}>Every logged set, newest first. Beat these numbers next session.</Text>
      </View>

      {groups.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Nothing logged yet</Text>
          <Text style={styles.emptyText}>Open the Calendar tab, pick a day, and tap a set to log your reps and weight.</Text>
        </View>
      ) : (
        groups.map(({ item, sessions }) => (
          <View key={item.id} style={styles.hist}>
            <Text style={styles.histName}>{item.name}</Text>
            {sessions.map(({ key, sets }) => (
              <View key={key} style={styles.histRow}>
                <Text style={styles.histDate}>{fmtDay(key)}</Text>
                <Text style={styles.histSets}>{sets.map((s) => fmtSet(s, item)).join(',  ')}</Text>
              </View>
            ))}
          </View>
        ))
      )}

      <Pressable onPress={onErase} style={styles.erase} accessibilityRole="button">
        <Text style={styles.eraseText}>Erase all logged data</Text>
      </Pressable>
    </ScrollView>
  );
}

function TabBar({ tab, onChange }) {
  const insets = useSafeAreaInsets();
  const tabs = [
    ['calendar', 'Calendar'],
    ['history', 'History'],
  ];
  return (
    <View style={[styles.tabbar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {tabs.map(([k, label]) => (
        <Pressable
          key={k}
          onPress={() => onChange(k)}
          style={styles.tab}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === k }}
        >
          <View style={[styles.tabMark, tab === k && styles.tabMarkOn]} />
          <Text style={[styles.tabText, tab === k && styles.tabTextOn]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const num = { fontVariant: ['tabular-nums'] };

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  loading: { margin: 24, color: C.sub, fontSize: 16 },
  scroll: { paddingHorizontal: 16, paddingBottom: 32 },

  monthHead: { paddingTop: 12, paddingBottom: 12 },
  month: { fontSize: 30, fontWeight: '800', color: C.ink, letterSpacing: -0.5 },
  monthSub: { marginTop: 2, fontSize: 15, color: C.sub, ...num },

  grid: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: C.card, borderRadius: 14, padding: 6, borderWidth: 1, borderColor: C.line },
  gridHead: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 12, color: C.sub, paddingVertical: 6, fontWeight: '600' },
  cell: { width: `${100 / 7}%`, padding: 2 },
  cellInner: { borderRadius: 9, paddingTop: 5, paddingBottom: 6, alignItems: 'center', minHeight: 58, borderWidth: 1.5, borderColor: 'transparent' },
  cellToday: { borderColor: C.blue },
  cellSelected: { backgroundColor: C.ink, borderColor: C.ink },
  cellNum: { fontSize: 15, fontWeight: '700', color: C.ink, ...num },
  cellNumOff: { fontSize: 15, color: C.faint, ...num },
  cellCode: { fontSize: 10.5, fontWeight: '600', color: C.blue, marginTop: 1 },
  cellCodeRest: { color: C.faint },
  cellTextSelected: { color: '#FFFFFF' },
  meter: { marginTop: 5, width: '70%', height: 4, borderRadius: 2, backgroundColor: C.line, overflow: 'hidden' },
  meterSelected: { backgroundColor: 'rgba(255,255,255,0.25)' },
  meterFill: { height: '100%', backgroundColor: C.blue, borderRadius: 2 },
  meterFillDone: { backgroundColor: C.gold },

  todayLink: { alignSelf: 'flex-start', marginTop: 10, paddingVertical: 6, paddingHorizontal: 2 },
  todayLinkText: { color: C.blue, fontSize: 15, fontWeight: '600' },

  dayHead: { marginTop: 20, marginBottom: 10 },
  dayDate: { fontSize: 14, color: C.sub, fontWeight: '600' },
  dayTitle: { fontSize: 26, fontWeight: '800', color: C.ink, marginTop: 2, letterSpacing: -0.3 },
  dayNote: { marginTop: 6, fontSize: 15, lineHeight: 21, color: C.ink },
  dayWeek: { fontWeight: '700' },

  item: { backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.line },
  itemDone: { borderColor: C.gold, backgroundColor: '#FFFDF8' },
  itemTop: { flexDirection: 'row', alignItems: 'flex-start' },
  box: { width: 30, height: 30, borderRadius: 8, borderWidth: 2, borderColor: C.ink, alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 1 },
  boxLocked: { borderColor: C.line, backgroundColor: C.bg },
  boxDone: { backgroundColor: C.gold, borderColor: C.gold },
  boxTick: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', marginTop: -1 },
  itemText: { flex: 1 },
  itemName: { fontSize: 17, fontWeight: '700', color: C.ink },
  itemNameDone: { color: C.sub },
  itemMeta: { marginTop: 2, fontSize: 14, color: C.sub, lineHeight: 19 },
  itemLeft: { marginTop: 4, fontSize: 13, color: C.blue, fontWeight: '600', ...num },

  sets: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, marginHorizontal: -4 },
  pill: { width: '31%', marginHorizontal: '1.1%', marginBottom: 8, borderRadius: 10, borderWidth: 1.5, borderColor: C.line, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: C.card },
  pillRound: { width: '14.6%', alignItems: 'center', paddingHorizontal: 0 },
  pillDone: { backgroundColor: C.blue, borderColor: C.blue },
  pillLabel: { fontSize: 12, fontWeight: '700', color: C.sub, ...num },
  pillLabelDone: { color: '#DCE6FA' },
  pillValue: { marginTop: 2, fontSize: 14, fontWeight: '600', color: C.faint, ...num },
  pillValueDone: { color: '#FFFFFF' },

  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: C.scrim },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 20 },
  sheetTitle: { fontSize: 22, fontWeight: '800', color: C.ink },
  sheetSub: { marginTop: 4, fontSize: 15, color: C.sub },
  sheetLast: { marginTop: 10, fontSize: 15, color: C.blue, fontWeight: '600', ...num },
  fields: { flexDirection: 'row', marginTop: 16, marginHorizontal: -6 },
  field: { flex: 1, marginHorizontal: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: C.sub, marginBottom: 6 },
  input: { borderWidth: 1.5, borderColor: C.line, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, fontSize: 26, fontWeight: '700', color: C.ink, backgroundColor: C.bg, ...num },
  seg: { flexDirection: 'row', marginTop: 8, borderRadius: 10, backgroundColor: C.bg, padding: 3, borderWidth: 1, borderColor: C.line },
  segBtn: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  segBtnOn: { backgroundColor: C.ink },
  segText: { fontSize: 15, fontWeight: '700', color: C.sub },
  segTextOn: { color: '#FFFFFF' },
  error: { marginTop: 12, color: C.danger, fontSize: 14, fontWeight: '600' },
  actions: { flexDirection: 'row', marginTop: 18 },
  secondary: { flex: 1, paddingVertical: 15, borderRadius: 12, alignItems: 'center', borderWidth: 1.5, borderColor: C.line, marginRight: 10 },
  secondaryText: { fontSize: 16, fontWeight: '700', color: C.ink },
  primary: { flex: 2, paddingVertical: 15, borderRadius: 12, alignItems: 'center', backgroundColor: C.blue },
  primaryText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  uncheck: { alignSelf: 'center', marginTop: 14, padding: 6 },
  uncheckText: { color: C.danger, fontSize: 15, fontWeight: '600' },

  empty: { backgroundColor: C.card, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: C.line },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: C.ink },
  emptyText: { marginTop: 4, fontSize: 15, color: C.sub, lineHeight: 21 },
  hist: { backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.line },
  histName: { fontSize: 17, fontWeight: '700', color: C.ink, marginBottom: 6 },
  histRow: { flexDirection: 'row', paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.bg },
  histDate: { width: 92, fontSize: 14, color: C.sub, fontWeight: '600', ...num },
  histSets: { flex: 1, fontSize: 14, color: C.ink, lineHeight: 20, ...num },
  erase: { alignSelf: 'center', marginTop: 24, padding: 8 },
  eraseText: { color: C.danger, fontSize: 15, fontWeight: '600' },

  tabbar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.card, paddingTop: 6 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  tabMark: { width: 28, height: 4, borderRadius: 2, backgroundColor: 'transparent', marginBottom: 6 },
  tabMarkOn: { backgroundColor: C.blue },
  tabText: { fontSize: 15, fontWeight: '600', color: C.sub },
  tabTextOn: { color: C.ink, fontWeight: '800' },
});

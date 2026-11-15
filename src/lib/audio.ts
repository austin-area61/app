import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

const SRC = {
  swoosh: require('../../assets/sounds/swoosh.wav'),
  blocked: require('../../assets/sounds/blocked.wav'),
  win: require('../../assets/sounds/win.wav'),
  lose: require('../../assets/sounds/lose.wav'),
};
export type Sfx = keyof typeof SRC;
const players: Partial<Record<Sfx, AudioPlayer>> = {};
let muted = false;

export const setMuted = (m: boolean) => { muted = m; };

export function sfx(name: Sfx) {
  if (muted) return;
  try {
    const p = (players[name] ??= createAudioPlayer(SRC[name]));
    p.seekTo(0);
    p.play();
  } catch {}
}

export const hapticTap = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); };
export const hapticError = () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}); };
export const hapticWin = () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); };

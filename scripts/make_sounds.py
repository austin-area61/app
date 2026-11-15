import wave, struct, math, random, os
SR = 22050
os.makedirs('assets/sounds', exist_ok=True)
def write(name, xs):
    with wave.open(f'assets/sounds/{name}.wav', 'w') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, x)) * 32767 * 0.6)) for x in xs))
def tone(f0, f1, dur, kind='sine', vol=1.0):
    n = int(SR * dur); out = []; ph = 0
    for i in range(n):
        t = i / n; ph += 2 * math.pi * (f0 + (f1 - f0) * t) / SR
        v = math.sin(ph) if kind == 'sine' else (0.5 if math.sin(ph) > 0 else -0.5)
        out.append(v * min(1, i / (SR * 0.01)) * (1 - t) ** 1.5 * vol)
    return out
sw = tone(300, 1600, 0.2)
write('swoosh', [a + random.uniform(-1, 1) * 0.25 * (1 - i / len(sw)) for i, a in enumerate(sw)])
write('blocked', tone(150, 90, 0.25, 'square'))
write('win', sum([tone(f, f, 0.13) for f in (523, 659, 784)], []) + tone(1047, 1047, 0.4))
write('lose', tone(420, 140, 0.55))

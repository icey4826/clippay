"""Synthesizes the video's sound effects into public/sfx (no samples, so nothing to license).

    python3 scripts/make-sfx.py

whoosh: scene transitions · click: mouse clicks · pop: a card or callout appears · tick: a list row appears
chime: money moves (a refund lands) · sting: the logo on the end card.
"""

import wave
from pathlib import Path

import numpy as np

RATE = 48000
OUT = Path(__file__).resolve().parent.parent / "public" / "sfx"
rng = np.random.default_rng(7)


def t(seconds):
    return np.arange(int(seconds * RATE)) / RATE


def env(n, attack, release, curve=4.0):
    """Linear attack, exponential release, as fractions of n samples."""
    a = max(1, int(n * attack))
    e = np.ones(n)
    e[:a] = np.linspace(0, 1, a)
    r = np.linspace(0, 1, n - a)
    e[a:] = np.exp(-curve * r) * (1 - r) ** 0.5
    return e


def lowpass(x, cutoff):
    """One-pole low-pass; cutoff may be an array (a sweep)."""
    cutoff = np.broadcast_to(cutoff, x.shape)
    k = 1 - np.exp(-2 * np.pi * cutoff / RATE)
    y = np.empty_like(x)
    acc = 0.0
    for i, (v, c) in enumerate(zip(x, k)):
        acc += c * (v - acc)
        y[i] = acc
    return y


def bell(freq, seconds, decay=5.0):
    x = t(seconds)
    partials = [(1, 1.0), (2.0, 0.35), (3.01, 0.12), (4.2, 0.06)]
    s = sum(a * np.sin(2 * np.pi * freq * m * x) * np.exp(-decay * m**0.6 * x) for m, a in partials)
    attack = np.minimum(1, x / 0.004)
    return s * attack


def save(name, mono, peak=0.7, width=0.0):
    mono = mono / (np.max(np.abs(mono)) + 1e-9) * peak
    # A touch of stereo: a few samples of delay on one side.
    d = int(width * 0.0006 * RATE)
    left = mono
    right = np.concatenate([np.zeros(d), mono[: len(mono) - d]]) if d else mono
    data = (np.stack([left, right], axis=1) * 32767).astype("<i2")
    OUT.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUT / f"{name}.wav"), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(data.tobytes())
    print(f"public/sfx/{name}.wav  {len(mono) / RATE:.2f}s")


def whoosh():
    n = len(t(0.55))
    noise = rng.standard_normal(n)
    sweep = np.concatenate([np.geomspace(500, 4200, n // 2), np.geomspace(4200, 900, n - n // 2)])
    body = lowpass(noise, sweep) - lowpass(noise, sweep * 0.25)
    shape = np.sin(np.linspace(0, np.pi, n)) ** 2.2
    save("whoosh", body * shape, peak=0.6, width=1)


def click():
    x = t(0.07)
    def transient(at, f, decay):
        y = np.zeros_like(x)
        m = x >= at
        xx = x[m] - at
        y[m] = np.sin(2 * np.pi * f * xx) * np.exp(-decay * xx)
        return y
    noise = rng.standard_normal(len(x)) * np.exp(-260 * x)
    s = transient(0, 3100, 380) + 0.6 * transient(0.022, 2300, 420) + 0.25 * lowpass(noise, 5000)
    save("click", s, peak=0.65)


def pop():
    x = t(0.16)
    f = 380 + 520 * np.exp(-38 * x)
    s = np.sin(2 * np.pi * np.cumsum(f) / RATE) * env(len(x), 0.02, 0.98, 6)
    save("pop", s, peak=0.6)


def tick():
    x = t(0.06)
    s = np.sin(2 * np.pi * 1850 * x) * np.exp(-90 * x) + 0.3 * np.sin(2 * np.pi * 3700 * x) * np.exp(-140 * x)
    save("tick", s, peak=0.5)


def chime():
    # Two quick bell notes, a rising fifth (E6 then B6), like a coin landing.
    a = bell(1318.5, 1.1, 4.5)
    b = bell(1975.5, 1.0, 4.0)
    s = np.zeros(len(t(1.2)))
    s[: len(a)] += 0.8 * a
    off = int(0.085 * RATE)
    s[off : off + len(b)] += b[: len(s) - off]
    save("chime", s, peak=0.6, width=1)


def sting():
    # Soft rising shimmer into a warm major chord (A major add9), for the logo.
    n = len(t(2.2))
    x = t(2.2)
    rise = lowpass(rng.standard_normal(n), np.geomspace(300, 6000, n)) * np.clip(x / 0.45, 0, 1) * np.exp(-np.clip(x - 0.45, 0, None) * 9)
    chord = np.zeros(n)
    start = int(0.42 * RATE)
    for f, a in [(220, 0.5), (277.2, 0.35), (329.6, 0.35), (440, 0.3), (493.9, 0.2), (659.3, 0.15)]:
        y = bell(f, 2.2 - 0.42, 1.6)
        chord[start : start + len(y)] += a * y[: n - start]
    save("sting", 0.35 * rise / (np.max(np.abs(rise)) + 1e-9) + chord / np.max(np.abs(chord)), peak=0.7, width=1)


if __name__ == "__main__":
    whoosh()
    click()
    pop()
    tick()
    chime()
    sting()

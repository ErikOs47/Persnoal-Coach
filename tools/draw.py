"""Strichfiguren für Übungen ohne Foto: je zwei Posen (Start, Ende) als WebP nach media/ex/.
Aufruf: python3 tools/draw.py media/ex
Seitenansicht, Blick nach rechts. Winkel in Grad: 0 = nach oben, 90 = nach vorn (rechts), 180 = nach unten."""
import sys, math
from PIL import Image, ImageDraw

W, H, K = 480, 320, 3          # Ausgabegröße, Supersampling
BG, FIG, PROP, FLOOR = '#E9EDF2', '#243447', '#9AA6B6', '#6B7787'
SHIN, THIGH, TORSO, NECK, HEAD, UARM, FARM, FOOT = 62, 62, 74, 12, 15, 46, 42, 28
GROUND = 282

def d(a, l):
    r = math.radians(a)
    return (l * math.sin(r), -l * math.cos(r))

def add(p, a, l):
    v = d(a, l)
    return (p[0] + v[0], p[1] + v[1])

def dist(p, q):
    return math.hypot(p[0] - q[0], p[1] - q[1])

def ik(s, h, l1, l2, bend):
    """Ellbogen zwischen Schulter s und Hand h; bend = +1/-1 wählt die Knickrichtung."""
    L = min(dist(s, h), l1 + l2 - 0.01)
    a = (l1 * l1 + L * L - l2 * l2) / (2 * l1 * L)
    base = math.atan2(h[1] - s[1], h[0] - s[0])
    t = base + bend * math.acos(max(-1, min(1, a)))
    return (s[0] + l1 * math.cos(t), s[1] + l1 * math.sin(t))

def canvas():
    im = Image.new('RGB', (W * K, H * K), BG)
    g = ImageDraw.Draw(im)
    g.rectangle([0, GROUND * K, W * K, H * K], fill='#DCE2E9')
    g.line([(0, GROUND * K), (W * K, GROUND * K)], fill=FLOOR, width=3 * K)
    return im, g

def limbs(g, segs, head):
    for a, b in segs:
        g.line([(a[0] * K, a[1] * K), (b[0] * K, b[1] * K)], fill=FIG, width=11 * K)
        for p in (a, b):
            g.ellipse([(p[0] - 5.5) * K, (p[1] - 5.5) * K, (p[0] + 5.5) * K, (p[1] + 5.5) * K], fill=FIG)
    g.ellipse([(head[0] - HEAD) * K, (head[1] - HEAD) * K, (head[0] + HEAD) * K, (head[1] + HEAD) * K], fill=FIG)

def save(im, path):
    im.resize((W, H), Image.LANCZOS).save(path, quality=80, method=6)

# Cyclist Squat: Fersen auf einem Keil, enge Stellung, Knie weit nach vorn, Oberkörper aufrecht
def cyclist(out):
    for i, (shin, thigh, torso, arm) in enumerate([(4, -4, 4, 175), (50, -96, 12, 92)]):
        im, g = canvas()
        g.polygon([(205 * K, GROUND * K), (205 * K, (GROUND - 16) * K), (255 * K, GROUND * K)], fill=PROP)
        ankle = (226, GROUND - 22)
        toe = (ankle[0] + 34, GROUND - 2)
        knee = add(ankle, shin, SHIN)
        hip = add(knee, thigh + 180 if thigh < -90 else thigh, THIGH) if False else add(knee, thigh, THIGH)
        sh = add(hip, torso, TORSO)
        head = add(add(sh, torso, NECK), torso, HEAD)
        el = add(sh, arm, UARM)
        wr = add(el, arm, FARM)
        limbs(g, [(ankle, toe), (ankle, knee), (knee, hip), (hip, sh), (sh, el), (el, wr)], head)
        save(im, f'{out}/cyclist_squat-{i}.webp')

# Pike Push-up: Hände und Füße am Boden, Hüfte hoch; unten Kopf Richtung Boden zwischen den Händen
def pike(out):
    hand, ankle = (318, GROUND - 6), (150, GROUND - 14)
    for i, (leg, reach) in enumerate([(26, 86), (31, 48)]):
        im, g = canvas()
        hip = add(ankle, leg, SHIN + THIGH)
        # Rumpfwinkel so wählen, dass die Schulter den gewünschten Abstand zur Hand hat
        best = min(range(100, 180), key=lambda a: abs(dist(add(hip, a, TORSO), hand) - reach))
        sh = add(hip, best, TORSO)
        head = add(add(sh, best, NECK), best, HEAD)
        el = ik(sh, hand, UARM, FARM, -1)
        knee = add(ankle, leg, SHIN)
        toe = add(ankle, 100, FOOT)
        limbs(g, [(ankle, toe), (ankle, knee), (knee, hip), (hip, sh), (sh, el), (el, hand)], head)
        save(im, f'{out}/pike-{i}.webp')

if __name__ == '__main__':
    out = sys.argv[1]
    cyclist(out)
    pike(out)

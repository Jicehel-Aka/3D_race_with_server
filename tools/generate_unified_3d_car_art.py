#!/usr/bin/env python3
"""
tools/generate_unified_3d_car_art.py — Générateur "3D Hybride" Rigide (Race3D-AKA)
- Calibre un maillage 3D GT unique au pixel près sur la silhouette complète de Stage 6 (2c7e371) :
  * Avant bas profilé (nez plongeant y = 45 -> 39 -> 34 -> 31, zéro bosse ni pavillon relevé à l'avant).
  * Toit parfaitement horizontal (y = 5..6 de x = 62 à x = 142) + montant A incliné + rétroviseurs.
  * Arrière GT unifié (coffre plat nervuré, bandeau noir, feux rectangulaires ambre/rouge, diffuseur y = 74,
    aileron horizontal et dérives rectangulaires montantes, lunette arrière à persiennes).
- Hybride 3D par Rétro-Projection Z-Buffer (zbuf6 shadow/visibility test) :
  * Chaque point 3D (X, Y, Z) du maillage échantillonne la vraie texture nettoyée de Stage 6 via sa
    projection perspective exacte à 29° (avec symétrie bilatérale et désocclusion propre derrière les roues
    et les mâts d'aileron), garantissant la MÊME voiture de 0° à 29°, une rotation 3D 100% rigide (zéro
    morphing 2D) et une fidélité parfaite à l'image 3/4 de référence (avant bas + flanc + roues + poupe).
"""

import math
import struct
import zlib

W0, W3, H = 176, 224, 84

# Paramètres caméra 3D calibrés simultanément sur Stage 0 (176x84) et Stage 6 (224x84)
YAW_MAX_DEG = 29.0
YAW_MAX = math.radians(YAW_MAX_DEG)
SIN_YAW_MAX = math.sin(YAW_MAX)
COS_YAW_MAX = math.cos(YAW_MAX)
CAM_DIST = 7.60
Z_PIV = 0.65
FOCAL = 82.5 * (CAM_DIST - Z_PIV)  # 573.375
HOR_Y = 36.0
CAM_Y = 0.565


def read_png_rgba(path):
    data = open(path, "rb").read()
    pos = 8
    w = h = 0
    idat = bytearray()
    while pos < len(data):
        ln, tp = struct.unpack(">I4s", data[pos : pos + 8])
        chunk = data[pos + 8 : pos + 8 + ln]
        pos += 12 + ln
        if tp == b"IHDR":
            w, h = struct.unpack(">II", chunk[:8])
        elif tp == b"IDAT":
            idat.extend(chunk)
    raw = zlib.decompress(bytes(idat))
    stride = w * 4
    out = []
    i = 0
    prev = bytearray(stride)
    for _ in range(h):
        flt = raw[i]
        i += 1
        row = bytearray(raw[i : i + stride])
        i += stride
        if flt == 1:
            for x in range(4, stride):
                row[x] = (row[x] + row[x - 4]) & 255
        elif flt == 2:
            for x in range(stride):
                row[x] = (row[x] + prev[x]) & 255
        elif flt == 3:
            for x in range(stride):
                a = row[x - 4] if x >= 4 else 0
                row[x] = (row[x] + ((a + prev[x]) >> 1)) & 255
        elif flt == 4:
            for x in range(stride):
                a = row[x - 4] if x >= 4 else 0
                b = prev[x]
                c = prev[x - 4] if x >= 4 else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                row[x] = (row[x] + pr) & 255
        prev = row
        out.append([(row[x * 4], row[x * 4 + 1], row[x * 4 + 2], row[x * 4 + 3]) for x in range(w)])
    return w, h, out


def write_png_rgba(path, w, h, rgba_bytes):
    raw = bytearray()
    stride = w * 4
    for y in range(h):
        raw.append(0)
        off = y * stride
        raw.extend(rgba_bytes[off : off + stride])
    comp = zlib.compress(bytes(raw), 6)

    def chunk(tp, body):
        return struct.pack(">I4s", len(body), tp) + body + struct.pack(">I", zlib.crc32(tp + body) & 0xFFFFFFFF)

    png = bytearray(b"\x89PNG\r\n\x1a\n")
    png.extend(chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)))
    png.extend(chunk(b"IDAT", comp))
    png.extend(chunk(b"IEND", b""))
    with open(path, "wb") as f:
        f.write(png)


def q565(r, g, b):
    ri = int(max(0.0, min(255.0, round(r)))) & 0xF8
    gi = int(max(0.0, min(255.0, round(g)))) & 0xFC
    bi = int(max(0.0, min(255.0, round(b)))) & 0xF8
    if ri == 248 and gi == 0 and bi == 248:
        gi = 4  # Évite la couleur clé transparente #F800F8
    return (ri, gi, bi, 255)


def is_magenta_fringe(r, g, b, driver_idx):
    if driver_idx == 5:
        return r > 180 and g < 58 and b > 180 and (r - g) > 135
    # Capte à la fois le magenta vif (#FF00FF) et le halo sombre anti-aliasé sur fond magenta
    if r > 130 and b > 120 and g < 78 and (r - g) > 68 and (b - g) > 58:
        return True
    if g < 58 and (r - g) > 42 and (b - g) > 42 and abs(r - b) < 42:
        return True
    return False


def extract_stage6_clean(repo_img, driver_idx):
    x0 = W0 + 5 * W3
    y0 = driver_idx * H
    grid = []
    for y in range(H):
        row = []
        for x in range(W3):
            r, g, b, a = repo_img[y0 + y][x0 + x]
            if a < 128 or is_magenta_fringe(r, g, b, driver_idx):
                row.append((0.0, 0.0, 0.0, 0))
            else:
                row.append((float(r), float(g), float(b), 255))
        grid.append(row)

    # Comble les 2-3 pixels internes détourés sous le mât d'aileron par moyenne des voisins opaques
    repaired = [r[:] for r in grid]
    for y in range(1, H - 1):
        for x in range(1, W3 - 1):
            if grid[y][x][3] == 0:
                nbs = [
                    grid[y + dy][x + dx]
                    for dy in (-1, 0, 1)
                    for dx in (-1, 0, 1)
                    if (dx or dy) and grid[y + dy][x + dx][3] > 0
                ]
                if len(nbs) >= 6:
                    repaired[y][x] = (
                        sum(p[0] for p in nbs) / len(nbs),
                        sum(p[1] for p in nbs) / len(nbs),
                        sum(p[2] for p in nbs) / len(nbs),
                        255,
                    )
    return repaired


def dilate_rgb_grid(rgba_grid, passes=6):
    cur = [row[:] for row in rgba_grid]
    h = len(cur)
    w = len(cur[0])
    for _ in range(passes):
        nxt = [row[:] for row in cur]
        for y in range(h):
            for x in range(w):
                if cur[y][x][3] > 0:
                    continue
                nbs = []
                for dy in (-1, 0, 1):
                    ny = y + dy
                    if ny < 0 or ny >= h:
                        continue
                    for dx in (-1, 0, 1):
                        nx = x + dx
                        if nx < 0 or nx >= w or (dx == 0 and dy == 0):
                            continue
                        if cur[ny][nx][3] > 0:
                            nbs.append(cur[ny][nx])
                if nbs:
                    nxt[y][x] = (
                        sum(p[0] for p in nbs) / len(nbs),
                        sum(p[1] for p in nbs) / len(nbs),
                        sum(p[2] for p in nbs) / len(nbs),
                        255,
                    )
        cur = nxt
    return [[(p[0], p[1], p[2]) for p in row] for row in cur]


def extract_driver_material(s6, driver_idx):
    # 1. Texture symétrique de poupe (coffre plat nervuré, bandeau noir, feux rectangulaires, bouclier, diffuseur)
    TW, TH = 136, 48
    rear_tex = [[(22.0, 24.0, 28.0) for _ in range(TW)] for _ in range(TH)]
    xc = 144.5
    half_r = 64.0
    half_l = 64.5

    for ty in range(TH):
        ys = min(H - 1, 27 + ty)
        for tx in range(TW):
            sym_u = abs((tx - (TW - 1) * 0.5) / ((TW - 1) * 0.5))
            xr = int(round(xc + sym_u * half_r))
            xl = int(round(xc - sym_u * half_l))
            pr = s6[ys][min(W3 - 1, max(0, xr))]
            pl = s6[ys][min(W3 - 1, max(0, xl))]
            if ys <= 31:
                if pl[3] >= 128 and pr[3] >= 128:
                    rgb = (0.5 * (pl[0] + pr[0]), 0.5 * (pl[1] + pr[1]), 0.5 * (pl[2] + pr[2]))
                elif pl[3] >= 128:
                    rgb = pl[:3]
                elif pr[3] >= 128:
                    rgb = pr[:3]
                else:
                    rgb = s6[34][143][:3]
            elif pl[3] < 128 and pr[3] >= 128:
                rgb = pr[:3]
            elif pr[3] < 128 and pl[3] >= 128:
                rgb = pl[:3]
            elif pl[3] >= 128 and pr[3] >= 128:
                rgb = (0.5 * (pl[0] + pr[0]), 0.5 * (pl[1] + pr[1]), 0.5 * (pl[2] + pr[2]))
            else:
                rgb = (20.0, 22.0, 26.0)
            rear_tex[ty][tx] = rgb

    # 2. Texture 3/4 de caisse sans roues (pour rétro-projection 3D propre du flanc, capot bas, montant A et vitres)
    body_rgba = [row[:] for row in s6]
    door_col = s6[50][32][:3] if s6[50][32][3] >= 128 else (185.0, 42.0, 32.0)
    for y in range(H):
        for x in range(W3):
            # Masque uniquement les disques des jantes/pneus avant-gauche et arrière-gauche sur la texture de caisse
            in_fl_wheel = ((x - 12.5) / 11.5) ** 2 + ((y - 62.0) / 11.5) ** 2 <= 1.02 and y >= 50
            in_rl_wheel = ((x - 60.5) / 16.5) ** 2 + ((y - 68.0) / 15.0) ** 2 <= 1.02 and y >= 53
            if in_fl_wheel or in_rl_wheel:
                body_rgba[y][x] = (20.0, 22.0, 26.0, 255)

    flank_tex = dilate_rgb_grid(body_rgba, passes=7)
    s6_dilated = dilate_rgb_grid(s6, passes=4)

    # Masque intérieur érodé de 2px pour ne jamais projeter le contour sombre externe de Stage 6 sur la caisse aux angles intermédiaires
    s6_inner = [[False] * W3 for _ in range(H)]
    for y in range(2, H - 2):
        for x in range(2, W3 - 2):
            if all(s6[y + dy][x + dx][3] >= 128 for dy in (-2, -1, 0, 1, 2) for dx in (-2, -1, 0, 1, 2)):
                s6_inner[y][x] = True

    shoulder = s6[35][34][:3] if s6[35][34][3] >= 128 else (210.0, 225.0, 242.0)
    trunk = s6[34][143][:3] if s6[34][143][3] >= 128 else door_col
    bumper = s6[56][143][:3] if s6[56][143][3] >= 128 else door_col
    roof = s6[7][100][:3] if s6[7][100][3] >= 128 else door_col
    endplate = s6[20][214][:3] if s6[20][214][3] >= 128 else door_col
    sideglass = s6[18][46][:3] if s6[18][46][3] >= 128 else (130.0, 160.0, 188.0)
    rearglass = s6[15][122][:3] if s6[15][122][3] >= 128 else (48.0, 66.0, 84.0)

    if driver_idx == 4:
        rearglass = (54.0, 70.0, 88.0)
        sideglass = (148.0, 178.0, 204.0)

    return {
        "s6": s6,
        "s6_inner": s6_inner,
        "s6_dilated": s6_dilated,
        "flank_tex": flank_tex,
        "rear_tex": rear_tex,
        "TW": TW,
        "TH": TH,
        "shoulder": shoulder,
        "door": door_col,
        "trunk": trunk,
        "bumper": bumper,
        "roof": roof,
        "endplate": endplate,
        "sideglass": sideglass,
        "rearglass": rearglass,
        "driver_idx": driver_idx,
    }


def bilerp_tex(tex, tw, th, u, v):
    fx = max(0.0, min(tw - 1.001, u * (tw - 1)))
    fy = max(0.0, min(th - 1.001, v * (th - 1)))
    x0, y0 = int(fx), int(fy)
    dx, dy = fx - x0, fy - y0
    c00 = tex[y0][x0]
    c10 = tex[y0][x0 + 1]
    c01 = tex[y0 + 1][x0]
    c11 = tex[y0 + 1][x0 + 1]
    return (
        (c00[0] * (1 - dx) + c10[0] * dx) * (1 - dy) + (c01[0] * (1 - dx) + c11[0] * dx) * dy,
        (c00[1] * (1 - dx) + c10[1] * dx) * (1 - dy) + (c01[1] * (1 - dx) + c11[1] * dx) * dy,
        (c00[2] * (1 - dx) + c10[2] * dx) * (1 - dy) + (c01[2] * (1 - dx) + c11[2] * dx) * dy,
    )


def bilerp_px(tex, w, h, px, py):
    fx = max(0.0, min(w - 1.001, px))
    fy = max(0.0, min(h - 1.001, py))
    x0, y0 = int(fx), int(fy)
    dx, dy = fx - x0, fy - y0
    c00 = tex[y0][x0]
    c10 = tex[y0][x0 + 1]
    c01 = tex[y0 + 1][x0]
    c11 = tex[y0 + 1][x0 + 1]
    return (
        (c00[0] * (1 - dx) + c10[0] * dx) * (1 - dy) + (c01[0] * (1 - dx) + c11[0] * dx) * dy,
        (c00[1] * (1 - dx) + c10[1] * dx) * (1 - dy) + (c01[1] * (1 - dx) + c11[1] * dx) * dy,
        (c00[2] * (1 - dx) + c10[2] * dx) * (1 - dy) + (c01[2] * (1 - dx) + c11[2] * dx) * dy,
    )


def proj_stage6_px(v):
    """Projection exacte d'un point local 3D (X, Y, Z) dans le repère de Stage 6 (224x84)."""
    dx = v[0]
    dz = v[2] - Z_PIV
    xw = dx * COS_YAW_MAX - dz * SIN_YAW_MAX
    zw = dx * SIN_YAW_MAX + dz * COS_YAW_MAX
    zc = CAM_DIST + zw
    cx6 = 112.0 + 14.2
    sx = cx6 + (xw * FOCAL) / zc
    sy = HOR_Y - ((v[1] - CAM_Y) * FOCAL) / zc
    return sx, sy, zc


def arch_height(z, z_center, half_span, y_skirt, y_peak):
    dz = abs(z - z_center)
    if dz >= half_span:
        return y_skirt
    t = dz / half_span
    circ = math.sqrt(max(0.0, 1.0 - t * t))
    return y_skirt + (y_peak - y_skirt) * min(1.0, circ * 1.06)


def build_calibrated_gt_mesh(steer_wheel_rad=0.0):
    """
    Maillage 3D GT unifié calibré au pixel près sur Stage 6 (2c7e371) :
    Chaque triangle porte (p0, p1, p2, mat, uv0, uv1, uv2).
    """
    tris = []

    def add_quad(p0, p1, p2, p3, mat, uv0=(0.0, 0.0), uv1=(1.0, 0.0), uv2=(1.0, 1.0), uv3=(0.0, 1.0)):
        tris.append((p0, p1, p2, mat, uv0, uv1, uv2))
        tris.append((p0, p2, p3, mat, uv0, uv2, uv3))

    def add_box(x0, x1, y0, y1, z0, z1, mat_side, mat_top=None, mat_rear=None, mat_bot="under"):
        mt = mat_top or mat_side
        mr = mat_rear or mat_side
        v = [
            (x0, y0, z0),
            (x1, y0, z0),
            (x1, y1, z0),
            (x0, y1, z0),
            (x0, y0, z1),
            (x1, y0, z1),
            (x1, y1, z1),
            (x0, y1, z1),
        ]
        add_quad(v[0], v[1], v[2], v[3], mr)
        add_quad(v[5], v[4], v[7], v[6], mat_side)
        add_quad(v[4], v[0], v[3], v[7], mat_side)
        add_quad(v[1], v[5], v[6], v[2], mat_side)
        add_quad(v[3], v[2], v[6], v[7], mt)
        add_quad(v[4], v[5], v[1], v[0], mat_bot)

    # 1. Caisse basse GT à nez plongeant (Z = 0.00 poupe -> Z = 3.38 pointe avant basse)
    z_list = [
        0.00, 0.16, 0.36, 0.56, 0.80, 1.04, 1.28, 1.64,
        2.02, 2.34, 2.56, 2.76, 2.96, 3.14, 3.28, 3.38,
    ]

    rings = []
    for z in z_list:
        if z <= 0.80:
            t = z / 0.80
            wm = 0.99 + 0.04 * math.sin(t * math.pi * 0.75)
            wt = 0.93 + 0.01 * t
            yd = 0.51 + 0.11 * (t ** 0.75)
        elif z <= 2.25:
            t = (z - 0.80) / 1.45
            wm = 1.02 - 0.02 * math.sin(t * math.pi)
            wt = 0.94 - 0.03 * t
            yd = 0.62 + 0.015 * t
        elif z <= 2.80:
            t = (z - 2.25) / 0.55
            wm = 1.00 + 0.015 * math.sin(t * math.pi)
            wt = 0.91 - 0.05 * t
            yd = 0.635 - 0.048 * (t ** 1.15)
        else:
            t = (z - 2.80) / 0.58
            wm = 0.99 * (1.0 - 0.24 * (t ** 1.35))
            wt = 0.86 * (1.0 - 0.30 * (t ** 1.35))
            yd = 0.587 - 0.195 * (t ** 1.20)

        y_sk = 0.120 if z < 0.28 else (0.145 if z < 2.40 else 0.115)
        yb = max(
            y_sk,
            arch_height(z, 0.72, 0.32, y_sk, 0.43),
            arch_height(z, 2.76, 0.32, y_sk, 0.40),
        )
        ym = max(yb + 0.025, min(yd - 0.04, 0.36 - 0.06 * max(0.0, (z - 2.60) / 0.78)))
        wb = wm - 0.040
        ws = wt + 0.030
        ys = yd - 0.042
        # Capot avant creusé au centre (empêche le bombé central de dépasser l'aile gauche en 3/4 !)
        yd_c = yd - (0.048 * max(0.0, (z - 2.15) / 1.23))
        rings.append((z, [
            (-wb, yb, z),   # 0 bas de caisse G
            (-wm, ym, z),   # 1 flanc médian G
            (-ws, ys, z),   # 2 épaule / pli G
            (-wt, yd, z),   # 3 crête d'aile G
            (0.0, yd_c, z), # 4 axe central capot / coffre
            ( wt, yd, z),   # 5 crête d'aile D
            ( ws, ys, z),   # 6 épaule / pli D
            ( wm, ym, z),   # 7 flanc médian D
            ( wb, yb, z),   # 8 bas de caisse D
        ]))

    for i in range(len(rings) - 1):
        z0, r0 = rings[i]
        z1, r1 = rings[i + 1]
        # Flancs gauche et droit -> rétro-projetés depuis le flanc Stage 6 !
        for k in (0, 1, 2, 5, 6, 7):
            add_quad(r0[k], r0[k + 1], r1[k + 1], r1[k], "flank_proj")

        # Dessus arrière (coffre nervuré Z <= 0.56) vs capot avant bas (Z > 0.56)
        if z1 <= 0.57:
            va = 0.25 * (1.0 - z0 / 0.56)
            vb = 0.25 * (1.0 - z1 / 0.56)
            add_quad(r0[3], r0[4], r1[4], r1[3], "rear_tex", (0.04, va), (0.50, va), (0.50, vb), (0.04, vb))
            add_quad(r0[4], r0[5], r1[5], r1[4], "rear_tex", (0.50, va), (0.96, va), (0.96, vb), (0.50, vb))
        else:
            add_quad(r0[3], r0[4], r1[4], r1[3], "hood_proj", (0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0))
            add_quad(r0[4], r0[5], r1[5], r1[4], "hood_proj", (1.0, 0.0), (0.0, 0.0), (0.0, 1.0), (1.0, 1.0))

        # Fermeture intérieure des passages de roues vers le soubassement
        for sgn, idx_b in ((-1.0, 0), (1.0, 8)):
            pa, pb = r0[idx_b], r1[idx_b]
            ia, ib = (sgn * 0.56, pa[1], z0), (sgn * 0.56, pb[1], z1)
            if sgn < 0:
                add_quad(ia, pa, pb, ib, "under")
            else:
                add_quad(pa, ia, ib, pb, "under")

    # Fermeture pointe du bouclier avant
    _, rn = rings[-1]
    add_quad(rn[0], rn[8], rn[7], rn[1], "under")
    add_quad(rn[1], rn[7], rn[6], rn[2], "flank_proj")
    add_quad(rn[2], rn[6], rn[5], rn[3], "hood_proj")

    # Plancher sombre continu (zéro jour sous le châssis)
    add_box(-0.60, 0.60, 0.145, 0.43, 0.14, 3.15, "under", mat_top="under", mat_rear="under", mat_bot="under")

    # 2. Poupe 3D sculptée (bandeau noir, feux rectangulaires ambre/rouge, pare-chocs, diffuseur y = 74)
    NX = 12
    rear_bands = [
        (0.510, 0.24, 0.94,  0.000),
        (0.485, 0.27, 0.96,  0.020),
        (0.365, 0.50, 0.99,  0.020),
        (0.340, 0.54, 1.00, -0.024),
        (0.195, 0.80, 0.96, -0.020),
        (0.102, 0.99, 0.72,  0.035),
    ]
    for b in range(len(rear_bands) - 1):
        ya, va, wa, za = rear_bands[b]
        yb, vb, wb, zb = rear_bands[b + 1]
        for ix in range(NX):
            u0, u1 = ix / NX, (ix + 1) / NX
            s0, s1 = -1.0 + 2.0 * u0, -1.0 + 2.0 * u1
            c0, c1 = 0.045 * (s0 * s0), 0.045 * (s1 * s1)
            p00 = (s0 * wa, ya, za + c0)
            p10 = (s1 * wa, ya, za + c1)
            p11 = (s1 * wb, yb, zb + c1)
            p01 = (s0 * wb, yb, zb + c0)
            add_quad(p00, p10, p11, p01, "rear_tex", (u0, va), (u1, va), (u1, vb), (u0, vb))

    # 3. Habitacle Fastback GT trapézoïdal symétrique calibré sur Stage 0 (0°) et Stage 6 (29°)
    cab = [
        (0.50, 0.80, 0.64, 0.58, 0.690),  # 0 Base custode AR
        (0.84, 0.78, 0.57, 0.60, 0.865),  # 1 Mi-montant C
        (1.18, 0.76, 0.52, 0.61, 1.006),  # 2 Traverse AR du toit (x6=140, y6=5)
        (1.66, 0.75, 0.51, 0.62, 1.015),  # 3 Milieu du toit plat (y6=4..5)
        (2.12, 0.75, 0.51, 0.63, 1.018),  # 4 Sommet montant A (x6=49, y6=6 ; caché dans le gabarit AR à 0°)
        (2.26, 0.77, 0.57, 0.63, 0.915),  # 5 Haut pare-brise / montant A (x6=42, y6=10)
        (2.40, 0.79, 0.64, 0.63, 0.785),  # 6 Mi-montant A (x6=34, y6=18)
        (2.53, 0.81, 0.71, 0.62, 0.635),  # 7 Pied montant A / baie de pare-brise (x6=26, y6=26)
    ]
    for i in range(len(cab) - 1):
        z0, wb0, wr0, yb0, yr0 = cab[i]
        z1, wb1, wr1, yb1, yr1 = cab[i + 1]
        if i in (2, 3):
            add_quad((-wr0, yr0, z0), (wr0, yr0, z0), (wr1, yr1, z1), (-wr1, yr1, z1), "roof")
        elif i >= 4:
            # Pare-brise encadré par deux montants A peints couleur carrosserie
            pf = 0.16
            add_quad((-wr0, yr0, z0), (-wr0 * (1 - pf), yr0, z0), (-wr1 * (1 - pf), yr1, z1), (-wr1, yr1, z1), "pillar")
            add_quad((wr0 * (1 - pf), yr0, z0), (wr0, yr0, z0), (wr1, yr1, z1), (wr1 * (1 - pf), yr1, z1), "pillar")
            add_quad((-wr0 * (1 - pf), yr0, z0), (wr0 * (1 - pf), yr0, z0), (wr1 * (1 - pf), yr1, z1), (-wr1 * (1 - pf), yr1, z1), "front_glass")

        if i in (0, 1, 6):
            # Montant C large peint (i=0,1) et pied de montant A peint (i=6) — symétrie gauche/droite stricte !
            add_quad((-wb0, yb0, z0), (-wr0, yr0, z0), (-wr1, yr1, z1), (-wb1, yb1, z1), "pillar")
            add_quad(( wr0, yr0, z0), ( wb0, yb0, z0), ( wb1, yb1, z1), ( wr1, yr1, z1), "pillar")
        else:
            # Brancard de pavillon peint en haut (18% supérieurs) + vitrage latéral / montant B projeté depuis Stage 6
            t_rail = 0.82
            xm0 = wb0 + (wr0 - wb0) * t_rail
            ym0 = yb0 + (yr0 - yb0) * t_rail
            xm1 = wb1 + (wr1 - wb1) * t_rail
            ym1 = yb1 + (yr1 - yb1) * t_rail
            add_quad((-xm0, ym0, z0), (-wr0, yr0, z0), (-wr1, yr1, z1), (-xm1, ym1, z1), "roof")
            add_quad(( wr0, yr0, z0), ( xm0, ym0, z0), ( xm1, ym1, z1), ( wr1, yr1, z1), "roof")
            add_quad((-wb0, yb0, z0), (-xm0, ym0, z0), (-xm1, ym1, z1), (-wb1, yb1, z1), "flank_proj")
            add_quad(( xm0, ym0, z0), ( wb0, yb0, z0), ( wb1, yb1, z1), ( xm1, ym1, z1), "flank_proj")

    # Bandeau supérieur peint au sommet de la lunette arrière (Z = 1.08 .. 1.18)
    add_quad((-0.51, 0.945, 1.08), (0.51, 0.945, 1.08), (0.52, 1.006, 1.18), (-0.52, 1.006, 1.18), "roof")

    # Lunette arrière inclinée à persiennes (Z = 0.50 -> 1.08, Y = 0.665 -> 0.945)
    GW = 10
    for ix in range(GW):
        u0, u1 = ix / GW, (ix + 1) / GW
        s0, s1 = -1.0 + 2.0 * u0, -1.0 + 2.0 * u1
        zc0, zc1 = 0.018 * (1.0 - s0 * s0), 0.018 * (1.0 - s1 * s1)
        p00 = (s0 * 0.60, 0.665, 0.50 - zc0)
        p10 = (s1 * 0.60, 0.665, 0.50 - zc1)
        p11 = (s1 * 0.49, 0.945, 1.08 - zc1)
        p01 = (s0 * 0.49, 0.945, 1.08 - zc0)
        add_quad(p00, p10, p11, p01, "rear_glass", (u0, 1.0), (u1, 1.0), (u1, 0.0), (u0, 0.0))

    # Montants C encadrant la lunette arrière
    for sgn in (-1.0, 1.0):
        p00 = (sgn * 0.60, 0.665, 0.50)
        p10 = (sgn * 0.79, 0.600, 0.52)
        p11 = (sgn * 0.52, 1.006, 1.18)
        p01 = (sgn * 0.49, 0.945, 1.08)
        if sgn > 0:
            add_quad(p00, p10, p11, p01, "pillar")
        else:
            add_quad(p10, p00, p01, p11, "pillar")

    # Rétroviseurs profilés au pied du montant A (x6 = 25..31, y6 = 26..30)
    add_box(-0.86, -0.76, 0.63, 0.680, 2.15, 2.26, "endplate", mat_top="roof")
    add_box( 0.76,  0.86, 0.63, 0.680, 2.15, 2.26, "endplate", mat_top="roof")

    # 4. Aileron GT horizontal + mâts noirs + dérives rectangulaires montantes (zéro rognage à 0°, x6 = 220 à 29°)
    add_box(-0.46, -0.39, 0.54, 0.725, 0.08, 0.22, "black_trim")
    add_box( 0.39,  0.46, 0.54, 0.725, 0.08, 0.22, "black_trim")
    add_box(-0.99,  0.99, 0.720, 0.758, 0.00, 0.26, "endplate", mat_top="wing_top", mat_rear="wing_rear", mat_bot="black_trim")
    add_box(-1.03, -0.99, 0.695, 0.865, -0.02, 0.34, "endplate", mat_top="wing_top", mat_rear="wing_rear", mat_bot="black_trim")
    add_box( 0.99,  1.03, 0.695, 0.865, -0.02, 0.34, "endplate", mat_top="wing_top", mat_rear="wing_rear", mat_bot="black_trim")

    # 5. Quatre roues slicks larges + jantes 5 branches argent à déport profond
    def add_wheel(cx, cy, cz, rad, half_w, steer_ang):
        segs = 22
        cs, sn = math.cos(steer_ang), math.sin(steer_ang)

        def xf(lx, ly, lz):
            return (cx + lx * cs - lz * sn, cy + ly, cz + lx * sn + lz * cs)

        out_x = -half_w if cx < 0 else half_w
        in_x = half_w if cx < 0 else -half_w
        dish_x = out_x * 0.66
        for k in range(segs):
            a0 = 2.0 * math.pi * k / segs
            a1 = 2.0 * math.pi * (k + 1) / segs
            y0, z0 = math.sin(a0) * rad, math.cos(a0) * rad
            y1, z1 = math.sin(a1) * rad, math.cos(a1) * rad
            add_quad(xf(in_x, y0, z0), xf(in_x, y1, z1), xf(out_x, y1, z1), xf(out_x, y0, z0), "tyre")
            ry0, rz0 = y0 * 0.62, z0 * 0.62
            ry1, rz1 = y1 * 0.62, z1 * 0.62
            add_quad(xf(out_x, y0, z0), xf(out_x, y1, z1), xf(out_x, ry1, rz1), xf(out_x, ry0, rz0), "tyre")
            add_quad(xf(out_x, ry0, rz0), xf(out_x, ry1, rz1), xf(dish_x, ry1 * 0.85, rz1 * 0.85), xf(dish_x, ry0 * 0.85, rz0 * 0.85), "rim_lip")
            spoke_mat = "rim_spoke" if (k % 4 != 0) else "black_trim"
            tris.append((xf(dish_x, 0.0, 0.0), xf(dish_x, ry0 * 0.85, rz0 * 0.85), xf(dish_x, ry1 * 0.85, rz1 * 0.85), spoke_mat, (0.0, 0.0), (1.0, 0.0), (1.0, 1.0)))
            tris.append((xf(in_x, 0.0, 0.0), xf(in_x, y1, z1), xf(in_x, y0, z0), "tyre", (0.0, 0.0), (1.0, 0.0), (1.0, 1.0)))

    add_wheel(-0.885, 0.202, 0.68, 0.232, 0.20, 0.0)
    add_wheel( 0.885, 0.202, 0.68, 0.232, 0.20, 0.0)
    add_wheel(-0.86, 0.195, 2.76, 0.205, 0.16, steer_wheel_rad)
    add_wheel( 0.86, 0.195, 2.76, 0.205, 0.16, steer_wheel_rad)

    return tris


def build_stage6_depth_map():
    """Construit la carte de profondeur de référence à YAW_MAX_DEG (224x84) pour le test de visibilité 3D Hybride."""
    tris = build_calibrated_gt_mesh(YAW_MAX * 0.35)
    zbuf6 = [1e9] * (W3 * H)
    for p0, p1, p2, _, _, _, _ in tris:
        q0, q1, q2 = proj_stage6_px(p0), proj_stage6_px(p1), proj_stage6_px(p2)
        area = (q1[0] - q0[0]) * (q2[1] - q0[1]) - (q2[0] - q0[0]) * (q1[1] - q0[1])
        if abs(area) < 1e-4:
            continue
        inva = 1.0 / area
        iz0, iz1, iz2 = 1.0 / q0[2], 1.0 / q1[2], 1.0 / q2[2]
        xmin = max(0, int(min(q0[0], q1[0], q2[0])))
        xmax = min(W3 - 1, int(math.ceil(max(q0[0], q1[0], q2[0]))))
        ymin = max(0, int(min(q0[1], q1[1], q2[1])))
        ymax = min(H - 1, int(math.ceil(max(q0[1], q1[1], q2[1]))))
        for py in range(ymin, ymax + 1):
            sy = py + 0.5
            roff = py * W3
            for px in range(xmin, xmax + 1):
                sx = px + 0.5
                w0 = ((q1[0] - sx) * (q2[1] - sy) - (q2[0] - sx) * (q1[1] - sy)) * inva
                w1 = ((q2[0] - sx) * (q0[1] - sy) - (q0[0] - sx) * (q2[1] - sy)) * inva
                w2 = 1.0 - w0 - w1
                if w0 < 0.0 or w1 < 0.0 or w2 < 0.0:
                    continue
                z = 1.0 / (w0 * iz0 + w1 * iz1 + w2 * iz2)
                if z < zbuf6[roff + px]:
                    zbuf6[roff + px] = z
    return zbuf6


ZBUF_STAGE6 = build_stage6_depth_map()


def render_car_angle(mat_info, yaw_deg, out_w, out_h):
    yaw = math.radians(yaw_deg)
    cy, sy = math.cos(yaw), math.sin(yaw)
    u_turn = min(1.0, max(0.0, yaw_deg / YAW_MAX_DEG))
    tris = build_calibrated_gt_mesh(yaw * 0.35)

    SS = 2
    BW, BH = out_w * SS, out_h * SS
    zbuf = [1e9] * (BW * BH)
    cbuf = [None] * (BW * BH)

    if out_w == W0:
        cx_scr = (W0 * 0.5) * SS
    else:
        cx_scr = (112.0 + 14.2 * (sy / SIN_YAW_MAX)) * SS

    focal_ss = FOCAL * SS
    hor_ss = HOR_Y * SS

    def proj(v):
        dx = v[0]
        dz = v[2] - Z_PIV
        xw = dx * cy - dz * sy
        zw = dx * sy + dz * cy
        yw = v[1]
        zc = CAM_DIST + zw
        sx = cx_scr + (xw * focal_ss) / zc
        sy_scr = hor_ss - ((yw - CAM_Y) * focal_ss) / zc
        return (sx, sy_scr, zc, xw, yw, zw)

    lx, ly, lz = -0.52, 0.72, -0.46
    ll = math.sqrt(lx * lx + ly * ly + lz * lz)
    lx, ly, lz = lx / ll, ly / ll, lz / ll

    # Poids smoothstep du transfert de détail 3D Hybride verrouillé en espace 3D sur Stage 6
    t_hyb = max(0.0, min(1.0, (u_turn - 0.42) / 0.58))
    hybrid_lock = t_hyb * t_hyb * (3.0 - 2.0 * t_hyb)

    for p0, p1, p2, mat, uv0, uv1, uv2 in tris:
        q0, q1, q2 = proj(p0), proj(p1), proj(p2)
        if q0[2] < 0.5 or q1[2] < 0.5 or q2[2] < 0.5:
            continue
        area = (q1[0] - q0[0]) * (q2[1] - q0[1]) - (q2[0] - q0[0]) * (q1[1] - q0[1])
        if abs(area) < 1e-4:
            continue

        ux, uy, uz = q1[3] - q0[3], q1[4] - q0[4], q1[5] - q0[5]
        vx, vy, vz = q2[3] - q0[3], q2[4] - q0[4], q2[5] - q0[5]
        nx = uy * vz - uz * vy
        ny = uz * vx - ux * vz
        nz = ux * vy - uy * vx
        nl = math.sqrt(nx * nx + ny * ny + nz * nz)
        if nl < 1e-7:
            continue
        nx, ny, nz = nx / nl, ny / nl, nz / nl
        if nx * (-q0[3]) + ny * (CAM_Y - q0[4]) + nz * (-CAM_DIST - q0[5]) < 0:
            nx, ny, nz = -nx, -ny, -nz

        ndotl = max(0.0, nx * lx + ny * ly + nz * lz)

        xmin = max(0, int(min(q0[0], q1[0], q2[0])))
        xmax = min(BW - 1, int(math.ceil(max(q0[0], q1[0], q2[0]))))
        ymin = max(0, int(min(q0[1], q1[1], q2[1])))
        ymax = min(BH - 1, int(math.ceil(max(q0[1], q1[1], q2[1]))))

        inv_area = 1.0 / area
        iz0, iz1, iz2 = 1.0 / q0[2], 1.0 / q1[2], 1.0 / q2[2]

        for py in range(ymin, ymax + 1):
            sample_y = py + 0.5
            row_off = py * BW
            for px in range(xmin, xmax + 1):
                sample_x = px + 0.5
                w0 = ((q1[0] - sample_x) * (q2[1] - sample_y) - (q2[0] - sample_x) * (q1[1] - sample_y)) * inv_area
                w1 = ((q2[0] - sample_x) * (q0[1] - sample_y) - (q0[0] - sample_x) * (q2[1] - sample_y)) * inv_area
                w2 = 1.0 - w0 - w1
                if w0 < 0.0 or w1 < 0.0 or w2 < 0.0:
                    continue
                iz = w0 * iz0 + w1 * iz1 + w2 * iz2
                z = 1.0 / iz
                idx = row_off + px
                if z >= zbuf[idx]:
                    continue
                zbuf[idx] = z

                # Coordonnée 3D locale exacte (X, Y, Z) du point sur la carrosserie
                lx_p = (w0 * p0[0] * iz0 + w1 * p1[0] * iz1 + w2 * p2[0] * iz2) * z
                ly_p = (w0 * p0[1] * iz0 + w1 * p1[1] * iz1 + w2 * p2[1] * iz2) * z
                lz_p = (w0 * p0[2] * iz0 + w1 * p1[2] * iz1 + w2 * p2[2] * iz2) * z

                u = (w0 * uv0[0] * iz0 + w1 * uv1[0] * iz1 + w2 * uv2[0] * iz2) * z
                v = (w0 * uv0[1] * iz0 + w1 * uv1[1] * iz1 + w2 * uv2[1] * iz2) * z

                if mat == "rear_tex":
                    base = bilerp_tex(mat_info["rear_tex"], mat_info["TW"], mat_info["TH"], u, v)
                    shade = 0.95 + 0.08 * ndotl
                    rgb = (base[0] * shade, base[1] * shade, base[2] * shade)
                elif mat == "flank_proj":
                    # Rétro-projection perspective exacte sur le flanc nettoyé de Stage 6 (symétrie bilatérale)
                    u6, v6, _ = proj_stage6_px((-abs(lx_p), ly_p, lz_p))
                    base = bilerp_px(mat_info["flank_tex"], W3, H, u6, v6)
                    shade = (0.94 + 0.08 * ndotl) if lx_p <= 0 else (0.78 + 0.14 * ndotl)
                    rgb = (base[0] * shade, base[1] * shade, base[2] * shade)
                elif mat == "hood_proj":
                    # Capot avant bas : fondu latéral doux entre la peinture capot et le pli lumineux d'aile Stage 6
                    u6, v6, _ = proj_stage6_px((-abs(lx_p), ly_p, lz_p))
                    edge_c = bilerp_px(mat_info["flank_tex"], W3, H, u6, v6)
                    c_tr = mat_info["trunk"]
                    shade = 0.86 + 0.22 * ndotl
                    center_c = (c_tr[0] * shade, c_tr[1] * shade, c_tr[2] * shade)
                    edge_w = max(0.0, min(1.0, (1.0 - u) * 1.4 - 0.35))
                    rgb = (
                        center_c[0] * (1.0 - edge_w) + edge_c[0] * edge_w,
                        center_c[1] * (1.0 - edge_w) + edge_c[1] * edge_w,
                        center_c[2] * (1.0 - edge_w) + edge_c[2] * edge_w,
                    )
                elif mat in ("roof", "wing_top"):
                    c = mat_info["roof"]
                    shade = 0.88 + 0.20 * ndotl
                    rgb = (c[0] * shade, c[1] * shade, c[2] * shade)
                elif mat in ("pillar", "endplate"):
                    c = mat_info["endplate"] if mat == "endplate" else mat_info["door"]
                    shade = 0.82 + 0.24 * ndotl
                    rgb = (c[0] * shade, c[1] * shade, c[2] * shade)
                elif mat == "wing_rear":
                    c = mat_info["bumper"]
                    rgb = (c[0] * 0.78, c[1] * 0.78, c[2] * 0.78)
                elif mat == "rear_glass":
                    xw_px = w0 * q0[3] + w1 * q1[3] + w2 * q2[3]
                    rx = xw_px * 0.90 + nx * 1.45
                    louver = 0.85 if (int(v * 10.0) % 2 == 1) else 1.04
                    sky_band = math.exp(-((v - 0.44) ** 2) / 0.14)
                    glint = sky_band * max(0.0, 0.48 + 0.52 * math.cos(rx * 2.2))
                    c = mat_info["rearglass"]
                    rgb = (
                        c[0] * louver + glint * 86.0,
                        c[1] * louver + glint * 100.0,
                        c[2] * louver + glint * 116.0,
                    )
                elif mat == "front_glass":
                    c = mat_info["sideglass"]
                    sh = 0.72 + 0.24 * ndotl
                    rgb = (c[0] * sh, c[1] * sh, c[2] * sh)
                elif mat == "tyre":
                    shade = 0.62 + 0.38 * ndotl
                    rgb = (24.0 * shade, 26.0 * shade, 30.0 * shade)
                elif mat == "rim_lip":
                    rgb = (198.0, 206.0, 218.0)
                elif mat == "rim_spoke":
                    shade = 0.74 + 0.32 * ndotl
                    rgb = (168.0 * shade, 176.0 * shade, 188.0 * shade)
                elif mat == "black_trim":
                    rgb = (20.0, 22.0, 26.0)
                else:
                    rgb = (16.0, 18.0, 22.0)

                # Passe "3D Hybride" verrouillée sur la géométrie 3D :
                # Si ce point 3D (lx_p, ly_p, lz_p) est directement visible sans occultation dans Stage 6
                # (vérifié via ZBUF_STAGE6) et qu'il ne s'agit pas du reflet continu de lunette arrière,
                # on fusionne progressivement les micro-détails pixels de Stage 6 (jantes, phares/ailes, écope).
                if hybrid_lock > 0.0 and mat not in ("rear_glass", "front_glass"):
                    sx6, sy6, zc6 = proj_stage6_px((lx_p, ly_p, lz_p))
                    ix6, iy6 = int(round(sx6)), int(round(sy6))
                    if 2 <= ix6 < W3 - 2 and 2 <= iy6 < H - 2:
                        z_ref = ZBUF_STAGE6[iy6 * W3 + ix6]
                        use_mask = mat_info["s6"][iy6][ix6][3] >= 128 if u_turn > 0.92 else mat_info["s6_inner"][iy6][ix6]
                        if zc6 <= z_ref + 0.075 and use_mask:
                            ref_rgb = bilerp_px(mat_info["s6_dilated"], W3, H, sx6, sy6)
                            w_hyb = hybrid_lock * (0.90 if mat in ("tyre", "rim_lip", "rim_spoke") else 0.95)
                            rgb = (
                                rgb[0] * (1.0 - w_hyb) + ref_rgb[0] * w_hyb,
                                rgb[1] * (1.0 - w_hyb) + ref_rgb[1] * w_hyb,
                                rgb[2] * (1.0 - w_hyb) + ref_rgb[2] * w_hyb,
                            )

                cbuf[idx] = (
                    max(0.0, min(255.0, rgb[0])),
                    max(0.0, min(255.0, rgb[1])),
                    max(0.0, min(255.0, rgb[2])),
                )

    out = [[(0, 0, 0, 0) for _ in range(out_w)] for _ in range(out_h)]
    for y in range(out_h):
        for x in range(out_w):
            samples = []
            for dy in range(SS):
                for dx in range(SS):
                    s = cbuf[(y * SS + dy) * BW + (x * SS + dx)]
                    if s is not None:
                        samples.append(s)
            if len(samples) >= 2:
                r = sum(s[0] for s in samples) / len(samples)
                g = sum(s[1] for s in samples) / len(samples)
                b = sum(s[2] for s in samples) / len(samples)
                out[y][x] = q565(r, g, b)

    # Contour arcade net quantifié RGB565 (identique au style Gamebuino AKA)
    final = [row[:] for row in out]
    for y in range(1, out_h - 1):
        for x in range(1, out_w - 1):
            if out[y][x][3] > 0:
                if (
                    out[y - 1][x][3] == 0
                    or out[y + 1][x][3] == 0
                    or out[y][x - 1][3] == 0
                    or out[y][x + 1][3] == 0
                ):
                    r, g, b, _ = out[y][x]
                    final[y][x] = q565(r * 0.42, g * 0.42, b * 0.46)
    return final


def main():
    _, _, repo_img = read_png_rgba("public/assets/repo_latest_car_art.png")

    AW7 = W0 + 6 * W3
    AH = 8 * H
    out_atlas7 = bytearray(AW7 * AH * 4)

    DENSE_N = 19
    AW19 = W0 + (DENSE_N - 1) * W3
    out_atlas19 = bytearray(AW19 * AH * 4)
    angles19 = [(YAW_MAX_DEG * i) / (DENSE_N - 1) for i in range(DENSE_N)]

    for d in range(8):
        s6 = extract_stage6_clean(repo_img, d)
        mat_info = extract_driver_material(s6, d)
        y0 = d * H
        for st19, ang in enumerate(angles19):
            fw = W0 if st19 == 0 else W3
            fr = render_car_angle(mat_info, ang, fw, H)
            sx19 = 0 if st19 == 0 else W0 + (st19 - 1) * W3
            for y in range(H):
                for x in range(fw):
                    i19 = ((y0 + y) * AW19 + sx19 + x) * 4
                    out_atlas19[i19 : i19 + 4] = bytes(fr[y][x])
            if st19 % 3 == 0:
                st7 = st19 // 3
                sx7 = 0 if st7 == 0 else W0 + (st7 - 1) * W3
                for y in range(H):
                    for x in range(fw):
                        i7 = ((y0 + y) * AW7 + sx7 + x) * 4
                        out_atlas7[i7 : i7 + 4] = bytes(fr[y][x])
        print(f"Driver {d} rendered ({DENSE_N} rigid 3D-Hybrid angles)")

    write_png_rgba("public/assets/unified_3d_car_art.png", AW7, AH, out_atlas7)
    write_png_rgba("public/assets/unified_3d_dense19.png", AW19, AH, out_atlas19)
    print("Generated v4 3D-Hybrid unified_3d_car_art.png (7 stages) and unified_3d_dense19.png (19 stages)!")


if __name__ == "__main__":
    main()

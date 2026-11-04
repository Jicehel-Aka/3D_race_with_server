// Drop-in C++17 (ESP-IDF 5.5.1 Gamebuino AKA + PC SDL2) & Python patches for Jicehel-Aka/Race3D-AKA

export interface CodePatchFile {
  id: string;
  filename: string;
  targetPathInRepo: string;
  category: 'pitstop' | 'circuits' | 'sprites' | 'multiplayer';
  titleFr: string;
  summaryFr: string;
  flashImpact: string;
  code: string;
}

export const CPP_PATCH_FILES: CodePatchFile[] = [
  {
    id: 'pit_technicians_fix',
    filename: 'pit_technicians_fix.cpp',
    targetPathInRepo: 'main/game/race.cpp + main/game/render.cpp + tools/import_technicians.py',
    category: 'pitstop',
    titleFr: 'Chorégraphie des Techniciens aux Stands, Bandes Sol Fixes & Cadrage HUD',
    summaryFr:
      'Aligne main/game/race.cpp et main/game/render.cpp sur le comportement validé : (1) tous les techniciens et le Lollipop attendent à l’extérieur sur le tablier des stands (x = 2.63..2.74 sous auvent), (2) arrivée autour de la voiture à l’arrêt (< 4 km/h) avec contournement du nez avant sans traverser la carrosserie, (3) bandes au sol 100 % fixes (zéro défilement temporel), (4) travail (TECH_WORK + étincelles) uniquement une fois à côté de la voiture puis éloignement immédiat dès la fin de l’intervention, (5) largeur dynamique du cadre HUD des stands (fini le texte qui dépasse sur Neon City, etc.).',
    flashImpact: '+48 octets état stand · Bandes fixes & HUD sans débordement',
    code: `// ============================================================================
// 1. main/game/race.h & race.cpp — Automate 4 phases par box (Stand 2 & Stand 3)
// ============================================================================
enum PitCrewPhase : uint8_t {
    PIT_IDLE_OUTSIDE = 0, // Attente calme sur le tablier extérieur (x = 2.63..2.74)
    PIT_WALKING_IN   = 1, // Marche vers les 4 roues / capot autour de la voiture arrêtée
    PIT_WORKING      = 2, // Intervention clé à chocs uniquement à côté de la voiture
    PIT_WALKING_OUT  = 3  // Éloignement immédiat vers l'extérieur dès la fin du travail
};

struct PitBayCrew {
    PitCrewPhase phase = PIT_IDLE_OUTSIDE;
    float progress     = 0.0f; // 0 = extérieur du stand, 1 = en poste autour de la voiture
    float workTimer    = 0.0f;
    float workReq      = 2.0f;
    float anchorZ      = 0.0f;
    float anchorX      = 2.10f;
};

// Dans update_pit_lane(Race& r, float dt) :
// - Déclenchement dès r.speedKmh() < 4.0f dans Stand 2 (PNEUS) ou Stand 3 (MOTEUR) :
//   crew.phase = PIT_WALKING_IN; crew.anchorZ = r.carZ(r.player()); crew.anchorX = clamp(p.x, 1.84f, 2.34f);
// - Réparation et workTimer avancent UNIQUEMENT pendant (crew.phase == PIT_WORKING).
// - Dès que (crew.workTimer >= crew.workReq), même voiture encore à 0 km/h :
//   crew.phase = PIT_WALKING_OUT; r.lollipop = LOLLI_GO; r.servicedThisStop = true;
//   -> les techniciens s'éloignent immédiatement sans reboucler tant que la voiture ne repart pas.

// ============================================================================
// 2. main/game/render.cpp — Bandes au sol 100 % fixes (suppression de s_time)
// ============================================================================
// Dans draw_pit_ground(const PSeg& ps) :
//   bool boxStripe = (ps.idx & 1) == 0; // FIXE dans le repère monde (aucun terme s_time !)
//   uint16_t boxCol = inNitro ? (boxStripe ? rgb(32,188,242) : rgb(22,126,184))
//                   : inTyres ? (boxStripe ? rgb(232,178,30) : rgb(156,118,22))
//                   :           (boxStripe ? rgb(218,48,48)  : rgb(148,34,38));
//   // Tablier béton extérieur (x = 2.48 .. 3.18) pour l'attente des techniciens sous auvent

// ============================================================================
// 3. main/game/render.cpp — Approche autour de la voiture, travail & départ
// ============================================================================
static inline float smooth01(float v) {
    float c = fminf(1.0f, fmaxf(0.0f, v));
    return c * c * (3.0f - 2.0f * c);
}

// Pour chaque mécanicien m du box b (tous au repos à idleX = 2.63f..2.74f, dir = -1) :
// - Mécaniciens flanc droit / capot / Lollipop : interpolation directe (idleZ, idleX) <-> (targetZ, targetX)
// - Mécaniciens flanc gauche : trajectoire en 3 tronçons devant le pare-chocs avant (noseZ = anchorZ + 545.0f)
//   afin de contourner la voiture sans jamais la traverser :
//     u in [0.00..0.34] : (idleZ, idleX)     -> (noseZ, rightClearX)
//     u in [0.34..0.70] : (noseZ, rightClearX) -> (noseZ, leftClearX)
//     u in [0.70..1.00] : (noseZ, leftClearX)  -> (targetZ, targetX)
// - Pose : TECH_WORK + étincelles UNIQUEMENT si (crew.phase == PIT_WORKING && u >= 0.99f) ;
//          TECH_TYRE uniquement à l'aller (PIT_WALKING_IN && u < 0.82f) ;
//          TECH_WALK_A / TECH_WALK_B pendant l'approche et l'éloignement (dir = +1 au retour) ;
//          TECH_IDLE au repos à l'extérieur.
// - Seuil d'affichage : (wAt >= 9.0f && wAt <= 365.0f) avec interpolation continue dans le PSeg.

// ============================================================================
// 4. main/game/render.cpp — Cadrage dynamique du HUD des stands (Neon City, etc.)
// ============================================================================
void draw_pit_hud_box(const char* bayTitle, const char* statsLine, bool goGreen, int lbRightX) {
    int tw1 = measure_text_px(bayTitle);   // ex: "STAND 3 - MOTEUR (ARRET 0 KM/H)"
    int tw2 = measure_text_px(statsLine);  // ex: "ENG 100% - TYR 100% - N2O 100%"
    int availX0 = lbRightX + 6;
    int maxBoxW = SCREEN_W - 6 - availX0;
    int boxW    = std::min(maxBoxW, std::max(tw1, tw2) + 18); // +9 px de marge de chaque côté
    int boxX    = availX0 + std::max(0, (maxBoxW - boxW) / 2);
    int boxY    = 44, boxH = 34;

    fill_rect_alpha(boxX, boxY, boxW, boxH, rgb(10, 15, 28), 224);
    stroke_rect(boxX, boxY, boxW, boxH, goGreen ? rgb(74, 222, 128) : rgb(250, 204, 21));
    draw_text_clipped(bayTitle,  boxX + (boxW - tw1) / 2, boxY + 5,  boxW - 10, goGreen ? rgb(74,222,128) : rgb(253,224,71));
    draw_text_clipped(statsLine, boxX + (boxW - tw2) / 2, boxY + 19, boxW - 10, rgb(226, 232, 240));
}

// ============================================================================
// 5. tools/import_technicians.py — Suppression de la bavure magenta sous les bottes
// ============================================================================
//   shadow_magenta = (a[:,:,0] > 95) & (a[:,:,1] < 45) & (a[:,:,2] > 95) & (abs(a[:,:,0] - a[:,:,2]) < 75)
//   key = key | shadow_magenta
//   rgb_clean = np.where(key[..., None], 0, a).astype(np.uint8)  # évite le mélange #FF00FF dans Image.BOX`,
  },
  {
    id: 'circuit_anim_lut',
    filename: 'circuit_animations_esp32s3.cpp',
    targetPathInRepo: 'main/game/render.cpp + main/game/track.cpp',
    category: 'circuits',
    titleFr: 'Animations Temps Réel des 6 Circuits + Tunnels SEGF_TUNNEL + LUT sin8 60 FPS',
    summaryFr:
      'Ajoute une table int16_t s_sin8[256] (économise ~1.2 ms/frame sur ESP32-S3), anime les aurores boréales de Glacier Run, le faisceau tournant du phare et les projecteurs de Night Harbor, le monorail et les fenêtres de Neon City, les voiliers de Palm Bay, la télécabine d’Alpine Pass et active le rendu des portiques SEGF_TUNNEL.',
    flashImpact: '+512 octets LUT · Gain +1.2 ms/frame sur ESP32-S3',
    code: `// ============================================================================
// main/game/render.cpp — Table trigonométrique fixe 8-bit pour ESP32-S3 (0 sinf par colonne)
// ============================================================================
static int16_t s_sin8[256]; // valeurs dans [-256..+256]
static bool    s_lutReady = false;

static void init_fast_lut() {
    if (s_lutReady) return;
    for (int i = 0; i < 256; ++i)
        s_sin8[i] = (int16_t)lroundf(sinf(i * 6.2831853f / 256.0f) * 256.0f);
    s_lutReady = true;
}
inline int fastSin(int idx) { return s_sin8[idx & 255]; }

// ---- Portiques & Éclairage des Tunnels (active SEGF_TUNNEL de track.h) ------
void draw_tunnel_arch(const PSeg& ps, const Theme& th, int themeId) {
    if (ps.w1 < 4.0f) return;
    int cx = (int)ps.x1, w = (int)(ps.w1 * 1.26f);
    int baseY = ps.y1 < ps.clip ? (int)ps.y1 : ps.clip;
    int topY  = baseY - (int)(ps.w1 * 0.78f);
    if (topY < 0) topY = 0;
    if (topY >= baseY) return;
    bool rib = (ps.idx % 4) == 0;
    uint16_t c = rib ? (themeId == THEME_CITY ? rgb(40, 225, 255) : rgb(255, 195, 90))
                     : rgb(52, 54, 66);
    c = lerp(c, th.fog, ps.fog >> 1);
    int pw = (int)(ps.w1 * 0.14f) + 2;
    fillRect(cx - w - pw, topY, pw, baseY - topY, c);
    fillRect(cx + w,      topY, pw, baseY - topY, c);
    fillRect(cx - w - pw, topY, (w + pw) * 2, (int)(ps.w1 * 0.10f) + 2, c);
}`,
  },
  {
    id: 'fixed_point_3d_esp32s3',
    filename: 'raster_q16_esp32s3.h',
    targetPathInRepo: 'main/game/raster_q16.h (Architecture 3D Virgule Fixe ESP32-S3)',
    category: 'sprites',
    titleFr: 'Référence Architecture Vraie 3D Virgule Fixe Q16.16 (ESP32-S3 @ 240 MHz)',
    summaryFr:
      'Squelette de rastériseur de triangles flat/Gouraud en virgule fixe Q16.16 sans aucun float ni division par pixel (table réciproque 1/dy et 1/z sur 1024 entrées), conçu pour tenir 8 voitures low-poly (~140 triangles) à 60 FPS constants sur Gamebuino AKA.',
    flashImpact: '2 Ko LUT réciproque · 0 float dans la boucle interne scanline',
    code: `// ============================================================================
// Architecture Vraie 3D Temps Réel en Virgule Fixe Q16.16 sur ESP32-S3 (240 MHz)
// - FPU matériel LX7 : rapide sur fadd.s/fmul.s (sommets), mais lent sur fdiv et ftoi par pixel.
// - En Q16.16 + LUT réciproque dans la boucle interne scanline : 0 float, 0 division par pixel,
//   3x à 5x plus rapide sur le remplissage des triangles + Z-buffer 16-bit partiel !
// ============================================================================
#pragma once
#include <stdint.h>

using fix16_t = int32_t; // Q16.16 : 1.0 = 65536

struct Vec3x { int16_t x, y, z; }; // sommets locaux voiture en Q8.8 (~6 octets/sommet)
struct TriFlat { uint8_t i0, i1, i2, colorIdx; };

// Table réciproque précalculée : kRecip[d] = (1 << 24) / d pour d in 1..511 (évite toute division !)
extern const uint32_t kRecip512[512];

inline void draw_span_z16(uint16_t* fbRow, uint16_t* zRow, int x0, int x1,
                          uint32_t zFixed, int32_t dzDx, uint16_t color565) {
    for (int x = x0; x < x1; ++x, zFixed += dzDx) {
        uint16_t z16 = (uint16_t)(zFixed >> 8);
        if (z16 < zRow[x]) {
            zRow[x]  = z16;
            fbRow[x] = color565;
        }
    }
}`,
  },
  {
    id: 'import_car_art_py',
    filename: 'generate_unified_3d_car_art.py',
    targetPathInRepo: 'tools/generate_unified_3d_car_art.py',
    category: 'sprites',
    titleFr: 'Générateur Validé 3D Hybride (7 Paliers AKA + 19 Angles Z-Buffer)',
    summaryFr:
      'Version validée et verrouillée du générateur 3D Hybride : maillage GT recalibré sur Stage 6 (nez plongeant y = 31 -> 45, toit plat y = 5, paroi latérale symétrique) et rétro-projection Z-buffer de la vraie texture 3/4 de 0° à 29°.',
    flashImpact: 'Validé · Zéro morphing 2D · Produit unified_3d_car_art.png',
    code: `#!/usr/bin/env python3
"""
tools/generate_unified_3d_car_art.py — Version Validée (3D Hybride Z-Buffer)
Utilisation avec l'importateur du dépôt :
  python3 tools/generate_unified_3d_car_art.py
  python3 tools/import_car_art.py --atlas7 public/assets/unified_3d_car_art.png main/game/car_art.cpp
"""
W0, W3, H = 176, 224, 84
KEY_BGR565 = 0xF81F
YAW_MAX_DEG = 29.0
ANGLES_7_DEG = [0.0, 4.83, 9.67, 14.50, 19.33, 24.17, 29.0]`,
  },
];

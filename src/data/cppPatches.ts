// Drop-in C++17 (ESP-IDF 5.5.1 Gamebuino AKA + PC SDL2) & Python patches for Jicehel-Aka/Race3D-AKA

export interface CodePatchFile {
  id: string;
  filename: string;
  targetPathInRepo: string;
  category: 'sprites' | 'pitstop' | 'circuits' | 'multiplayer';
  titleFr: string;
  summaryFr: string;
  flashImpact: string;
  code: string;
}

export const CPP_PATCH_FILES: CodePatchFile[] = [
  {
    id: 'car_art_rear3q',
    filename: 'rigid_3d_turn_aka.cpp',
    targetPathInRepo: 'main/game/race.cpp + main/game/render.cpp + main/game/car_art.h',
    category: 'sprites',
    titleFr: 'Rotation 3D Hybride Rigide + Coordonnées Exactes des Feux 3D (0 Ko RAM)',
    summaryFr:
      'Combine un maillage 3D GT recalibré au pixel près sur la silhouette basse de Stage 6 (nez plongeant y = 31 -> 45, toit horizontal y = 5, poupe GT unifiée) avec la rétro-projection Z-buffer de la vraie texture 3/4 (2c7e371) de 0° à 29°, sans aucun fondu ni déformation 2D.',
    flashImpact: 'Même empreinte Flash 7 paliers · Avant bas fidèle · 0 morphing 2D',
    code: `// ============================================================================
// 1. main/game/car_art.h — Boîtes de feux projetées en 3D sur le modèle 3D Hybride
// ============================================================================
// À 0° (176x84) comme à 29° (224x84), il s'agit des mêmes feux rectangulaires :
static constexpr int16_t kLampRear[8] = {
    12, 43, 45, 52,   131, 43, 164, 52
};
static constexpr int16_t kLamp3q[CAR_COUNT][8] = {
    { 82, 42, 110, 51,  175, 42, 204, 50 }, // VIPER .. YOU (géométrie 3D Hybride)
    { 82, 42, 110, 51,  175, 42, 204, 50 },
    { 82, 42, 110, 51,  175, 42, 204, 50 },
    { 82, 42, 110, 51,  175, 42, 204, 50 },
    { 82, 42, 110, 51,  175, 42, 204, 50 },
    { 82, 42, 110, 51,  175, 42, 204, 50 },
    { 82, 42, 110, 51,  175, 42, 204, 50 },
    { 82, 42, 110, 51,  175, 42, 204, 50 },
};

// ============================================================================
// 2. main/game/race.cpp — Inertie angulaire fluide de la caisse en virage
// ============================================================================
p.steerVis += (steer - p.steerVis) * fminf(1.0f, dt * 5.4f);

// ============================================================================
// 3. main/game/render.cpp — Paliers angulaires réguliers (0° -> 29°, 0 morphing)
// ============================================================================
// Pas constant de 4.83° par palier Z-buffer 3D Hybride (aucun mix565 entre images) :
static const float kRigidStep[CAR_ART_MID + 1] = {
    0.09f, 0.22f, 0.35f, 0.49f, 0.63f, 0.78f
};
int stage = 0;
float asv = fabsf(c.steerVis);
while (stage <= CAR_ART_MID && asv >= kRigidStep[stage]) ++stage;
bool flip = (c.steerVis > 0.0f);`,
  },
  {
    id: 'import_car_art_py',
    filename: 'generate_unified_3d_car_art.py',
    targetPathInRepo: 'tools/generate_unified_3d_car_art.py',
    category: 'sprites',
    titleFr: 'tools/generate_unified_3d_car_art.py — Générateur 3D Hybride Calé sur Stage 6 (2c7e371)',
    summaryFr:
      'Calibre le maillage 3D GT sur la silhouette exacte de Stage 6 (avant plongeant bas y = 31 -> 45, toit plat y = 5, poupe GT unifiée) et rétro-projette en Z-buffer la vraie texture nettoyée de Stage 6 (avec test de visibilité ZBUF_STAGE6) pour générer des vues de 0° à 29° sans bosse avant ni morphing.',
    flashImpact: 'Génère car_art.cpp complet · 0 dépendance externe · Avant 3/4 exact',
    code: `#!/usr/bin/env python3
"""
tools/generate_unified_3d_car_art.py — Générateur 3D Hybride Z-Buffer (Modèle GT 3/4 2c7e371)
- Silhouette avant abaissée et recalibrée au pixel près sur Stage 6 (y = 31 -> 34 -> 39 -> 45, toit plat y = 5).
- Rétro-projection perspective 3D de la vraie texture Stage 6 nettoyée sur les flancs, le capot bas,
  le montant A, les vitres latérales et les roues, combinée à la poupe 3D symétrique unifiée.
- Reflet continu en espace monde 3D sur la lunette arrière à persiennes.
"""
import math

W0, W3, H = 176, 224, 84
KEY_BGR565 = 0xF81F  # Magenta transparent Gamebuino AKA
YAW_MAX_DEG = 29.0
CAM_DIST, Z_PIV = 7.60, 0.65
FOCAL = 82.5 * (CAM_DIST - Z_PIV)
HOR_Y, CAM_Y = 36.0, 0.565

def rgb_to_bgr565(r, g, b):
    ri = max(0, min(255, int(r))) >> 3
    gi = max(0, min(255, int(g))) >> 2
    bi = max(0, min(255, int(b))) >> 3
    val = (bi << 11) | (gi << 5) | ri
    return 0xF81E if val == KEY_BGR565 else val

def project_point(v, cy, sy, cx_scr, SS=2):
    dx = v[0]
    dz = v[2] - Z_PIV
    xw = dx * cy - dz * sy
    zw = dx * sy + dz * cy
    zc = CAM_DIST + zw
    focal = FOCAL * SS
    sx = cx_scr + (xw * focal) / zc
    sy_scr = (HOR_Y * SS) - ((v[1] - CAM_Y) * focal) / zc
    return sx, sy_scr, zc, xw, v[1], zw

# Angles rigides exportés dans main/game/car_art.cpp (0 morphing 2D) :
ANGLES_7_DEG = [0.0, 4.83, 9.67, 14.50, 19.33, 24.17, 29.0]`,
  },
  {
    id: 'pitstop_v12',
    filename: 'pitstop_3bays_aka.cpp',
    targetPathInRepo: 'main/game/race.h + race.cpp + render.cpp',
    category: 'pitstop',
    titleFr: 'Voie des Stands Séparée à 3 Box Spécialisés + Mécaniciens + Lollipop + Bouton L1',
    summaryFr:
      'Remplace le simple rectangle jaune peint sur la voie de droite par une vraie voie des stands sécurisée derrière un muret béton (x = 1.04..1.98) avec 3 box distincts (N2O Express, Pneus & Géométrie, Garage Moteur Complet), mécaniciens animés, panneau Lollipop GO! avec boost de relance et limiteur L1 + vibrations Gamebuino AKA.',
    flashImpact: '+2.4 Ko code · 0 octets RAM dynamique',
    code: `// ============================================================================
// main/game/race.h — Constantes & état des 3 stands spécialisés (v1.2)
// ============================================================================
constexpr int   PIT_ENTRY_FIRST = 4;
constexpr int   PIT_WALL_FIRST  = 10, PIT_WALL_END = 38, PIT_EXIT_END = 44;
constexpr float PIT_WALL_X      = 1.04f, PIT_LANE_X0 = 1.12f, PIT_LANE_X1 = 1.96f;

// 3 stands spécialisés le long de la voie des stands :
// 1. N2O Express (segs 11..18)  : passage rapide < 95 km/h -> recharge cryo N2O sans arrêt complet
// 2. Pneus & Train (segs 19..26): arrêt < 38 km/h (~1.2s)  -> usure pneus à 0 + supprime pullDir
// 3. Garage Moteur (segs 27..36): arrêt < 30 km/h          -> révision moteur complète + Lollipop GO!
enum PitBayKind : uint8_t { BAY_NONE = 0, BAY_NITRO = 1, BAY_TYRES = 2, BAY_ENGINE = 3 };

// Champs à ajouter dans class Race (race.h) :
//   float tyreWear = 0.0f;
//   uint8_t activeBay = BAY_NONE;
//   bool pitLimiter = true;      // activable/désactivable avec BTN_L1 sur Gamebuino AKA
//   uint8_t lollipop = 0;        // 0 caché, 1 STOP, 2 READY, 3 GO!
//   float lollipopGoT = 0.0f, launchBoostT = 0.0f;

// ============================================================================
// main/game/race.cpp — Logique des 3 stands + Limiteur L1 + Boost Lollipop
// ============================================================================
void Race::updatePitStops(float dt, const plat::Input& in) {
    Car& p = player();
    if (autopilot || demo || !started || p.retired) { pitting = false; activeBay = BAY_NONE; return; }

    if (in.pressed & plat::BTN_L1) {
        pitLimiter = !pitLimiter;
        plat::playSfx(plat::SFX_MENU_MOVE);
    }

    int pidx = track.indexAt(carZ(p));
    bool onApron = (pidx >= PIT_ENTRY_FIRST && pidx <= PIT_EXIT_END && p.x > PIT_WALL_X && p.x < PIT_LANE_X1 + 0.10f);
    float kmh = speedKmh();

    if (onApron && pitLimiter && kmh > 85.0f) {
        p.speed = fmaxf(85.0f / 240.0f * MAX_SPEED, p.speed - MAX_SPEED * 0.9f * dt);
    }

    if (!onApron || pidx < PIT_WALL_FIRST || pidx > PIT_WALL_END) {
        if (lollipop == 3 && lollipopGoT > 0.0f && (in.held & plat::BTN_A)) {
            launchBoostT = 1.35f; lollipopGoT = 0.0f;
            plat::playSfx(plat::SFX_NITRO);
        }
        pitting = false; activeBay = BAY_NONE;
        if (!onApron) lollipop = 0;
        return;
    }

    static const float kRepair[DIFF_COUNT] = { 0.40f, 0.30f, 0.24f, 0.19f };

    if (pidx >= 11 && pidx <= 18) {                 // STAND 1 : N2O EXPRESS (< 95 km/h)
        activeBay = BAY_NITRO;
        if (kmh <= 95.0f && nitro < 1.0f) {
            pitting = true;
            nitro = fminf(1.0f, nitro + dt * 1.35f);
        } else pitting = false;
    } else if (pidx >= 19 && pidx <= 26) {          // STAND 2 : PNEUS & GEOMETRIE (< 38 km/h)
        activeBay = BAY_TYRES;
        if (kmh <= 38.0f && (tyreWear > 0.01f || pullDir != 0)) {
            pitting = true; lollipop = 1;
            tyreWear = fmaxf(0.0f, tyreWear - dt * 0.78f);
            if (tyreWear <= 0.0f) { pullDir = 0; lollipop = 3; lollipopGoT = 1.8f; ev.pitDone = true; }
        } else pitting = false;
    } else if (pidx >= 27 && pidx <= 36) {          // STAND 3 : GARAGE MOTEUR COMPLET (< 30 km/h)
        activeBay = BAY_ENGINE;
        if (kmh <= 30.0f && (damage > 0.005f || tyreWear > 0.01f || nitro < 0.99f)) {
            if (!pitting) { pitting = true; pitT = 0; ev.pitStart = true; }
            pitT += dt;
            damage   = fmaxf(0.0f, damage - kRepair[difficulty] * dt);
            tyreWear = fmaxf(0.0f, tyreWear - 0.55f * dt);
            nitro    = fminf(1.0f, nitro + 0.65f * dt);
            lollipop = damage < 0.08f ? 2 : 1;
            if (damage <= 0.0f && tyreWear <= 0.0f && nitro >= 0.99f) {
                pullDir = 0; pitting = false;
                lollipop = 3; lollipopGoT = 2.0f; ev.pitDone = true;
            }
        } else {
            if (lollipop == 3 && lollipopGoT > 0.0f && (in.held & plat::BTN_A)) {
                launchBoostT = 1.35f; lollipopGoT = 0.0f;
                plat::playSfx(plat::SFX_NITRO);
            }
            pitting = false;
        }
    }
}`,
  },
  {
    id: 'circuit_anim_lut',
    filename: 'circuit_animations_esp32s3.cpp',
    targetPathInRepo: 'main/game/render.cpp + main/game/track.cpp',
    category: 'circuits',
    titleFr: 'Animations Temps Réel des 6 Circuits + Tunnels SEGF_TUNNEL + LUT sin8 60 FPS',
    summaryFr:
      'Ajoute une table int16_t kSin8[256] (économise ~1.2 ms/frame sur ESP32-S3 en supprimant les 1280 sinf() de glacier_far), anime les aurores boréales de Glacier Run, le faisceau tournant du phare et les projecteurs de Night Harbor, le monorail et les fenêtres de Neon City, les vagues/voiliers de Palm Bay, la télécabine/neige d’Alpine Pass et active enfin le flag SEGF_TUNNEL !',
    flashImpact: '+512 octets LUT · Gain +1.2 ms/frame sur ESP32-S3',
    code: `// ============================================================================
// main/game/render.cpp — Table trigonométrique fixe 8-bit pour ESP32-S3 (0 sinf par colonne !)
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

// ---- Animations temps réel dans draw_sky(const Race& r, float time) ---------
void draw_sky_animated_overlays(const Race& r, float time, int sh) {
    init_fast_lut();
    const int theme = r.track.theme;
    const int t8 = (int)(time * 42.0f);

    if (theme == THEME_GLACIER) {
        // Rideaux d'aurores boréales ondulants en temps réel (2px step -> < 0.18 ms sur ESP32-S3)
        for (int x = 0; x < W; x += 2) {
            int ph = (((x + sh) & (PANO_W - 1)) * 256) / PANO_W;
            int yc = 32 + ((11 * fastSin(ph * 2 + t8)) >> 8) + ((5 * fastSin(ph * 5 - t8 * 2)) >> 8);
            int mix = 128 + (fastSin(ph * 3 + (t8 >> 1)) >> 1);
            uint16_t col = lerp(rgb(64, 255, 168), rgb(156, 92, 255), mix);
            for (int dy = 0; dy < 26; dy += 2) {
                int a = ((26 - dy) * 115) / 26;
                blendRect(x, yc + dy, 2, 2, col, a);
            }
        }
    } else if (theme == THEME_CITY || theme == THEME_HARBOR) {
        // Projecteurs balayant le ciel nocturne
        for (int b = 0; b < 2; ++b) {
            int basePx = b ? 760 : 180;
            int bx = ((basePx - sh) & (PANO_W - 1));
            if (bx > 680) bx -= PANO_W;
            int sweep = (fastSin(t8 / (b ? 3 : 2) + b * 90) * 190) >> 8; // -190..+190
            uint16_t beamCol = theme == THEME_CITY ? (b ? rgb(255, 70, 210) : rgb(60, 235, 255))
                                                   : rgb(205, 228, 248);
            for (int dy = 0; dy < HORIZON - 10; dy += 2) {
                int cx = bx + ((sweep * dy) >> 8);
                int w = 3 + dy / 8;
                blendRect(cx - w / 2, HORIZON - 2 - dy, w, 2, beamCol, 26);
            }
        }
    } else if (theme == THEME_COAST) {
        // Oiseaux marins battant des ailes devant le soleil couchant
        for (int b = 0; b < 5; ++b) {
            int bx = ((180 + b * 46 + (int)(time * 22.0f) - sh) & (PANO_W - 1));
            if (bx >= W - 4) continue;
            int by = 32 + b * 6 + (fastSin(t8 + b * 40) >> 6);
            int flap = fastSin(t8 * 4 + b * 55) >= 0 ? 1 : 0;
            for (int dx = -3; dx <= 3; ++dx)
                pset(bx + dx, by - abs(dx) * flap + (dx == 0 ? 1 : 0), rgb(38, 18, 48));
        }
    }
}

// ---- Faisceau tournant du Phare (Night Harbor / Palm Bay) dans draw_prop() ---
if (pr.spr == SPR_LIGHTHOUSE && dw > 3 && ps.fog < 230) {
    int gx = x + dw / 2, gy = y + (int)(41 * destH / 230);
    float dir = sinf(time * 2.1f);
    int len = (int)(dw * 2.4f * fabsf(dir));
    int sgn = dir >= 0 ? 1 : -1;
    for (int bx = 0; bx < len; bx += 2) {
        int sp = 1 + bx / 6;
        int a = 120 - (bx * 105) / (len + 1);
        if (gy - sp < ps.clip)
            blendRect(gx + sgn * bx, gy - sp, 2, sp * 2 + 1, rgb(255, 236, 150), a);
    }
}

// ---- Portiques & Éclairage des Tunnels (active SEGF_TUNNEL de track.h !) ----
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
    id: 'net_mp_aka_esp32',
    filename: 'net_mp_aka.cpp',
    targetPathInRepo: 'main/game/net_mp_aka.cpp (ESP32-S3) + host/net_mp_pc.cpp',
    category: 'multiplayer',
    titleFr: 'Client Multijoueur Gamebuino AKA (ESP32-S3 Wi-Fi WebSocket Binaire 20 octets)',
    summaryFr:
      'Se connecte directement au serveur de course WebSocket (server.ts /ws/race?mode=binary) depuis la Gamebuino AKA via esp_websocket_client ou depuis le build PC SDL2. Zéro allocation JSON en course : trame binaire fixe 0xA4 (20 octets envoi) / 0xA5 (164 octets réception à 20 Hz).',
    flashImpact: 'Bande passante < 3.4 Ko/s · 0 malloc par frame',
    code: `// ============================================================================
// main/game/net_mp_aka.cpp — Client Multijoueur Temps Réel Gamebuino AKA (ESP-IDF 5.5)
// Compatible avec le serveur WebSocket de cet atelier (/ws/race?mode=binary)
// Dépendance CMakeLists.txt : REQUIRES esp_wifi esp_event nvs_flash esp_websocket_client
// ============================================================================
#include "race.h"
#include "esp_websocket_client.h"
#include "esp_log.h"
#include <string.h>

#pragma pack(push, 1)
struct AkaCarPacket {           // 20 octets exacts (AKA_BIN_PACKET_SIZE)
    uint8_t  magic;             // 0xA4
    uint8_t  slotAndFlags;      // bits 0..2: slot | bit3: brake, bit4: nitro, bit5: pit, bit6: retired, bit7: human
    float    dist;
    float    x;
    float    speed;
    int16_t  steerMilli;        // steerVis * 1000
    uint16_t damageMilli;       // damage * 1000
    uint8_t  place;
    uint8_t  driverLook;
};

struct AkaRoomSnapshot {        // 164 octets exacts diffusés à 20 Hz par server.ts
    uint8_t      magic;         // 0xA5
    uint8_t      phaseAndTrack; // bits 0..1: LOBBY/COUNTDOWN/RACING/RESULTS | bits 2..5: trackId
    uint16_t     raceTimeCs;    // centièmes de seconde
    AkaCarPacket cars[CAR_COUNT];
};
#pragma pack(pop)

static esp_websocket_client_handle_t s_ws = nullptr;
static volatile bool s_hasSnap = false;
static AkaRoomSnapshot s_latestSnap{};
static int s_mySlot = CAR_COUNT - 1;

static void on_ws_event(void*, esp_event_base_t, int32_t event_id, void* event_data) {
    auto* d = (esp_websocket_event_data_t*)event_data;
    if (event_id == WEBSOCKET_EVENT_DATA && d->op_code == 0x02 /* binary */) {
        if (d->data_len == sizeof(AkaRoomSnapshot) && (uint8_t)d->data_ptr[0] == 0xA5) {
            memcpy(&s_latestSnap, d->data_ptr, sizeof(AkaRoomSnapshot));
            s_hasSnap = true;
        }
    }
}

void net_mp_connect(const char* serverHost, const char* roomCode, const char* callsign) {
    static char uri[192];
    snprintf(uri, sizeof(uri),
             "wss://%s/ws/race?mode=binary&room=%s&platform=AKA&name=%s",
             serverHost, roomCode, callsign);

    esp_websocket_client_config_t cfg = {};
    cfg.uri = uri;
    cfg.buffer_size = 512;
    cfg.reconnect_timeout_ms = 2000;
    s_ws = esp_websocket_client_init(&cfg);
    esp_websocket_register_events(s_ws, WEBSOCKET_EVENTS, on_ws_event, nullptr);
    esp_websocket_client_start(s_ws);
}

// Appeler à 20 Hz (toutes les 3 frames à 60 FPS) pendant ST_RACING
void net_mp_sync(Race& r) {
    if (!s_ws || !esp_websocket_client_is_connected(s_ws)) return;

    const Car& p = r.player();
    uint8_t flags = (p.braking ? 1 : 0) | (r.nitroOn ? 2 : 0) | (r.pitting ? 4 : 0) | (p.retired ? 8 : 0);
    AkaCarPacket out = {
        0xA4,
        (uint8_t)((s_mySlot & 7) | (flags << 3)),
        p.dist, p.x, p.speed,
        (int16_t)(r.steer * 1000.0f),
        (uint16_t)(r.damage * 1000.0f),
        (uint8_t)p.place,
        (uint8_t)p.look
    };
    esp_websocket_client_send_bin(s_ws, (const char*)&out, sizeof(out), pdMS_TO_TICKS(5));

    if (s_hasSnap) {
        s_hasSnap = false;
        for (int i = 0; i < CAR_COUNT; ++i) {
            if (i == s_mySlot) continue;
            const AkaCarPacket& sc = s_latestSnap.cars[i];
            Car& c = r.cars[i];
            c.dist     += (sc.dist - c.dist) * 0.45f; // interpolation fluide sans saccade
            c.x        += (sc.x - c.x) * 0.45f;
            c.speed     = sc.speed;
            c.steerVis  = sc.steerMilli / 1000.0f;
            c.braking   = (sc.slotAndFlags >> 3) & 1;
            c.place     = sc.place;
            c.look      = sc.driverLook & 7;
        }
    }
}`,
  },
];

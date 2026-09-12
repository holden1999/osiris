import { stealthFetch } from '@/lib/stealthFetch';
import { cachedSource } from '@/lib/sourceCache';
import type { CctvCamera, CctvStreamType } from './types';

/**
 * OSIRIS — Asian cameras via the OpenCCTV directory.
 *
 * Source: https://opencctv.org — an aggregator carrying ~145,000 cameras, of
 * which ~30,000 sit inside the Asian boxes below, most of them republished
 * from official city and prefectural operators (Busan and Ansan's ITS, Seoul,
 * Hong Kong's Observatory, Japan's river and road bureaus). It fills the
 * region the traffic-authority feeds cannot: South Korea, Indonesia, Vietnam
 * and the Philippines publish no open machine-readable CCTV index of their
 * own — every national portal checked (Korea's UTIC and ITS, Taiwan's TDX)
 * gates its camera list behind an API key.
 *
 * Two endpoints, both the ones the site's own map calls:
 *
 *   GET  /api/cameras/markers   the whole index as parallel arrays — id, lat,
 *                               lng — and nothing else. 7.3 MB, and it ignores
 *                               every filter parameter tried, so the shape of
 *                               this module is set by having to take all of it
 *                               and narrow locally.
 *   POST /api/cameras/batch     {ids:[…]} → full records. It answers with at
 *                               most 50 rows however many ids are sent, which
 *                               is what BATCH_SIZE encodes and why the region
 *                               is sampled rather than taken whole: 24,000
 *                               cameras would be 483 round trips.
 */

const MARKERS = 'https://opencctv.org/api/cameras/markers';
const BATCH = 'https://opencctv.org/api/cameras/batch';

/** The server truncates a batch response to 50 rows regardless of ids sent. */
const BATCH_SIZE = 50;
/**
 * Asia is split rather than taken whole so a viewport over Jakarta does not
 * pay for Japan. Each sub-region carries its own ceiling on cameras
 * materialised, which is what keeps this to tens of round trips, not 600.
 */
interface Bounds { minLat: number; maxLat: number; minLng: number; maxLng: number }

const REGIONS: Record<string, { bounds: Bounds; cap: number }> = {
  /* China, Japan, the Koreas and Taiwan — ~24,000 candidates. */
  eastasia: { bounds: { minLat: 18, maxLat: 46, minLng: 73.5, maxLng: 146 }, cap: 1200 },
  /* Indochina, Indonesia, the Philippines — ~7,700 candidates. */
  seasia: { bounds: { minLat: -11, maxLat: 24, minLng: 92, maxLng: 130 }, cap: 800 },
  /* The Gulf, Iran, Central Asia and the subcontinent — ~950 between them, so
     the cap is never the binding constraint here; it is a guard, not a quota. */
  westasia: { bounds: { minLat: 5, maxLat: 56, minLng: 25, maxLng: 92 }, cap: 600 },
};

/** The index, as three parallel arrays. */
interface MarkerIndex {
  ids?: string[];
  lats?: number[];
  lngs?: number[];
}

/** One row from /api/cameras/batch (only the fields we consume). */
export interface OpenCctvRecord {
  id?: string;
  name?: string | null;
  city?: string | null;
  country?: string | null;
  lat?: number;
  lng?: number;
  feed_url?: string | null;
  feed_type?: string | null;
  source?: string | null;
  active?: number;
  /** Set when appending a query string to feed_url returns an error instead. */
  cache_buster_breaks_url?: boolean;
}

/** OpenCCTV's `feed_type` in OSIRIS's vocabulary; null means unusable. */
export function streamKind(feedType?: string | null): CctvStreamType | 'jpg' | null {
  switch ((feedType || '').toLowerCase()) {
    case 'm3u8':
    case 'hls': return 'hls';
    case 'mjpeg': return 'mjpeg';
    case 'image': return 'jpg';
    case 'iframe': return 'iframe';
    default: return null;
  }
}

/**
 * OpenCCTV's own coordinates for the Hutama Karya "MUDIK" cameras on the
 * Jakarta Outer Ring Road south arc (JORR S) are generated from the camera
 * *name* — mostly chainage markers like "23+200" — by an upstream geocoder
 * that placed the whole corridor up to 5 km north-east of the toll road
 * (GT Ampera and GT Lenteng Agung verify 1.7–5 km off, in the wrong order).
 *
 * The pins are re-anchored onto the JORR S alignment. GT Ampera (km 27) and
 * GT Lenteng Agung (km 30) were verified against OSM — those two fix the
 * chainage; the km-marker cameras sit at their own chainage; the remaining
 * gates keep their kilometre order west→east (Fatmawati 25 · Ampera 27 ·
 * Lenteng Agung 30 · Gedong 32 · Kampung Rambutan 32+ · Pasar Rebo 32+),
 * roughly 1 km per chainage unit at this latitude.
 */
const JAKARTA_JORR_FIXES: Record<string, { lat: number; lng: number }> = {
  'mudik-BUJT-2368': { lat: -6.2773, lng: 106.7686 }, /* 19+850 */
  'mudik-BUJT-2371': { lat: -6.2847, lng: 106.7746 }, /* 21+300 */
  'mudik-BUJT-2373': { lat: -6.2906, lng: 106.7810 }, /* 22+400 */
  'mudik-BUJT-2374': { lat: -6.2915, lng: 106.7845 }, /* 23+000 */
  'mudik-BUJT-2375': { lat: -6.2917, lng: 106.7860 }, /* 23+200 */
  'mudik-BUJT-2376': { lat: -6.2922, lng: 106.7890 }, /* 23+600 */
  'mudik-BUJT-2377': { lat: -6.2922, lng: 106.7921 }, /* 24+000 */
  'mudik-BUJT-2116': { lat: -6.29244, lng: 106.81920 }, /* JORRS GT AMPERA 1 — OSM-verified */
  'mudik-BUJT-2117': { lat: -6.2926, lng: 106.8196 }, /* JORRS GT AMPERA 2 */
  'mudik-BUJT-2119': { lat: -6.2923, lng: 106.8011 }, /* JORRS GT FATMAWATI 2 */
  'mudik-BUJT-2120': { lat: -6.3046, lng: 106.8536 }, /* JORRS GT GEDONG 2 */
  'mudik-BUJT-2121': { lat: -6.3048, lng: 106.8546 }, /* JORRS GT KP RAMBUTAN */
  'mudik-BUJT-2122': { lat: -6.30126, lng: 106.83547 }, /* JORRS GT LENTENG 1 — OSM-verified */
  'mudik-BUJT-2123': { lat: -6.3015, lng: 106.8364 }, /* JORRS GT LENTENG AGUNG 2 */
  'mudik-BUJT-2124': { lat: -6.3053, lng: 106.8574 }, /* JORRS GT PASAR REBO */
};

/**
 * Same disease, second corridor: the MUDIK cameras on the Cimanggis–Cibitung
 * toll (JORR 2) are placed by name too, again on the wrong spot — "VMS KM 25"
 * and "GT Jatikarya 1" land up to 3 km off the carriageway. The toll's km
 * markers continue from the Simpang Susun Cimanggis (km 49) through Jatikarya
 * (52–53), Nagrak (56) and on to Cibitung (km 75); each camera is re-anchored
 * at its own chainage along the OSM alignment (Wikipedia interchange list).
 */
const CIMANGGIS_CIBITUNG_FIXES: Record<string, { lat: number; lng: number }> = {
  'mudik-BUJT-904': { lat: -6.38911, lng: 106.91043 }, /* VMS KM 25 (km 51) */
  'mudik-BUJT-1166': { lat: -6.38911, lng: 106.91043 }, /* KM 25+000 (KM 51+000) */
  'mudik-BUJT-1167': { lat: -6.38329, lng: 106.91747 }, /* KM 26+000 (KM 52+000) */
  'mudik-BUJT-1171': { lat: -6.38103, lng: 106.92034 }, /* On Ramp Jatikarya */
  'mudik-BUJT-903': { lat: -6.38109, lng: 106.92128 }, /* VMS On RAMP JATIKARYA */
  'mudik-BUJT-1169': { lat: -6.38109, lng: 106.92128 }, /* GT Jatikarya 1 */
  'mudik-BUJT-1168': { lat: -6.38169, lng: 106.92592 }, /* KM 27+000 (KM 53+000) */
  'mudik-BUJT-2183': { lat: -6.38231, lng: 106.93056 }, /* KM 53+500 */
  'mudik-BUJT-905': { lat: -6.38369, lng: 106.93499 }, /* Danau Onramp */
  'mudik-BUJT-906': { lat: -6.38405, lng: 106.93586 }, /* Danau Offramp */
  'mudik-BUJT-2184': { lat: -6.38369, lng: 106.93499 }, /* KM 54+000 */
  'mudik-BUJT-2503': { lat: -6.38470, lng: 106.93859 }, /* KM 54+400 */
  'mudik-BUJT-2186': { lat: -6.38461, lng: 106.94793 }, /* KM 55+400 */
  'mudik-BUJT-2188': { lat: -6.38421, lng: 106.95353 }, /* KM 56+000 */
};


/**
 * And the full sweep of the remaining MUDIK corridors — every one of these was
 * off its road, from ~2 km (the Lampung and Jakarta gates) out to ~22 km (the
 * Gending cameras were pinned at the north-coast trunk road instead of the
 * toll). Each pin is re-chained to its road using the official interchange km
 * tables (Wikipedia) and the OSM alignment:
 *   • Palembang–Indralaya       km 0 Ramp Palembang → 18 Indralaya
 *   • Serang–Panimbang Seksi 1  km 64 Walantaka → 90 Rangkasbitung
 *   • Pasuruan–Probolinggo      km 837+600 … 849+600 (SS Gending 849, then
 *                               the Probolinggo–Banyuwangi continuation)
 *   • Serpong–Balaraja Seksi 1  km 12+750 … 16+650 (Rawabuntu 12, BSD 16)
 *   • Terbanggi Besar–Kayu Agung km 177 … 181 (Gunung Batin 166 → Menggala 184)
 *   • Akses Tanjung Priok       km 58+400 … 61+400 (into Tanjung Priok port)
 *   • Tol Dalam Kota Ruas 6     km 22+670 … 27+100 (Kelapa Gading → Pulo Gebang)
 */
const MUDIK_INDONESIAN_TOLLS_FIXES: Record<string, { lat: number; lng: number }> = {
  'mudik-BUJT-197': { lat: -6.14882, lng: 106.24321 },
  'mudik-BUJT-201': { lat: -6.14965, lng: 106.24323 },
  'mudik-BUJT-2156': { lat: -3.10977, lng: 104.72533 },
  'mudik-BUJT-2157': { lat: -3.20769, lng: 104.69 },
  'mudik-BUJT-2158': { lat: -3.15405, lng: 104.70946 },
  'mudik-BUJT-2159': { lat: -3.1559, lng: 104.70895 },
  'mudik-BUJT-2160': { lat: -3.11149, lng: 104.72447 },
  'mudik-BUJT-2177': { lat: -6.1085, lng: 106.90437 },
  'mudik-BUJT-2178': { lat: -6.11695, lng: 106.89443 },
  'mudik-BUJT-2179': { lat: -6.12581, lng: 106.89314 },
  'mudik-BUJT-2301': { lat: -7.81783, lng: 113.2107 },
  'mudik-BUJT-2305': { lat: -7.82183, lng: 113.30619 },
  'mudik-BUJT-2307': { lat: -7.8218, lng: 113.3071 },
  'mudik-BUJT-2308': { lat: -7.8218, lng: 113.3071 },
  'mudik-BUJT-2310': { lat: -7.82177, lng: 113.308 },
  'mudik-BUJT-2311': { lat: -7.82158, lng: 113.30844 },
  'mudik-BUJT-2313': { lat: -7.8231, lng: 113.29362 },
  'mudik-BUJT-2314': { lat: -7.8222, lng: 113.30079 },
  'mudik-BUJT-2315': { lat: -7.82738, lng: 113.27894 },
  'mudik-BUJT-2317': { lat: -7.83254, lng: 113.24275 },
  'mudik-BUJT-2318': { lat: -7.832, lng: 113.25171 },
  'mudik-BUJT-2319': { lat: -7.82943, lng: 113.2602 },
  'mudik-BUJT-2321': { lat: -7.82868, lng: 113.26914 },
  'mudik-BUJT-2322': { lat: -7.82758, lng: 113.27805 },
  'mudik-BUJT-2323': { lat: -7.82508, lng: 113.2867 },
  'mudik-BUJT-2324': { lat: -7.82281, lng: 113.29541 },
  'mudik-BUJT-2326': { lat: -7.82158, lng: 113.31344 },
  'mudik-BUJT-2378': { lat: -6.13934, lng: 106.938 },
  'mudik-BUJT-2379': { lat: -6.13934, lng: 106.938 },
  'mudik-BUJT-2380': { lat: -6.1247, lng: 106.92793 },
  'mudik-BUJT-2381': { lat: -6.1247, lng: 106.92793 },
  'mudik-BUJT-2382': { lat: -6.11362, lng: 106.92426 },
  'mudik-BUJT-2384': { lat: -6.10876, lng: 106.91032 },
  'mudik-BUJT-2385': { lat: -6.10876, lng: 106.91032 },
  'mudik-BUJT-2386': { lat: -6.13467, lng: 106.8919 },
  'mudik-BUJT-2387': { lat: -6.13467, lng: 106.8919 },
  'mudik-BUJT-2388': { lat: -3.06613, lng: 104.75144 },
  'mudik-BUJT-2389': { lat: -3.06613, lng: 104.75144 },
  'mudik-BUJT-2390': { lat: -3.07554, lng: 104.74966 },
  'mudik-BUJT-2391': { lat: -3.07554, lng: 104.74966 },
  'mudik-BUJT-2392': { lat: -3.08376, lng: 104.7448 },
  'mudik-BUJT-2393': { lat: -3.08376, lng: 104.7448 },
  'mudik-BUJT-2395': { lat: -3.09109, lng: 104.73861 },
  'mudik-BUJT-2396': { lat: -3.09857, lng: 104.73261 },
  'mudik-BUJT-2397': { lat: -3.09857, lng: 104.73261 },
  'mudik-BUJT-2409': { lat: -4.64931, lng: 105.19061 },
  'mudik-BUJT-2410': { lat: -4.6435, lng: 105.19124 },
  'mudik-BUJT-2411': { lat: -4.6435, lng: 105.19124 },
  'mudik-BUJT-2412': { lat: -4.63787, lng: 105.19277 },
  'mudik-BUJT-2413': { lat: -4.63787, lng: 105.19277 },
  'mudik-BUJT-2414': { lat: -4.6328, lng: 105.19551 },
  'mudik-BUJT-2415': { lat: -4.6328, lng: 105.19551 },
  'mudik-BUJT-2416': { lat: -4.62705, lng: 105.19552 },
  'mudik-BUJT-2417': { lat: -4.62705, lng: 105.19552 },
  'mudik-BUJT-2461': { lat: -6.30089, lng: 106.69683 },
  'mudik-BUJT-2462': { lat: -6.30194, lng: 106.69512 },
  'mudik-BUJT-2463': { lat: -6.30194, lng: 106.69512 },
  'mudik-BUJT-2464': { lat: -6.30404, lng: 106.69169 },
  'mudik-BUJT-2465': { lat: -6.30404, lng: 106.69169 },
  'mudik-BUJT-2466': { lat: -6.30754, lng: 106.68598 },
  'mudik-BUJT-2467': { lat: -6.30754, lng: 106.68598 },
  'mudik-BUJT-2468': { lat: -6.31104, lng: 106.68027 },
  'mudik-BUJT-2469': { lat: -6.31104, lng: 106.68027 },
  'mudik-BUJT-2470': { lat: -6.31214, lng: 106.67408 },
  'mudik-BUJT-2471': { lat: -6.31214, lng: 106.67408 },
  'mudik-BUJT-2472': { lat: -6.30696, lng: 106.67007 },
  'mudik-BUJT-2473': { lat: -6.30696, lng: 106.67007 },
  'mudik-BUJT-2474': { lat: -6.3048, lng: 106.6646 },
  'mudik-BUJT-2475': { lat: -6.3048, lng: 106.6646 },
  'mudik-BUJT-2476': { lat: -6.30415, lng: 106.65864 },
  'mudik-BUJT-2477': { lat: -6.30415, lng: 106.65864 },
  'mudik-BUJT-2478': { lat: -6.30461, lng: 106.65135 },
  'mudik-BUJT-2479': { lat: -6.30461, lng: 106.65135 },
  'mudik-BUJT-2481': { lat: -6.30415, lng: 106.65864 },
  'mudik-BUJT-2482': { lat: -6.30428, lng: 106.65997 },
  'mudik-BUJT-2483': { lat: -6.30415, lng: 106.65864 },
  'mudik-BUJT-2484': { lat: -6.30442, lng: 106.66129 },
  'mudik-BUJT-286': { lat: -6.30261, lng: 106.25405 },
  'mudik-BUJT-287': { lat: -6.28586, lng: 106.25876 },
  'mudik-BUJT-312': { lat: -6.33533, lng: 106.23234 },
  'mudik-BUJT-322': { lat: -6.34124, lng: 106.22945 },
  'mudik-BUJT-324': { lat: -6.342, lng: 106.22914 },
  'mudik-BUJT-339': { lat: -6.16153, lng: 106.25009 },
  'mudik-BUJT-340': { lat: -6.16958, lng: 106.24942 },
  'mudik-BUJT-347': { lat: -6.20475, lng: 106.25852 },
  'mudik-BUJT-363': { lat: -6.21191, lng: 106.26242 },
  'mudik-BUJT-377': { lat: -6.22504, lng: 106.26897 },
  'mudik-BUJT-424': { lat: -6.23384, lng: 106.26742 },
  'mudik-BUJT-425': { lat: -6.21459, lng: 106.26431 },
  'mudik-BUJT-559': { lat: -6.27107, lng: 106.26339 },
  'mudik-BUJT-560': { lat: -6.27937, lng: 106.25983 },
  'mudik-BUJT-859': { lat: -6.18841, lng: 106.942 },
  'mudik-BUJT-860': { lat: -6.18589, lng: 106.93906 },
  'mudik-BUJT-862': { lat: -6.18322, lng: 106.92369 },
  'mudik-BUJT-865': { lat: -6.16716, lng: 106.91603 },
  'mudik-BUJT-867': { lat: -6.15983, lng: 106.90378 },
  'mudik-BUJT-868': { lat: -6.15614, lng: 106.898 },
  'mudik-BUJT-870': { lat: -6.18841, lng: 106.942 },
};

export const OPENCCTV_COORD_FIXES: Record<string, { lat: number; lng: number }> = {
  ...JAKARTA_JORR_FIXES,
  ...CIMANGGIS_CIBITUNG_FIXES,
  ...MUDIK_INDONESIAN_TOLLS_FIXES,
};


/** Re-anchor a camera whose upstream coordinates are known to be wrong, in place. */
export function applyCoordinateFix(rec: { id?: string }, cam: CctvCamera): CctvCamera {
  const fix = rec.id ? OPENCCTV_COORD_FIXES[rec.id] : undefined;
  if (fix) {
    cam.lat = fix.lat;
    cam.lng = fix.lng;
  }
  return cam;
}

/** Map one record to a camera, or null if it should be skipped. */
export function mapRecord(rec: OpenCctvRecord): CctvCamera | null {
  if (!rec?.id || rec.active === 0) return null;

  const url = rec.feed_url?.trim();
  if (!url) return null;

  const kind = streamKind(rec.feed_type);
  if (!kind) return null;

  const { lat, lng } = rec;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  /* A snapshot tile re-requests with `?_t=` on every refresh. Where the source
     has recorded that a query string breaks the URL, that tile would turn into
     a broken box the moment it refreshed, so it never gets one. */
  if (kind === 'jpg' && rec.cache_buster_breaks_url) return null;

  const name = rec.name?.trim() || rec.city?.trim() || 'Camera';

  return {
    id: `occ-${rec.id}`,
    lat,
    lng,
    name,
    city: rec.city?.trim() || '',
    country: rec.country?.trim() || '',
    /* A still is a feed_url; everything else is a stream the player picks up. */
    ...(kind === 'jpg' ? { feed_url: url } : { stream_url: url, stream_type: kind }),
    source: rec.source?.trim() ? `OpenCCTV / ${rec.source.trim()}` : 'OpenCCTV',
  };
}

/**
 * Thin the candidates down to MAX_CAMERAS by walking the list at a fixed
 * stride. The index is ordered by id, which groups cameras by operator and so
 * by place — taking the first N would return one city and call it a region.
 */
export function sample<T>(items: T[], cap: number): T[] {
  if (items.length <= cap) return items;
  const stride = items.length / cap;
  const out: T[] = [];
  for (let i = 0; out.length < cap && Math.floor(i) < items.length; i += stride) {
    out.push(items[Math.floor(i)]);
  }
  return out;
}

async function fetchBatch(ids: string[]): Promise<OpenCctvRecord[]> {
  const res = await stealthFetch(BATCH, {
    method: 'POST',
    signal: AbortSignal.timeout(20000),
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Referer: 'https://opencctv.org/',
    },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data.filter(Boolean) : [];
}

/** The marker index, fetched once and shared by every Asian sub-region. */
const markerIndex = cachedSource('opencctv-index', async (): Promise<MarkerIndex[]> => {
  const res = await stealthFetch(MARKERS, {
    signal: AbortSignal.timeout(30000),
    headers: { Accept: 'application/json', Referer: 'https://opencctv.org/' },
  });
  if (!res.ok) throw new Error(`OpenCCTV markers HTTP ${res.status}`);

  const index = (await res.json()) as MarkerIndex;
  if (!Array.isArray(index.ids) || !Array.isArray(index.lats) || !Array.isArray(index.lngs)) {
    throw new Error('OpenCCTV markers returned no index');
  }
  /* Wrapped in an array because the cache stores lists; it is one 7.3 MB
     download shared by all three regions rather than one download each. */
  return [index];
});

function loader(region: string, bounds: Bounds, cap: number) {
  return async (): Promise<CctvCamera[]> => {
    const [index] = await markerIndex();
    const ids = index?.ids ?? [];
    const lats = index?.lats ?? [];
    const lngs = index?.lngs ?? [];

    const inRegion: string[] = [];
    for (let i = 0; i < ids.length; i++) {
      const lat = lats[i];
      const lng = lngs[i];
      if (lat > bounds.minLat && lat < bounds.maxLat &&
          lng > bounds.minLng && lng < bounds.maxLng) {
        inRegion.push(ids[i]);
      }
    }

    const wanted = sample(inRegion, cap);
    const chunks: string[][] = [];
    for (let i = 0; i < wanted.length; i += BATCH_SIZE) {
      chunks.push(wanted.slice(i, i + BATCH_SIZE));
    }

    const results = await Promise.allSettled(chunks.map(fetchBatch));
    const seen = new Map<string, CctvCamera>();
    for (const r of results) {
      if (r.status !== 'fulfilled') continue;
      for (const rec of r.value) {
        const cam = mapRecord(rec);
        if (cam) {
          applyCoordinateFix(rec, cam);
          seen.set(cam.id, cam);
        }
      }
    }

    const cams = [...seen.values()];
    console.log(`[OSIRIS] ${region} cameras — OpenCCTV: ${cams.length} of ${inRegion.length} in region`);
    return cams;
  };
}

export const fetchEastAsiaCameras = cachedSource('eastasia', loader('East Asia', REGIONS.eastasia.bounds, REGIONS.eastasia.cap));
export const fetchSeAsiaCameras = cachedSource('seasia', loader('Southeast Asia', REGIONS.seasia.bounds, REGIONS.seasia.cap));
export const fetchWestAsiaCameras = cachedSource('westasia', loader('West & Central Asia', REGIONS.westasia.bounds, REGIONS.westasia.cap));

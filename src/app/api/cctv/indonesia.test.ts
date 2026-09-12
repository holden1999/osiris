import { describe, it, expect } from 'vitest';
import { fetchIndonesiaCameras } from './indonesia';
import type { CctvCamera } from './types';

/**
 * The Indonesian pins are hand-catalogued, so nothing else in the build would
 * catch a fat-fingered coordinate. These bounds are deliberately a little wider
 * than the Greater Jakarta / Bogor area the cameras actually sit in — they
 * catch a transposed digit or a sign flip, not a street-level mistake.
 */
const JABODETABEK = { minLat: -6.8, maxLat: -5.9, minLng: 106.4, maxLng: 107.2 };

describe('fetchIndonesiaCameras', () => {
  it('returns every camera with a unique id', async () => {
    const cams = await fetchIndonesiaCameras();
    expect(cams.length).toBeGreaterThan(0);
    const ids = cams.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('pins every camera inside the Jakarta / Bogor footprint', async () => {
    const cams = await fetchIndonesiaCameras();
    for (const c of cams) {
      expect(c.lat, `${c.id} lat`).toBeGreaterThanOrEqual(JABODETABEK.minLat);
      expect(c.lat, `${c.id} lat`).toBeLessThanOrEqual(JABODETABEK.maxLat);
      expect(c.lng, `${c.id} lng`).toBeGreaterThanOrEqual(JABODETABEK.minLng);
      expect(c.lng, `${c.id} lng`).toBeLessThanOrEqual(JABODETABEK.maxLng);
    }
  });

  /* The Puncak corridor cameras were once pinned ~7-10km south of the road they
     watch, which put them in open country rather than on the pass. */
  it('keeps the Puncak corridor cameras on the Cisarua-Gadog stretch', async () => {
    const cams = await fetchIndonesiaCameras();
    const byId = new Map(cams.map(c => [c.id, c]));
    expect(byId.get('id-yt-simpang-gadog')?.lat).toBeCloseTo(-6.6539, 2);
    expect(byId.get('id-yt-puncak-cisarua')?.lat).toBeCloseTo(-6.6995, 2);
  });

  it('gives every camera a usable stream or external link', async () => {
    const cams = await fetchIndonesiaCameras();
    for (const c of cams) {
      expect(c.stream_url ?? c.external_url ?? c.feed_url, `${c.id} has no source`).toBeTruthy();
    }
  });

  it('marks YouTube embeds as iframes so the viewer picks the right player', async () => {
    const cams: CctvCamera[] = await fetchIndonesiaCameras();
    const youtube = cams.filter(c => c.stream_url?.includes('youtube.com/embed'));
    expect(youtube.length).toBeGreaterThan(0);
    for (const c of youtube) expect(c.stream_type).toBe('iframe');
  });

  /* The Bogor toll cameras came from the MUDIK directory with OpenCCTV
     carrying none of them, so these pins are the only place they surface.
     They are chained along the Ciawi–Sukabumi motorway — km 47.3 at the IC
     Ciawi through to km 60+150 at IC Cigombong — and must march south-west. */
  const BOGOR_IDS = ['id-bgr-km-47-200', 'id-bgr-gt-ciawi-selatan', 'id-bgr-ic-ciawi-selatan',
    'id-bgr-akses-ciawi-selatan', 'id-bgr-km-51-050', 'id-bgr-gt-caringin', 'id-bgr-ic-caringin',
    'id-bgr-km-55-000', 'id-bgr-gt-cigombong-a', 'id-bgr-gt-cigombong-b', 'id-bgr-ic-cigombong',
    'id-bgr-akses-cigombong'];

  it('ships the twelve Bogor toll cameras as HLS feeds', async () => {
    const cams = await fetchIndonesiaCameras();
    const bogor = cams.filter(c => BOGOR_IDS.includes(c.id));
    expect(bogor).toHaveLength(12);
    for (const c of bogor) {
      expect(c.stream_type, `${c.id}`).toBe('hls');
      expect(c.stream_url, `${c.id}`).toMatch(/^https:\/\/www\.tjt-info\.co\.id\/LiveApp\/streams\//);
    }
  });

  it('keeps the Bogor toll pins marching south-west along the motorway', async () => {
    const cams = await fetchIndonesiaCameras();
    const byId = new Map(cams.map(c => [c.id, c]));
    const order = ['id-bgr-km-47-200', 'id-bgr-ic-ciawi-selatan', 'id-bgr-km-51-050',
      'id-bgr-ic-caringin', 'id-bgr-km-55-000', 'id-bgr-ic-cigombong'];
    let prevLat = Number.POSITIVE_INFINITY; // travel = lat dropping, lng dropping
    let prevLng = Number.POSITIVE_INFINITY;
    for (const id of order) {
      const c = byId.get(id)!;
      expect(c.lat, `${id} lat`).toBeLessThan(prevLat);
      expect(c.lng, `${id} lng`).toBeLessThan(prevLng);
      prevLat = c.lat;
      prevLng = c.lng;
    }
  });

  /* The Monas cameras are baked from the OpenCCTV index so all 57 angles
     appear (the seasia fetch samples only ~1 in 10 of the index), with the
     jakarta-Monas-* originals dropped from the OpenCCTV path. */
  it('ships all 57 Monas cameras as iframe embeds around the monument', async () => {
    const cams = await fetchIndonesiaCameras();
    const monas = cams.filter(c => c.id.startsWith('id-jkt-mn-'));
    expect(monas).toHaveLength(57);
    for (const c of monas) {
      expect(c.stream_type, `${c.id}`).toBe('iframe');
      expect(c.stream_url, `${c.id}`).toMatch(/^https:\/\/cctv\.balitower\.co\.id\/Monas-/);
      expect(c.lat, `${c.id} lat`).toBeGreaterThan(-6.181);
      expect(c.lat, `${c.id} lat`).toBeLessThan(-6.170);
      expect(c.lng, `${c.id} lng`).toBeGreaterThan(106.822);
      expect(c.lng, `${c.id} lng`).toBeLessThan(106.831);
    }
  });
});

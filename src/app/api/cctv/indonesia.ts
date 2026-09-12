import type { CctvCamera } from './types';

/**
 * OSIRIS — Indonesia live CCTV cameras.
 *
 * Primary sources:
 * - YouTube live embeds: 24/7 streams from Cemerlang CCTV and Kompas TV showing
 *   real-time Indonesian traffic conditions. These work globally.
 * - BaliTower Jakarta Smart City: real HLS streams from Jakarta's public CCTV
 *   network (4,363 cameras). Geofenced to Indonesia — only accessible from
 *   within the country or via VPN. Kept as external_url for reference.
 * - OpenCCTV directory: additional cameras fetched dynamically via opencctv.ts
 *   (seasia region covers Indonesia).
 * - MUDIK (Kemenhub) toll cameras: 12 HLS feeds from PT Trans Jabar Tol on the
 *   Ciawi–Sukabumi toll through Bogor (Ciawi · Caringin · Cigombong). They are
 *   in the official MUDIK directory but missing from OpenCCTV's index, so they
 *   live here. Coordinates are chained to the OSM road: the toll begins at the
 *   IC Ciawi (where Jagorawi ends, km ~47.3) and each interchange keeps its
 *   chainage (Ciawi Selatan 48+200 · Caringin 53+380 · Cigombong 60+150), so
 *   the pins sit on the carriageway in the correct order.
 *
 * Coordinates are the geocoded anchor of the road or location each camera
 * watches (resolved via OpenStreetMap Nominatim, per the repo convention used
 * by the generated catalog files). The BaliTower catalog itself is geofenced
 * to Indonesia and cannot be reached from outside, so those pins sit on the
 * named street, not on the exact pole position.
 */
const INDONESIA_CAMERAS: CctvCamera[] = [
  // ── YouTube Live Embeds (global access) ──

  // Puncak/Cisarua corridor — major Bogor–Jakarta commuter route
  {
    id: 'id-yt-puncak-cisarua',
    lat: -6.6995, lng: 106.9705,
    name: 'Jalur Puncak Cisarua — Live CCTV',
    city: 'Cisarua', country: 'Indonesia',
    stream_url: 'https://www.youtube.com/embed/AQd-p5hFtQo?autoplay=1&mute=1',
    stream_type: 'iframe',
    external_url: 'https://www.youtube.com/watch?v=AQd-p5hFtQo',
    source: 'Cemerlang CCTV',
  },
  {
    id: 'id-yt-simpang-gadog',
    lat: -6.6539, lng: 106.8649,
    name: 'Simpang Gadog — Live CCTV',
    city: 'Gadog', country: 'Indonesia',
    stream_url: 'https://www.youtube.com/embed/JJ3MWNYVCU4?autoplay=1&mute=1',
    stream_type: 'iframe',
    external_url: 'https://www.youtube.com/watch?v=JJ3MWNYVCU4',
    source: 'Cemerlang CCTV',
  },

  // Jakarta metro — Kompas TV 24h news (periodically shows traffic CCTV feeds)
  {
    id: 'id-yt-kompastv-24h',
    lat: -6.2090, lng: 106.7940,
    name: 'KOMPASTV Live — Jakarta Traffic Feed',
    city: 'Jakarta', country: 'Indonesia',
    stream_url: 'https://www.youtube.com/embed/DOOrIxw5xOw?autoplay=1&mute=1',
    stream_type: 'iframe',
    external_url: 'https://www.youtube.com/watch?v=DOOrIxw5xOw',
    source: 'Kompas TV',
  },

  // ── BaliTower Jakarta Smart City (geofenced — Indonesia only) ──
  // These are real HLS streams from the official Jakarta CCTV network.
  // They only load when the viewer is inside Indonesia (or using a VPN).
  // Kept as external_url so users in Indonesia can open the live viewer.

  // Central Jakarta — Bendungan Hilir / GBK area
  {
    id: 'id-jkt-bendungan-hilir-1',
    lat: -6.20763, lng: 106.80376,
    name: 'Bendungan Hilir — Gatot Subroto',
    city: 'Jakarta', country: 'Indonesia',
    external_url: 'https://cctv.balitower.co.id/Bendungan-Hilir-003-700014_1/embed.html',
    source: 'Jakarta Smart City (BaliTower)',
  },
  {
    id: 'id-jkt-bendungan-hilir-2',
    lat: -6.20540, lng: 106.80674,
    name: 'Bendungan Hilir — Pejompongan',
    city: 'Jakarta', country: 'Indonesia',
    external_url: 'https://cctv.balitower.co.id/Bendungan-Hilir-015-700383_2/embed.html',
    source: 'Jakarta Smart City (BaliTower)',
  },
  {
    id: 'id-jkt-bendungan-hilir-3',
    lat: -6.21298, lng: 106.80775,
    name: 'Bendungan Hilir — Gatot Subroto (South)',
    city: 'Jakarta', country: 'Indonesia',
    external_url: 'https://cctv.balitower.co.id/Bendungan-Hilir-004-700015_2/embed.html',
    source: 'Jakarta Smart City (BaliTower)',
  },

  // North Jakarta — Ancol / Port area
  {
    id: 'id-jkt-ancol-lodan',
    lat: -6.1296, lng: 106.8321,
    name: 'Ancol — Lodan Road',
    city: 'Jakarta', country: 'Indonesia',
    external_url: 'https://cctv.balitower.co.id/Ancol-001-701002_1/embed.html',
    source: 'Jakarta Smart City (BaliTower)',
  },
  {
    id: 'id-jkt-ancol-inner-ring',
    lat: -6.1305, lng: 106.8265,
    name: 'Ancol — Inner Ring Road',
    city: 'Jakarta', country: 'Indonesia',
    external_url: 'https://cctv.balitower.co.id/Ancol-001-MP-601131_2/embed.html',
    source: 'Jakarta Smart City (BaliTower)',
  },
  {
    id: 'id-jkt-ancol-martadinata',
    lat: -6.1255, lng: 106.8513,
    name: 'Ancol — Jl. R.E. Martadinata',
    city: 'Jakarta', country: 'Indonesia',
    external_url: 'https://cctv.balitower.co.id/Ancol-006-701231_1/embed.html',
    source: 'Jakarta Smart City (BaliTower)',
  },
  {
    id: 'id-jkt-ancol-kencur',
    lat: -6.13283, lng: 106.81592,
    name: 'Ancol — Jl. Kencur',
    city: 'Jakarta', country: 'Indonesia',
    external_url: 'https://cctv.balitower.co.id/Ancol-003-701004_2/embed.html',
    source: 'Jakarta Smart City (BaliTower)',
  },

  // West Jakarta — Angke
  {
    id: 'id-jkt-angke',
    lat: -6.14247, lng: 106.79028,
    name: 'Tubagus Angke — Kali Jodo Bridge',
    city: 'Jakarta', country: 'Indonesia',
    external_url: 'https://cctv.balitower.co.id/Angke-001-702002_1/embed.html',
    source: 'Jakarta Smart City (BaliTower)',
  },

  // South Jakarta — Kemang / Bangka
  {
    id: 'id-jkt-kemang-bangka',
    lat: -6.2477, lng: 106.8132,
    name: 'Kemang Raya — Bangka',
    city: 'Jakarta', country: 'Indonesia',
    external_url: 'https://cctv.balitower.co.id/Bangka-005-705099_1/embed.html',
    source: 'Jakarta Smart City (BaliTower)',
  },
  {
    id: 'id-jkt-bangka-kemang-utara',
    lat: -6.25765, lng: 106.82031,
    name: 'Bangka — Kemang Utara',
    city: 'Jakarta', country: 'Indonesia',
    external_url: 'https://cctv.balitower.co.id/Bangka-012-705106_1/embed.html',
    source: 'Jakarta Smart City (BaliTower)',
  },

  // East Jakarta — Matraman / Jatinegara
  {
    id: 'id-jkt-matraman',
    lat: -6.21456, lng: 106.86457,
    name: 'Matraman Raya — Jatinegara',
    city: 'Jakarta', country: 'Indonesia',
    external_url: 'https://cctv.balitower.co.id/Bali-Mester-007-704645_1/embed.html',
    source: 'Jakarta Smart City (BaliTower)',
  },
  {
    id: 'id-jkt-jatinegara-timur',
    lat: -6.21927, lng: 106.86784,
    name: 'Jl. Jatinegara Timur',
    city: 'Jakarta', country: 'Indonesia',
    external_url: 'https://cctv.balitower.co.id/Bali-Mester-006-704644_1/embed.html',
    source: 'Jakarta Smart City (BaliTower)',
  },

  // Far East Jakarta — Bambu Apus
  {
    id: 'id-jkt-bambu-apus',
    lat: -6.3113, lng: 106.9064,
    name: 'Bambu Apus — East Jakarta',
    city: 'Jakarta', country: 'Indonesia',
    external_url: 'https://cctv.balitower.co.id/Bambu-Apus-008-704050_1/embed.html',
    source: 'Jakarta Smart City (BaliTower)',
  },

  // ── Bogor — Ciawi–Sukabumi toll (MUDIK / Kemenhub) ──
  // PT Trans Jabar Tol's cameras on the Ciawi–Sukabumi toll through Bogor
  // Regency. Streams come straight from the official MUDIK directory; OpenCCTV
  // carries none of them, and the Ciawi chainage markers (which continue
  // Jagorawi's, km 47.3 at the IC Ciawi) are placed on the OSM road below.
  {
    id: 'id-bgr-km-47-200',
    lat: -6.6483, lng: 106.8491,
    name: 'KM 47+200 — Ciawi Interchange',
    city: 'Ciawi', country: 'Indonesia',
    stream_url: 'https://www.tjt-info.co.id/LiveApp/streams/796749052161901029073168.m3u8',
    stream_type: 'hls',
    source: 'MUDIK / Trans Jabar Tol',
  },
  {
    id: 'id-bgr-gt-ciawi-selatan',
    lat: -6.6550, lng: 106.8445,
    name: 'GT Ciawi Selatan',
    city: 'Ciawi', country: 'Indonesia',
    stream_url: 'https://www.tjt-info.co.id/LiveApp/streams/227374319950729322701285.m3u8',
    stream_type: 'hls',
    source: 'MUDIK / Trans Jabar Tol',
  },
  {
    id: 'id-bgr-ic-ciawi-selatan',
    lat: -6.6555, lng: 106.8441,
    name: 'IC Ciawi Selatan — KM 48+200',
    city: 'Ciawi', country: 'Indonesia',
    stream_url: 'https://www.tjt-info.co.id/LiveApp/streams/357514173892609384751207.m3u8',
    stream_type: 'hls',
    source: 'MUDIK / Trans Jabar Tol',
  },
  {
    id: 'id-bgr-akses-ciawi-selatan',
    lat: -6.6553, lng: 106.8437,
    name: 'Akses Ciawi Selatan',
    city: 'Ciawi', country: 'Indonesia',
    stream_url: 'https://www.tjt-info.co.id/LiveApp/streams/327294924686013390782781.m3u8',
    stream_type: 'hls',
    source: 'MUDIK / Trans Jabar Tol',
  },
  {
    id: 'id-bgr-km-51-050',
    lat: -6.6758, lng: 106.8354,
    name: 'KM 51+050 — Bojong Kerta',
    city: 'Bogor', country: 'Indonesia',
    stream_url: 'https://www.tjt-info.co.id/LiveApp/streams/211884290923669138161535.m3u8',
    stream_type: 'hls',
    source: 'MUDIK / Trans Jabar Tol',
  },
  {
    id: 'id-bgr-gt-caringin',
    lat: -6.6929, lng: 106.8252,
    name: 'GT Caringin',
    city: 'Caringin', country: 'Indonesia',
    stream_url: 'https://www.tjt-info.co.id/LiveApp/streams/035462094731391708865402.m3u8',
    stream_type: 'hls',
    source: 'MUDIK / Trans Jabar Tol',
  },
  {
    id: 'id-bgr-ic-caringin',
    lat: -6.6934, lng: 106.8248,
    name: 'IC Caringin — KM 53+380',
    city: 'Caringin', country: 'Indonesia',
    stream_url: 'https://www.tjt-info.co.id/LiveApp/streams/998223146655371157400972.m3u8',
    stream_type: 'hls',
    source: 'MUDIK / Trans Jabar Tol',
  },
  {
    id: 'id-bgr-km-55-000',
    lat: -6.7051, lng: 106.8188,
    name: 'KM 55+000',
    city: 'Bogor', country: 'Indonesia',
    stream_url: 'https://www.tjt-info.co.id/LiveApp/streams/021325546274001698409340.m3u8',
    stream_type: 'hls',
    source: 'MUDIK / Trans Jabar Tol',
  },
  {
    id: 'id-bgr-gt-cigombong-a',
    lat: -6.7424, lng: 106.8006,
    name: 'GT Cigombong A',
    city: 'Cigombong', country: 'Indonesia',
    stream_url: 'https://www.tjt-info.co.id/LiveApp/streams/577208699430530699650671.m3u8',
    stream_type: 'hls',
    source: 'MUDIK / Trans Jabar Tol',
  },
  {
    id: 'id-bgr-gt-cigombong-b',
    lat: -6.7427, lng: 106.8007,
    name: 'GT Cigombong B',
    city: 'Cigombong', country: 'Indonesia',
    stream_url: 'https://www.tjt-info.co.id/LiveApp/streams/390022051470745093489871.m3u8',
    stream_type: 'hls',
    source: 'MUDIK / Trans Jabar Tol',
  },
  {
    id: 'id-bgr-ic-cigombong',
    lat: -6.7428, lng: 106.8007,
    name: 'IC Cigombong — KM 60+150',
    city: 'Cigombong', country: 'Indonesia',
    stream_url: 'https://www.tjt-info.co.id/LiveApp/streams/336845911722359113982848.m3u8',
    stream_type: 'hls',
    source: 'MUDIK / Trans Jabar Tol',
  },
  {
    id: 'id-bgr-akses-cigombong',
    lat: -6.7432, lng: 106.8008,
    name: 'Akses Cigombong',
    city: 'Cigombong', country: 'Indonesia',
    stream_url: 'https://www.tjt-info.co.id/LiveApp/streams/261350381912633467488420.m3u8',
    stream_type: 'hls',
    source: 'MUDIK / Trans Jabar Tol',
  },
];

export async function fetchIndonesiaCameras(): Promise<CctvCamera[]> {
  return INDONESIA_CAMERAS;
}

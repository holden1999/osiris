import { NextResponse } from 'next/server';
import { parseIPv4 } from '@/lib/osint-utils';
import { allowPrivateTargets, classifyIPv4, getClientIp } from '@/lib/ssrf-guard';

export const dynamic = 'force-dynamic';

interface RateLimitEntry {
  timestamps: number[];
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;

function checkRateLimit(requesterIp: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(requesterIp);

  if (!entry) {
    rateLimitMap.set(requesterIp, { timestamps: [now] });
    return true;
  }

  entry.timestamps = entry.timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (entry.timestamps.length >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.timestamps.push(now);
  return true;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // --- 1. IP Validation ---
  const ip = searchParams.get('ip');
  if (!ip) {
    return NextResponse.json({ error: 'Missing ip parameter' }, { status: 400 });
  }

  const octets = parseIPv4(ip);
  if (!octets) {
    return NextResponse.json({ error: 'Invalid IPv4 address format' }, { status: 400 });
  }

  // Single authoritative gate: classifyIPv4 (the SSRF guard) knows RFC1918 /
  // loopback / CGNAT as 'private' (relaxable) and TEST-NET, benchmarking,
  // link-local (incl. metadata 169.254.169.254), multicast and reserved as
  // 'always' (never relaxable). Private/lab ranges are permitted only when the
  // operator opts in via ALLOW_PRIVATE_TARGETS=1 (mirrors the scanner proxy).
  const kind = classifyIPv4(ip);
  if (kind !== 'public') {
    const privateOptIn = allowPrivateTargets() && kind === 'private';
    if (!privateOptIn) {
      return NextResponse.json(
        { error: 'Private and reserved IP ranges are not allowed' +
          (kind === 'private' ? '. Set ALLOW_PRIVATE_TARGETS=1 to permit private-range targets.' : '') },
        { status: 400 },
      );
    }
  }

  const cidrParam = searchParams.get('cidr');
  let cidr = 24;
  if (cidrParam) {
    cidr = parseInt(cidrParam, 10);
    if (isNaN(cidr) || cidr < 24 || cidr > 32) {
      return NextResponse.json(
        { error: 'CIDR must be between 24 and 32' },
        { status: 400 },
      );
    }
  }

  // --- 2. Rate Limiting ---
  // The first X-Forwarded-For entry is whatever the client wrote, so reading it
  // let every request claim a fresh address and a fresh allowance.
  const requesterIp = getClientIp(req);

  if (!checkRateLimit(requesterIp)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded.' },
      { status: 429 },
    );
  }

  try {
    // --- 3. Geolocation ---
    // Private ranges have no public geolocation: ip-api resolves them to
    // "private range" and fails. Rather than 422 the whole sweep, synthesise a
    // centre from the operator's own IP so a LAN sweep still renders — the
    // device coordinates dominate the view anyway.
    let geoData: any;
    try {
      const geoRes = await fetch(
        `http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,lat,lon,isp,org,as,proxy,hosting`,
        { signal: AbortSignal.timeout(5000) },
      );
      geoData = geoRes.ok ? await geoRes.json() : { status: 'fail', message: 'Geolocation service unavailable' };
    } catch {
      geoData = { status: 'fail', message: 'Geolocation service unavailable' };
    }

    if (geoData.status === 'fail') {
      const isPrivate = classifyIPv4(ip) === 'private';
      if (!isPrivate) {
        return NextResponse.json(
          { error: `Geolocation failed: ${geoData.message || 'Unknown error'}` },
          { status: 422 },
        );
      }
      // Fall back to the requester's own coordinates for a private target.
      let fallback: any = { status: 'fail' };
      try {
        const selfRes = await fetch(
          'http://ip-api.com/json/?fields=status,country,countryCode,regionName,city,lat,lon,isp,org,as',
          { signal: AbortSignal.timeout(5000) },
        );
        if (selfRes.ok) fallback = await selfRes.json();
      } catch { /* keep the fail marker */ }

      geoData = fallback.status === 'success'
        ? { ...fallback, regionName: fallback.regionName || 'Private network', city: fallback.city || 'Local network' }
        : { status: 'success', country: 'Private network', countryCode: 'LO', regionName: 'Private network', city: 'Local network', lat: 0, lon: 0, isp: '', org: '', as: '' };
    }

    const center = {
      lat: geoData.lat as number,
      lng: geoData.lon as number,
      city: geoData.city as string,
      region: geoData.regionName as string,
      country: geoData.country as string,
      countryCode: geoData.countryCode as string,
      isp: geoData.isp as string,
      asn: (geoData.as as string) || '',
      org: (geoData.org as string) || '',
    };

    return NextResponse.json({
      center,
      target_ip: ip,
      cidr
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (err) {
    console.error('[OSIRIS] Sweep Init error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Sweep initialization failed' }, { status: 500 });
  }
}

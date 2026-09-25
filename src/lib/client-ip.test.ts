import { describe, it, expect } from 'vitest';
import { getClientIp, isRateLimited } from './ssrf-guard';

const req = (headers: Record<string, string>) => new Request('https://osiris.test/api/scanner', { headers });

describe('getClientIp', () => {
  /* The bypass: the leftmost X-Forwarded-For entry is written by the client,
     so a new value per request bought a new rate-limit bucket per request. */
  it('ignores the client-written left entry and uses the proxy-observed right one', () => {
    expect(getClientIp(req({ 'x-forwarded-for': '1.1.1.1, 203.0.113.9' }))).toBe('203.0.113.9');
    expect(getClientIp(req({ 'x-forwarded-for': '9.9.9.9, 203.0.113.9' }))).toBe('203.0.113.9');
  });

  it('prefers an edge-set header over anything forwarded', () => {
    expect(getClientIp(req({
      'cf-connecting-ip': '198.51.100.4',
      'x-forwarded-for': 'attacker-controlled, 203.0.113.9',
    }))).toBe('198.51.100.4');
  });

  it('falls back to x-real-ip when there is no edge header', () => {
    expect(getClientIp(req({ 'x-real-ip': '198.51.100.7' }))).toBe('198.51.100.7');
  });

  it('collapses junk to one shared bucket instead of a fresh one each time', () => {
    expect(getClientIp(req({ 'x-forwarded-for': 'not-an-ip' }))).toBe('unknown');
    expect(getClientIp(req({ 'x-forwarded-for': 'also-not-an-ip' }))).toBe('unknown');
    expect(getClientIp(req({}))).toBe('unknown');
  });

  it('accepts IPv6, bracketed or bare', () => {
    expect(getClientIp(req({ 'x-real-ip': '2001:db8::1' }))).toBe('2001:db8::1');
    expect(getClientIp(req({ 'x-real-ip': '[2001:db8::1]' }))).toBe('[2001:db8::1]');
  });
});

describe('scanner throttle under a spoofed header', () => {
  it('still binds when the attacker rotates the left entry every request', () => {
    const limit = 5;
    let blocked = 0;
    for (let i = 0; i < 20; i++) {
      const ip = getClientIp(req({ 'x-forwarded-for': `10.0.0.${i}, 203.0.113.42` }));
      if (isRateLimited(ip, limit, 60_000)) blocked++;
    }
    // 20 requests, 5 allowed: the rotation buys nothing.
    expect(blocked).toBe(15);
  });
});

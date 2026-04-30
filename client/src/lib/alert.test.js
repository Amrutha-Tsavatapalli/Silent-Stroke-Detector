import { describe, it, expect } from 'vitest';
import { buildWhatsAppLink, buildCallLink } from './alert.js';

describe('alert.js unit tests', () => {
  const mockHospital = {
    name: 'Test Hospital',
    emergencyPhone: '123-456-7890',
  };

  it('output starts with https://wa.me/?text=', () => {
    const link = buildWhatsAppLink(mockHospital, 0.6, 5, 'en');
    expect(link).toStartWith('https://wa.me/?text=');
  });

  it('all 4 languages produce non-empty, URL-encoded messages', () => {
    const languages = ['en', 'hi', 'ta', 'te'];
    for (const lang of languages) {
      const link = buildWhatsAppLink(mockHospital, 0.6, 5, lang);
      expect(link).toContain('https://wa.me/?text=');
      const decoded = decodeURIComponent(link.split('?text=')[1]);
      expect(decoded.length).toBeGreaterThan(0);
    }
  });

  it('unknown language falls back to English', () => {
    const link = buildWhatsAppLink(mockHospital, 0.6, 5, 'xx');
    const decoded = decodeURIComponent(link.split('?text=')[1]);
    expect(decoded).toContain('STROKE RISK');
  });

  it('buildCallLink strips whitespace from phone number', () => {
    expect(buildCallLink('123 456 7890')).toBe('tel:1234567890');
    expect(buildCallLink(' 123-456-7890 ')).toBe('tel:123-456-7890');
    expect(buildCallLink('+1 234 567 8901')).toBe('tel:+12345678901');
  });

  it('FLAG level includes 🚨 emoji', () => {
    const link = buildWhatsAppLink(mockHospital, 0.6, 5, 'en');
    const decoded = decodeURIComponent(link.split('?text=')[1]);
    expect(decoded).toContain('🚨');
  });

  it('WARN level includes ⚠️ emoji', () => {
    const link = buildWhatsAppLink(mockHospital, 0.4, 5, 'en');
    const decoded = decodeURIComponent(link.split('?text=')[1]);
    expect(decoded).toContain('⚠️');
  });
});
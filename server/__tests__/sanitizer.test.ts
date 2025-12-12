import { sanitizeUrl, urlSanitizationSchema, exportOptionsSanitizationSchema } from '../sanitizer';

/**
 * Unit Tests for Input Sanitization
 * Following TDD principles with security-focused validation
 */

describe('URL Sanitization', () => {
  describe('Valid URLs', () => {
    it('should accept valid HTTPS URLs', () => {
      const validUrls = [
        'https://example.com',
        'https://www.google.com',
        'https://metabol-balance-app.vercel.app/',
        'https://subdomain.example.com/path?query=value'
      ];

      validUrls.forEach(url => {
        expect(() => sanitizeUrl(url)).not.toThrow();
        const sanitized = sanitizeUrl(url);
        expect(sanitized).toMatch(/^https?:\/\//);
      });
    });

    it('should add HTTPS protocol to URLs without protocol', () => {
      const url = 'example.com';
      const sanitized = sanitizeUrl(url);
      expect(sanitized).toBe('https://example.com/');
    });

    it('should preserve HTTP protocol when explicitly provided', () => {
      const url = 'http://example.com';
      const sanitized = sanitizeUrl(url);
      expect(sanitized).toBe('http://example.com/');
    });
  });

  describe('Security Validation', () => {
    it('should block localhost URLs', () => {
      const localhostUrls = [
        'localhost',
        'localhost:3000',
        'http://localhost',
        'https://localhost:8080'
      ];

      localhostUrls.forEach(url => {
        expect(() => sanitizeUrl(url)).toThrow('Invalid URL or blocked for security reasons');
      });
    });

    it('should block private IP addresses', () => {
      const privateIPs = [
        '127.0.0.1',
        '192.168.1.1',
        '10.0.0.1',
        '172.16.0.1',
        'http://192.168.0.100',
        'https://10.1.1.1:8080'
      ];

      privateIPs.forEach(ip => {
        expect(() => sanitizeUrl(ip)).toThrow('Invalid URL or blocked for security reasons');
      });
    });

    it('should block IPv6 localhost', () => {
      const ipv6Localhost = [
        '::1',
        '[::1]',
        'http://[::1]:3000'
      ];

      ipv6Localhost.forEach(url => {
        expect(() => sanitizeUrl(url)).toThrow('Invalid URL or blocked for security reasons');
      });
    });

    it('should block non-HTTP protocols', () => {
      const invalidProtocols = [
        'ftp://example.com',
        'file:///etc/passwd',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>'
      ];

      invalidProtocols.forEach(url => {
        expect(() => sanitizeUrl(url)).toThrow('Invalid URL or blocked for security reasons');
      });
    });
  });

  describe('Input Validation', () => {
    it('should reject empty URLs', () => {
      expect(() => sanitizeUrl('')).toThrow('URL is required');
      expect(() => sanitizeUrl('   ')).toThrow('URL is required');
    });

    it('should reject URLs that are too long', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(2048);
      expect(() => sanitizeUrl(longUrl)).toThrow('URL too long');
    });

    it('should reject malformed URLs', () => {
      const malformedUrls = [
        'not-a-url',
        'http://',
        'https://',
        '://example.com',
        'http://.',
        'http://..'
      ];

      malformedUrls.forEach(url => {
        expect(() => sanitizeUrl(url)).toThrow();
      });
    });
  });

  describe('URL Schema Validation', () => {
    it('should validate URL schema correctly', () => {
      const validInput = { url: 'https://example.com' };
      const result = urlSanitizationSchema.parse(validInput);
      expect(result.url).toBe('https://example.com');
    });

    it('should trim whitespace from URLs', () => {
      const input = { url: '  https://example.com  ' };
      const result = urlSanitizationSchema.parse(input);
      expect(result.url).toBe('https://example.com');
    });
  });
});

describe('Export Options Sanitization', () => {
  it('should validate valid export options', () => {
    const validOptions = {
      format: 'pdf' as const,
      includeRecommendations: true,
      includeRawData: false,
      customTitle: 'My Custom Report'
    };

    const result = exportOptionsSanitizationSchema.parse(validOptions);
    expect(result).toEqual(validOptions);
  });

  it('should apply default values', () => {
    const minimalOptions = { format: 'html' as const };
    const result = exportOptionsSanitizationSchema.parse(minimalOptions);
    
    expect(result.format).toBe('html');
    expect(result.includeRecommendations).toBe(true);
    expect(result.includeRawData).toBe(false);
  });

  it('should reject invalid format', () => {
    const invalidOptions = { format: 'docx' };
    expect(() => exportOptionsSanitizationSchema.parse(invalidOptions)).toThrow();
  });

  it('should trim and limit custom title length', () => {
    const longTitle = 'A'.repeat(250);
    const options = { format: 'pdf' as const, customTitle: `  ${longTitle}  ` };
    
    expect(() => exportOptionsSanitizationSchema.parse(options)).toThrow();
  });

  it('should accept valid custom title', () => {
    const options = { 
      format: 'pdf' as const, 
      customTitle: '  Valid Title  ' 
    };
    
    const result = exportOptionsSanitizationSchema.parse(options);
    expect(result.customTitle).toBe('Valid Title');
  });
});
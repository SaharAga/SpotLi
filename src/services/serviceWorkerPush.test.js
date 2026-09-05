import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Service Worker Web Push and Click Handler', () => {
  let listeners;
  let mockRegistration;
  let mockClients;

  beforeEach(() => {
    listeners = {};
    mockRegistration = {
      showNotification: vi.fn().mockResolvedValue(undefined)
    };
    mockClients = {
      claim: vi.fn().mockResolvedValue(undefined),
      matchAll: vi.fn().mockResolvedValue([]),
      openWindow: vi.fn().mockResolvedValue({})
    };

    const mockSelf = {
      addEventListener: (type, handler) => {
        listeners[type] = handler;
      },
      skipWaiting: vi.fn(),
      registration: mockRegistration,
      clients: mockClients
    };

    const swCode = fs.readFileSync(path.resolve(process.cwd(), 'public/sw.js'), 'utf-8');
    const executeSW = new Function('self', swCode);
    executeSW(mockSelf);
  });

  it('registers push and notificationclick event listeners', () => {
    expect(typeof listeners.push).toBe('function');
    expect(typeof listeners.notificationclick).toBe('function');
  });

  it('handles push event with json payload', async () => {
    const waitUntilMock = vi.fn();
    const event = {
      data: {
        json: () => ({
          title: 'Package Ready',
          body: 'Your package is at the locker',
          data: { packageId: 'pkg-123', url: '/?packageId=pkg-123' }
        }),
        text: () => 'fallback text'
      },
      waitUntil: waitUntilMock
    };

    listeners.push(event);

    expect(waitUntilMock).toHaveBeenCalled();
    expect(mockRegistration.showNotification).toHaveBeenCalledWith(
      'Package Ready',
      expect.objectContaining({
        body: 'Your package is at the locker',
        tag: 'pkg-pkg-123',
        data: expect.objectContaining({ packageId: 'pkg-123' })
      })
    );
  });

  it('handles push event with plain text fallback', async () => {
    const waitUntilMock = vi.fn();
    const event = {
      data: {
        json: () => { throw new Error('Not JSON'); },
        text: () => 'Order Shipped'
      },
      waitUntil: waitUntilMock
    };

    listeners.push(event);

    expect(waitUntilMock).toHaveBeenCalled();
    expect(mockRegistration.showNotification).toHaveBeenCalledWith(
      'Deliveree | עדכון משלוח',
      expect.objectContaining({
        body: 'Order Shipped'
      })
    );
  });

  it('handles notificationclick dismiss action by closing notification without navigating', () => {
    const closeMock = vi.fn();
    const waitUntilMock = vi.fn();
    const event = {
      action: 'dismiss',
      notification: {
        close: closeMock,
        data: { url: '/?packageId=pkg-123' }
      },
      waitUntil: waitUntilMock
    };

    listeners.notificationclick(event);

    expect(closeMock).toHaveBeenCalled();
    expect(waitUntilMock).not.toHaveBeenCalled();
  });

  it('handles notificationclick view action by focusing existing window or opening URL', async () => {
    const closeMock = vi.fn();
    let promiseCaptured;
    const waitUntilMock = vi.fn((p) => { promiseCaptured = p; });

    const focusMock = vi.fn().mockResolvedValue(undefined);
    const navigateMock = vi.fn().mockResolvedValue(undefined);
    mockClients.matchAll.mockResolvedValue([
      { url: 'https://deliveree.app/', focus: focusMock, navigate: navigateMock }
    ]);

    const event = {
      action: 'view',
      notification: {
        close: closeMock,
        data: { packageId: 'pkg-999', url: '/?packageId=pkg-999' }
      },
      waitUntil: waitUntilMock
    };

    listeners.notificationclick(event);

    expect(closeMock).toHaveBeenCalled();
    expect(waitUntilMock).toHaveBeenCalled();

    await promiseCaptured;
    expect(navigateMock).toHaveBeenCalledWith('/?packageId=pkg-999');
    expect(focusMock).toHaveBeenCalled();
  });

  it('rejects external untrusted URLs in notification data to prevent open redirect', async () => {
    const closeMock = vi.fn();
    let promiseCaptured;
    const waitUntilMock = vi.fn((p) => { promiseCaptured = p; });

    const focusMock = vi.fn().mockResolvedValue(undefined);
    const navigateMock = vi.fn().mockResolvedValue(undefined);
    mockClients.matchAll.mockResolvedValue([
      { url: 'https://deliveree.app/', focus: focusMock, navigate: navigateMock }
    ]);

    const event = {
      action: 'view',
      notification: {
        close: closeMock,
        data: { url: 'https://malicious-phishing.com/steal-creds' }
      },
      waitUntil: waitUntilMock
    };

    listeners.notificationclick(event);
    await promiseCaptured;

    // Must NOT navigate to external malicious domain
    expect(navigateMock).not.toHaveBeenCalledWith('https://malicious-phishing.com/steal-creds');
    expect(focusMock).toHaveBeenCalled();
  });

  it('rejects backslash protocol-relative open redirect vectors like /\\evil.com and /\\\\evil.com', async () => {
    for (const evilVector of ['/\\evil.com', '/\\\\evil.com', '//evil.com']) {
      const closeMock = vi.fn();
      let promiseCaptured;
      const waitUntilMock = vi.fn((p) => { promiseCaptured = p; });

      const focusMock = vi.fn().mockResolvedValue(undefined);
      const navigateMock = vi.fn().mockResolvedValue(undefined);
      mockClients.matchAll.mockResolvedValue([
        { url: 'https://deliveree.app/', focus: focusMock, navigate: navigateMock }
      ]);

      const event = {
        action: 'view',
        notification: {
          close: closeMock,
          data: { url: evilVector }
        },
        waitUntil: waitUntilMock
      };

      listeners.notificationclick(event);
      await promiseCaptured;

      expect(navigateMock).not.toHaveBeenCalledWith(evilVector);
      expect(navigateMock).not.toHaveBeenCalledWith(expect.stringContaining('evil.com'));
      expect(focusMock).toHaveBeenCalled();
    }
  });
});

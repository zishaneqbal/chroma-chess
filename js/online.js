/**
 * Real-Time Online Multiplayer Manager via WebRTC (PeerJS).
 * Allows 2 players on different devices to connect using a short Game ID
 * without needing any custom backend server.
 */
(function (global) {
  const PEER_PREFIX = 'chromachess-room-';

  function generateGameId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = '';
    for (let i = 0; i < 6; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
  }

  class OnlineManager {
    constructor(callbacks) {
      this.cb = callbacks || {};
      this.peer = null;
      this.conn = null;
      this.gameId = null;
      this.role = null; // 'host' | 'guest'
      this.connected = false;
    }

    isSupported() {
      return typeof global.Peer !== 'undefined';
    }

    _cleanup() {
      if (this.conn) {
        try { this.conn.close(); } catch (_) {}
        this.conn = null;
      }
      if (this.peer) {
        try { this.peer.destroy(); } catch (_) {}
        this.peer = null;
      }
      this.connected = false;
      this.gameId = null;
      this.role = null;
    }

    leave() {
      this._cleanup();
      if (this.cb.onStatus) this.cb.onStatus('offline', 'Disconnected');
    }

    hostGame() {
      if (!this.isSupported()) {
        if (this.cb.onError) this.cb.onError('Online multiplayer library failed to load.');
        return;
      }
      this._cleanup();
      this.role = 'host';
      this.gameId = generateGameId();
      if (this.cb.onStatus) this.cb.onStatus('waiting', 'Creating room...', this.gameId);

      const peer = new global.Peer(PEER_PREFIX + this.gameId, {
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });
      this.peer = peer;

      peer.on('open', () => {
        if (this.cb.onStatus) {
          this.cb.onStatus('waiting', 'Waiting for opponent to join...', this.gameId);
        }
      });

      peer.on('connection', (conn) => {
        if (this.conn && this.conn.open) {
          conn.close();
          return;
        }
        this._attachConnection(conn);
      });

      peer.on('error', (err) => {
        if (err && err.type === 'unavailable-id') {
          // Retry with a fresh ID
          this.hostGame();
          return;
        }
        if (this.cb.onError) this.cb.onError(err.message || 'Connection error');
      });
    }

    joinGame(rawId) {
      if (!this.isSupported()) {
        if (this.cb.onError) this.cb.onError('Online multiplayer library failed to load.');
        return;
      }
      const cleanId = String(rawId || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (cleanId.length < 4) {
        if (this.cb.onError) this.cb.onError('Please enter a valid Game ID.');
        return;
      }

      this._cleanup();
      this.role = 'guest';
      this.gameId = cleanId;
      if (this.cb.onStatus) this.cb.onStatus('waiting', `Connecting to ${cleanId}...`, cleanId);

      const peer = new global.Peer(undefined, {
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });
      this.peer = peer;

      peer.on('open', () => {
        const conn = peer.connect(PEER_PREFIX + cleanId, { reliable: true });
        this._attachConnection(conn);
      });

      peer.on('error', (err) => {
        const msg =
          err && err.type === 'peer-unavailable'
            ? `Room "${cleanId}" not found. Check the Game ID and try again.`
            : err.message || 'Could not join room.';
        if (this.cb.onError) this.cb.onError(msg);
        this._cleanup();
        if (this.cb.onStatus) this.cb.onStatus('error', msg);
      });
    }

    _attachConnection(conn) {
      this.conn = conn;

      conn.on('open', () => {
        this.connected = true;
        if (this.cb.onConnected) this.cb.onConnected(this.role, this.gameId);
      });

      conn.on('data', (payload) => {
        if (this.cb.onMessage) this.cb.onMessage(payload);
      });

      conn.on('close', () => {
        this.connected = false;
        if (this.cb.onDisconnected) this.cb.onDisconnected();
      });

      conn.on('error', () => {
        this.connected = false;
        if (this.cb.onError) this.cb.onError('Peer connection lost.');
      });
    }

    send(payload) {
      if (this.conn && this.conn.open) {
        this.conn.send(payload);
        return true;
      }
      return false;
    }
  }

  global.ChessOnline = OnlineManager;
})(typeof window !== 'undefined' ? window : globalThis);

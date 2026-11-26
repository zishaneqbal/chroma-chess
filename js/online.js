/**
 * Real-Time Online Multiplayer & Voice Chat Manager via WebRTC (PeerJS).
 * Allows 2 players on different devices to connect using a short Game ID
 * and exchange moves + live voice audio without any custom backend server.
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
      this.mediaCall = null;
      this.localStream = null;
      this.remotePeerId = null;
      this.micEnabled = false;
      this.gameId = null;
      this.role = null; // 'host' | 'guest'
      this.connected = false;
    }

    isSupported() {
      return typeof global.Peer !== 'undefined';
    }

    _cleanupVoice() {
      if (this.mediaCall) {
        try { this.mediaCall.close(); } catch (_) {}
        this.mediaCall = null;
      }
      if (this.localStream) {
        this.localStream.getTracks().forEach((t) => t.stop());
        this.localStream = null;
      }
      this.micEnabled = false;
      if (this.cb.onRemoteStream) this.cb.onRemoteStream(null);
    }

    _cleanup() {
      this._cleanupVoice();
      if (this.conn) {
        try { this.conn.close(); } catch (_) {}
        this.conn = null;
      }
      if (this.peer) {
        try { this.peer.destroy(); } catch (_) {}
        this.peer = null;
      }
      this.remotePeerId = null;
      this.connected = false;
      this.gameId = null;
      this.role = null;
    }

    leave() {
      this._cleanup();
      if (this.cb.onStatus) this.cb.onStatus('offline', 'Disconnected');
    }

    _setupIncomingCalls(peer) {
      peer.on('call', (call) => {
        if (this.mediaCall && this.mediaCall !== call) {
          try { this.mediaCall.close(); } catch (_) {}
        }
        this.mediaCall = call;
        if (this.localStream) {
          call.answer(this.localStream);
        } else {
          call.answer();
        }
        call.on('stream', (remoteStream) => {
          if (this.cb.onRemoteStream) this.cb.onRemoteStream(remoteStream);
        });
        call.on('close', () => {
          if (this.cb.onRemoteStream) this.cb.onRemoteStream(null);
        });
      });
    }

    async toggleMic() {
      if (!this.connected || !this.peer || !this.remotePeerId) {
        return false;
      }
      if (this.micEnabled && this.localStream) {
        this.localStream.getAudioTracks().forEach((t) => { t.enabled = false; });
        this.micEnabled = false;
        return false;
      }

      if (!this.localStream) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          if (this.cb.onVoiceError) {
            this.cb.onVoiceError('Microphone requires HTTPS or localhost.');
          }
          return false;
        }
        try {
          this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        } catch (err) {
          if (this.cb.onVoiceError) {
            this.cb.onVoiceError('Microphone permission denied or unavailable.');
          }
          return false;
        }
      }

      this.localStream.getAudioTracks().forEach((t) => { t.enabled = true; });
      this.micEnabled = true;

      // Initiate or refresh media call so opponent receives our audio stream
      if (this.mediaCall) {
        try { this.mediaCall.close(); } catch (_) {}
      }
      const call = this.peer.call(this.remotePeerId, this.localStream);
      this.mediaCall = call;
      call.on('stream', (remoteStream) => {
        if (this.cb.onRemoteStream) this.cb.onRemoteStream(remoteStream);
      });
      call.on('close', () => {
        if (this.cb.onRemoteStream) this.cb.onRemoteStream(null);
      });

      return true;
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
      this._setupIncomingCalls(peer);

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
      this._setupIncomingCalls(peer);

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
      this.remotePeerId = conn.peer;

      conn.on('open', () => {
        this.connected = true;
        if (this.cb.onConnected) this.cb.onConnected(this.role, this.gameId);
      });

      conn.on('data', (payload) => {
        if (this.cb.onMessage) this.cb.onMessage(payload);
      });

      conn.on('close', () => {
        this.connected = false;
        this._cleanupVoice();
        if (this.cb.onDisconnected) this.cb.onDisconnected();
      });

      conn.on('error', () => {
        this.connected = false;
        this._cleanupVoice();
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

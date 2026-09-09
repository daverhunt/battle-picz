(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BattlePiczBackend = api.BattlePiczBackend;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const SESSION_KEY = 'battle-picz.supabase-session';
  const MATCH_KEY = 'battle-picz.current-match';

  class BattlePiczBackend {
    constructor(options = {}) {
      this.url = String(options.url || '').replace(/\/$/, '');
      this.publishableKey = options.publishableKey || '';
      this.fetch = options.fetchImpl || globalThis.fetch?.bind(globalThis);
      this.storage = options.storage || globalThis.localStorage;
      this.location = options.location || globalThis.location;
      this.now = options.now || (() => Date.now());
    }

    get configured() {
      return Boolean(this.url && this.publishableKey && this.fetch);
    }

    readSession() {
      try {
        return JSON.parse(this.storage?.getItem(SESSION_KEY) || 'null');
      } catch {
        return null;
      }
    }

    saveSession(session) {
      this.storage?.setItem(SESSION_KEY, JSON.stringify(session));
      return session;
    }

    async authRequest(path, body) {
      const response = await this.fetch(`${this.url}/auth/v1/${path}`, {
        method: 'POST',
        headers: {
          apikey: this.publishableKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      return this.readResponse(response);
    }

    async ensureSession() {
      if (!this.configured) throw new Error('Supabase is not configured');
      const saved = this.readSession();
      if (saved?.access_token && Number(saved.expires_at) * 1000 > this.now() + 60_000) {
        return saved;
      }
      if (saved?.refresh_token) {
        try {
          return this.saveSession(await this.authRequest(
            'token?grant_type=refresh_token',
            { refresh_token: saved.refresh_token }
          ));
        } catch {
          this.storage?.removeItem(SESSION_KEY);
        }
      }
      return this.saveSession(await this.authRequest('signup', {}));
    }

    async readResponse(response) {
      const text = await response.text();
      let data = null;
      if (text) {
        try { data = JSON.parse(text); } catch { data = text; }
      }
      if (!response.ok) {
        const message = data?.message || data?.msg || data?.error_description || data?.error || text;
        throw new Error(message || `Supabase request failed (${response.status})`);
      }
      return data;
    }

    async request(path, options = {}) {
      const session = await this.ensureSession();
      const response = await this.fetch(`${this.url}/rest/v1/${path}`, {
        ...options,
        headers: {
          apikey: this.publishableKey,
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          ...(options.headers || {})
        }
      });
      return this.readResponse(response);
    }

    rpc(name, args = {}) {
      return this.request(`rpc/${name}`, {
        method: 'POST',
        body: JSON.stringify(args)
      });
    }

    async createChallenge(gameConfig = {}) {
      const rows = await this.rpc('create_challenge', {
        p_game_config: gameConfig,
        p_invited_user_id: null
      });
      const challenge = Array.isArray(rows) ? rows[0] : rows;
      if (!challenge?.match_id || !challenge?.invite_code) {
        throw new Error('Supabase did not return a challenge');
      }
      this.storage?.setItem(MATCH_KEY, challenge.match_id);
      return { ...challenge, share_url: this.buildShareUrl(challenge.invite_code) };
    }

    async joinChallenge(inviteCode) {
      const code = BattlePiczBackend.normaliseInviteCode(inviteCode);
      if (!code) throw new Error('Enter a valid six-character challenge code');
      const matchId = await this.rpc('join_challenge', { p_invite_code: code });
      this.storage?.setItem(MATCH_KEY, matchId);
      return this.getMatch(matchId);
    }

    async getMatch(matchId) {
      const rows = await this.request(
        `matches?id=eq.${encodeURIComponent(matchId)}&select=id,mode,status,invite_code,seed,game_config,created_by,created_at,started_at,completed_at`
      );
      if (!rows?.[0]) throw new Error('Match not found');
      return rows[0];
    }

    async listMatches() {
      return this.request(
        'match_players?select=player_no,total_score,accepted_at,matches(id,mode,status,invite_code,seed,game_config,created_at,started_at,completed_at),profiles(display_name)&order=joined_at.desc'
      );
    }

    submitTurn(matchId, roundNo, score, answers, ghostTimeline, isFinal = false) {
      return this.rpc('submit_turn', {
        p_match_id: matchId,
        p_round_no: roundNo,
        p_score: score,
        p_answers: answers,
        p_ghost_timeline: ghostTimeline,
        p_is_final: isFinal
      });
    }

    buildShareUrl(inviteCode) {
      const origin = this.location?.origin || '';
      const pathname = this.location?.pathname || '/';
      const url = new URL(pathname, origin || 'https://battle-picz-game.vercel.app');
      url.searchParams.set('challenge', BattlePiczBackend.normaliseInviteCode(inviteCode));
      return url.toString();
    }

    inviteCodeFromLocation() {
      return BattlePiczBackend.normaliseInviteCode(
        new URLSearchParams(this.location?.search || '').get('challenge')
      );
    }

    static normaliseInviteCode(value) {
      const code = String(value || '').trim().toUpperCase();
      return /^[A-Z0-9]{6}$/.test(code) ? code : '';
    }
  }

  return { BattlePiczBackend, SESSION_KEY, MATCH_KEY };
});

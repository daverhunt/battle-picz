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

    async recoverSession() {
      const saved = this.readSession();
      if (saved?.refresh_token) {
        try {
          return this.saveSession(await this.authRequest(
            'token?grant_type=refresh_token',
            { refresh_token: saved.refresh_token }
          ));
        } catch {
          // The refresh token is no longer usable, so start a new guest session.
        }
      }
      this.storage?.removeItem(SESSION_KEY);
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

    async request(path, options = {}, canRecover = true) {
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
      if (response.status === 401 && canRecover) {
        await this.recoverSession();
        return this.request(path, options, false);
      }
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
        `matches?id=eq.${encodeURIComponent(matchId)}&select=id,mode,status,invite_code,seed,game_config,created_by,winner_id,week_start,created_at,started_at,completed_at`
      );
      if (!rows?.[0]) throw new Error('Match not found');
      return rows[0];
    }

    async getMatchPlayers(matchId) {
      return this.request(
        `match_players?match_id=eq.${encodeURIComponent(matchId)}&select=user_id,player_no,total_score,accepted_at,profiles(display_name)&order=player_no`
      );
    }

    async getMatchTurns(matchId) {
      return this.request(
        `match_turns?match_id=eq.${encodeURIComponent(matchId)}&select=user_id,round_no,score,answers,ghost_timeline,is_final,completed_at&order=round_no`
      );
    }

    setRoundConfig(matchId, roundNo, category, difficulty) {
      return this.rpc('set_round_config', {
        p_match_id: matchId,
        p_round_no: roundNo,
        p_category: category,
        p_difficulty: difficulty
      });
    }

    async getMatchContext(matchId, roundNo = null) {
      const session = await this.ensureSession();
      const [match, players, turns] = await Promise.all([
        this.getMatch(matchId),
        this.getMatchPlayers(matchId),
        this.getMatchTurns(matchId)
      ]);
      const userId = session.user?.id;
      const me = players.find(player => player.user_id === userId);
      if (!me) throw new Error('You are not part of this match');
      const opponent = players.find(player => player.user_id !== userId) || null;
      const currentRound = BattlePiczBackend.currentRound(match, turns);
      const viewedRound = Number(roundNo) || currentRound;
      const ownTurn = turns.find(turn =>
        turn.user_id === userId && Number(turn.round_no) === viewedRound
      ) || null;
      const opponentTurn = turns.find(turn =>
        turn.user_id !== userId && Number(turn.round_no) === viewedRound
      ) || null;
      const roundResults = BattlePiczBackend.roundResults(turns, userId);
      const myRoundsWon = roundResults.filter(result => result.result === 'won').length;
      const theirRoundsWon = roundResults.filter(result => result.result === 'lost').length;
      const canPlayOpeningTurn = match.status === 'waiting' &&
        me.player_no === 1 && viewedRound === 1;
      return {
        match,
        me,
        opponent,
        turns,
        ownTurn,
        opponentTurn,
        currentRound,
        roundNo: viewedRound,
        roundResults,
        myRoundsWon,
        theirRoundsWon,
        result: match.status !== 'complete' ? null
          : match.winner_id == null ? 'draw'
            : match.winner_id === userId ? 'won' : 'lost',
        roundConfig: match.game_config?.rounds?.[String(viewedRound)] || null,
        canChoose: (match.status === 'active' || canPlayOpeningTurn) &&
          me.player_no === (viewedRound % 2 === 1 ? 1 : 2)
      };
    }

    async listMatches(userId) {
      const playerFilter = userId ? `user_id=eq.${encodeURIComponent(userId)}&` : '';
      return this.request(
        `match_players?${playerFilter}select=user_id,player_no,total_score,accepted_at,joined_at,matches(id,mode,status,invite_code,seed,game_config,created_by,winner_id,week_start,created_at,started_at,completed_at)&order=joined_at.desc`
      );
    }

    async getProfile() {
      const session = await this.ensureSession();
      const userId = session.user?.id;
      const rows = await this.request(
        `profiles?id=eq.${encodeURIComponent(userId)}&select=id,display_name,xp,coins,skill_rating,games_played,games_won`
      );
      return rows?.[0] || null;
    }

    finalizeWeeklyTournaments() {
      return this.rpc('finalize_weekly_tournaments');
    }

    async getMatchesDashboard() {
      const session = await this.ensureSession();
      const userId = session.user?.id;
      const [memberships, nudges] = await Promise.all([
        this.listMatches(userId),
        this.listNudges()
      ]);
      const dashboard = await Promise.all((memberships || []).map(async membership => {
        const match = membership.matches;
        if (!match) return null;
        const [players, turns] = await Promise.all([
          this.getMatchPlayers(match.id),
          this.getMatchTurns(match.id)
        ]);
        return BattlePiczBackend.describeMatch(
          match, players, turns, userId,
          (nudges || []).filter(nudge => nudge.match_id === match.id)
        );
      }));
      return dashboard.filter(item => item && item.match.status !== 'cancelled')
        .sort((a, b) => b.updatedAt - a.updatedAt);
    }

    async getWeeklyDashboard(referenceTime = this.now()) {
      await this.finalizeWeeklyTournaments();
      const [matches, profile] = await Promise.all([
        this.getMatchesDashboard(),
        this.getProfile()
      ]);
      return {
        matches,
        profile,
        current: BattlePiczBackend.weeklySummary(matches, referenceTime),
        previous: BattlePiczBackend.weeklySummary(matches, referenceTime, -1)
      };
    }

    async createRematch(matchId) {
      const rows = await this.rpc('create_rematch', { p_match_id: matchId });
      const rematch = Array.isArray(rows) ? rows[0] : rows;
      if (!rematch?.match_id) throw new Error('Supabase did not return a rematch');
      this.storage?.setItem(MATCH_KEY, rematch.match_id);
      return { ...rematch, share_url: rematch.invite_code ? this.buildShareUrl(rematch.invite_code) : '' };
    }

    acceptMatch(matchId) {
      return this.rpc('accept_match', { p_match_id: matchId });
    }

    listNudges() {
      return this.request(
        'match_nudges?select=match_id,from_user_id,to_user_id,created_at&order=created_at.desc'
      );
    }

    sendNudge(matchId) {
      return this.rpc('send_match_nudge', { p_match_id: matchId });
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

    static currentRound(match, turns = []) {
      let roundNo = 1;
      while (true) {
        const submittedPlayers = new Set((turns || [])
          .filter(turn => Number(turn.round_no) === roundNo)
          .map(turn => turn.user_id));
        if (submittedPlayers.size < 2) {
          return match?.status === 'complete' ? Math.max(1, roundNo - 1) : roundNo;
        }
        roundNo += 1;
      }
    }

    static roundResults(turns = [], userId) {
      const results = [];
      const roundNumbers = [...new Set((turns || [])
        .map(turn => Number(turn.round_no))
        .filter(roundNo => Number.isInteger(roundNo) && roundNo >= 1))]
        .sort((a, b) => a - b);
      for (const roundNo of roundNumbers) {
        const mine = turns.find(turn =>
          turn.user_id === userId && Number(turn.round_no) === roundNo
        );
        const theirs = turns.find(turn =>
          turn.user_id !== userId && Number(turn.round_no) === roundNo
        );
        if (!mine || !theirs) continue;
        const myScore = Number(mine.score) || 0;
        const theirScore = Number(theirs.score) || 0;
        results.push({
          roundNo,
          myScore,
          theirScore,
          result: myScore === theirScore ? 'draw' : myScore > theirScore ? 'won' : 'lost'
        });
      }
      return results;
    }

    static utcWeekWindow(value = Date.now(), weekOffset = 0) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) throw new Error('Invalid week date');
      const daysSinceMonday = (date.getUTCDay() + 6) % 7;
      const start = Date.UTC(
        date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - daysSinceMonday + weekOffset * 7
      );
      const end = start + 7 * 24 * 60 * 60 * 1000;
      return {
        start,
        end,
        key: new Date(start).toISOString().slice(0, 10)
      };
    }

    static weeklySummary(items = [], referenceTime = Date.now(), weekOffset = 0) {
      const window = BattlePiczBackend.utcWeekWindow(referenceTime, weekOffset);
      const battles = items.filter(item => {
        const weekStart = item?.match?.week_start
          ? new Date(`${item.match.week_start}T00:00:00.000Z`).getTime()
          : new Date(item?.match?.created_at || 0).getTime();
        return item?.match?.status !== 'cancelled' && weekStart >= window.start && weekStart < window.end;
      });
      const result = { wins: 0, losses: 0, draws: 0 };
      const roundRecord = { roundWins: 0, roundLosses: 0, roundDraws: 0 };
      const opponents = new Set();
      let roundsPlayed = 0;
      let matchesPlayed = 0;
      battles.forEach(item => {
        const rounds = item.roundResults || BattlePiczBackend.roundResults(
          item.turns || [], item.me?.user_id
        );
        if (!rounds.length) return;
        matchesPlayed += 1;
        if (item.opponent?.user_id) opponents.add(item.opponent.user_id);
        roundsPlayed += rounds.length;
        rounds.forEach(round => {
          if (round.result === 'won') roundRecord.roundWins += 1;
          else if (round.result === 'lost') roundRecord.roundLosses += 1;
          else roundRecord.roundDraws += 1;
        });
        const myWins = rounds.filter(round => round.result === 'won').length;
        const theirWins = rounds.filter(round => round.result === 'lost').length;
        if (myWins > theirWins) result.wins += 1;
        else if (theirWins > myWins) result.losses += 1;
        else result.draws += 1;
      });
      return {
        ...window,
        ...result,
        ...roundRecord,
        matchesPlayed,
        opponentsPlayed: opponents.size,
        roundsPlayed,
        coins: matchesPlayed ? 10 + result.wins * 5 : 0
      };
    }

    static describeMatch(match, players, turns, userId, nudges = []) {
      const me = players.find(player => player.user_id === userId) || null;
      if (!me) return null;
      const opponent = players.find(player => player.user_id !== userId) || null;
      const currentRound = BattlePiczBackend.currentRound(match, turns);
      const roundConfig = match.game_config?.rounds?.[String(currentRound)] || null;
      const ownTurn = turns.find(turn => turn.user_id === userId && Number(turn.round_no) === currentRound) || null;
      const opponentTurn = turns.find(turn => turn.user_id !== userId && Number(turn.round_no) === currentRound) || null;
      const canPlayOpeningTurn = match.status === 'waiting' &&
        me.player_no === 1 && currentRound === 1;
      const canChoose = (match.status === 'active' || canPlayOpeningTurn) &&
        me.player_no === (currentRound % 2 === 1 ? 1 : 2);
      let bucket = 'waiting';
      let action = 'waiting';

      if (match.status === 'complete') {
        bucket = 'completed';
        action = 'result';
      } else if (!me.accepted_at) {
        bucket = 'your-turn';
        action = 'accept';
      } else if (match.status === 'waiting' && canPlayOpeningTurn && !ownTurn) {
        bucket = 'your-turn';
        action = roundConfig ? 'play' : 'choose';
      } else if (match.status === 'waiting') {
        bucket = 'waiting';
      } else if (ownTurn) {
        bucket = 'waiting';
      } else if (roundConfig || canChoose) {
        bucket = 'your-turn';
        action = roundConfig ? 'play' : 'choose';
      }

      const dates = [match.completed_at, ownTurn?.completed_at, opponentTurn?.completed_at,
        match.started_at, match.created_at].filter(Boolean).map(value => new Date(value).getTime());
      const myScore = Number(me.total_score) || 0;
      const theirScore = Number(opponent?.total_score) || 0;
      const roundResults = BattlePiczBackend.roundResults(turns, userId);
      const myRoundsWon = roundResults.filter(result => result.result === 'won').length;
      const theirRoundsWon = roundResults.filter(result => result.result === 'lost').length;
      const lastSentNudge = nudges.find(nudge => nudge.from_user_id === userId) || null;
      const lastReceivedNudge = nudges.find(nudge => nudge.to_user_id === userId) || null;
      const nudgeCooldownMs = 6 * 60 * 60 * 1000;
      return {
        id: match.id, match, me, opponent, turns, ownTurn, opponentTurn,
        currentRound, roundConfig, canChoose, bucket, action, myScore, theirScore,
        roundResults, myRoundsWon, theirRoundsWon,
        result: match.status !== 'complete' ? null
          : match.winner_id == null ? 'draw'
            : match.winner_id === userId ? 'won' : 'lost',
        lastSentNudge,
        lastReceivedNudge,
        canNudge: bucket === 'waiting' && Boolean(opponent) &&
          (!lastSentNudge || Date.now() - new Date(lastSentNudge.created_at).getTime() >= nudgeCooldownMs),
        updatedAt: dates.length ? Math.max(...dates) : 0
      };
    }
  }

  return { BattlePiczBackend, SESSION_KEY, MATCH_KEY };
});

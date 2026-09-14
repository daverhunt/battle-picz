(function () {
  const config = window.BATTLE_PICZ_SUPABASE || {};
  if (!window.BattlePiczBackend) return;
  const backend = new window.BattlePiczBackend(config);
  window.battlePiczBackend = backend;
  if (!backend.configured) return;

  const game = document.getElementById('game');
  const trigger = document.createElement('button');
  trigger.className = 'match-button';
  trigger.innerHTML = '<span class="match-button-dot"></span> Matches';
  trigger.setAttribute('aria-haspopup', 'dialog');

  const panel = document.createElement('section');
  panel.className = 'match-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Your matches');
  panel.innerHTML = `
    <header class="matches-header">
      <button class="matches-back" aria-label="Back to game">‹</button>
      <div><h2>Your Battles</h2><p>Pick up where you left off</p></div>
      <button class="matches-refresh" aria-label="Refresh matches">↻</button>
    </header>
    <section class="weekly-strip" aria-label="This week's tournament record">
      <div><span>THIS WEEK</span><strong class="weekly-record">0 WINS · 0 LOSSES</strong></div>
      <div><span>ENDS IN</span><strong class="weekly-countdown">—</strong></div>
      <button class="matches-test-week">TEST: END WEEK</button>
    </section>
    <div class="invite-banner" hidden>
      <strong>You’ve been challenged!</strong><span class="invite-banner-code"></span>
      <button class="invite-join">JOIN & PLAY</button>
    </div>
    <nav class="matches-tabs" aria-label="Match filters">
      <button data-tab="your-turn" class="active">My Turn <b>0</b></button>
      <button data-tab="waiting">Their Turn <b>0</b></button>
      <button data-tab="completed">Completed <b>0</b></button>
    </nav>
    <div class="matches-state" role="status">Loading battles…</div>
    <div class="matches-list"></div>
    <footer class="matches-footer">
      <button class="matches-new">+ CHALLENGE A FRIEND</button>
      <button class="matches-code">ENTER CODE</button>
      <button class="matches-alerts">🔔 ALERTS</button>
    </footer>
    <div class="weekly-summary" hidden>
      <section class="weekly-summary-card" role="dialog" aria-modal="true" aria-labelledby="weekly-summary-title">
        <span class="weekly-cup">🏆</span>
        <p class="weekly-kicker">WEEK COMPLETE</p>
        <h2 id="weekly-summary-title">Weekly tournament results</h2>
        <div class="weekly-result-grid">
          <div><strong data-weekly="wins">0</strong><span>Games won</span></div>
          <div><strong data-weekly="losses">0</strong><span>Games lost</span></div>
          <div><strong data-weekly="draws">0</strong><span>Draws</span></div>
        </div>
        <dl class="weekly-details">
          <div><dt>Matches played</dt><dd data-weekly="matches">0</dd></div>
          <div><dt>Opponents played</dt><dd data-weekly="opponents">0</dd></div>
          <div><dt>Rounds played</dt><dd data-weekly="rounds">0</dd></div>
        </dl>
        <div class="weekly-coins">🪙 <strong data-weekly="coins">+0 COINS</strong><small>10 participation + 5 per win</small></div>
        <button class="weekly-continue">START NEW WEEK!</button>
        <small class="weekly-preview-note" hidden>Test preview only — no coins awarded and the real week is unchanged.</small>
      </section>
    </div>`;
  game.append(trigger, panel);

  const list = panel.querySelector('.matches-list');
  const state = panel.querySelector('.matches-state');
  const tabs = [...panel.querySelectorAll('.matches-tabs button')];
  const refreshButton = panel.querySelector('.matches-refresh');
  const inviteBanner = panel.querySelector('.invite-banner');
  const inviteCodeLabel = panel.querySelector('.invite-banner-code');
  const joinButton = panel.querySelector('.invite-join');
  const alertsButton = panel.querySelector('.matches-alerts');
  const weeklyRecord = panel.querySelector('.weekly-record');
  const weeklyCountdown = panel.querySelector('.weekly-countdown');
  const weeklySummary = panel.querySelector('.weekly-summary');
  const weeklyPreviewNote = panel.querySelector('.weekly-preview-note');
  let activeTab = 'your-turn';
  let matches = [];
  let currentWeek = null;
  let previousWeek = null;
  let shownSummaryKey = '';
  let matchContext = null;
  let busy = false;

  const categoryImages = {
    ANIMALS: 'assets/images/animals/penguin.webp',
    FOOD: 'assets/images/food/avocado.webp',
    SPORT: 'assets/images/sport/football.webp'
  };

  function escapeHtml(value) {
    const element = document.createElement('span');
    element.textContent = String(value ?? '');
    return element.innerHTML;
  }

  function relativeTime(timestamp) {
    if (!timestamp) return 'Just now';
    const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    const days = Math.floor(seconds / 86400);
    return days === 1 ? 'Yesterday' : `${days}d ago`;
  }

  function matchUrl(item) {
    const url = new URL(location.href);
    url.searchParams.delete('challenge');
    url.searchParams.set('match', item.match.seed);
    url.searchParams.set('matchId', item.id);
    return url.toString();
  }

  function shareUrl(item) {
    return backend.buildShareUrl(item.match.invite_code);
  }

  function opponentName(item) {
    return item.opponent?.profiles?.display_name || (item.match.status === 'waiting' ? 'Waiting for player' : 'Opponent');
  }

  function cardStatus(item) {
    if (item.bucket === 'completed') return item.result.toUpperCase();
    if (item.lastReceivedNudge && item.bucket === 'your-turn') return 'THEY NUDGED YOU · YOUR TURN';
    if (item.action === 'accept') return 'NEW CHALLENGE';
    if (item.action === 'choose') return 'CHOOSE THE ROUND';
    if (item.action === 'play') return 'READY TO PLAY';
    if (!item.opponent) return 'INVITE SENT';
    return 'WAITING FOR THEIR TURN';
  }

  function primaryLabel(item) {
    if (item.action === 'accept') return 'ACCEPT';
    if (item.action === 'choose') return 'CHOOSE';
    if (item.action === 'play') return 'PLAY';
    if (item.action === 'result') return 'RESULT';
    return 'WAITING';
  }

  function renderCard(item) {
    const category = item.roundConfig?.category || 'Challenge';
    const difficulty = item.roundConfig?.difficulty || '';
    const image = categoryImages[String(category).toUpperCase()] || '';
    const resultClass = item.bucket === 'completed' ? ` result-${item.result}` : '';
    const inviteAction = !item.opponent && item.match.invite_code
      ? `<button class="match-card-link" data-action="share" data-id="${item.id}">COPY INVITE</button>` : '';
    const rematchAction = item.bucket === 'completed'
      ? `<button class="match-card-link" data-action="rematch" data-id="${item.id}">REMATCH</button>` : '';
    const nudgeAction = item.bucket === 'waiting' && item.opponent
      ? `<button class="match-card-link nudge-link" data-action="nudge" data-id="${item.id}" ${item.canNudge ? '' : 'disabled'}>${item.canNudge ? '🔔 NUDGE' : 'NUDGED ✓'}</button>` : '';
    return `<article class="match-card${resultClass}">
      <div class="match-card-image"${image ? ` style="background-image:url('${image}')"` : ''}><span>${escapeHtml(category).slice(0, 1)}</span></div>
      <div class="match-card-main">
        <div class="match-card-top"><strong>${escapeHtml(opponentName(item))}</strong><time>${relativeTime(item.updatedAt)}</time></div>
        <div class="match-card-meta">Round ${item.currentRound} of 3 · ${escapeHtml(category)}${difficulty ? ` · ${escapeHtml(difficulty)}` : ''}</div>
        <div class="match-card-status">${cardStatus(item)}</div>
        <div class="match-card-score"><span>You <b>${item.myRoundsWon}</b></span><i></i><span>Them <b>${item.theirRoundsWon}</b></span></div>
        <div class="match-card-links">${inviteAction}${rematchAction}${nudgeAction}</div>
      </div>
      <button class="match-card-primary" data-action="${item.action}" data-id="${item.id}" ${item.action === 'waiting' ? 'disabled' : ''}>${primaryLabel(item)}</button>
    </article>`;
  }

  function emptyMessage(tab) {
    if (tab === 'your-turn') return ['You’re all caught up', 'Start a new battle or check games waiting on friends.'];
    if (tab === 'waiting') return ['Nobody’s keeping you waiting', 'Battles you’ve played or invited friends to will appear here.'];
    return ['No completed battles yet', 'Finish a battle and your results will be saved here.'];
  }

  function render() {
    const keys = ['your-turn', 'waiting', 'completed'];
    const counts = Object.fromEntries(keys.map(key => [key, matches.filter(item => item.bucket === key).length]));
    tabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === activeTab);
      tab.querySelector('b').textContent = counts[tab.dataset.tab];
    });
    const visible = matches.filter(item => item.bucket === activeTab);
    state.hidden = true;
    if (!visible.length) {
      const [title, copy] = emptyMessage(activeTab);
      list.innerHTML = `<div class="matches-empty"><span>⚔</span><strong>${title}</strong><p>${copy}</p></div>`;
      return;
    }
    list.innerHTML = visible.map(renderCard).join('');
  }

  function updateCountdown() {
    if (!currentWeek) return;
    const remaining = Math.max(0, currentWeek.end - Date.now());
    const days = Math.floor(remaining / 86400000);
    const hours = Math.floor((remaining % 86400000) / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    weeklyCountdown.textContent = `${days}D ${String(hours).padStart(2, '0')}H ${String(minutes).padStart(2, '0')}M · UTC`;
  }

  function renderWeeklyRecord() {
    if (!currentWeek) return;
    const drawText = currentWeek.draws ? ` · ${currentWeek.draws} ${currentWeek.draws === 1 ? 'DRAW' : 'DRAWS'}` : '';
    weeklyRecord.textContent = `${currentWeek.wins} ${currentWeek.wins === 1 ? 'WIN' : 'WINS'} · ${currentWeek.losses} ${currentWeek.losses === 1 ? 'LOSS' : 'LOSSES'}${drawText}`;
    updateCountdown();
  }

  function showWeeklySummary(summary, isPreview = false) {
    shownSummaryKey = isPreview ? '' : summary.key;
    panel.querySelector('[data-weekly="wins"]').textContent = summary.wins;
    panel.querySelector('[data-weekly="losses"]').textContent = summary.losses;
    panel.querySelector('[data-weekly="draws"]').textContent = summary.draws;
    panel.querySelector('[data-weekly="matches"]').textContent = summary.matchesPlayed;
    panel.querySelector('[data-weekly="opponents"]').textContent = summary.opponentsPlayed;
    panel.querySelector('[data-weekly="rounds"]').textContent = summary.roundsPlayed;
    panel.querySelector('[data-weekly="coins"]').textContent = `+${summary.coins} COINS`;
    weeklyPreviewNote.hidden = !isPreview;
    weeklySummary.hidden = false;
  }

  function maybeShowPreviousWeek() {
    if (!previousWeek?.matchesPlayed) return;
    const acknowledged = localStorage.getItem(`battle-picz.week-summary.${previousWeek.key}`);
    if (!acknowledged) showWeeklySummary(previousWeek);
  }

  function updateAlertsButton() {
    if (!('Notification' in window)) {
      alertsButton.textContent = 'ALERTS N/A';
      alertsButton.disabled = true;
      return;
    }
    alertsButton.textContent = Notification.permission === 'granted' ? '🔔 ALERTS ON' : '🔔 ALERTS';
  }

  function notifyAboutNudges() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const received = matches.filter(item => item.lastReceivedNudge)
      .sort((a, b) => new Date(b.lastReceivedNudge.created_at) - new Date(a.lastReceivedNudge.created_at))[0];
    if (!received) return;
    const notificationKey = `${received.id}:${received.lastReceivedNudge.created_at}`;
    if (localStorage.getItem('battle-picz.last-nudge-notification') === notificationKey) return;
    try {
      new Notification('Your turn in Battle Picz', {
        body: `${opponentName(received)} gave you a nudge. Ready to play?`,
        tag: `battle-picz-${received.id}`
      });
      localStorage.setItem('battle-picz.last-nudge-notification', notificationKey);
    } catch {
      // Some mobile browsers expose Notification but require service-worker delivery.
    }
  }

  function setBusy(value, message) {
    busy = value;
    panel.classList.toggle('is-busy', value);
    refreshButton.disabled = value;
    if (message) {
      state.hidden = false;
      state.className = 'matches-state';
      state.textContent = message;
    }
  }

  function showError(error) {
    state.hidden = false;
    state.className = 'matches-state error';
    state.textContent = error?.message || 'Something went wrong. Please try again.';
  }

  async function loadMatches(message = 'Loading battles…') {
    if (busy) return;
    setBusy(true, message);
    try {
      const dashboard = await backend.getWeeklyDashboard();
      matches = dashboard.matches;
      currentWeek = dashboard.current;
      previousWeek = dashboard.previous;
      render();
      renderWeeklyRecord();
      notifyAboutNudges();
      maybeShowPreviousWeek();
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  function open(tab) {
    if (tab) activeTab = tab;
    panel.classList.add('show');
    trigger.hidden = true;
    loadMatches();
  }

  function close() {
    panel.classList.remove('show');
    trigger.hidden = false;
  }

  async function copyText(text, success = 'Invite link copied') {
    try {
      await navigator.clipboard.writeText(text);
      state.hidden = false;
      state.className = 'matches-state success';
      state.textContent = success;
    } catch {
      window.prompt('Copy this challenge link:', text);
    }
  }

  trigger.onclick = () => open();
  panel.querySelector('.matches-back').onclick = close;
  refreshButton.onclick = () => loadMatches('Refreshing battles…');
  tabs.forEach(tab => tab.onclick = () => { activeTab = tab.dataset.tab; render(); });
  alertsButton.onclick = async () => {
    if (!('Notification' in window)) return;
    await Notification.requestPermission();
    updateAlertsButton();
    notifyAboutNudges();
  };
  updateAlertsButton();
  setInterval(updateCountdown, 30_000);

  panel.querySelector('.matches-test-week').onclick = () => {
    if (!currentWeek) return;
    showWeeklySummary(currentWeek, true);
  };
  panel.querySelector('.weekly-continue').onclick = () => {
    if (shownSummaryKey) {
      localStorage.setItem(`battle-picz.week-summary.${shownSummaryKey}`, 'shown');
    }
    weeklySummary.hidden = true;
    shownSummaryKey = '';
  };

  panel.querySelector('.matches-new').onclick = async () => {
    if (busy) return;
    setBusy(true, 'Creating your challenge…');
    try {
      const challenge = await backend.createChallenge({ version: 1 });
      sessionStorage.setItem('battle-picz.pending-share-url', challenge.share_url);
      sessionStorage.setItem('battle-picz.pending-share-code', challenge.invite_code);
      await copyText(challenge.share_url, `Challenge ${challenge.invite_code} copied — send it to a friend`);
      matches = await backend.getMatchesDashboard();
      activeTab = 'your-turn';
      render();
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };

  panel.querySelector('.matches-code').onclick = async () => {
    const code = window.prompt('Enter the six-character challenge code:');
    if (code == null) return;
    setBusy(true, 'Joining challenge…');
    try {
      const match = await backend.joinChallenge(code);
      location.assign(matchUrl({ id: match.id, match }));
    } catch (error) {
      showError(error);
      setBusy(false);
    }
  };

  list.onclick = async event => {
    const button = event.target.closest('button[data-action]');
    if (!button || busy) return;
    const item = matches.find(candidate => candidate.id === button.dataset.id);
    if (!item) return;
    const action = button.dataset.action;
    if (action === 'share') return copyText(shareUrl(item));
    if (action === 'play' || action === 'choose' || action === 'result') return location.assign(matchUrl(item));
    setBusy(true, action === 'rematch' ? 'Creating rematch…' : 'Accepting challenge…');
    try {
      if (action === 'accept') {
        await backend.acceptMatch(item.id);
        return location.assign(matchUrl(item));
      }
      if (action === 'nudge') {
        await backend.sendNudge(item.id);
        matches = await backend.getMatchesDashboard();
        activeTab = 'waiting';
        render();
        state.hidden = false;
        state.className = 'matches-state success';
        state.textContent = 'Nudge sent. You can nudge them again in 6 hours.';
      }
      if (action === 'rematch') {
        await backend.createRematch(item.id);
        const dashboard = await backend.getWeeklyDashboard();
        matches = dashboard.matches;
        currentWeek = dashboard.current;
        previousWeek = dashboard.previous;
        activeTab = 'waiting';
        render();
        renderWeeklyRecord();
        state.hidden = false;
        state.className = 'matches-state success';
        state.textContent = 'Rematch sent — it will appear for your opponent to accept.';
      }
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };

  const inviteCode = backend.inviteCodeFromLocation();
  if (inviteCode) {
    panel.classList.add('show');
    trigger.hidden = true;
    inviteBanner.hidden = false;
    inviteCodeLabel.textContent = inviteCode;
    joinButton.onclick = async () => {
      setBusy(true, 'Joining challenge…');
      try {
        const match = await backend.joinChallenge(inviteCode);
        location.assign(matchUrl({ id: match.id, match }));
      } catch (error) {
        showError(error);
        setBusy(false);
      }
    };
    loadMatches();
  }

  async function initialiseMatch() {
    const matchId = new URLSearchParams(location.search).get('matchId');
    if (!matchId) {
      open();
      return;
    }
    try {
      matchContext = await backend.getMatchContext(matchId);
      window.BATTLE_PICZ_MATCH = matchContext;
      const opponentNameValue = matchContext.opponent?.profiles?.display_name || 'OPPONENT';
      const opponentLabel = document.querySelector('.pname.opp');
      if (opponentLabel) opponentLabel.textContent = opponentNameValue;
      const seenRoundKey = `battle-picz.seen-round.${matchId}`;
      const lastCompletedRound = matchContext.roundResults.length;
      const lastSeenRound = Number(localStorage.getItem(seenRoundKey) || 0);
      if (lastCompletedRound > lastSeenRound) {
        matchContext = await backend.getMatchContext(matchId, lastCompletedRound);
        window.BATTLE_PICZ_MATCH = matchContext;
        window.showBattlePiczMatchResult?.(matchContext);
      } else if (matchContext.match.status === 'complete') {
        matchContext = await backend.getMatchContext(matchId, 3);
        window.BATTLE_PICZ_MATCH = matchContext;
        window.showBattlePiczMatchResult?.(matchContext);
      } else if (matchContext.ownTurn) {
        if (matchContext.opponentTurn) {
          window.showBattlePiczMatchResult?.(matchContext);
        } else {
          open('waiting');
          state.hidden = false;
          state.className = 'matches-state success';
          state.textContent = 'Round saved. Your friend’s turn now.';
        }
      } else if (matchContext.roundConfig || matchContext.canChoose) {
        close();
        window.startBattlePicz?.(matchContext);
      } else {
        open('waiting');
      }
    } catch (error) {
      panel.classList.add('show');
      trigger.hidden = true;
      showError(error);
    }
  }

  window.battlePiczSaveRound = async payload => {
    if (!matchContext) throw new Error('Match is not ready');
    await backend.submitTurn(matchContext.match.id, payload.roundNo, payload.score,
      payload.answers, payload.ghostTimeline, payload.roundNo === 3);
    matchContext = await backend.getMatchContext(matchContext.match.id, payload.roundNo);
    window.BATTLE_PICZ_MATCH = matchContext;
    return matchContext;
  };

  if (!inviteCode) initialiseMatch();
})();

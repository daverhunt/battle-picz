(function () {
  const config = window.BATTLE_PICZ_SUPABASE || {};
  if (!window.BattlePiczBackend) return;
  const backend = new window.BattlePiczBackend(config);
  window.battlePiczBackend = backend;
  if (!backend.configured) return;

  const game = document.getElementById('game');
  const ONBOARDING_KEY = 'battle-picz.onboarding-complete';
  const providerNames = {
    apple: 'Apple',
    google: 'Google',
    facebook: 'Facebook',
    twitter: 'X',
    email: 'Email'
  };
  let applicationStarted = false;
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
      <div><h2>Your Battles</h2><p class="matches-balance">🪙 0 COINS</p></div>
      <div class="matches-header-actions">
        <button class="matches-settings" aria-label="Settings">⚙</button>
        <button class="matches-refresh" aria-label="Refresh matches">↻</button>
      </div>
    </header>
    <section class="weekly-strip" aria-label="This week's tournament record">
      <div><span>THIS WEEK</span><strong class="weekly-record">0 WINS · 0 LOSSES</strong></div>
      <div><span>ENDS IN</span><strong class="weekly-countdown">—</strong></div>
      <button class="matches-test-week">TEST: END WEEK</button>
      <button class="matches-test-reset">TEST: RESET GAME</button>
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
          <div><strong data-weekly="wins">0</strong><span>Battles won</span></div>
          <div><strong data-weekly="losses">0</strong><span>Battles lost</span></div>
          <div><strong data-weekly="draws">0</strong><span>Draws</span></div>
        </div>
        <dl class="weekly-details">
          <div><dt>Battles played</dt><dd data-weekly="matches">0</dd></div>
          <div><dt>Opponents played</dt><dd data-weekly="opponents">0</dd></div>
          <div><dt>Rounds played</dt><dd data-weekly="rounds">0</dd></div>
        </dl>
        <div class="weekly-coins">🪙 <strong data-weekly="coins">+0 COINS</strong><small>10 participation + 5 per battle won</small></div>
        <button class="weekly-continue">START NEW WEEK!</button>
        <small class="weekly-preview-note" hidden>Test preview only — no coins awarded and the real week is unchanged.</small>
      </section>
    </div>`;
  game.append(trigger, panel);

  function showWelcomeScreen(initialError = '') {
    trigger.hidden = true;
    const welcome = document.createElement('section');
    welcome.className = 'welcome-screen';
    welcome.setAttribute('role', 'dialog');
    welcome.setAttribute('aria-modal', 'true');
    welcome.setAttribute('aria-label', 'Choose how to play Battle Picz');
    welcome.innerHTML = `
      <header class="welcome-hero">
        <h1>BATTLE <span>PICZ</span></h1>
        <p>Reveal it. Name it. Beat your friends.</p>
        <div class="welcome-picture-mark" aria-hidden="true">
          <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
        </div>
      </header>
      <main class="welcome-card">
        <section class="welcome-options">
          <h2>LET'S PLAY</h2>
          <p>Choose how you want to continue</p>
          <div class="welcome-auth-buttons">
            <button class="welcome-auth welcome-guest" type="button" data-auth="guest">
              <span class="welcome-auth-icon" aria-hidden="true">▶</span>
              <strong>PLAY AS GUEST</strong>
              <small>FASTEST</small>
            </button>
            <button class="welcome-auth welcome-apple" type="button" data-provider="apple">
              <span class="welcome-auth-icon" aria-hidden="true"><svg viewBox="0 0 32 32" focusable="false"><path d="M21.2 16.7c0-3.1 2.5-4.6 2.6-4.7-1.4-2.1-3.7-2.4-4.5-2.4-1.9-.2-3.7 1.1-4.7 1.1-1 0-2.6-1.1-4.2-1.1-2.1 0-4.1 1.2-5.2 3.1-2.2 3.9-.6 9.6 1.6 12.8 1.1 1.5 2.3 3.2 4 3.1 1.6-.1 2.2-1 4.2-1s2.5 1 4.2 1c1.7 0 2.8-1.5 3.9-3.1 1.2-1.8 1.7-3.5 1.8-3.6-.1 0-3.6-1.4-3.6-5.8zM18.1 7.6c.9-1.1 1.5-2.7 1.3-4.2-1.3.1-2.9.9-3.8 2-.8 1-1.6 2.6-1.4 4.1 1.5.1 3-.8 3.9-1.9z"/></svg></span>
              <strong>CONTINUE WITH APPLE</strong>
              <span></span>
            </button>
            <button class="welcome-auth welcome-google" type="button" data-provider="google">
              <span class="welcome-auth-icon welcome-google-icon" aria-hidden="true">G</span>
              <strong>CONTINUE WITH GOOGLE</strong>
              <span></span>
            </button>
            <button class="welcome-auth welcome-more" type="button" aria-expanded="false">
              <span class="welcome-auth-icon" aria-hidden="true">＋</span>
              <strong>MORE SIGN-IN OPTIONS</strong>
              <span aria-hidden="true">⌄</span>
            </button>
          </div>
          <div class="welcome-extra-options" hidden>
            <button class="welcome-auth welcome-facebook" type="button" data-provider="facebook">
              <span class="welcome-auth-icon" aria-hidden="true">f</span>
              <strong>CONTINUE WITH FACEBOOK</strong><span></span>
            </button>
            <button class="welcome-auth welcome-x" type="button" data-provider="twitter">
              <span class="welcome-auth-icon" aria-hidden="true">X</span>
              <strong>CONTINUE WITH X</strong><span></span>
            </button>
            <button class="welcome-auth welcome-email" type="button" data-provider="email">
              <span class="welcome-auth-icon" aria-hidden="true">@</span>
              <strong>CONTINUE WITH EMAIL</strong><span></span>
            </button>
          </div>
          <p class="welcome-device-note">Guest progress stays on this device. You can link an account later to keep your games, coins and XP.</p>
          <p class="welcome-legal">By continuing, you agree to the Terms and Privacy Policy.</p>
        </section>
        <section class="welcome-name-step" hidden>
          <button class="welcome-name-back" type="button">‹ BACK</button>
          <div class="welcome-player-icon" aria-hidden="true"><span></span></div>
          <h2>YOUR PLAYER NAME</h2>
          <p>This is what your friends will see.</p>
          <form class="welcome-name-form">
            <label for="welcome-player-name">Player name</label>
            <input id="welcome-player-name" name="player-name" type="text" minlength="2" maxlength="24" autocomplete="nickname" placeholder="e.g. Dave" required>
            <small>2–24 characters. You can change it later.</small>
            <button class="welcome-start" type="submit">START PLAYING</button>
          </form>
        </section>
        <section class="welcome-email-step" hidden>
          <button class="welcome-email-back" type="button">‹ BACK</button>
          <div class="welcome-player-icon" aria-hidden="true"><span></span></div>
          <h2>SIGN IN WITH EMAIL</h2>
          <p>We’ll email you a secure sign-in link.</p>
          <form class="welcome-email-form">
            <label for="welcome-player-email">Email address</label>
            <input id="welcome-player-email" name="player-email" type="email" maxlength="254" autocomplete="email" placeholder="you@example.com" required>
            <small>Use the email previously linked to your Battle Picz player.</small>
            <button class="welcome-start" type="submit">EMAIL MY SIGN-IN LINK</button>
          </form>
        </section>
        <div class="welcome-status" role="status" aria-live="polite"></div>
      </main>`;
    game.append(welcome);

    const options = welcome.querySelector('.welcome-options');
    const nameStep = welcome.querySelector('.welcome-name-step');
    const emailStep = welcome.querySelector('.welcome-email-step');
    const nameInput = welcome.querySelector('#welcome-player-name');
    const emailInput = welcome.querySelector('#welcome-player-email');
    const nameForm = welcome.querySelector('.welcome-name-form');
    const emailForm = welcome.querySelector('.welcome-email-form');
    const status = welcome.querySelector('.welcome-status');
    const moreButton = welcome.querySelector('.welcome-more');
    const extraOptions = welcome.querySelector('.welcome-extra-options');
    const authButtons = [...welcome.querySelectorAll('button')];

    function setWelcomeBusy(value) {
      welcome.classList.toggle('is-busy', value);
      authButtons.forEach(button => { button.disabled = value; });
      nameInput.disabled = value;
      emailInput.disabled = value;
    }

    function setWelcomeStatus(message, isError = false) {
      status.textContent = message || '';
      status.classList.toggle('error', isError);
    }

    moreButton.onclick = () => {
      const expanded = moreButton.getAttribute('aria-expanded') === 'true';
      moreButton.setAttribute('aria-expanded', String(!expanded));
      extraOptions.hidden = expanded;
      moreButton.querySelector('strong').textContent = expanded
        ? 'MORE SIGN-IN OPTIONS' : 'FEWER SIGN-IN OPTIONS';
      moreButton.lastElementChild.textContent = expanded ? '⌄' : '⌃';
      setWelcomeStatus('');
    };

    welcome.querySelector('[data-auth="guest"]').onclick = () => {
      options.hidden = true;
      nameStep.hidden = false;
      setWelcomeStatus('');
      nameInput.focus({ preventScroll: true });
      backend.getProfile().then(profile => {
        const currentName = profile?.display_name || '';
        if (currentName && !/^Player\b/i.test(currentName) && !nameInput.value) {
          nameInput.value = currentName;
          nameInput.select();
        }
      }).catch(() => {});
    };

    welcome.querySelector('.welcome-name-back').onclick = () => {
      nameStep.hidden = true;
      options.hidden = false;
      setWelcomeStatus('');
    };

    welcome.querySelector('.welcome-email-back').onclick = () => {
      emailStep.hidden = true;
      options.hidden = false;
      setWelcomeStatus('');
    };

    welcome.querySelectorAll('[data-provider]').forEach(button => {
      button.onclick = async () => {
        const provider = button.dataset.provider;
        const label = providerNames[provider] || 'This option';
        const configured = config.authProviders?.[provider] === true;
        if (provider === 'email' && configured) {
          options.hidden = true;
          emailStep.hidden = false;
          setWelcomeStatus('');
          emailInput.focus({ preventScroll: true });
          return;
        }
        if (provider === 'google' && configured) {
          setWelcomeBusy(true);
          setWelcomeStatus('Opening Google sign-in…');
          try {
            location.assign(await backend.beginOAuth('google'));
          } catch (error) {
            setWelcomeBusy(false);
            setWelcomeStatus(error?.message || 'Could not start Google sign-in.', true);
          }
          return;
        }
        setWelcomeStatus(configured
          ? `${label} is configured, but is not available in this test build yet.`
          : `${label} sign-in is ready to connect once its Supabase provider is configured. Play as Guest to test the game now.`
        );
      };
    });

    emailForm.onsubmit = async event => {
      event.preventDefault();
      setWelcomeBusy(true);
      setWelcomeStatus('Sending your secure sign-in link…');
      try {
        await backend.sendEmailSignIn(emailInput.value);
        setWelcomeBusy(false);
        setWelcomeStatus('Email sent. Open the link on this device to restore your player.');
      } catch (error) {
        setWelcomeBusy(false);
        setWelcomeStatus(error?.message || 'Could not send the sign-in email.', true);
      }
    };

    nameForm.onsubmit = async event => {
      event.preventDefault();
      const displayName = window.BattlePiczBackend.normaliseDisplayName(nameInput.value);
      if (!displayName) {
        setWelcomeStatus('Choose a player name between 2 and 24 characters.', true);
        nameInput.focus();
        return;
      }
      setWelcomeBusy(true);
      setWelcomeStatus('Creating your guest player…');
      try {
        await backend.updateDisplayName(displayName);
        localStorage.setItem(ONBOARDING_KEY, 'guest');
        welcome.remove();
        startApplication();
      } catch (error) {
        setWelcomeBusy(false);
        setWelcomeStatus(error?.message || 'Could not create your guest player. Try again.', true);
      }
    };

    if (initialError) setWelcomeStatus(initialError, true);
  }

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
  const balanceLabel = panel.querySelector('.matches-balance');
  const resetButton = panel.querySelector('.matches-test-reset');
  let activeTab = 'your-turn';
  let matches = [];
  let currentWeek = null;
  let previousWeek = null;
  let shownSummaryKey = '';
  let matchContext = null;
  let busy = false;

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

  function opponentAvatar(item) {
    const profile = item.opponent?.profiles || {};
    const value = profile.avatar_url || profile.picture || '';
    if (!value) return '';
    try {
      const url = new URL(value, location.origin);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch {
      return '';
    }
  }

  function exposeUnreadRoundResult(item) {
    const seenRound = Number(localStorage.getItem(`battle-picz.seen-round.${item.id}`) || 0);
    const resultRound = window.BattlePiczBackend.unreadCompletedRound(item, seenRound);
    if (!resultRound) return item;
    return {
      ...item,
      bucket: 'your-turn',
      action: 'result',
      currentRound: resultRound,
      resultRound,
      roundConfig: item.match.game_config?.rounds?.[String(resultRound)] || item.roundConfig
    };
  }

  function cardStatus(item) {
    if (item.bucket === 'completed') return item.result.toUpperCase();
    if (item.action === 'result') return `ROUND ${item.resultRound || item.currentRound} RESULTS`;
    if (item.hasActiveReceivedNudge) return 'THEY NUDGED YOU · YOUR TURN';
    if (item.action === 'accept') return 'NEW CHALLENGE';
    if (item.action === 'choose') return `CHOOSE ROUND ${item.currentRound}`;
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
    const avatar = opponentAvatar(item);
    const resultClass = item.bucket === 'completed' ? ` result-${item.result}` : '';
    const inviteAction = !item.opponent && item.match.invite_code
      ? `<button class="match-card-link" data-action="share" data-id="${item.id}">COPY INVITE</button>` : '';
    const rematchAction = item.bucket === 'completed'
      ? `<button class="match-card-link" data-action="rematch" data-id="${item.id}">REMATCH</button>` : '';
    const nudgeAction = item.bucket === 'waiting' && item.opponent
      ? `<button class="match-card-link nudge-link" data-action="nudge" data-id="${item.id}" ${item.canNudge ? '' : 'disabled'}>${item.canNudge ? '🔔 NUDGE' : 'NUDGED ✓'}</button>` : '';
    return `<article class="match-card${resultClass}">
      <div class="match-card-avatar${avatar ? ' has-image' : ''}">${avatar ? `<img src="${escapeHtml(avatar)}" alt="">` : '<span aria-hidden="true"></span>'}</div>
      <div class="match-card-main">
        <div class="match-card-top"><strong>${escapeHtml(opponentName(item))}</strong><time>${relativeTime(item.updatedAt)}</time></div>
        <div class="match-card-meta">Round ${item.currentRound} · ${escapeHtml(category)}${difficulty ? ` · ${escapeHtml(difficulty)}` : ''}</div>
        <div class="match-card-status">${cardStatus(item)}</div>
        <div class="match-card-score"><span>You <b>${item.myRoundsWon}</b></span><span class="match-card-score-separator" aria-hidden="true">–</span><span>Them <b>${item.theirRoundsWon}</b></span></div>
        <div class="match-card-links">${inviteAction}${rematchAction}${nudgeAction}</div>
      </div>
      <button class="match-card-primary" data-action="${item.action}" data-id="${item.id}" ${item.action === 'waiting' ? 'disabled' : ''}>${primaryLabel(item)}</button>
    </article>`;
  }

  function emptyMessage(tab) {
    if (tab === 'your-turn') return ['You’re all caught up', 'Start a new battle or check games waiting on friends.'];
    if (tab === 'waiting') return ['Nobody’s keeping you waiting', 'Battles you’ve played or invited friends to will appear here.'];
    return ['No completed battles yet', 'Battles finish when the UTC tournament week ends.'];
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
    const enabled = Notification.permission === 'granted'
      && window.battlePiczPreferences?.notificationsEnabled !== false;
    alertsButton.textContent = enabled ? '🔔 ALERTS ON' : '🔔 ALERTS';
  }

  function notifyAboutNudges() {
    if (window.battlePiczPreferences?.notificationsEnabled === false) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const received = matches.filter(item => item.hasActiveReceivedNudge)
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
    resetButton.disabled = value;
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
      matches = dashboard.matches.map(exposeUnreadRoundResult);
      currentWeek = dashboard.current;
      previousWeek = dashboard.previous;
      balanceLabel.textContent = `🪙 ${Number(dashboard.profile?.coins || 0).toLocaleString()} COINS`;
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
  window.addEventListener('battle-picz:profile-updated', () => loadMatches('Updating your profile…'));
  window.addEventListener('battle-picz:settings-changed', event => {
    if (event.detail?.notificationsEnabled) notifyAboutNudges();
    updateAlertsButton();
  });
  tabs.forEach(tab => tab.onclick = () => { activeTab = tab.dataset.tab; render(); });
  alertsButton.onclick = async () => {
    if (!('Notification' in window)) return;
    await Notification.requestPermission();
    if (Notification.permission === 'granted' && window.battlePiczPreferences) {
      window.battlePiczPreferences.notificationsEnabled = true;
    }
    updateAlertsButton();
    notifyAboutNudges();
  };
  updateAlertsButton();
  setInterval(updateCountdown, 30_000);

  panel.querySelector('.matches-test-week').onclick = () => {
    if (!currentWeek) return;
    showWeeklySummary(currentWeek, true);
  };
  resetButton.onclick = async () => {
    if (busy || !window.confirm('Reset your test game? This removes your battles, coins, XP and saved progress.')) return;
    setBusy(true, 'Resetting your test game…');
    try {
      await backend.resetMyGameData();
      sessionStorage.removeItem('battle-picz.pending-share-url');
      sessionStorage.removeItem('battle-picz.pending-share-code');
      location.replace(new URL(location.pathname, location.origin).toString());
    } catch (error) {
      showError(error);
      setBusy(false);
    }
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
      const match = await backend.getMatch(challenge.match_id);
      location.assign(matchUrl({ id: challenge.match_id, match }));
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
        matches = (await backend.getMatchesDashboard()).map(exposeUnreadRoundResult);
        activeTab = 'waiting';
        render();
        state.hidden = false;
        state.className = 'matches-state success';
        state.textContent = 'Nudge sent. You can nudge them again in 6 hours.';
      }
      if (action === 'rematch') {
        const rematch = await backend.createRematch(item.id);
        const match = await backend.getMatch(rematch.match_id);
        return location.assign(matchUrl({ id: rematch.match_id, match }));
      }
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };

  const inviteCode = backend.inviteCodeFromLocation();
  function prepareInvite() {
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
      await backend.finalizeWeeklyTournaments();
      matchContext = await backend.getMatchContext(matchId);
      window.BATTLE_PICZ_MATCH = matchContext;
      const ownNameValue = matchContext.me?.profiles?.display_name || 'YOU';
      const opponentNameValue = matchContext.opponent?.profiles?.display_name || 'OPPONENT';
      const ownLabel = document.querySelector('.pname.me');
      const opponentLabel = document.querySelector('.pname.opp');
      if (ownLabel) ownLabel.textContent = ownNameValue;
      if (opponentLabel) opponentLabel.textContent = opponentNameValue;
      const summaryOwnLabel = document.querySelector('.summary-players > span:first-child');
      const summaryOpponentLabel = document.querySelector('.summary-players > span:last-child');
      if (summaryOwnLabel) summaryOwnLabel.textContent = ownNameValue;
      if (summaryOpponentLabel) summaryOpponentLabel.textContent = opponentNameValue;
      const seenRoundKey = `battle-picz.seen-round.${matchId}`;
      const lastCompletedRound = matchContext.roundResults.length;
      const lastSeenRound = Number(localStorage.getItem(seenRoundKey) || 0);
      if (lastCompletedRound > lastSeenRound) {
        const nextContext = matchContext;
        const resultContext = await backend.getMatchContext(matchId, lastCompletedRound);
        window.BATTLE_PICZ_MATCH = resultContext;
        window.BATTLE_PICZ_NEXT_CONTEXT = nextContext;
        window.showBattlePiczMatchResult?.(resultContext);
      } else if (matchContext.match.status === 'complete') {
        matchContext = await backend.getMatchContext(matchId, matchContext.currentRound);
        window.BATTLE_PICZ_MATCH = matchContext;
        window.showBattlePiczMatchResult?.(matchContext);
      } else if (matchContext.ownTurn) {
        window.BattlePiczProgress?.clear(localStorage, matchId, matchContext.currentRound || 1);
        if (matchContext.opponentTurn) {
          window.showBattlePiczMatchResult?.(matchContext);
        } else {
          open('waiting');
          state.hidden = false;
          state.className = 'matches-state success';
          state.textContent = matchContext.opponent
            ? 'Round saved. Your friend’s turn now.'
            : 'Round saved. Send the invite link and wait for your friend.';
        }
      } else if ((matchContext.canChoose && !matchContext.roundConfig) || matchContext.canPlay) {
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
    const matchId = matchContext.match.id;
    try {
      await backend.submitTurn(matchId, payload.roundNo, payload.score,
        payload.answers, payload.ghostTimeline, false);
    } catch (error) {
      const savedContext = await backend.getMatchContext(matchId, payload.roundNo).catch(() => null);
      if (!savedContext?.ownTurn) throw error;
    }
    const [resultContext, nextContext] = await Promise.all([
      backend.getMatchContext(matchId, payload.roundNo),
      backend.getMatchContext(matchId)
    ]);
    matchContext = nextContext;
    window.BATTLE_PICZ_NEXT_CONTEXT = nextContext;
    window.BATTLE_PICZ_MATCH = matchContext;
    return resultContext;
  };

  function startApplication() {
    if (applicationStarted) return;
    applicationStarted = true;
    if (inviteCode) prepareInvite();
    else initialiseMatch();
  }

  async function bootstrap() {
    let authResult = null;
    let authError = null;
    try {
      authResult = await backend.completeAuthRedirect();
      if (authResult?.user) localStorage.setItem(ONBOARDING_KEY, 'linked');
    } catch (error) {
      authError = error;
    }
    const onboarded = Boolean(localStorage.getItem(ONBOARDING_KEY));
    if (onboarded) startApplication();
    else showWelcomeScreen(authError?.message || '');
    if (onboarded && (authResult || authError)) {
      setTimeout(() => window.dispatchEvent(new CustomEvent('battle-picz:auth-linked', {
        detail: authError
          ? { error: authError.message || 'Could not complete sign-in.' }
          : { provider: authResult.provider, linked: authResult.linked, user: authResult.user }
      })), 0);
    }
  }

  bootstrap();
})();

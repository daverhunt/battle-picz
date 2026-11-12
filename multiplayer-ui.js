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
      <span class="playroom-mark" aria-hidden="true">▦</span>
      <div class="matches-brand"><span class="playroom-kicker">PIC <span>RIVALS</span></span><h2>Your Battles</h2><p class="matches-balance"><span class="gold-coin" aria-hidden="true"></span> <span class="matches-coins-value">0 COINS</span></p></div>
      <div class="matches-header-actions">
        <button class="matches-shop" type="button" aria-label="Power-up shop" title="Shop"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l1 13H4L5 8Z M8 8V6a4 4 0 0 1 8 0v2" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg></button>
        <button class="matches-settings" aria-label="Settings">⚙</button>
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
    <div class="matches-pull" role="status" aria-live="polite"></div>
    <div class="matches-list" tabindex="0" aria-label="Games. Pull down and release to refresh, or press R." aria-keyshortcuts="R"></div>
    <footer class="matches-footer">
      <button class="matches-start" type="button" aria-haspopup="dialog" aria-controls="start-game-menu">▶ START GAME</button>
    </footer>
    <div id="start-game-menu" class="start-game-menu" hidden>
      <section class="start-game-card" role="dialog" aria-modal="true" aria-labelledby="start-game-title">
        <button class="start-game-close" type="button" aria-label="Close">×</button>
        <div class="start-game-symbol" aria-hidden="true">🎮</div>
        <h2 id="start-game-title">START A GAME</h2>
        <p>Who are you playing?</p>
        <button class="matches-new" type="button"><span aria-hidden="true">👥</span><span><strong>CHALLENGE A FRIEND</strong><small>Invite someone with a link</small></span><b aria-hidden="true">›</b></button>
        <button class="matches-random" type="button"><span aria-hidden="true">🎲</span><span><strong>RANDOM OPPONENT</strong><small>Find someone new to play</small></span><b aria-hidden="true">›</b></button>
        <button class="matches-code" type="button"><span aria-hidden="true">⌗</span><span><strong>ENTER CODE</strong><small>Join a friend's challenge</small></span><b aria-hidden="true">›</b></button>
      </section>
    </div>
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
          <div><dt>Completed battles</dt><dd data-weekly="matches">0</dd></div>
          <div data-weekly-expired hidden><dt>Challenges expired before an opponent joined</dt><dd data-weekly="expired">0</dd></div>
          <div><dt>Opponents played</dt><dd data-weekly="opponents">0</dd></div>
          <div><dt>Rounds played</dt><dd data-weekly="rounds">0</dd></div>
        </dl>
        <div class="weekly-coins">🪙 <strong data-weekly="coins">+0 COINS</strong><small>10 for your first visit each week + 5 per battle won</small></div>
        <button class="weekly-continue">START NEW WEEK!</button>
        <small class="weekly-preview-note" hidden>Test preview only — no coins awarded and the real week is unchanged.</small>
      </section>
    </div>`;
  game.append(trigger, panel);
  // Category/difficulty setup is a focused flow: no floating Matches shortcut.
  const categoryChooser = document.getElementById('categoryChooser');
  function syncCategoryNavigation() {
    if (!categoryChooser) return;
    if (!categoryChooser.classList.contains('hidden')) {
      trigger.hidden = true;
    } else if (applicationStarted && !panel.classList.contains('show')) {
      trigger.hidden = false;
    }
  }
  if (categoryChooser) {
    new MutationObserver(syncCategoryNavigation).observe(categoryChooser, {
      attributes: true, attributeFilter: ['class']
    });
    syncCategoryNavigation();
  }

  function showWelcomeScreen(initialError = '') {
    trigger.hidden = true;
    const welcome = document.createElement('section');
    welcome.className = 'welcome-screen';
    welcome.setAttribute('role', 'dialog');
    welcome.setAttribute('aria-modal', 'true');
    welcome.setAttribute('aria-label', 'Choose how to play Pic Rivals');
    welcome.innerHTML = `
      <header class="welcome-hero">
        <h1>PIC <span>RIVALS</span></h1>
        <p>Reveal it. Name it. Beat your friends.</p>
        <div class="welcome-picture-mark" aria-hidden="true">
          <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
        </div>
      </header>
      <main class="welcome-card">
        <section class="welcome-options">
          <h2>Reveal. Guess. Win.</h2>
          <p>Picture battles with friends</p>
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
            <small>New here? This creates your account. Returning players: use your existing account’s email.</small>
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
  const pullStatus = panel.querySelector('.matches-pull');
  const inviteBanner = panel.querySelector('.invite-banner');
  const inviteCodeLabel = panel.querySelector('.invite-banner-code');
  const joinButton = panel.querySelector('.invite-join');
  panel.querySelector('.matches-shop').onclick = () => window.openPicRivalsShop?.();
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
    if (item.resultRound) return 'RESULTS READY';
    if (item.action === 'result') return 'RESULTS READY';
    if (item.hasActiveReceivedNudge) return 'THEY NUDGED YOU · YOUR TURN';
    if (item.action === 'accept') return 'NEW CHALLENGE';
    if (item.action === 'choose') return `CHOOSE ROUND ${item.currentRound}`;
    if (item.action === 'play') return 'READY TO PLAY';
    if (!item.opponent) return 'AWAITING FRIEND';
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
    const resultClass = item.bucket === 'completed' && !item.resultRound ? ` result-${item.result}` : '';
    const inviteAction = !item.opponent && item.match.invite_code
      ? `<button class="match-card-link" data-action="share" data-id="${item.id}">SHARE INVITE</button>` : '';
    const rematchAction = item.bucket === 'completed'
      ? `<button class="match-card-link" data-action="rematch" data-id="${item.id}">REMATCH</button>` : '';
    const nudgeAction = item.bucket === 'waiting' && item.canNudge
      ? `<button class="match-card-link nudge-link" data-action="nudge" data-id="${item.id}">🔔 NUDGE</button>` : '';
    return `<article class="match-card${resultClass}">
      <div class="match-card-avatar${avatar ? ' has-image' : ''}">${avatar ? `<img src="${escapeHtml(avatar)}" alt="">` : '<span aria-hidden="true"></span>'}</div>
      <div class="match-card-main">
        <div class="match-card-top"><strong>${escapeHtml(opponentName(item))}</strong><time>${relativeTime(item.updatedAt)}</time></div>
        <div class="match-card-meta">Round ${item.currentRound} · ${escapeHtml(category)}${difficulty ? ` · ${escapeHtml(difficulty)}` : ''}</div>
        <div class="match-card-status">${cardStatus(item)}</div>
        ${item.resultRound ? '<div class="match-card-score">Open Results to see the score</div>' : `<div class="match-card-score"><span>You <b>${item.myRoundsWon}</b></span><span class="match-card-score-separator" aria-hidden="true">–</span><span>Them <b>${item.theirRoundsWon}</b></span></div>`}
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
    shownSummaryKey = isPreview ? '' : summary.playerId + '.' + summary.key;
    panel.querySelector('[data-weekly-expired]').hidden = !summary.expired;
    panel.querySelector('[data-weekly="expired"]').textContent = summary.expired || 0;
    panel.querySelector('[data-weekly="wins"]').textContent = summary.wins;
    panel.querySelector('[data-weekly="losses"]').textContent = summary.losses;
    panel.querySelector('[data-weekly="draws"]').textContent = summary.draws;
    panel.querySelector('[data-weekly="matches"]').textContent = summary.matchesPlayed;
    panel.querySelector('[data-weekly="opponents"]').textContent = summary.opponentsPlayed;
    panel.querySelector('[data-weekly="rounds"]').textContent = summary.roundsPlayed;
    panel.querySelector('[data-weekly="coins"]').textContent = `+${summary.coins} COINS`;
    weeklyPreviewNote.hidden = !isPreview;
    weeklySummary.hidden = false;
    if (!isPreview) window.picRivalsCelebrateCoins?.(panel.querySelector(".weekly-coins"), summary.coins);
  }

  async function maybeShowPreviousWeek() {
    const summary = previousWeek;
    if (!summary || (!summary.matchesPlayed && !summary.expired && !summary.coins) || !weeklySummary.hidden) return;
    const key = `battle-picz.week-summary.${summary.playerId}.${summary.key}`;
    // Preserve acknowledgements already stored on this device, and sync them to the server.
    if (localStorage.getItem(key)) {
      backend.acknowledgeWeeklySummary(summary.key).catch(error =>
        console.warn('Could not sync weekly summary acknowledgement', error));
      return;
    }
    try {
      if (await backend.hasAcknowledgedWeeklySummary(summary.key)) {
        localStorage.setItem(key, 'shown');
        return;
      }
      if (previousWeek?.key === summary.key && weeklySummary.hidden) showWeeklySummary(summary);
    } catch (error) {
      // Don't repeatedly interrupt the player if the server is unreachable.
      console.warn('Weekly summary status unavailable', error);
    }
  }

  const ALERT_PROMPT_PREFIX = 'pic-rivals.alerts-onboarding.';
  let alertsPromptOpen = false;

  function offerAlertsAfterLogin() {
    const push = window.BattlePiczPush;
    const userId = backend.readSession()?.user?.id;
    if (!userId || !push || alertsPromptOpen || !push.available() ||
        !('Notification' in window) || Notification.permission !== 'default' ||
        push.enabled) return;
    const key = ALERT_PROMPT_PREFIX + userId;
    const requiresInstall = /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !((window.matchMedia?.('(display-mode: standalone)').matches) || navigator.standalone === true);
    const previousPrompt = localStorage.getItem(key);
    if (previousPrompt === 'seen' || (previousPrompt === 'needs-install' && requiresInstall)) return;
    // An install hint on Safari should not suppress the real opt-in after installation.
    localStorage.setItem(key, requiresInstall ? 'needs-install' : 'seen');
    alertsPromptOpen = true;
    const dialog = document.createElement('div');
    dialog.className = 'pic-alert-intro';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'pic-alert-intro-title');
    dialog.innerHTML = `
      <section class="pic-alert-intro-card">
        <span class="pic-alert-intro-icon" aria-hidden="true">🔔</span>
        <h2 id="pic-alert-intro-title">Never miss your turn!</h2>
        <p>Enable alerts to get updates when a friend plays, when it's your turn and when a result is ready.</p>
        ${requiresInstall ? '<p class="pic-alert-install-note">On iPhone, first add Pic Rivals to your Home Screen using Safari’s Share menu, then open it from there to enable notifications.</p>' : ''}
        <p class="pic-alert-intro-status" role="status" aria-live="polite" hidden></p>
        <button class="pic-alert-intro-allow" type="button">${requiresInstall ? 'GOT IT' : 'OK, ENABLE ALERTS'}</button>
        <button class="pic-alert-intro-later" type="button">NOT NOW</button>
      </section>`;
    const done = () => { dialog.remove(); alertsPromptOpen = false; };
    dialog.querySelector('.pic-alert-intro-later').onclick = done;
    dialog.querySelector('.pic-alert-intro-allow').onclick = () => {
      if (requiresInstall) { done(); return; }
      const allow = dialog.querySelector('.pic-alert-intro-allow');
      // The permission request must start synchronously from this tap on iOS.
      const result = push.enable();
      allow.disabled = true;
      const status = dialog.querySelector('.pic-alert-intro-status');
      Promise.resolve(result).then(done).catch(error => {
        status.hidden = false;
        status.textContent = error?.message || push.status();
        allow.disabled = false;
        if (Notification.permission === 'denied') allow.hidden = true;
      });
    };
    game.appendChild(dialog);
  }

  function notifyAboutNudges() { /* Background push handles delivery. */ }

  function setBusy(value, message) {
    busy = value;
    panel.classList.toggle('is-busy', value);
    list.setAttribute('aria-busy', String(value));
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
    state.textContent = (error?.message || 'Connection lost. Your player has been kept.') + ' Pull down and release to retry, or use Settings to sign in.';
  }

  async function loadMatches(message = 'Loading battles…') {
    if (busy) return;
    setBusy(true, message);
    try {
      const dashboard = await backend.getWeeklyDashboard();
      matches = dashboard.matches.map(exposeUnreadRoundResult);
      currentWeek = dashboard.current;
      previousWeek = dashboard.previous;
      balanceLabel.querySelector('.matches-coins-value').textContent = `${Number(dashboard.profile?.coins || 0).toLocaleString()} COINS`;
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

  async function shareChallenge(url) {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Pic Rivals', text: 'Can you beat my score on Pic Rivals?', url });
        return;
      } catch (error) {
        if (error.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      window.alert('Invite link copied. Paste it into a chat to challenge your friend.');
    } catch {
      window.prompt('Copy your Pic Rivals invite link:', url);
    }
  }
  window.sharePicRivalsChallenge = code => shareChallenge(backend.buildShareUrl(code));
  // Show once after the challenger's first completed round; sharing requires a user tap.
  window.showPicRivalsInvitePopup = (context, onClose) => {
    const match = context?.match || {};
    const code = match.invite_code || sessionStorage.getItem('battle-picz.pending-share-code');
    if (match.mode !== 'challenge' || match.status !== 'waiting' ||
        !code || context?.opponent || context?.currentRound !== 1) return false;
    const key = 'pic-rivals.share-prompt.' + match.id;
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, 'shown');
    const overlay = document.createElement('div');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Invite your friend');
    Object.assign(overlay.style, {position:'absolute',inset:'0',zIndex:'9999',display:'grid',
      placeItems:'center',background:'rgba(4,12,44,.84)',padding:'22px'});
    overlay.innerHTML = '<div style="width:100%;max-width:340px;border:2px solid #ff9b26;border-radius:20px;background:#103a83;color:white;padding:26px 20px;text-align:center;box-shadow:0 18px 60px #0008">' +
      '<div style="font-size:44px">🏆</div><h2 style="margin:10px 0">Round 1 complete!</h2>' +
      '<p style="line-height:1.5">Now challenge a friend to beat your score.</p>' +
      '<button data-invite-share style="width:100%;padding:15px;border:0;border-radius:12px;background:#ff9419;color:#192047;font-weight:900;font-size:17px">SHARE CHALLENGE</button>' +
      '<button data-invite-copy style="width:100%;margin-top:10px;padding:12px;border:1px solid #a4cfff;border-radius:12px;background:transparent;color:white;font-weight:700">COPY LINK</button>' +
      '<button data-invite-later style="margin-top:14px;padding:9px;border:0;background:transparent;color:#c9dcff">NOT NOW</button></div>';
    const dismiss = () => {overlay.remove(); onClose?.();};
    overlay.querySelector('[data-invite-share]').onclick = () => shareChallenge(backend.buildShareUrl(code));
    overlay.querySelector('[data-invite-copy]').onclick = async () => {
      const url = backend.buildShareUrl(code);
      try {await navigator.clipboard.writeText(url); overlay.querySelector('[data-invite-copy]').textContent='✓ LINK COPIED';}
      catch {window.prompt('Copy invite link:',url);}
    };
    overlay.querySelector('[data-invite-later]').onclick = dismiss;
    game.appendChild(overlay);
    return true;
  };


  trigger.onclick = () => open();
  // Only claim a downward gesture that began at the top of the games list.
  let pullStart = null;
  let pullDistance = 0;
  const pullThreshold = 65;
  function resetPull() {
    pullStart = null;
    pullDistance = 0;
    panel.style.removeProperty('--pull-distance');
    panel.style.removeProperty('--pull-rotation');
    panel.classList.remove('is-pulling', 'is-pull-refreshing');
    pullStatus.textContent = '';
  }
  async function refreshGames() {
    if (busy) return;
    pullStart = null;
    pullDistance = 0;
    panel.classList.remove('is-pulling');
    panel.classList.add('is-pull-refreshing');
    panel.style.setProperty('--pull-distance', '46px');
    pullStatus.textContent = 'Refreshing games…';
    try { await loadMatches(''); } finally { resetPull(); }
  }
  list.addEventListener('touchstart', event => {
    if (busy) return;
    resetPull();
    if (!busy && list.scrollTop <= 0 && event.touches.length === 1) {
      pullStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }
  }, { passive: true });
  list.addEventListener('touchmove', event => {
    if (!pullStart) return;
    if (event.touches.length !== 1) { resetPull(); return; }
    const dx = event.touches[0].clientX - pullStart.x;
    const dy = event.touches[0].clientY - pullStart.y;
    if (dy < 0 || Math.abs(dx) > Math.max(12, dy)) { resetPull(); return; }
    if (dy <= 8) return;
    if (event.cancelable) event.preventDefault();
    panel.classList.add('is-pulling');
    pullDistance = Math.min(dy, 110);
    panel.style.setProperty('--pull-rotation', `${pullDistance * 3}deg`);
    panel.style.setProperty('--pull-distance', `${Math.min(pullDistance * .55, 50)}px`);
    pullStatus.textContent = pullDistance >= pullThreshold ? 'Release to refresh' : 'Pull down to refresh';
  }, { passive: false });
  list.addEventListener('touchend', () => {
    const shouldRefresh = pullDistance >= pullThreshold;
    if (busy) return;
    if (shouldRefresh) void refreshGames();
    else resetPull();
  });
  list.addEventListener('touchcancel', () => { if (!busy) resetPull(); });
  list.addEventListener('keydown', event => {
    if (event.target === list && event.key.toLowerCase() === 'r' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      void refreshGames();
    }
  });
  window.addEventListener('battle-picz:profile-updated', () => loadMatches('Updating your profile…'));
  window.addEventListener('battle-picz:balance', event => {
    balanceLabel.querySelector('.matches-coins-value').textContent = `${Number(event.detail).toLocaleString()} COINS`;
  });
  window.addEventListener('battle-picz:settings-changed', event => {
    if (event.detail?.notificationsEnabled) notifyAboutNudges();
  });
  tabs.forEach(tab => tab.onclick = () => { activeTab = tab.dataset.tab; render(); });
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
  panel.querySelector('.weekly-continue').onclick = async () => {
    const acknowledged = shownSummaryKey;
    weeklySummary.hidden = true;
    shownSummaryKey = '';
    if (!acknowledged) return;
    const key = `battle-picz.week-summary.${acknowledged}`;
    localStorage.setItem(key, 'shown');
    const weekStart = acknowledged.slice(-10);
    try {
      await backend.acknowledgeWeeklySummary(weekStart);
    } catch (error) {
      console.warn('Will retry syncing weekly summary acknowledgement', error);
    }
  };

  const startGameMenu = panel.querySelector('.start-game-menu');
  const closeStartGameMenu = () => {
    startGameMenu.hidden = true;
    panel.querySelector('.matches-start').focus({ preventScroll: true });
  };
  panel.querySelector('.matches-start').onclick = () => {
    if (busy) return;
    startGameMenu.hidden = false;
    startGameMenu.querySelector('.matches-new').focus({ preventScroll: true });
  };
  startGameMenu.querySelector('.start-game-close').onclick = closeStartGameMenu;
  startGameMenu.addEventListener('click', event => {
    if (event.target === startGameMenu) closeStartGameMenu();
  });
  startGameMenu.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeStartGameMenu();
  });

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

  panel.querySelector('.matches-random').onclick = async () => {
    if (busy) return;
    setBusy(true, 'Finding a random opponent…');
    try {
      const result = await backend.findRandomChallenge();
      const match = await backend.getMatch(result.match_id);
      location.assign(matchUrl({id:result.match_id, match}));
    } catch (error) {
      showError(error);
    } finally {setBusy(false);}
  };

  panel.querySelector('.matches-code').onclick = async () => {
    const code = window.prompt('Enter the six-character challenge code:');
    if (code == null) return;
    startGameMenu.hidden = true;
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
    if (action === 'share') return shareChallenge(shareUrl(item));
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

  let inviteCode = backend.inviteCodeFromLocation();
  function prepareInvite() {
    panel.classList.add('show');
    trigger.hidden = true;
    inviteBanner.hidden = false;
    inviteCodeLabel.textContent = 'Accept to play your round.';
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
    const notificationParams = new URLSearchParams(location.search);
    const matchId = notificationParams.get('matchId');
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
      if (ownLabel) { ownLabel.textContent = ownNameValue; ownLabel.title = ownNameValue; ownLabel.setAttribute("aria-label", ownNameValue); }
      if (opponentLabel) { opponentLabel.textContent = opponentNameValue; opponentLabel.title = opponentNameValue; opponentLabel.setAttribute("aria-label", opponentNameValue); }
      const summaryOwnLabel = document.querySelector('.summary-players > span:first-child');
      const summaryOpponentLabel = document.querySelector('.summary-players > span:last-child');
      if (summaryOwnLabel) summaryOwnLabel.textContent = ownNameValue;
      if (summaryOpponentLabel) summaryOpponentLabel.textContent = opponentNameValue;
      const seenRoundKey = `battle-picz.seen-round.${matchId}`;
      const lastCompletedRound = matchContext.roundResults.length;
      const lastSeenRound = Number(localStorage.getItem(seenRoundKey) || 0);
      const requestedRound = Number(notificationParams.get('round'));
      if (notificationParams.get('screen') === 'results' &&
          Number.isSafeInteger(requestedRound) && requestedRound > 0 &&
          requestedRound <= lastCompletedRound) {
        const resultContext = backend.contextForRound(matchContext, requestedRound);
        if (resultContext.ownTurn && resultContext.opponentTurn) {
          window.BATTLE_PICZ_MATCH = resultContext;
          window.BATTLE_PICZ_NEXT_CONTEXT = matchContext;
          close();
          window.showBattlePiczMatchResult?.(resultContext);
          return;
        }
      }
      // A turn notification targets the currently playable round. If it is stale,
      // use the normal results/waiting flow rather than replaying a submitted turn.
      if (notificationParams.get('screen') === 'game' &&
          ((matchContext.canChoose && !matchContext.roundConfig) || matchContext.canPlay)) {
        close();
        window.startBattlePicz?.(matchContext);
      } else if (lastCompletedRound > lastSeenRound) {
        const nextContext = matchContext;
        const resultContext = backend.contextForRound(matchContext, lastCompletedRound);
        window.BATTLE_PICZ_MATCH = resultContext;
        window.BATTLE_PICZ_NEXT_CONTEXT = nextContext;
        window.showBattlePiczMatchResult?.(resultContext);
      } else if (matchContext.match.status === 'complete') {
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
    let nextContext;
    try {
      await backend.submitTurn(matchId, payload.roundNo, payload.score,
        payload.answers, payload.ghostTimeline, false);
    } catch (error) {
      nextContext = await backend.getMatchContext(matchId).catch(() => null);
      if (!nextContext || !backend.contextForRound(nextContext, payload.roundNo).ownTurn) throw error;
    }
    nextContext ||= await backend.getMatchContext(matchId);
    const resultContext = backend.contextForRound(nextContext, payload.roundNo);
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
    setTimeout(offerAlertsAfterLogin, 600);
  }

  window.addEventListener('battle-picz:auth-linked', event => {
    if (!event.detail?.error) setTimeout(offerAlertsAfterLogin, 300);
  });

  async function bootstrap() {
    // Auth may fall back to the original production domain. Return the fragment
    // to the branded app before consuming it or starting a guest session here.
    const callback = new URLSearchParams((location.hash || '').slice(1));
    const isAuthReturn = ['access_token', 'error', 'error_description'].some(key => callback.has(key));
    if (location.origin === 'https://battle-picz-game.vercel.app' && isAuthReturn) {
      const pending = backend.readPendingAuth();
      if (!pending || Date.now() - pending.startedAt > 60 * 60 * 1000) {
        location.replace('https://pic-rivals.vercel.app/' + location.search + location.hash);
        return;
      }
    }
    let authResult = null;
    let authError = null;
    try {
      const pendingInvite = backend.readPendingAuth?.()?.inviteCode;
      authResult = await backend.completeAuthRedirect();
      if (authResult?.user && !inviteCode) inviteCode = pendingInvite;
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

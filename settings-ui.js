(function () {
  const game = document.getElementById('game');
  const backend = window.battlePiczBackend;
  const prefs = window.battlePiczPreferences;
  const settingsButton = document.querySelector('.matches-settings');
  if (!game || !backend || !prefs || !settingsButton) return;

  const config = window.BATTLE_PICZ_SUPABASE || {};
  const screen = document.createElement('section');
  screen.className = 'settings-screen';
  screen.hidden = true;
  screen.setAttribute('role', 'dialog');
  screen.setAttribute('aria-modal', 'true');
  screen.setAttribute('aria-label', 'Settings');
  screen.innerHTML = `
    <header class="settings-header">
      <button class="settings-back" type="button" aria-label="Back to matches">‹</button>
      <h2>Settings</h2><span></span>
    </header>
    <div class="settings-scroll">
      <h3 class="settings-section-title">Profile</h3>
      <section class="settings-card">
        <div class="settings-profile">
          <div class="settings-avatar"><span></span></div>
          <div><h3 class="settings-player-name">Player</h3><p class="settings-account-status">Guest account · this device</p></div>
        </div>
        <div class="settings-stats">
          <div><strong data-stat="coins">—</strong><span>Coins</span></div>
          <div><strong data-stat="xp">—</strong><span>XP</span></div>
          <div><strong data-stat="wins">—</strong><span>Wins</span></div>
        </div>
        <button class="settings-row settings-edit-name" type="button">
          <span class="settings-row-icon">✎</span><span><strong>Player name</strong><small>Change the name friends see</small></span><span class="settings-chevron">›</span>
        </button>
      </section>

      <h3 class="settings-section-title">Secure your progress</h3>
      <section class="settings-card">
        <div class="settings-link-status">Guest games stay with this browser. Link a sign-in later to keep games, coins and XP when you change device.</div>
        <div class="settings-link-buttons">
          <button type="button" data-provider="apple">Apple</button>
          <button type="button" data-provider="google">Google</button>
          <button type="button" data-provider="email">Email</button>
        </div>
        <div class="settings-link-status settings-provider-status" role="status" aria-live="polite">Account linking will activate when the chosen Supabase providers are configured.</div>
      </section>

      <h3 class="settings-section-title">Game</h3>
      <section class="settings-card">
        <div class="settings-row">
          <span class="settings-row-icon">♪</span><span><strong>Sound effects</strong><small>Master preference for game audio</small></span>
          <button class="settings-switch settings-sound" type="button" role="switch" aria-label="Sound effects"></button>
        </div>
        <div class="settings-row">
          <span class="settings-row-icon">≡</span><span><strong>Round scores</strong><small>How score cards open by default</small></span>
          <div class="settings-segment" aria-label="Round score display"><button type="button" data-detail="false">Summary</button><button type="button" data-detail="true">Detailed</button></div>
        </div>
        <div class="settings-row">
          <span class="settings-row-icon">♢</span><span><strong>Turn alerts</strong><small class="settings-notification-copy">Browser notifications for nudges</small></span>
          <button class="settings-switch settings-notifications" type="button" role="switch" aria-label="Turn alerts"></button>
        </div>
      </section>
      <p class="settings-version">BATTLE PICZ · TEST BUILD</p>
    </div>
    <div class="settings-modal" hidden>
      <form class="settings-modal-card">
        <h3>Change player name</h3><p>This is what your friends will see.</p>
        <input name="display-name" minlength="2" maxlength="24" autocomplete="nickname" required>
        <div class="settings-modal-actions"><button class="settings-cancel-name" type="button">Cancel</button><button class="settings-save-name" type="submit">Save name</button></div>
        <div class="settings-modal-status" role="status" aria-live="polite"></div>
      </form>
    </div>
    <div class="settings-modal settings-email-modal" hidden>
      <form class="settings-modal-card settings-email-link-form">
        <h3>Secure with email</h3><p>We’ll send a verification link. Your current games, coins and XP stay with this player.</p>
        <input name="email" type="email" maxlength="254" autocomplete="email" placeholder="you@example.com" required>
        <div class="settings-modal-actions"><button class="settings-cancel-email" type="button">Cancel</button><button class="settings-save-name" type="submit">Send link</button></div>
        <div class="settings-modal-status settings-email-status" role="status" aria-live="polite"></div>
      </form>
    </div>`;
  game.append(screen);

  const soundSwitch = screen.querySelector('.settings-sound');
  const notificationsSwitch = screen.querySelector('.settings-notifications');
  const modal = screen.querySelector('.settings-modal');
  const nameInput = modal.querySelector('input');
  const modalStatus = modal.querySelector('.settings-modal-status');
  const emailModal = screen.querySelector('.settings-email-modal');
  const emailInput = emailModal.querySelector('input');
  const emailStatus = emailModal.querySelector('.settings-email-status');
  let profile = null;

  function setSwitch(button, value) {
    button.setAttribute('aria-checked', String(Boolean(value)));
  }

  function notificationAvailable() {
    return 'Notification' in window;
  }

  function renderPreferences() {
    setSwitch(soundSwitch, prefs.soundEnabled);
    const detailed = prefs.roundDetail;
    screen.querySelectorAll('[data-detail]').forEach(button => {
      button.classList.toggle('active', button.dataset.detail === String(detailed));
    });
    const canNotify = notificationAvailable();
    setSwitch(notificationsSwitch, canNotify && prefs.notificationsEnabled && Notification.permission === 'granted');
    notificationsSwitch.disabled = !canNotify;
    screen.querySelector('.settings-notification-copy').textContent = !canNotify
      ? 'Not available in this browser'
      : Notification.permission === 'denied'
        ? 'Blocked in browser settings'
        : Notification.permission === 'granted'
          ? 'Browser notifications for nudges'
          : 'Tap to allow browser notifications';
  }

  function renderProfile() {
    if (!profile) return;
    screen.querySelector('.settings-player-name').textContent = profile.display_name || 'Player';
    screen.querySelector('[data-stat="coins"]').textContent = Number(profile.coins || 0).toLocaleString();
    screen.querySelector('[data-stat="xp"]').textContent = Number(profile.xp || 0).toLocaleString();
    screen.querySelector('[data-stat="wins"]').textContent = Number(profile.games_won || 0).toLocaleString();
    const session = backend.readSession();
    const user = session?.user || {};
    const providers = (user.identities || []).map(identity => identity.provider);
    const emailLinked = providers.includes('email') || Boolean(user.email_confirmed_at);
    const linked = emailLinked || providers.some(provider => provider !== 'anonymous');
    screen.querySelector('.settings-account-status').textContent = linked ? 'Linked account · progress secured' : 'Guest account · this device';
    screen.querySelectorAll('[data-provider]').forEach(button => {
      const connected = providers.includes(button.dataset.provider) ||
        (button.dataset.provider === 'email' && emailLinked);
      button.classList.toggle('connected', connected);
      button.textContent = `${button.dataset.provider === 'apple' ? 'Apple' : button.dataset.provider === 'google' ? 'Google' : 'Email'}${connected ? ' ✓' : ''}`;
      button.disabled = connected;
    });
    const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || '';
    if (avatarUrl && /^https?:\/\//i.test(avatarUrl)) {
      const avatar = screen.querySelector('.settings-avatar');
      avatar.querySelector('img')?.remove();
      const image = document.createElement('img');
      image.src = avatarUrl;
      image.alt = '';
      avatar.append(image);
    }
  }

  async function openSettings() {
    screen.hidden = false;
    renderPreferences();
    try {
      profile = await backend.getProfile();
      renderProfile();
    } catch (error) {
      screen.querySelector('.settings-account-status').textContent = error?.message || 'Could not load profile';
    }
  }

  settingsButton.onclick = openSettings;
  screen.querySelector('.settings-back').onclick = () => { screen.hidden = true; };
  soundSwitch.onclick = () => {
    prefs.soundEnabled = !prefs.soundEnabled;
    renderPreferences();
    window.dispatchEvent(new CustomEvent('battle-picz:settings-changed', { detail: { soundEnabled: prefs.soundEnabled } }));
  };
  screen.querySelectorAll('[data-detail]').forEach(button => {
    button.onclick = () => {
      prefs.roundDetail = button.dataset.detail === 'true';
      renderPreferences();
    };
  });
  notificationsSwitch.onclick = async () => {
    if (!notificationAvailable()) return;
    const alreadyGranted = Notification.permission === 'granted';
    if (!alreadyGranted) await Notification.requestPermission();
    prefs.notificationsEnabled = Notification.permission === 'granted'
      ? (alreadyGranted ? !prefs.notificationsEnabled : true)
      : false;
    renderPreferences();
    window.dispatchEvent(new CustomEvent('battle-picz:settings-changed', { detail: { notificationsEnabled: prefs.notificationsEnabled } }));
  };
  screen.querySelector('.settings-edit-name').onclick = () => {
    nameInput.value = profile?.display_name || '';
    modalStatus.textContent = '';
    modal.hidden = false;
    nameInput.focus({ preventScroll: true });
    nameInput.select();
  };
  screen.querySelector('.settings-cancel-name').onclick = () => { modal.hidden = true; };
  screen.querySelector('.settings-cancel-email').onclick = () => { emailModal.hidden = true; };
  modal.querySelector('form').onsubmit = async event => {
    event.preventDefault();
    modalStatus.textContent = 'Saving…';
    try {
      const updated = await backend.updateDisplayName(nameInput.value);
      profile = { ...profile, ...updated };
      renderProfile();
      modal.hidden = true;
      window.dispatchEvent(new CustomEvent('battle-picz:profile-updated', { detail: updated }));
    } catch (error) {
      modalStatus.textContent = error?.message || 'Could not save your name';
    }
  };
  screen.querySelectorAll('[data-provider]').forEach(button => {
    button.onclick = async () => {
      const provider = button.dataset.provider;
      const label = provider === 'apple' ? 'Apple' : provider === 'google' ? 'Google' : 'Email';
      const configured = config.authProviders?.[provider] === true;
      if (provider === 'email' && configured) {
        emailStatus.textContent = '';
        emailInput.value = '';
        emailInput.disabled = false;
        emailModal.hidden = false;
        emailInput.focus({ preventScroll: true });
        return;
      }
      if (provider === 'google' && configured) {
        const status = screen.querySelector('.settings-provider-status');
        status.textContent = 'Opening Google…';
        try {
          location.assign(await backend.beginOAuth('google', { link: true }));
        } catch (error) {
          status.textContent = error?.message || 'Could not start Google linking.';
        }
        return;
      }
      screen.querySelector('.settings-provider-status').textContent = configured
        ? `${label} linking is not available in this test build yet.`
        : `${label} needs enabling in Supabase before account linking can go live.`;
    };
  });

  emailModal.querySelector('form').onsubmit = async event => {
    event.preventDefault();
    emailStatus.textContent = 'Sending verification email…';
    try {
      await backend.linkEmailIdentity(emailInput.value);
      emailStatus.textContent = 'Email sent. Open the link on this device to finish securing your player.';
      emailInput.disabled = true;
    } catch (error) {
      emailStatus.textContent = error?.message || 'Could not send the verification email.';
    }
  };

  window.addEventListener('battle-picz:auth-linked', async event => {
    await openSettings();
    const status = screen.querySelector('.settings-provider-status');
    if (event.detail?.error) {
      status.textContent = event.detail.error;
      return;
    }
    const label = event.detail?.provider === 'google' ? 'Google' : event.detail?.provider === 'email' ? 'Email' : 'Account';
    status.textContent = event.detail?.linked
      ? `${label} connected. Your games, coins and XP are secured.`
      : `Signed in with ${label}. Your player has been restored.`;
  });
})();

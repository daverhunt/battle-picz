(function () {
  let registration, subscribed = false, busy = false;
  const available = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const installed = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ios = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const backend = () => window.battlePiczBackend;
  function changed() { window.dispatchEvent(new CustomEvent('battle-picz:push-changed')); }
  function status() {
    if (ios() && !installed()) return 'Open from your Home Screen to enable alerts';
    if (!available()) return 'Push alerts are not supported in this browser';
    if (Notification.permission === 'denied') return 'Notifications blocked. Allow them in device Settings';
    return subscribed ? 'Turn, result and nudge alerts are on' : 'Tap to enable turn, result and nudge alerts';
  }
  async function ready() {
    if (!available()) throw new Error(status());
    registration ||= await navigator.serviceWorker.register('/sw.js');
    return navigator.serviceWorker.ready;
  }
  async function save(subscription) {
    if (!backend()?.readSession()?.user?.id) throw new Error('Sign in before enabling alerts');
    await backend().rpc('register_web_push', { p_subscription: subscription.toJSON() });
    subscribed = true;
    window.battlePiczPreferences.notificationsEnabled = true;
    changed();
  }
  async function enable() {
    if (busy) return;
    if (!available() || (ios() && !installed())) throw new Error(status());
    busy = true;
    try {
      // Must be called directly from a tap for iOS permission prompting.
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error(status());
      const reg = await ready();
      const key = await backend().rpc('web_push_public_key');
      const bytes = Uint8Array.from(atob(key.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
      const sub = await reg.pushManager.getSubscription() || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
      await save(sub);
    } finally { busy = false; changed(); }
  }
  async function disable() {
    const reg = await ready();
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await backend().rpc('unregister_web_push', { p_endpoint: sub.endpoint });
      await sub.unsubscribe();
    }
    subscribed = false;
    window.battlePiczPreferences.notificationsEnabled = false;
    changed();
  }
  async function sync() {
    if (!available() || !backend()?.readSession()?.user?.id) return;
    const reg = await ready();
    const sub = await reg.pushManager.getSubscription();
    subscribed = false;
    if (sub && Notification.permission === 'granted') await save(sub);
    changed();
  }
  window.BattlePiczPush = { available, status, enable, disable, sync, get enabled() { return subscribed; },
    async test() { if (!subscribed) throw new Error('Enable alerts first'); await backend().rpc('test_web_push'); }
  };
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  window.addEventListener('focus', () => sync().catch(() => {}));
  window.addEventListener('battle-picz:profile-updated', () => sync().catch(() => {}));
  sync().catch(() => {});
})();

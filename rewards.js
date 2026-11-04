/* Decorative reward feedback; coin balances remain server-owned. */
(function () {
  const runs = new WeakMap();
  window.picRivalsCelebrateCoins = function (container, amount) {
    const previous = runs.get(container);
    if (previous) previous.forEach(clearTimeout);
    container.querySelectorAll('.reward-coin-burst').forEach(node => node.remove());
    if (!(amount > 0)) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const burst = document.createElement('span');
    burst.className = 'reward-coin-burst';
    burst.setAttribute('aria-hidden', 'true');
    container.append(burst);
    const timers = [];
    runs.set(container, timers);
    for (let i = 0; i < Math.min(8, amount); i++) {
      const coin = document.createElement('span');
      coin.className = 'reward-flying-coin';
      coin.textContent = '★';
      coin.style.setProperty('--coin-x', `${(i % 5 - 2) * 25}px`);
      coin.style.animationDelay = `${i * 110}ms`;
      burst.append(coin);
      if (!reduced || i === 0) timers.push(setTimeout(() => {
        if (!document.hidden && container.getClientRects().length) window.battlePiczSound?.play('coin');
      }, reduced ? 0 : 280 + i * 110));
    }
    timers.push(setTimeout(() => { burst.remove(); runs.delete(container); }, 1900));
  };
})();

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BattlePiczImages = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function preloadRound(questions, ImageClass = Image) {
    return questions.map((question, index) => {
      const image = new ImageClass();
      image.fetchPriority = index === 0 ? 'high' : 'low';
      image.decoding = 'async';
      const ready = new Promise(resolve => {
        let settled = false;
        const finish = success => {
          if (settled) return;
          settled = true;
          image.onload = image.onerror = null;
          resolve(success);
        };
        image.onerror = () => finish(false);
        image.onload = async () => {
          try {
            if (image.decode) await image.decode();
            finish(image.naturalWidth > 0);
          } catch { finish(false); }
        };
        image.src = question.image;
        if (image.complete && image.naturalWidth > 0) image.onload();
      });
      return { image, ready };
    });
  }
  async function waitForPicture(entry, timeoutMs = 15000) {
    entry.image.fetchPriority = 'high';
    let timer;
    try {
      return await Promise.race([entry.ready, new Promise(resolve => {
        timer = setTimeout(() => resolve(false), timeoutMs);
      })]);
    } finally { clearTimeout(timer); }
  }
  return { preloadRound, waitForPicture };
});

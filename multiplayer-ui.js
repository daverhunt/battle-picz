(function () {
  const config = window.BATTLE_PICZ_SUPABASE || {};
  if (!window.BattlePiczBackend) return;
  const backend = new window.BattlePiczBackend(config);
  window.battlePiczBackend = backend;
  if (!backend.configured) return;

  const game = document.getElementById('game');
  const trigger = document.createElement('button');
  trigger.className = 'match-button';
  trigger.textContent = 'Friends';
  trigger.setAttribute('aria-haspopup', 'dialog');

  const panel = document.createElement('section');
  panel.className = 'match-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.innerHTML = `
    <h2>PLAY A FRIEND</h2>
    <p id="matchStatus">Create a private challenge link to send in WhatsApp or Messages.</p>
    <div id="matchCode" class="match-code" hidden></div>
    <div class="match-actions">
      <button id="createChallenge">CREATE CHALLENGE</button>
      <button id="joinChallenge" hidden>JOIN CHALLENGE</button>
      <button id="copyChallenge" hidden>COPY LINK</button>
      <button id="refreshMatch" hidden>REFRESH MATCH</button>
      <button class="match-close" id="closeMatches">BACK TO GAME</button>
    </div>`;
  game.append(trigger, panel);

  const status = panel.querySelector('#matchStatus');
  const codeLabel = panel.querySelector('#matchCode');
  const createButton = panel.querySelector('#createChallenge');
  const joinButton = panel.querySelector('#joinChallenge');
  const copyButton = panel.querySelector('#copyChallenge');
  const refreshButton = panel.querySelector('#refreshMatch');
  const closeButton = panel.querySelector('#closeMatches');
  let shareUrl = '';
  let matchContext = null;

  function setBusy(busy) {
    [createButton, joinButton, copyButton, refreshButton, closeButton].forEach(button => button.disabled = busy);
  }

  function showError(error) {
    status.className = 'match-error';
    status.textContent = error?.message || 'Something went wrong. Please try again.';
  }

  function open() {
    panel.classList.add('show');
    trigger.hidden = true;
  }

  function enterMatch(match) {
    const url = new URL(location.href);
    url.searchParams.delete('challenge');
    url.searchParams.set('match', match.seed);
    url.searchParams.set('matchId', match.id);
    location.assign(url.toString());
  }

  trigger.onclick = open;
  closeButton.onclick = () => {
    panel.classList.remove('show');
    trigger.hidden = false;
  };

  createButton.onclick = async () => {
    setBusy(true);
    status.className = '';
    status.textContent = 'Creating your challenge…';
    try {
      const challenge = await backend.createChallenge({ version: 1 });
      const match = await backend.getMatch(challenge.match_id);
      shareUrl = challenge.share_url;
      codeLabel.hidden = false;
      codeLabel.textContent = challenge.invite_code;
      status.textContent = 'Your challenge is ready. Copy the link and send it to your friend.';
      createButton.hidden = true;
      copyButton.hidden = false;
      sessionStorage.setItem('battle-picz.pending-share-url', shareUrl);
      sessionStorage.setItem('battle-picz.pending-share-code', challenge.invite_code);
      const url = new URL(location.href);
      url.searchParams.set('match', match.seed);
      url.searchParams.set('matchId', match.id);
      location.assign(url.toString());
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };

  copyButton.onclick = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      status.textContent = 'Challenge link copied.';
    } catch {
      window.prompt('Copy this challenge link:', shareUrl);
    }
  };

  const inviteCode = backend.inviteCodeFromLocation();
  if (inviteCode) {
    open();
    createButton.hidden = true;
    joinButton.hidden = false;
    codeLabel.hidden = false;
    codeLabel.textContent = inviteCode;
    status.textContent = 'You have been challenged. Join to play the same match.';
    joinButton.onclick = async () => {
      setBusy(true);
      status.className = '';
      status.textContent = 'Joining challenge…';
      try {
        enterMatch(await backend.joinChallenge(inviteCode));
      } catch (error) {
        showError(error);
        setBusy(false);
      }
    };
  } else {
    shareUrl = sessionStorage.getItem('battle-picz.pending-share-url') || '';
    const pendingCode = sessionStorage.getItem('battle-picz.pending-share-code') || '';
    if (shareUrl && pendingCode) {
      codeLabel.hidden = false;
      codeLabel.textContent = pendingCode;
      createButton.hidden = true;
      copyButton.hidden = false;
    }
  }

  async function initialiseMatch() {
    const matchId = new URLSearchParams(location.search).get('matchId');
    if (!matchId) return;
    setBusy(true);
    try {
      matchContext = await backend.getMatchContext(matchId, 1);
      window.BATTLE_PICZ_MATCH = matchContext;
      const opponentName = matchContext.opponent?.profiles?.display_name || 'OPPONENT';
      const opponentLabel = document.querySelector('.pname.opp');
      if (opponentLabel) opponentLabel.textContent = opponentName;
      if (matchContext.ownTurn) {
        if (matchContext.opponentTurn) {
          refreshButton.hidden = true;
          panel.classList.remove('show');
          trigger.hidden = false;
          window.showBattlePiczMatchResult?.(matchContext);
        } else {
          open();
          createButton.hidden = true;
          joinButton.hidden = true;
          copyButton.hidden = !shareUrl;
          refreshButton.hidden = false;
          codeLabel.hidden = true;
          status.className = '';
          status.textContent = 'Your round is saved. Waiting for your opponent — tap refresh when they have played.';
        }
      } else if (matchContext.roundConfig || matchContext.canChoose) {
        refreshButton.hidden = true;
        panel.classList.remove('show');
        trigger.hidden = false;
        window.startBattlePicz?.(matchContext);
      } else {
        open();
        createButton.hidden = true;
        joinButton.hidden = true;
        copyButton.hidden = true;
        refreshButton.hidden = false;
        codeLabel.hidden = true;
        status.className = '';
        status.textContent = 'Waiting for your opponent to choose the round. Pull down or tap refresh after they have chosen.';
      }
    } catch (error) {
      open();
      showError(error);
      refreshButton.hidden = false;
    } finally {
      setBusy(false);
    }
  }

  refreshButton.onclick = initialiseMatch;

  window.battlePiczSaveRound = async payload => {
    if (!matchContext) throw new Error('Match is not ready');
    await backend.submitTurn(
      matchContext.match.id,
      payload.roundNo,
      payload.score,
      payload.answers,
      payload.ghostTimeline,
      true
    );
    matchContext = await backend.getMatchContext(matchContext.match.id, payload.roundNo);
    window.BATTLE_PICZ_MATCH = matchContext;
    return matchContext;
  };

  if (!inviteCode) initialiseMatch();
})();

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { BattlePiczBackend } = require("../multiplayer.js");

test("offers the next round only when a later round is actionable", () => {
  assert.deepEqual(
    BattlePiczBackend.nextRoundAction(
      {
        currentRound: 2,
        canChoose: true,
        canPlay: false,
        roundConfig: null,
      },
      1,
    ),
    { available: true, roundNo: 2, mode: "choose" },
  );

  assert.deepEqual(
    BattlePiczBackend.nextRoundAction(
      {
        currentRound: 2,
        canChoose: false,
        canPlay: true,
        roundConfig: { category: "SPORT", difficulty: "medium" },
      },
      1,
    ),
    { available: true, roundNo: 2, mode: "play" },
  );

  assert.equal(
    BattlePiczBackend.nextRoundAction(
      {
        currentRound: 2,
        canChoose: false,
        canPlay: false,
        roundConfig: null,
      },
      1,
    ).available,
    false,
  );
});

test("uses an inline coin step and never reloads to advance a round", () => {
  const html = fs.readFileSync(
    path.join(__dirname, "..", "index.html"),
    "utf8",
  );
  assert.match(html, /roundSummary\.insertBefore\(coinReward,\s*seeResult\)/);
  assert.match(html, /roundSummary\.appendChild\(resultActions\)/);
  assert.match(html, /seeResult\.remove\(\)/);
  assert.match(html, /lobby\.hidden\s*=\s*false/);
  assert.match(html, /showNext\s*\?\s*"1fr 1fr"\s*:\s*"1fr"/);
  assert.match(html, /actions\.style\.visibility\s*=\s*"visible"/);
  assert.match(html, /reward\.style\.visibility\s*=\s*"visible"/);
  assert.match(html, /visibility:\s*"hidden"/);
  assert.match(
    html,
    /await window\.battlePiczBackend\.getMatchContext\(MATCH_ID\)/,
  );
  assert.equal(html.includes("return location.reload()"), false);
});

test("puts unseen round results in My Turn without waiting for the next round", () => {
  const ui = fs.readFileSync(
    path.join(__dirname, "..", "multiplayer-ui.js"),
    "utf8",
  );
  assert.match(ui, /function exposeUnreadRoundResult\(item\)/);
  assert.match(ui, /bucket:\s*'your-turn'/);
  assert.match(ui, /action:\s*'result'/);
  assert.match(ui, /dashboard\.matches\.map\(exposeUnreadRoundResult\)/);
  assert.match(ui, /ROUND \$\{item\.resultRound \|\| item\.currentRound\} RESULTS/);
});

test("uses played pictures and unambiguous player cards", () => {
  const html = fs.readFileSync(
    path.join(__dirname, "..", "index.html"),
    "utf8",
  );
  const ui = fs.readFileSync(
    path.join(__dirname, "..", "multiplayer-ui.js"),
    "utf8",
  );

  assert.match(html, /<img src=\"' \+\s*r\.image/);
  assert.match(html, /image:\s*question\.image/);
  assert.match(ui, /function opponentAvatar\(item\)/);
  assert.match(ui, /match-card-avatar/);
  assert.match(ui, /hasActiveReceivedNudge/);
  assert.equal(ui.includes("categoryImages"), false);
});

test("renders reset scores before a fresh round starts", () => {
  const html = fs.readFileSync(
    path.join(__dirname, "..", "index.html"),
    "utf8",
  );
  const resetIndex = html.indexOf("my = 0;\n          opp = 0;");
  const myScoreRender = html.indexOf(
    '$("myscore").textContent = my.toLocaleString();',
    resetIndex,
  );
  const startQuestion = html.indexOf("startQ(saved);", resetIndex);
  assert.ok(resetIndex > -1, "fresh rounds reset their score values");
  assert.ok(myScoreRender > resetIndex, "the reset player score is rendered");
  assert.ok(myScoreRender < startQuestion, "the reset is visible before question one starts");
  assert.match(html.slice(myScoreRender, startQuestion), /opscore/);
});

test("gates first launch behind guest onboarding with honest provider states", () => {
  const ui = fs.readFileSync(
    path.join(__dirname, "..", "multiplayer-ui.js"),
    "utf8",
  );
  const css = fs.readFileSync(
    path.join(__dirname, "..", "multiplayer.css"),
    "utf8",
  );

  assert.match(ui, /battle-picz\.onboarding-complete/);
  assert.match(ui, /welcome\.className = 'welcome-screen'/);
  assert.match(ui, /data-auth="guest"/);
  assert.match(ui, /data-provider="apple"/);
  assert.match(ui, /data-provider="google"/);
  assert.match(ui, /MORE SIGN-IN OPTIONS/);
  assert.match(ui, /await backend\.updateDisplayName\(displayName\)/);
  assert.match(ui, /localStorage\.setItem\(ONBOARDING_KEY, 'guest'\)/);
  assert.match(ui, /authResult = await backend\.completeAuthRedirect\(\)/);
  assert.match(ui, /if \(onboarded\) startApplication\(\)/);
  assert.match(ui, /welcome-email-form/);
  assert.match(ui, /showWelcomeScreen\(authError\?\.message \|\| ''\)/);
  assert.match(ui, /await backend\.sendEmailSignIn\(emailInput\.value\)/);
  assert.match(ui, /setWelcomeBusy\(false\);\s*setWelcomeStatus\('Email sent/);
  assert.match(css, /\.welcome-apple\{[^}]*background:#111[^}]*color:#fff/);
});

test('links guest accounts from settings without replacing the player', () => {
  const settings = fs.readFileSync(path.join(__dirname, '..', 'settings-ui.js'), 'utf8');
  const config = fs.readFileSync(path.join(__dirname, '..', 'supabase-config.js'), 'utf8');
  assert.match(settings, /await backend\.linkEmailIdentity\(emailInput\.value\)/);
  assert.match(settings, /await backend\.beginOAuth\('google', \{ link: true \}\)/);
  assert.match(settings, /battle-picz:auth-linked/);
  assert.match(settings, /user\.email_confirmed_at/);
  assert.match(config, /email: true/);
});

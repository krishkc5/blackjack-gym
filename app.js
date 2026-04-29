const DEALER_UPCARDS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "A"];
const SUITS = ["♠", "♥", "♦", "♣"];
const ACTIONS = {
  H: { label: "Hit", css: "cell-H" },
  S: { label: "Stand", css: "cell-S" },
  D: { label: "Double", css: "cell-D" },
  DS: { label: "Double", css: "cell-DS" },
  P: { label: "Split", css: "cell-P" },
  R: { label: "Surrender", css: "cell-R" },
};
const STORAGE_KEY = "blackjack-gym.stats.v1";
const CATEGORY_LABELS = {
  hard: "Hard totals",
  soft: "Soft totals",
  pair: "Pairs",
};

const state = {
  focus: "all",
  current: null,
  locked: false,
  learnLesson: "foundations",
  learnCurrent: null,
  learnLocked: false,
  stats: loadStats(),
};

const els = {
  views: document.querySelectorAll("[data-view]"),
  viewButtons: document.querySelectorAll("[data-view-button]"),
  dealerCards: document.querySelector("#dealer-cards"),
  playerCards: document.querySelector("#player-cards"),
  handTag: document.querySelector("#hand-tag"),
  actionButtons: document.querySelectorAll("[data-action]"),
  feedbackZone: document.querySelector("#feedback-zone"),
  feedbackTitle: document.querySelector("#feedback-title"),
  feedbackCopy: document.querySelector("#feedback-copy"),
  nextButton: document.querySelector("#next-btn"),
  lessonList: document.querySelector("#lesson-list"),
  lessonKicker: document.querySelector("#lesson-kicker"),
  lessonTitle: document.querySelector("#lesson-title"),
  learnDealerCards: document.querySelector("#learn-dealer-cards"),
  learnPlayerCards: document.querySelector("#learn-player-cards"),
  learnHandTag: document.querySelector("#learn-hand-tag"),
  learnActionButtons: document.querySelectorAll("[data-learn-action]"),
  learnFeedbackZone: document.querySelector("#learn-feedback-zone"),
  learnFeedbackTitle: document.querySelector("#learn-feedback-title"),
  learnFeedbackCopy: document.querySelector("#learn-feedback-copy"),
  learnNextButton: document.querySelector("#learn-next-btn"),
  coachTitle: document.querySelector("#coach-title"),
  coachCopy: document.querySelector("#coach-copy"),
  coachRule: document.querySelector("#coach-rule"),
  hintButton: document.querySelector("#hint-btn"),
  hintCopy: document.querySelector("#hint-copy"),
  focusButtons: document.querySelectorAll("[data-focus]"),
  spotCategory: document.querySelector("#spot-category"),
  spotPlayer: document.querySelector("#spot-player"),
  spotDealer: document.querySelector("#spot-dealer"),
  spotLoad: document.querySelector("#spot-load"),
  statAccuracy: document.querySelector("#stat-accuracy"),
  statStreak: document.querySelector("#stat-streak"),
  statMastery: document.querySelector("#stat-mastery"),
  statHands: document.querySelector("#stat-hands"),
  sessionStrip: document.querySelector("#session-strip"),
  todayBadge: document.querySelector("#today-badge"),
  todayFill: document.querySelector("#today-fill"),
  categoryList: document.querySelector("#category-list"),
  weakList: document.querySelector("#weak-list"),
  masteryGrid: document.querySelector("#mastery-grid"),
  strategySections: document.querySelector("#strategy-sections"),
  resetStats: document.querySelector("#reset-stats"),
};

const SCENARIOS = buildScenarios();
const LESSONS = buildLessons();

init();

function init() {
  renderStrategy();
  renderLessons();
  populateSpotControls();
  wireEvents();
  syncStats();
  startLearnLesson(state.learnLesson);
  nextHand();
}

function wireEvents() {
  els.viewButtons.forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.viewButton));
  });

  els.lessonList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-lesson]");
    if (!button) return;
    startLearnLesson(button.dataset.lesson);
  });

  els.focusButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.focus = button.dataset.focus;
      els.focusButtons.forEach((item) => item.classList.toggle("is-active", item === button));
      nextHand();
    });
  });

  els.actionButtons.forEach((button) => {
    button.addEventListener("click", () => submitAnswer(button.dataset.action));
  });

  els.learnActionButtons.forEach((button) => {
    button.addEventListener("click", () => submitLearnAnswer(button.dataset.learnAction));
  });

  els.nextButton.addEventListener("click", nextHand);
  els.learnNextButton.addEventListener("click", nextLearnSpot);
  els.hintButton.addEventListener("click", toggleHint);
  els.spotCategory.addEventListener("change", populateSpotPlayers);
  els.spotLoad.addEventListener("click", loadSelectedSpot);
  els.resetStats.addEventListener("click", resetStats);

  document.addEventListener("keydown", (event) => {
    if (event.target.closest("button, a, input, textarea, select")) return;

    const keyMap = {
      h: "H",
      s: "S",
      d: "D",
      p: "P",
      r: "R",
      Enter: "NEXT",
      " ": "NEXT",
    };
    const action = keyMap[event.key];
    if (!action) return;

    event.preventDefault();
    const activeView = document.querySelector(".view.is-active")?.dataset.view;
    if (action === "NEXT") {
      if (activeView === "learn" && state.learnLocked) nextLearnSpot();
      if (activeView === "gym" && state.locked) nextHand();
      return;
    }

    if (activeView === "learn") {
      submitLearnAnswer(action);
      return;
    }
    if (activeView === "gym") submitAnswer(action);
  });
}

function setView(viewName) {
  els.views.forEach((view) => view.classList.toggle("is-active", view.dataset.view === viewName));
  els.viewButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.viewButton === viewName);
  });
  if (viewName === "progress") syncStats();
}

function nextHand() {
  const pool = getScenarioPool(state.focus);
  setGymScenario(pickScenario(pool));
}

function setGymScenario(scenario, intro = "Choose an action.") {
  state.current = scenario;
  state.locked = false;

  els.feedbackZone.classList.remove("is-correct", "is-wrong");
  els.feedbackTitle.textContent = intro;
  els.feedbackCopy.textContent = "";
  els.nextButton.disabled = true;
  els.actionButtons.forEach((button) => {
    button.disabled = false;
    button.classList.remove("is-correct-choice", "is-wrong-choice");
  });

  renderHand(state.current);
}

function submitAnswer(action) {
  if (state.locked || !state.current) return;

  const scenario = state.current;
  const correct = action === scenario.answer;
  const correctAction = ACTIONS[scenario.answer];
  const chosenAction = ACTIONS[action];

  recordAttempt(scenario, correct);
  state.locked = true;

  els.feedbackZone.classList.add(correct ? "is-correct" : "is-wrong");
  els.feedbackTitle.textContent = correct ? "Correct." : `${correctAction.label}, not ${chosenAction.label}.`;
  els.feedbackCopy.textContent = scenario.reason;
  els.nextButton.disabled = false;

  els.actionButtons.forEach((button) => {
    button.disabled = true;
    const buttonAction = button.dataset.action;
    button.classList.toggle("is-correct-choice", buttonAction === scenario.answer);
    button.classList.toggle("is-wrong-choice", buttonAction === action && !correct);
  });

  syncStats();
}

function renderHand(scenario) {
  els.handTag.textContent = scenario.label;
  els.dealerCards.replaceChildren(createCard(scenario.dealer));
  els.playerCards.replaceChildren(...scenario.player.map(createCard));
}

function renderLessons() {
  const buttons = LESSONS.map((lesson) => {
    const item = state.stats.lessons[lesson.id] ?? { total: 0, correct: 0 };
    const pool = getLessonPool(lesson);
    const accuracy = percent(item.correct, item.total);
    const button = document.createElement("button");
    button.className = "lesson-card";
    button.type = "button";
    button.dataset.lesson = lesson.id;
    button.classList.toggle("is-active", lesson.id === state.learnLesson);
    button.innerHTML = `
      <span class="lesson-card-title">${lesson.title}</span>
      <span class="lesson-card-copy">${lesson.description}</span>
      <span class="lesson-card-meta">${item.total} reps · ${accuracy}% · ${pool.length} spots</span>
    `;
    return button;
  });

  els.lessonList.replaceChildren(...buttons);
}

function startLearnLesson(lessonId) {
  state.learnLesson = lessonId;
  renderLessons();
  nextLearnSpot();
}

function nextLearnSpot() {
  const lesson = currentLesson();
  const pool = getLessonPool(lesson);
  const progress = state.stats.lessons[lesson.id] ?? { total: 0 };
  const scenario = pool[progress.total % pool.length];
  setLearnScenario(scenario, lesson);
}

function setLearnScenario(scenario, lesson) {
  const coach = coachForScenario(scenario, lesson);
  state.learnCurrent = scenario;
  state.learnLocked = false;

  els.lessonKicker.textContent = lesson.kicker;
  els.lessonTitle.textContent = lesson.title;
  els.learnHandTag.textContent = scenario.label;
  els.learnDealerCards.replaceChildren(createCard(scenario.dealer));
  els.learnPlayerCards.replaceChildren(...scenario.player.map(createCard));
  els.coachTitle.textContent = coach.title;
  els.coachCopy.textContent = coach.copy;
  els.coachRule.textContent = coach.rule;
  els.hintCopy.textContent = coach.hint;
  els.hintCopy.hidden = true;
  els.hintButton.textContent = "Show hint";

  els.learnFeedbackZone.classList.remove("is-correct", "is-wrong");
  els.learnFeedbackTitle.textContent = "Choose an action.";
  els.learnFeedbackCopy.textContent = "";
  els.learnNextButton.disabled = true;
  els.learnActionButtons.forEach((button) => {
    button.disabled = false;
    button.classList.remove("is-correct-choice", "is-wrong-choice");
  });
}

function submitLearnAnswer(action) {
  if (state.learnLocked || !state.learnCurrent) return;

  const lesson = currentLesson();
  const scenario = state.learnCurrent;
  const correct = action === scenario.answer;
  const correctAction = ACTIONS[scenario.answer];
  const chosenAction = ACTIONS[action];
  const coach = coachForScenario(scenario, lesson);

  recordLessonAttempt(lesson.id, correct);
  state.learnLocked = true;

  els.learnFeedbackZone.classList.add(correct ? "is-correct" : "is-wrong");
  els.learnFeedbackTitle.textContent = correct
    ? `Correct: ${correctAction.label}.`
    : `${correctAction.label}, not ${chosenAction.label}.`;
  els.learnFeedbackCopy.textContent = `${scenario.reason} ${coach.after}`;
  els.learnNextButton.disabled = false;

  els.learnActionButtons.forEach((button) => {
    button.disabled = true;
    const buttonAction = button.dataset.learnAction;
    button.classList.toggle("is-correct-choice", buttonAction === scenario.answer);
    button.classList.toggle("is-wrong-choice", buttonAction === action && !correct);
  });

  renderLessons();
}

function recordLessonAttempt(lessonId, correct) {
  state.stats.lessons ??= {};
  state.stats.lessons[lessonId] ??= { total: 0, correct: 0 };
  const item = state.stats.lessons[lessonId];
  item.total += 1;
  item.correct += correct ? 1 : 0;
  item.last = Date.now();
  saveStats();
}

function toggleHint() {
  const hidden = !els.hintCopy.hidden;
  els.hintCopy.hidden = hidden;
  els.hintButton.textContent = hidden ? "Show hint" : "Hide hint";
}

function currentLesson() {
  return LESSONS.find((lesson) => lesson.id === state.learnLesson) ?? LESSONS[0];
}

function getLessonPool(lesson) {
  if (lesson.ids) {
    return lesson.ids.map((id) => SCENARIOS.find((scenario) => scenario.id === id)).filter(Boolean);
  }
  return SCENARIOS.filter(lesson.selector);
}

function coachForScenario(scenario, lesson) {
  const dealer = upcardValue(scenario.dealerRank);
  const dealerText = dealer >= 7 || dealer === 11 ? "strong" : dealer >= 4 && dealer <= 6 ? "vulnerable" : "mixed";
  const action = ACTIONS[scenario.answer].label.toLowerCase();
  const base = {
    title: `${scenario.label} vs dealer ${scenario.dealerRank}`,
    copy: `${lesson.principle} This dealer upcard is ${dealerText}, so the decision is about whether to protect a made hand, attack with a double, or improve a weak hand.`,
    rule: scenario.reason,
    hint: `You are looking for ${action}.`,
    after: "Keep the pattern, not the exact cards, in your head.",
  };

  if (scenario.category === "hard") return hardCoach(scenario, base);
  if (scenario.category === "soft") return softCoach(scenario, base);
  return pairCoach(scenario, base);
}

function hardCoach(scenario, base) {
  const total = Number(scenario.label.replace("Hard ", ""));
  if (scenario.answer === "R") {
    return {
      ...base,
      copy: `Hard ${total} is a stiff hand against one of the dealer's best upcards. Late surrender matters before hit or stand.`,
      rule: "Use surrender only on hard 16 vs 9, 10, A and hard 15 vs 10.",
      hint: "Ask: is this one of the few late-surrender spots?",
      after: "Surrender is not giving up; it is saving half a bet in the worst matchups.",
    };
  }
  if (scenario.answer === "D") {
    return {
      ...base,
      copy: `Hard ${total} has a strong one-card upside. Doubling is about pressing when your next card can make a powerful total.`,
      rule: "Double 11 against everything, 10 against 2-9, and 9 against 3-6.",
      hint: "If one good card makes 18-21 and the dealer is not too strong, look for double.",
      after: "The double spots are small in number, so they become fast once grouped.",
    };
  }
  if (scenario.answer === "S") {
    return {
      ...base,
      copy: `Hard ${total} is already made or the dealer is vulnerable enough that standing is better than drawing.`,
      rule: "Stand on 17+, stand 13-16 vs 2-6, and stand 12 vs 4-6.",
      hint: "Dealer 2-6 is where stiff hands often stop drawing.",
      after: "Most hard-total stand decisions come from letting weak dealer cards break.",
    };
  }
  return {
    ...base,
    copy: `Hard ${total} is not strong enough to keep as-is against this upcard.`,
    rule: "Hit hard 8 or less, hit 12 vs 2-3 and 7-A, and hit 13-16 vs 7-A unless surrender applies.",
    hint: "If standing waits for the dealer to fail and the dealer is not vulnerable, improve your hand.",
    after: "Hard-total hits are usually the spots where your total is weak and the dealer is not under pressure.",
  };
}

function softCoach(scenario, base) {
  const side = Number(scenario.label.split(",")[1]);
  const total = side + 11;
  if (scenario.answer === "D") {
    return {
      ...base,
      copy: `Soft ${total} cannot bust on one card, so the ace lets you attack dealer weakness.`,
      rule: "Double soft 13-14 vs 5-6, soft 15-16 vs 4-6, soft 17-18 vs 2-6, and soft 19 vs 6.",
      hint: "Soft double decisions cluster around dealer 4-6, with stronger soft totals widening a bit.",
      after: "Soft hands are flexible; use that flexibility to double when the dealer is exposed.",
    };
  }
  if (scenario.answer === "S") {
    return {
      ...base,
      copy: `Soft ${total} is strong enough to keep. The ace gives protection, but the total is already doing its job.`,
      rule: "Stand on soft 19+, and stand soft 18 vs 7-8.",
      hint: "Soft 18 is the pivot: stand against 7-8, hit against 9-A, double against 2-6.",
      after: "Soft standing spots are about respecting that 18 or 19 is already a real hand.",
    };
  }
  return {
    ...base,
    copy: `Soft ${total} needs more value and is not in a profitable double spot.`,
    rule: "Hit soft totals when the dealer is too strong for a double and the hand is not strong enough to stand.",
    hint: "If the dealer is 7-A and the soft hand is below 19, check whether it needs a hit.",
    after: "The ace protects the draw, so hitting these soft totals is less scary than it looks.",
  };
}

function pairCoach(scenario, base) {
  const rank = scenario.player[0].rank;
  if (scenario.answer === "P") {
    return {
      ...base,
      copy: `A pair is a chance to turn one awkward hand into two better starting hands.`,
      rule: "Always split aces and 8s. Split 2s, 3s, 6s, and 7s against weak/mid dealer cards; split 9s except vs 7, 10, A.",
      hint: "First memorize the always-split hands: aces and 8s.",
      after: "Pair strategy starts with the rank, then narrows by dealer upcard.",
    };
  }
  if (scenario.answer === "D") {
    return {
      ...base,
      copy: "A pair of 5s is really hard 10, and hard 10 is a double spot against most dealer cards.",
      rule: "Never split 5s; play them as hard 10.",
      hint: "Two 5s make 10, not two weak hands.",
      after: "This is why pair recognition matters before you reach for the split button.",
    };
  }
  if (scenario.answer === "S") {
    return {
      ...base,
      copy: `This pair is already valuable enough to keep together against dealer ${scenario.dealerRank}.`,
      rule: "Never split 10s, and keep 9s together against 7, 10, and A.",
      hint: rank === "10" ? "Twenty is already the prize." : "Some 9,9 spots are stands, not splits.",
      after: "Do not turn a strong made hand into extra variance without an edge.",
    };
  }
  return {
    ...base,
    copy: `Splitting this pair does not create enough value against dealer ${scenario.dealerRank}.`,
    rule: "When a small pair is not a split, play it as the matching hard total.",
    hint: "Small pairs stop splitting as the dealer upcard gets stronger.",
    after: "When the split disappears, go back to the hard-total logic.",
  };
}

function populateSpotControls() {
  const dealerOptions = DEALER_UPCARDS.map((rank) => optionNode(rank, rank));
  els.spotDealer.replaceChildren(...dealerOptions);
  els.spotDealer.value = "10";
  populateSpotPlayers();
}

function populateSpotPlayers() {
  const category = els.spotCategory.value;
  const hands = spotHandsFor(category);
  els.spotPlayer.replaceChildren(...hands.map((hand) => optionNode(hand.value, hand.label)));
  els.spotPlayer.value = category === "hard" ? "Hard 16" : hands[0].value;
}

function spotHandsFor(category) {
  if (category === "soft") {
    return [9, 8, 7, 6, 5, 4, 3, 2].map((side) => ({ value: `A,${side}`, label: `A,${side}` }));
  }
  if (category === "pair") {
    return ["A", "10", "9", "8", "7", "6", "5", "4", "3", "2"].map((rank) => ({
      value: `${rank === "10" ? "T" : rank},${rank === "10" ? "T" : rank}`,
      label: `${rank},${rank}`,
    }));
  }
  return Array.from({ length: 15 }, (_, index) => {
    const total = index + 5;
    return { value: `Hard ${total}`, label: `Hard ${total}` };
  });
}

function optionNode(value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

function loadSelectedSpot() {
  const scenario = SCENARIOS.find((item) => (
    item.category === els.spotCategory.value
    && item.label === els.spotPlayer.value
    && item.dealerRank === els.spotDealer.value
  ));
  if (!scenario) return;
  setGymScenario(scenario, "Spot loaded.");
}

function createCard(card) {
  const suit = card.suit ?? randomSuit();
  const node = document.createElement("div");
  node.className = `playing-card ${suit === "♥" || suit === "♦" ? "is-red" : ""}`;
  node.setAttribute("aria-label", `${card.rank} of ${suitName(suit)}`);
  node.innerHTML = `
    <span class="rank">${card.rank}</span>
    <span class="suit" aria-hidden="true">${suit}</span>
    <span class="rank corner" aria-hidden="true">${card.rank}</span>
  `;
  return node;
}

function buildScenarios() {
  const scenarios = [];

  const pairRanks = ["A", "10", "9", "8", "7", "6", "5", "4", "3", "2"];
  pairRanks.forEach((rank) => {
    DEALER_UPCARDS.forEach((dealerRank) => {
      const answer = pairStrategy(rank, dealerRank);
      const player = [
        { rank, suit: "♠" },
        { rank, suit: rank === "A" ? "♥" : "♦" },
      ];
      scenarios.push(makeScenario({
        category: "pair",
        label: `${rank === "10" ? "T" : rank},${rank === "10" ? "T" : rank}`,
        player,
        dealerRank,
        answer,
        reason: pairReason(rank, dealerRank, answer),
      }));
    });
  });

  for (let aceSide = 9; aceSide >= 2; aceSide -= 1) {
    DEALER_UPCARDS.forEach((dealerRank) => {
      const answer = softStrategy(aceSide, dealerRank);
      scenarios.push(makeScenario({
        category: "soft",
        label: `A,${aceSide}`,
        player: [
          { rank: "A", suit: "♠" },
          { rank: String(aceSide), suit: "♥" },
        ],
        dealerRank,
        answer,
        reason: softReason(aceSide, dealerRank, answer),
      }));
    });
  }

  for (let total = 5; total <= 19; total += 1) {
    DEALER_UPCARDS.forEach((dealerRank) => {
      const answer = hardStrategy(total, dealerRank);
      scenarios.push(makeScenario({
        category: "hard",
        label: `Hard ${total}`,
        player: hardCardsForTotal(total),
        dealerRank,
        answer,
        reason: hardReason(total, dealerRank, answer),
      }));
    });
  }

  return scenarios;
}

function buildLessons() {
  return [
    {
      id: "foundations",
      title: "Foundation path",
      kicker: "Start here",
      description: "A compact route through the patterns that show up constantly.",
      principle: "Classify the hand first: pair, soft total, or hard total.",
      ids: [
        "hard:Hard 17:vs:10",
        "hard:Hard 16:vs:10",
        "hard:Hard 12:vs:4",
        "hard:Hard 11:vs:A",
        "hard:Hard 9:vs:2",
        "soft:A,7:vs:9",
        "soft:A,8:vs:6",
        "pair:8,8:vs:10",
        "pair:T,T:vs:6",
        "hard:Hard 15:vs:10",
      ],
    },
    {
      id: "hard",
      title: "Hard totals",
      kicker: "Core map",
      description: "Stiff hands, made totals, and the 9-11 double zone.",
      principle: "Hard hands have no ace cushion, so dealer strength matters quickly.",
      selector: (scenario) => scenario.category === "hard",
    },
    {
      id: "soft",
      title: "Soft totals",
      kicker: "Ace work",
      description: "Use the ace cushion to separate hit, stand, and double spots.",
      principle: "Soft hands can draw safely, which creates extra double opportunities.",
      selector: (scenario) => scenario.category === "soft",
    },
    {
      id: "pairs",
      title: "Pairs",
      kicker: "Split logic",
      description: "Learn when one hand should become two hands.",
      principle: "Pairs are decided by rank first, then by the dealer upcard.",
      selector: (scenario) => scenario.category === "pair",
    },
    {
      id: "pressure",
      title: "Doubles and surrender",
      kicker: "High leverage",
      description: "The spots where one decision changes the most expected value.",
      principle: "High-leverage plays are rare enough to memorize as families.",
      selector: (scenario) => scenario.answer === "D" || scenario.answer === "R",
    },
  ];
}

function makeScenario({ category, label, player, dealerRank, answer, reason }) {
  const dealer = { rank: dealerRank, suit: "♣" };
  return {
    id: `${category}:${label}:vs:${dealerRank}`,
    category,
    label,
    player,
    dealer,
    dealerRank,
    answer,
    reason,
  };
}

function pairStrategy(rank, dealerRank) {
  const dealer = upcardValue(dealerRank);
  if (rank === "A" || rank === "8") return "P";
  if (rank === "10") return "S";
  if (rank === "9") return [2, 3, 4, 5, 6, 8, 9].includes(dealer) ? "P" : "S";
  if (rank === "7") return dealer >= 2 && dealer <= 7 ? "P" : "H";
  if (rank === "6") return dealer >= 2 && dealer <= 6 ? "P" : "H";
  if (rank === "5") return hardStrategy(10, dealerRank);
  if (rank === "4") return dealer === 5 || dealer === 6 ? "P" : "H";
  if (rank === "3" || rank === "2") return dealer >= 2 && dealer <= 7 ? "P" : "H";
  return "H";
}

function softStrategy(aceSide, dealerRank) {
  const dealer = upcardValue(dealerRank);
  if (aceSide === 9) return "S";
  if (aceSide === 8) return dealer === 6 ? "D" : "S";
  if (aceSide === 7) {
    if (dealer >= 2 && dealer <= 6) return "D";
    if (dealer === 7 || dealer === 8) return "S";
    return "H";
  }
  if (aceSide === 6) return dealer >= 3 && dealer <= 6 ? "D" : "H";
  if (aceSide === 5 || aceSide === 4) return dealer >= 4 && dealer <= 6 ? "D" : "H";
  if (aceSide === 3 || aceSide === 2) return dealer === 5 || dealer === 6 ? "D" : "H";
  return "H";
}

function hardStrategy(total, dealerRank) {
  const dealer = upcardValue(dealerRank);
  if (total === 16 && [9, 10, 11].includes(dealer)) return "R";
  if (total === 15 && dealer === 10) return "R";
  if (total >= 17) return "S";
  if (total >= 13 && total <= 16) return dealer >= 2 && dealer <= 6 ? "S" : "H";
  if (total === 12) return dealer >= 4 && dealer <= 6 ? "S" : "H";
  if (total === 11) return "D";
  if (total === 10) return dealer >= 2 && dealer <= 9 ? "D" : "H";
  if (total === 9) return dealer >= 3 && dealer <= 6 ? "D" : "H";
  return "H";
}

function pairReason(rank, dealerRank, answer) {
  if (rank === "5") return `A pair of 5s plays as hard 10 against ${dealerRank}.`;
  if (rank === "10") return "Keep the made 20 together.";
  if (answer === "P") return `Split ${rankLabel(rank)}s against ${dealerRank}.`;
  if (answer === "S") return `Stand with ${rankLabel(rank)}s against ${dealerRank}.`;
  return `Do not split ${rankLabel(rank)}s against ${dealerRank}; play the total.`;
}

function softReason(aceSide, dealerRank, answer) {
  const total = 11 + aceSide;
  if (answer === "D") return `Soft ${total} has enough equity to double against ${dealerRank}.`;
  if (answer === "S") return `Soft ${total} is strong enough to stand against ${dealerRank}.`;
  return `Soft ${total} needs another card against ${dealerRank}.`;
}

function hardReason(total, dealerRank, answer) {
  if (answer === "R") return `Late surrender hard ${total} against ${dealerRank}.`;
  if (answer === "D") return `Double hard ${total} against ${dealerRank}.`;
  if (answer === "S") return `Stand hard ${total} against ${dealerRank}.`;
  return `Hit hard ${total} against ${dealerRank}.`;
}

function hardCardsForTotal(total) {
  const lookup = {
    5: ["2", "3"],
    6: ["2", "4"],
    7: ["3", "4"],
    8: ["3", "5"],
    9: ["4", "5"],
    10: ["6", "4"],
    11: ["5", "6"],
    12: ["10", "2"],
    13: ["10", "3"],
    14: ["10", "4"],
    15: ["10", "5"],
    16: ["10", "6"],
    17: ["10", "7"],
    18: ["10", "8"],
    19: ["10", "9"],
  };
  const ranks = lookup[total] ?? ["10", String(total - 10)];
  return [
    { rank: ranks[0], suit: "♠" },
    { rank: ranks[1], suit: "♥" },
  ];
}

function getScenarioPool(focus) {
  if (focus === "all") return SCENARIOS;
  if (focus === "weak") {
    const weak = SCENARIOS.filter((scenario) => {
      const item = state.stats.scenarios[scenario.id];
      return item && item.attempts > 0 && item.correct / item.attempts < 0.82;
    });
    return weak.length >= 8 ? weak : SCENARIOS;
  }
  if (focus === "double") return SCENARIOS.filter((scenario) => scenario.answer === "D");
  if (focus === "surrender") return SCENARIOS.filter((scenario) => scenario.answer === "R");
  return SCENARIOS.filter((scenario) => scenario.category === focus);
}

function pickScenario(pool) {
  const weighted = pool.flatMap((scenario) => {
    const item = state.stats.scenarios[scenario.id];
    if (!item) return [scenario, scenario];
    const accuracy = item.correct / item.attempts;
    const misses = item.attempts - item.correct;
    const weight = Math.max(1, 5 - Math.floor(accuracy * 4) + Math.min(3, misses));
    return Array.from({ length: weight }, () => scenario);
  });
  return weighted[Math.floor(Math.random() * weighted.length)];
}

function recordAttempt(scenario, correct) {
  const stats = state.stats;
  const today = todayKey();
  stats.total += 1;
  stats.correct += correct ? 1 : 0;
  stats.streak = correct ? stats.streak + 1 : 0;
  stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
  stats.recent.push(correct);
  stats.recent = stats.recent.slice(-24);

  stats.days[today] ??= { total: 0, correct: 0 };
  stats.days[today].total += 1;
  stats.days[today].correct += correct ? 1 : 0;

  stats.categories[scenario.category] ??= { total: 0, correct: 0 };
  stats.categories[scenario.category].total += 1;
  stats.categories[scenario.category].correct += correct ? 1 : 0;

  stats.scenarios[scenario.id] ??= { total: 0, attempts: 0, correct: 0, streak: 0 };
  const item = stats.scenarios[scenario.id];
  item.total = (item.total ?? 0) + 1;
  item.attempts += 1;
  item.correct += correct ? 1 : 0;
  item.streak = correct ? item.streak + 1 : 0;
  item.last = Date.now();

  saveStats();
}

function syncStats() {
  const stats = state.stats;
  const accuracy = percent(stats.correct, stats.total);
  const mastery = masteryPercent();
  els.statAccuracy.textContent = `${accuracy}%`;
  els.statStreak.textContent = String(stats.streak);
  els.statMastery.textContent = `${mastery}%`;
  els.statHands.textContent = String(stats.total);

  renderSessionStrip();
  renderToday();
  renderCategories();
  renderWeakSpots();
  renderMasteryGrid();
}

function renderSessionStrip() {
  const dots = Array.from({ length: 24 }, (_, index) => {
    const value = state.stats.recent[index - (24 - state.stats.recent.length)];
    const dot = document.createElement("span");
    dot.className = "session-dot";
    if (value === true) dot.classList.add("is-correct");
    if (value === false) dot.classList.add("is-wrong");
    return dot;
  });
  els.sessionStrip.replaceChildren(...dots);
}

function renderToday() {
  const today = state.stats.days[todayKey()] ?? { total: 0, correct: 0 };
  const value = percent(today.correct, today.total);
  els.todayBadge.textContent = `${today.correct} / ${today.total}`;
  els.todayFill.style.width = `${value}%`;
}

function renderCategories() {
  const rows = ["hard", "soft", "pair"].map((category) => {
    const item = state.stats.categories[category] ?? { total: 0, correct: 0 };
    const value = percent(item.correct, item.total);
    const row = document.createElement("div");
    row.className = "category-row";
    row.innerHTML = `
      <div class="row-top">
        <span>${CATEGORY_LABELS[category]}</span>
        <span>${value}%</span>
      </div>
      <div class="bar" aria-label="${CATEGORY_LABELS[category]} accuracy">
        <span style="width: ${value}%"></span>
      </div>
      <span class="row-meta">${item.correct} correct · ${item.total} hands</span>
    `;
    return row;
  });
  els.categoryList.replaceChildren(...rows);
}

function renderWeakSpots() {
  const weak = SCENARIOS
    .map((scenario) => ({ scenario, item: state.stats.scenarios[scenario.id] }))
    .filter(({ item }) => item && item.attempts >= 2)
    .sort((a, b) => {
      const aRate = a.item.correct / a.item.attempts;
      const bRate = b.item.correct / b.item.attempts;
      return aRate - bRate || b.item.attempts - a.item.attempts;
    })
    .slice(0, 7);

  if (!weak.length) {
    const note = document.createElement("p");
    note.className = "empty-note";
    note.textContent = "No weak spots yet.";
    els.weakList.replaceChildren(note);
    return;
  }

  const rows = weak.map(({ scenario, item }) => {
    const value = percent(item.correct, item.attempts);
    const row = document.createElement("div");
    row.className = "weak-row";
    row.innerHTML = `
      <div class="row-top">
        <span>${scenario.label} vs ${scenario.dealerRank}</span>
        <span>${ACTIONS[scenario.answer].label}</span>
      </div>
      <div class="bar" aria-label="${scenario.label} against ${scenario.dealerRank} accuracy">
        <span style="width: ${value}%"></span>
      </div>
      <span class="row-meta">${value}% · ${item.correct}/${item.attempts}</span>
    `;
    return row;
  });
  els.weakList.replaceChildren(...rows);
}

function renderMasteryGrid() {
  const cells = SCENARIOS.map((scenario) => {
    const item = state.stats.scenarios[scenario.id];
    const cell = document.createElement("span");
    cell.className = "mastery-cell";
    cell.title = `${scenario.label} vs ${scenario.dealerRank}: ${ACTIONS[scenario.answer].label}`;
    if (item?.attempts) {
      const rate = item.correct / item.attempts;
      cell.classList.add("is-started");
      if (item.attempts >= 3 && item.streak >= 3 && rate >= 0.9) cell.classList.add("is-strong");
      if (item.attempts >= 2 && rate < 0.7) cell.classList.add("is-weak");
    }
    return cell;
  });
  els.masteryGrid.replaceChildren(...cells);
}

function renderStrategy() {
  const sections = [
    {
      title: "Pair splitting",
      rows: ["A", "10", "9", "8", "7", "6", "5", "4", "3", "2"].map((rank) => ({
        label: `${rank === "10" ? "T" : rank},${rank === "10" ? "T" : rank}`,
        values: DEALER_UPCARDS.map((dealer) => pairStrategy(rank, dealer)),
      })),
    },
    {
      title: "Soft totals",
      rows: [9, 8, 7, 6, 5, 4, 3, 2].map((side) => ({
        label: `A,${side}`,
        values: DEALER_UPCARDS.map((dealer) => softStrategy(side, dealer)),
      })),
    },
    {
      title: "Hard totals",
      rows: [17, 16, 15, 14, 13, 12, 11, 10, 9, 8].map((total) => ({
        label: total === 17 ? "17+" : String(total),
        values: DEALER_UPCARDS.map((dealer) => hardStrategy(total, dealer)),
      })),
    },
  ];

  const blocks = sections.map((section) => {
    const block = document.createElement("section");
    block.className = "strategy-block";
    block.innerHTML = `
      <h2>${section.title}</h2>
      <div class="strategy-scroll">
        <table class="strategy-table">
          <thead>
            <tr>
              <th scope="col">Hand</th>
              ${DEALER_UPCARDS.map((dealer) => `<th scope="col">${dealer}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${section.rows.map((row) => `
              <tr>
                <th scope="row">${row.label}</th>
                ${row.values.map((value) => strategyCell(value)).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
    return block;
  });

  els.strategySections.replaceChildren(...blocks);
}

function strategyCell(action) {
  const display = action === "DS" ? "D/S" : action;
  const actionKey = action === "DS" ? "D" : action;
  return `<td class="${ACTIONS[action]?.css ?? ACTIONS[actionKey].css}">${display}</td>`;
}

function masteryPercent() {
  const mastered = SCENARIOS.filter((scenario) => {
    const item = state.stats.scenarios[scenario.id];
    if (!item || item.attempts < 3) return false;
    return item.streak >= 3 && item.correct / item.attempts >= 0.9;
  }).length;
  return percent(mastered, SCENARIOS.length);
}

function loadStats() {
  const fallback = {
    total: 0,
    correct: 0,
    streak: 0,
    bestStreak: 0,
    recent: [],
    days: {},
    categories: {},
    scenarios: {},
    lessons: {},
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      ...fallback,
      ...parsed,
      days: parsed.days ?? {},
      categories: parsed.categories ?? {},
      scenarios: parsed.scenarios ?? {},
      lessons: parsed.lessons ?? {},
      recent: parsed.recent ?? [],
    };
  } catch {
    return fallback;
  }
}

function saveStats() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.stats));
}

function resetStats() {
  const confirmed = window.confirm("Reset all Blackjack Gym stats?");
  if (!confirmed) return;
  localStorage.removeItem(STORAGE_KEY);
  state.stats = loadStats();
  syncStats();
  startLearnLesson(state.learnLesson);
  nextHand();
}

function percent(numerator, denominator) {
  return denominator ? Math.round((numerator / denominator) * 100) : 0;
}

function upcardValue(rank) {
  if (rank === "A") return 11;
  return Number(rank);
}

function rankLabel(rank) {
  return rank === "10" ? "10-value" : rank;
}

function randomSuit() {
  return SUITS[Math.floor(Math.random() * SUITS.length)];
}

function suitName(suit) {
  return {
    "♠": "spades",
    "♥": "hearts",
    "♦": "diamonds",
    "♣": "clubs",
  }[suit];
}

function todayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

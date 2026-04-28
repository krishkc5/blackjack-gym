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
  focusButtons: document.querySelectorAll("[data-focus]"),
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

init();

function init() {
  renderStrategy();
  wireEvents();
  syncStats();
  nextHand();
}

function wireEvents() {
  els.viewButtons.forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.viewButton));
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

  els.nextButton.addEventListener("click", nextHand);
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
    if (action === "NEXT") {
      if (state.locked) nextHand();
      return;
    }
    submitAnswer(action);
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
  state.current = pickScenario(pool);
  state.locked = false;

  els.feedbackZone.classList.remove("is-correct", "is-wrong");
  els.feedbackTitle.textContent = "Choose an action.";
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
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
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

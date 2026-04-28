# Blackjack Gym

A static GitHub Pages trainer for blackjack basic strategy reps. The trainer tracks accuracy, streaks, category progress, scenario mastery, and weak spots in browser `localStorage`.

Rules encoded in the trainer:

- 4+ decks
- Dealer hits soft 17
- Double after split
- Late surrender
- No insurance

## Local Preview

Open `index.html` directly, or run a tiny local server:

```sh
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## GitHub Pages

This repo is designed to publish from the `main` branch root.

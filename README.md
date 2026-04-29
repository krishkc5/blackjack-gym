# Blackjack Gym

A static GitHub Pages trainer for blackjack basic strategy reps. The app has a guided Learn mode for reasoning through patterns, flashcards for memorizing the strategy rules, a Gym mode for drills and exact spot simulation, and progress tracking in browser `localStorage`.

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

The source lives on `main`; GitHub Pages publishes the static app from the
`gh-pages` branch root.

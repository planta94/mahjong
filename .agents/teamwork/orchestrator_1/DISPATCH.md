# Dispatch Record

## 2026-11-01T03:44:06Z

User constraint on Mahjong tabletop:
"no need, as long as u make sure the logic is correct, dun change the action button"
(Leave Mahjong scoring logic and `src/app/pages/table/` tabletop action buttons untouched.)

User request #1 & #2 + `/grill-me`:
"few things I want you to do

1) in the monopoly, the bot does not reposence to my trading offer
2) I want to create another game, called the "Pandemic" board game 

/grill-me"

User's `/grill-me` interview answers:
- Q1 (Monopoly Bot Trade Behavior & UX): "Show a clear Trade Result popup/banner + SFX (Accepted/Declined with the bot's reason), validate inputs before sending, AND update bot AI to accept fair mutual-monopoly swaps & high-premium offers"
- Q2 (Pandemic Map & Setting): "Authentic 48-City Global World Map across 4 disease colors (Blue, Yellow, Black, Red) starting at Atlanta, with classic cross-continent & Pacific wraparound routes"
- Q3 (Pandemic Ruleset & Roles Scope): "Full Classic Base Game: all 7 Specialist Roles (Medic, Scientist, Researcher, Dispatcher, Operations Expert, Quarantine Specialist, Contingency Planner), all 5 Special Event cards (Airlift, Government Grant, One Quiet Night, Forecast, Resilient Population), and 3 Difficulty levels (4 / 5 / 6 Epidemics)"
- Q4 (Solo, AI Bots & Co-op Control): "Support BOTH: Cooperative Tactical AI Bot teammates (for Solo & mixed P2P rooms) AND a 'Solo Commander' toggle in the lobby where 1 player controls all 2–4 Specialist seats directly"
- Q5 (Epidemic Timing, Role Selection & World Map UX):
  - Turn phases: Explicit `4 Actions` → `Draw 2 Player Cards / Epidemic Alert` → `Infect Cities` stepper so players have an Event reaction window after an Epidemic's bottom-card Infect step (before Intensify shuffles `infectionDiscard` onto `infectionDeck`) and before `Infect Cities`.
  - Role selection: Random unique roles by default + optional Lobby Role Picker per seat.
  - Board & Mobile UX: "Interactive CDC Tactical SVG World Map (continents, route lines, Pacific wraparounds, cube/station/pawn badges) with Region Filter / Zoom controls + click-a-city to see & execute valid moves, paired with Mobile App Cards on <= 768px"

User request #3 (`/plan` addition):
"/plan 

add one more thing, check the home button or the exit room button (sometimese they are confusing)"

Approved Implementation Plan (`C:\Users\chine\.gemini\antigravity\brain\effe94dd-f539-4d36-8797-edcb695c4bde\implementation_plan.md` — also write `C:\Users\chine\.gemini\antigravity\brain\effe94dd-f539-4d36-8797-edcb695c4bde\walkthrough.md` upon completion).

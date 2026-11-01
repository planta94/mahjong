import { Injectable, inject } from '@angular/core';
import { CITY_ADJACENCY_MAP } from '../data/pandemic-cities.data';
import {
  CityCubes,
  CityPlayerCard,
  DiseaseColor,
  EventCardId,
  HAND_LIMIT,
  PandemicAction,
  PandemicPlayerState,
  PandemicPlayerView,
} from '../models/pandemic.model';
import { PandemicEngineService } from './pandemic-engine.service';

interface BfsNode {
  readonly cityId: string;
  readonly firstAction: PandemicAction;
}

@Injectable({
  providedIn: 'root',
})
export class PandemicBotService {
  private readonly engine = inject(PandemicEngineService);

  chooseBotAction(view: PandemicPlayerView, botSeat: number): PandemicAction | null {
    if (view.phase === 'game_over') {
      return null;
    }

    const bot = view.players.find((p) => p.seat === botSeat);
    if (!bot) {
      return null;
    }

    switch (view.phase) {
      case 'discard':
        return this.chooseDiscardAction(view, botSeat, bot);
      case 'forecast':
        return this.chooseForecastAction(view);
      case 'epidemic':
        return this.chooseEpidemicAction(view, botSeat, bot);
      case 'infect':
        return this.chooseInfectAction(view, botSeat, bot);
      case 'actions':
        return this.chooseTurnAction(view, botSeat, bot);
      default:
        return null;
    }
  }

  // --- Discard Phase ---
  // Discard least-needed color card not advancing a cure

  private chooseDiscardAction(
    view: PandemicPlayerView,
    botSeat: number,
    bot: PandemicPlayerState
  ): PandemicAction | null {
    if (!view.discardQueue.includes(botSeat) && bot.cards.length <= HAND_LIMIT) {
      return null;
    }

    if (bot.cards.length === 0) {
      return null;
    }

    let bestIndex = 0;
    let highestDiscardScore = -Infinity;

    for (let i = 0; i < bot.cards.length; i++) {
      const card = bot.cards.at(i);
      if (!card) continue;

      let score = 0;
      if (card.type === 'city') {
        const cureStatus = view.cureStatus.get(card.color);
        if (cureStatus === 'cured' || cureStatus === 'eradicated') {
          score = 1000;
        } else {
          const cardsOfColor = bot.cards.filter(
            (c) => c.type === 'city' && c.color === card.color
          ).length;
          let teamCardsOfColor = 0;
          for (const p of view.players) {
            teamCardsOfColor += p.cards.filter(
              (c) => c.type === 'city' && c.color === card.color
            ).length;
          }
          score = 100 - cardsOfColor * 15 - teamCardsOfColor * 5;
        }
      } else if (card.type === 'event') {
        score = 10;
      }

      if (score > highestDiscardScore) {
        highestDiscardScore = score;
        bestIndex = i;
      }
    }

    return {
      type: 'discardCard',
      seat: botSeat,
      cardIndex: bestIndex,
    };
  }

  // --- Forecast Phase ---
  // Reorder 6 cards placing high-threat cities to the back so safe cities draw first

  private chooseForecastAction(view: PandemicPlayerView): PandemicAction | null {
    if (!view.forecastCards || view.forecastCards.length === 0) {
      return null;
    }

    const scored = view.forecastCards.map((card) => {
      const cubes = view.cityCubes.get(card.cityId) ?? {
        blue: 0,
        yellow: 0,
        black: 0,
        red: 0,
      };
      const status = view.cureStatus.get(card.color);
      const isEradicated = status === 'eradicated';
      const matchingCubes = isEradicated
        ? 0
        : card.color === 'blue'
          ? cubes.blue
          : card.color === 'yellow'
            ? cubes.yellow
            : card.color === 'black'
              ? cubes.black
              : cubes.red;
      const totalCubes = cubes.blue + cubes.yellow + cubes.black + cubes.red;
      const threat = isEradicated ? 0 : matchingCubes * 100 + totalCubes;
      return { card, threat };
    });

    // Lowest threat first (draws first), highest threat last (draws last)
    scored.sort((a, b) => a.threat - b.threat);

    return {
      type: 'confirmForecast',
      reorderedCityIds: scored.map((s) => s.card.cityId),
    };
  }

  // --- Epidemic Phase ---
  // Play resilient_population on 3-cube cards in infectionDiscard if held, then resolveEpidemicIntensify

  private chooseEpidemicAction(
    view: PandemicPlayerView,
    botSeat: number,
    bot: PandemicPlayerState
  ): PandemicAction | null {
    const holdsResilient =
      bot.cards.some((c) => c.type === 'event' && c.eventId === 'resilient_population') ||
      (bot.role === 'contingency_planner' && bot.storedEventCard === 'resilient_population');

    if (holdsResilient && view.infectionDiscard.length > 0) {
      let bestCityId: string | null = null;
      let maxCubes = -1;

      for (const card of view.infectionDiscard) {
        const cubes = view.cityCubes.get(card.cityId) ?? {
          blue: 0,
          yellow: 0,
          black: 0,
          red: 0,
        };
        const matchingCubes =
          card.color === 'blue'
            ? cubes.blue
            : card.color === 'yellow'
              ? cubes.yellow
              : card.color === 'black'
                ? cubes.black
                : cubes.red;
        if (matchingCubes >= 2 && matchingCubes > maxCubes) {
          maxCubes = matchingCubes;
          bestCityId = card.cityId;
        }
      }

      if (bestCityId) {
        return {
          type: 'playEvent',
          seat: botSeat,
          eventId: 'resilient_population',
          cardCityId: bestCityId,
        };
      }
    }

    return { type: 'resolveEpidemicIntensify' };
  }

  // --- Infect Phase ---
  // Play one_quiet_night if >= 2 cities have 3 cubes, then resolveInfectStep

  private chooseInfectAction(
    view: PandemicPlayerView,
    botSeat: number,
    bot: PandemicPlayerState
  ): PandemicAction | null {
    const holdsOneQuietNight =
      bot.cards.some((c) => c.type === 'event' && c.eventId === 'one_quiet_night') ||
      (bot.role === 'contingency_planner' && bot.storedEventCard === 'one_quiet_night');

    if (!view.oneQuietNightActive && holdsOneQuietNight) {
      let threeCubeCount = 0;
      for (const cubes of view.cityCubes.values()) {
        if (cubes.blue >= 3 || cubes.yellow >= 3 || cubes.black >= 3 || cubes.red >= 3) {
          threeCubeCount++;
        }
      }

      if (threeCubeCount >= 2) {
        return {
          type: 'playEvent',
          seat: botSeat,
          eventId: 'one_quiet_night',
        };
      }
    }

    return { type: 'resolveInfectStep' };
  }

  // --- Actions Phase ---
  // BFS shortest-path planner prioritizing:
  // (1) discoverCure
  // (2) treating 3-cube hotspots
  // (3) shareKnowledge to complete a cure set
  // (4) role specials (Contingency Planner reclaim, Operations Expert station flight/build)
  // (5) moving toward 2-3 cube clusters and treating disease

  private chooseTurnAction(
    view: PandemicPlayerView,
    botSeat: number,
    bot: PandemicPlayerState
  ): PandemicAction | null {
    if (view.activeSeat !== botSeat) {
      return null;
    }
    if (view.actionsRemaining <= 0) {
      return { type: 'endActionsEarly' };
    }

    const legal = this.engine.getLegalActions(view, botSeat);

    // 1. Discover Cure Priority
    if (legal.canDiscoverCure.length > 0) {
      const color = legal.canDiscoverCure.at(0) ?? 'blue';
      const required = bot.role === 'scientist' ? 4 : 5;
      const matchingCards = bot.cards
        .filter((c): c is CityPlayerCard => c.type === 'city' && c.color === color)
        .slice(0, required)
        .map((c) => c.cityId);
      return {
        type: 'discoverCure',
        color,
        cardCityIds: matchingCards,
      };
    }

    // If bot already holds enough cards for a cure, move to the nearest research station
    const cureColorReady = this.getCureColorReady(view, bot);
    if (cureColorReady) {
      const pathToStation = this.findPathToNearestStation(view, bot);
      if (pathToStation) {
        return pathToStation;
      }
    }

    // 2. Treating 3-Cube Hotspot Priority in Current City
    const currentCubes = view.cityCubes.get(bot.cityId) ?? {
      blue: 0,
      yellow: 0,
      black: 0,
      red: 0,
    };
    const threeCubeColor = this.getThreeCubeColor(currentCubes);
    if (threeCubeColor && legal.canTreatDiseases.includes(threeCubeColor)) {
      return { type: 'treatDisease', color: threeCubeColor };
    }

    // 3. Share Knowledge to complete a cure set (co-located)
    if (legal.canShareKnowledge.length > 0) {
      const shareAction = this.evaluateShareKnowledge(view, bot, legal.canShareKnowledge);
      if (shareAction) {
        return shareAction;
      }
    }

    // 4. Role Specials
    // Contingency Planner: reclaim an event from player discard
    if (bot.role === 'contingency_planner' && legal.canContingencyPlannerTakeEvent.length > 0) {
      const eventId = this.pickBestEventToReclaim(legal.canContingencyPlannerTakeEvent);
      return { type: 'contingencyPlannerTakeEvent', eventId };
    }

    // Operations Expert: build research station without card
    if (bot.role === 'operations_expert' && legal.canBuildStation && view.researchStations.length < 6) {
      return { type: 'buildStation' };
    }

    // Operations Expert: fly from station to distant threat by discarding least-needed card
    if (
      bot.role === 'operations_expert' &&
      legal.canOperationsExpertFlightTo.length > 0 &&
      view.researchStations.includes(bot.cityId) &&
      !bot.operationsExpertFlightUsed
    ) {
      const distantThreatCity = this.findHighThreatCity(view, bot.cityId);
      const discardCard = this.pickSafeCardToDiscard(view, bot);
      if (distantThreatCity && discardCard) {
        return {
          type: 'operationsExpertFlight',
          toCityId: distantThreatCity,
          discardCardCityId: discardCard.cityId,
        };
      }
    }

    // 5. Treat Disease in Current City (1 or 2 cubes)
    if (legal.canTreatDiseases.length > 0) {
      const bestColor = this.getMostCubesColor(currentCubes, legal.canTreatDiseases);
      if (bestColor) {
        return { type: 'treatDisease', color: bestColor };
      }
    }

    // 6. Move toward 2-3 cube clusters (prioritizing 3-cube hotspots, then 2-cube, then any cubes)
    const hotspotMove = this.findPathToTarget(view, bot, (cityId) => {
      const cubes = view.cityCubes.get(cityId);
      return (
        cubes !== undefined &&
        (cubes.blue >= 3 || cubes.yellow >= 3 || cubes.black >= 3 || cubes.red >= 3)
      );
    });
    if (hotspotMove) {
      return hotspotMove;
    }

    const twoCubeMove = this.findPathToTarget(view, bot, (cityId) => {
      const cubes = view.cityCubes.get(cityId);
      return (
        cubes !== undefined &&
        (cubes.blue >= 2 || cubes.yellow >= 2 || cubes.black >= 2 || cubes.red >= 2)
      );
    });
    if (twoCubeMove) {
      return twoCubeMove;
    }

    const anyCubesMove = this.findPathToTarget(view, bot, (cityId) => {
      const cubes = view.cityCubes.get(cityId);
      if (!cubes) return false;
      return cubes.blue + cubes.yellow + cubes.black + cubes.red > 0;
    });
    if (anyCubesMove) {
      return anyCubesMove;
    }

    // 7. Fallback Actions
    if (legal.canBuildStation && view.researchStations.length < 6) {
      return { type: 'buildStation' };
    }

    if (legal.canDriveOrFerryTo.length > 0) {
      const nextCity = legal.canDriveOrFerryTo.at(0);
      if (nextCity) {
        return { type: 'driveOrFerry', toCityId: nextCity };
      }
    }

    return { type: 'endActionsEarly' };
  }

  // --- Helper Methods ---

  private getCureColorReady(view: PandemicPlayerView, bot: PandemicPlayerState): DiseaseColor | null {
    const required = bot.role === 'scientist' ? 4 : 5;
    const colors: readonly DiseaseColor[] = ['blue', 'yellow', 'black', 'red'];
    for (const col of colors) {
      if (view.cureStatus.get(col) === 'uncured') {
        const count = bot.cards.filter((c) => c.type === 'city' && c.color === col).length;
        if (count >= required) {
          return col;
        }
      }
    }
    return null;
  }

  private getThreeCubeColor(cubes: CityCubes): DiseaseColor | null {
    if (cubes.blue >= 3) return 'blue';
    if (cubes.yellow >= 3) return 'yellow';
    if (cubes.black >= 3) return 'black';
    if (cubes.red >= 3) return 'red';
    return null;
  }

  private getMostCubesColor(
    cubes: CityCubes,
    availableColors: readonly DiseaseColor[]
  ): DiseaseColor | null {
    let max = -1;
    let best: DiseaseColor | null = null;
    for (const col of availableColors) {
      const count =
        col === 'blue'
          ? cubes.blue
          : col === 'yellow'
            ? cubes.yellow
            : col === 'black'
              ? cubes.black
              : cubes.red;
      if (count > max) {
        max = count;
        best = col;
      }
    }
    return best ?? availableColors.at(0) ?? null;
  }

  private pickBestEventToReclaim(events: readonly EventCardId[]): EventCardId {
    const priority: readonly EventCardId[] = [
      'one_quiet_night',
      'resilient_population',
      'airlift',
      'government_grant',
      'forecast',
    ];
    for (const p of priority) {
      if (events.includes(p)) {
        return p;
      }
    }
    return events.at(0) ?? 'one_quiet_night';
  }

  private evaluateShareKnowledge(
    view: PandemicPlayerView,
    bot: PandemicPlayerState,
    options: readonly { targetSeat: number; cardCityId: string }[]
  ): PandemicAction | null {
    for (const opt of options) {
      const other = view.players.find((p) => p.seat === opt.targetSeat);
      if (!other) continue;

      // Find the card being shared
      const botCard = bot.cards.find((c) => c.type === 'city' && c.cityId === opt.cardCityId);
      const otherCard = other.cards.find((c) => c.type === 'city' && c.cityId === opt.cardCityId);
      const sharedCard = (botCard ?? otherCard) as CityPlayerCard | undefined;
      if (!sharedCard) continue;

      const cureStatus = view.cureStatus.get(sharedCard.color);
      if (cureStatus !== 'uncured') continue;

      // If bot is giving, check if other player is accumulating that color
      if (botCard) {
        const otherCount = other.cards.filter(
          (c) => c.type === 'city' && c.color === sharedCard.color
        ).length;
        if (otherCount >= 2 || other.role === 'scientist') {
          return {
            type: 'shareKnowledge',
            targetSeat: opt.targetSeat,
            cardCityId: opt.cardCityId,
          };
        }
      }

      // If bot is receiving, check if bot is accumulating that color
      if (otherCard) {
        const botCount = bot.cards.filter(
          (c) => c.type === 'city' && c.color === sharedCard.color
        ).length;
        if (botCount >= 2 || bot.role === 'scientist') {
          return {
            type: 'shareKnowledge',
            targetSeat: opt.targetSeat,
            cardCityId: opt.cardCityId,
          };
        }
      }
    }

    // Default to the first legal share knowledge option if none strongly favored
    const fallback = options.at(0);
    if (fallback) {
      return {
        type: 'shareKnowledge',
        targetSeat: fallback.targetSeat,
        cardCityId: fallback.cardCityId,
      };
    }
    return null;
  }

  private pickSafeCardToDiscard(
    view: PandemicPlayerView,
    bot: PandemicPlayerState
  ): CityPlayerCard | null {
    const cityCards = bot.cards.filter((c): c is CityPlayerCard => c.type === 'city');
    if (cityCards.length === 0) return null;

    // Favor card of already-cured disease
    for (const card of cityCards) {
      const status = view.cureStatus.get(card.color);
      if (status === 'cured' || status === 'eradicated') {
        return card;
      }
    }

    // Otherwise find card of color with lowest count in hand
    let lowestCount = Infinity;
    let chosen: CityPlayerCard = cityCards[0];
    for (const card of cityCards) {
      const count = cityCards.filter((c) => c.color === card.color).length;
      if (count < lowestCount) {
        lowestCount = count;
        chosen = card;
      }
    }
    return chosen;
  }

  private findHighThreatCity(view: PandemicPlayerView, excludeCityId: string): string | null {
    let maxThreat = 0;
    let bestCity: string | null = null;
    for (const [cityId, cubes] of view.cityCubes.entries()) {
      if (cityId === excludeCityId) continue;
      const total = cubes.blue + cubes.yellow + cubes.black + cubes.red;
      if (total >= 2 && total > maxThreat) {
        maxThreat = total;
        bestCity = cityId;
      }
    }
    return bestCity;
  }

  // --- BFS Shortest Path Planner ---

  private findPathToNearestStation(
    view: PandemicPlayerView,
    bot: PandemicPlayerState
  ): PandemicAction | null {
    return this.findPathToTarget(view, bot, (cityId) => view.researchStations.includes(cityId));
  }

  private findPathToTarget(
    view: PandemicPlayerView,
    bot: PandemicPlayerState,
    isTarget: (cityId: string) => boolean
  ): PandemicAction | null {
    if (isTarget(bot.cityId)) {
      return null;
    }

    const visited = new Set<string>([bot.cityId]);
    const queue: BfsNode[] = [];

    // Initialize queue with immediate valid moves from bot.cityId
    // 1. Adjacent drive/ferry moves
    const adjacent = CITY_ADJACENCY_MAP.get(bot.cityId) ?? [];
    for (const adj of adjacent) {
      if (!visited.has(adj)) {
        visited.add(adj);
        const action: PandemicAction = { type: 'driveOrFerry', toCityId: adj };
        if (isTarget(adj)) {
          return action;
        }
        queue.push({ cityId: adj, firstAction: action });
      }
    }

    // 2. Shuttle flight between stations
    if (view.researchStations.includes(bot.cityId)) {
      for (const stationCity of view.researchStations) {
        if (stationCity !== bot.cityId && !visited.has(stationCity)) {
          visited.add(stationCity);
          const action: PandemicAction = { type: 'shuttleFlight', toCityId: stationCity };
          if (isTarget(stationCity)) {
            return action;
          }
          queue.push({ cityId: stationCity, firstAction: action });
        }
      }
    }

    // 3. Direct flight using safe cards
    for (const card of bot.cards) {
      if (card.type === 'city' && card.cityId !== bot.cityId && !visited.has(card.cityId)) {
        const cureStatus = view.cureStatus.get(card.color);
        const sameColorCount = bot.cards.filter(
          (c) => c.type === 'city' && c.color === card.color
        ).length;
        // Only use for direct flight if cure already found or < 3 cards of this color held
        if (cureStatus !== 'uncured' || sameColorCount < 3) {
          visited.add(card.cityId);
          const action: PandemicAction = { type: 'directFlight', toCityId: card.cityId };
          if (isTarget(card.cityId)) {
            return action;
          }
          queue.push({ cityId: card.cityId, firstAction: action });
        }
      }
    }

    // 4. Continue BFS search outward to find closest target
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;

      const nextAdjacent = CITY_ADJACENCY_MAP.get(current.cityId) ?? [];
      for (const nextCity of nextAdjacent) {
        if (!visited.has(nextCity)) {
          visited.add(nextCity);
          if (isTarget(nextCity)) {
            return current.firstAction;
          }
          queue.push({ cityId: nextCity, firstAction: current.firstAction });
        }
      }

      // Shuttle connections from any intermediate station
      if (view.researchStations.includes(current.cityId)) {
        for (const stationCity of view.researchStations) {
          if (!visited.has(stationCity)) {
            visited.add(stationCity);
            if (isTarget(stationCity)) {
              return current.firstAction;
            }
            queue.push({ cityId: stationCity, firstAction: current.firstAction });
          }
        }
      }
    }

    return null;
  }
}

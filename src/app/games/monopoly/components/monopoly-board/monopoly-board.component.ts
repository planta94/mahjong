import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GameSessionManagerService } from '../../../../core/services/game-session-manager.service';
import { ShellUiService } from '../../../../core/services/shell-ui.service';
import { TranslateService } from '../../../../core/services/translate.service';
import { RealDiceComponent } from '../../../../shared/dice/real-dice.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import {
  BOARD_SPACE_MAP,
  COLOR_GROUP_HEX_MAP,
  MALAYSIA_BOARD_DATA,
} from '../../data/monopoly-board.data';
import {
  BoardSpace,
  ColorGroup,
  MonopolyPlayer,
  MonopolyPlayerView,
  PropertyState,
  TradeProposal,
  TradeReasonKey,
} from '../../models/monopoly.model';
import { MonopolyEngineService } from '../../services/monopoly-engine.service';
import { MonopolySessionService } from '../../services/monopoly-session.service';

interface GridPosition {
  row: number;
  col: number;
}

const SPACE_GRID_MAP: ReadonlyMap<number, GridPosition> = new Map<number, GridPosition>([
  [0, { row: 11, col: 11 }],
  [1, { row: 11, col: 10 }],
  [2, { row: 11, col: 9 }],
  [3, { row: 11, col: 8 }],
  [4, { row: 11, col: 7 }],
  [5, { row: 11, col: 6 }],
  [6, { row: 11, col: 5 }],
  [7, { row: 11, col: 4 }],
  [8, { row: 11, col: 3 }],
  [9, { row: 11, col: 2 }],
  [10, { row: 11, col: 1 }],
  [11, { row: 10, col: 1 }],
  [12, { row: 9, col: 1 }],
  [13, { row: 8, col: 1 }],
  [14, { row: 7, col: 1 }],
  [15, { row: 6, col: 1 }],
  [16, { row: 5, col: 1 }],
  [17, { row: 4, col: 1 }],
  [18, { row: 3, col: 1 }],
  [19, { row: 2, col: 1 }],
  [20, { row: 1, col: 1 }],
  [21, { row: 1, col: 2 }],
  [22, { row: 1, col: 3 }],
  [23, { row: 1, col: 4 }],
  [24, { row: 1, col: 5 }],
  [25, { row: 1, col: 6 }],
  [26, { row: 1, col: 7 }],
  [27, { row: 1, col: 8 }],
  [28, { row: 1, col: 9 }],
  [29, { row: 1, col: 10 }],
  [30, { row: 1, col: 11 }],
  [31, { row: 2, col: 11 }],
  [32, { row: 3, col: 11 }],
  [33, { row: 4, col: 11 }],
  [34, { row: 5, col: 11 }],
  [35, { row: 6, col: 11 }],
  [36, { row: 7, col: 11 }],
  [37, { row: 8, col: 11 }],
  [38, { row: 9, col: 11 }],
  [39, { row: 10, col: 11 }],
]);

@Component({
  selector: 'app-monopoly-board',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, RealDiceComponent],
  templateUrl: './monopoly-board.component.html',
  styleUrl: './monopoly-board.component.scss',
})
export class MonopolyBoardComponent implements OnInit {
  readonly session = inject(MonopolySessionService);
  readonly shellUi = inject(ShellUiService);
  readonly engine = inject(MonopolyEngineService);
  readonly translate = inject(TranslateService);
  private readonly gameManager = inject(GameSessionManagerService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly spaces = MALAYSIA_BOARD_DATA;
  readonly Math = Math;
  readonly BOARD_SPACE_MAP = BOARD_SPACE_MAP;
  readonly isDiceRolling = signal<boolean>(false);

  private diceAnimTimer: ReturnType<typeof setTimeout> | undefined;

  // Trade Modal State
  tradeTargetSeat = 1;
  tradeOfferCash = 0;
  tradeRequestCash = 0;
  tradeOfferProps: number[] = [];
  tradeRequestProps: number[] = [];
  readonly tradeErrorKey = signal<string | null>(null);
  readonly dismissedTradeOutcomeId = signal<number | null>(null);

  readonly activePlayer = computed<MonopolyPlayer | null>(() => {
    const view = this.session.currentView();
    if (!view) return null;
    return view.players.find((p: MonopolyPlayer) => p.seat === view.activeSeat) ?? null;
  });

  readonly myPlayer = computed<MonopolyPlayer | null>(() => {
    const view = this.session.currentView();
    const seat = this.session.mySeat();
    if (!view || seat < 0) return null;
    return view.players.find((p: MonopolyPlayer) => p.seat === seat) ?? null;
  });

  readonly selectedSpace = computed<BoardSpace | null>(() => {
    const idx = this.session.selectedSpaceIndex();
    return typeof idx === 'number' ? BOARD_SPACE_MAP.get(idx) ?? null : null;
  });

  readonly selectedPropState = computed<PropertyState | null>(() => {
    const idx = this.session.selectedSpaceIndex();
    const view = this.session.currentView();
    if (typeof idx !== 'number' || !view) return null;
    const entry = view.properties.find(([i]: readonly [number, PropertyState]) => i === idx);
    return entry ? entry[1] : null;
  });

  readonly landingSpace = computed<BoardSpace | null>(() => {
    const player = this.activePlayer();
    if (!player) return null;
    return BOARD_SPACE_MAP.get(player.position) ?? null;
  });

  readonly landingPropState = computed<PropertyState | null>(() => {
    const space = this.landingSpace();
    const view = this.session.currentView();
    if (!space || !view) return null;
    const entry = view.properties.find(([i]: readonly [number, PropertyState]) => i === space.index);
    return entry ? entry[1] : null;
  });

  readonly incomingTrade = computed<TradeProposal | null>(() => {
    const view = this.session.currentView();
    const mySeat = this.session.mySeat();
    if (!view?.pendingTrade || view.pendingTrade.toSeat !== mySeat) return null;
    return view.pendingTrade;
  });

  readonly isUnownedLanding = computed<boolean>(() => {
    const space = this.landingSpace();
    const prop = this.landingPropState();
    return Boolean(
      space &&
        prop &&
        prop.ownerSeat === null &&
        (space.type === 'property' || space.type === 'transit' || space.type === 'utility')
    );
  });

  ngOnInit(): void {
    this.shellUi.setActiveGame('monopoly');
    if (!this.session.snapshot()) {
      this.session.createSoloMatch(4);
    }
    this.destroyRef.onDestroy(() => clearTimeout(this.diceAnimTimer));
  }

  getSpaceGridStyle(index: number): Record<string, string> {
    const pos = SPACE_GRID_MAP.get(index) ?? { row: 1, col: 1 };
    return {
      'grid-row': `${pos.row}`,
      'grid-column': `${pos.col}`,
    };
  }

  getGroupColor(group?: ColorGroup): string {
    if (!group) return 'transparent';
    return COLOR_GROUP_HEX_MAP.get(group) ?? '#30363d';
  }

  isActiveLanding(spaceIndex: number): boolean {
    return this.activePlayer()?.position === spaceIndex;
  }

  getPropertyState(spaceIndex: number): PropertyState | undefined {
    const view = this.session.currentView();
    if (!view) return undefined;
    const entry = view.properties.find(([idx]: readonly [number, PropertyState]) => idx === spaceIndex);
    return entry ? entry[1] : undefined;
  }

  getPlayersOnSpace(spaceIndex: number): MonopolyPlayer[] {
    const view = this.session.currentView();
    if (!view) return [];
    return view.players.filter((p: MonopolyPlayer) => p.position === spaceIndex && !p.bankrupt);
  }

  getOwnerColor(spaceIndex: number): string | null {
    const prop = this.getPropertyState(spaceIndex);
    if (!prop || prop.ownerSeat === null) return null;
    const view = this.session.currentView();
    const owner = view?.players.find((p: MonopolyPlayer) => p.seat === prop.ownerSeat);
    return owner?.color ?? '#8b949e';
  }

  getOwnedSpacesForSeat(seat: number): BoardSpace[] {
    const view = this.session.currentView();
    if (!view) return [];
    return MALAYSIA_BOARD_DATA.filter((s) => this.getPropertyState(s.index)?.ownerSeat === seat);
  }

  rollDice(): void {
    clearTimeout(this.diceAnimTimer);
    this.isDiceRolling.set(true);
    this.diceAnimTimer = setTimeout(() => this.isDiceRolling.set(false), 450);
    this.session.dispatchAction({ type: 'rollDice' });
  }

  buyProperty(): void {
    this.session.dispatchAction({ type: 'buyProperty' });
  }

  passProperty(): void {
    this.session.dispatchAction({ type: 'passProperty' });
  }

  endTurn(): void {
    this.session.dispatchAction({ type: 'endTurn' });
  }

  payBail(): void {
    this.session.dispatchAction({ type: 'payJailBail' });
  }

  useJailCard(): void {
    this.session.dispatchAction({ type: 'useJailCard' });
  }

  declareBankruptcy(): void {
    this.session.dispatchAction({ type: 'declareBankruptcy' });
  }

  bidAuction(amount: number): void {
    this.session.dispatchAction({ type: 'bidAuction', amount });
  }

  passAuction(): void {
    this.session.dispatchAction({ type: 'passAuction' });
  }

  buildHouse(spaceIndex: number): void {
    this.session.dispatchAction({ type: 'buildHouse', spaceIndex });
  }

  sellHouse(spaceIndex: number): void {
    this.session.dispatchAction({ type: 'sellHouse', spaceIndex });
  }

  mortgage(spaceIndex: number): void {
    this.session.dispatchAction({ type: 'mortgageProperty', spaceIndex });
  }

  unmortgage(spaceIndex: number): void {
    this.session.dispatchAction({ type: 'unmortgageProperty', spaceIndex });
  }

  openDeed(spaceIndex: number): void {
    this.session.inspectSpace(spaceIndex);
  }

  closeDeed(): void {
    this.session.closeDeedModal();
  }

  onTradeTargetChange(): void {
    this.tradeRequestProps = [];
    this.tradeErrorKey.set(null);
  }

  openTrade(): void {
    const view = this.session.currentView();
    const mySeat = this.session.mySeat();
    if (!view) return;
    const other = view.players.find((p: MonopolyPlayer) => p.seat !== mySeat && !p.bankrupt);
    if (other) this.tradeTargetSeat = other.seat;
    this.tradeOfferCash = 0;
    this.tradeRequestCash = 0;
    this.tradeOfferProps = [];
    this.tradeRequestProps = [];
    this.tradeErrorKey.set(null);
    this.session.showTradeModal.set(true);
    this.shellUi.playSfx('click');
  }

  closeTrade(): void {
    this.tradeErrorKey.set(null);
    this.session.showTradeModal.set(false);
  }

  proposeTrade(): void {
    const view = this.session.currentView();
    const mySeat = this.session.mySeat();
    if (!view) return;

    const myPlayer = view.players.find((p: MonopolyPlayer) => p.seat === mySeat);
    const targetPlayer = view.players.find((p: MonopolyPlayer) => p.seat === this.tradeTargetSeat);
    if (!myPlayer || !targetPlayer) return;

    const sanitizedOfferCash = Math.max(0, Math.floor(Number(this.tradeOfferCash) || 0));
    const sanitizedRequestCash = Math.max(0, Math.floor(Number(this.tradeRequestCash) || 0));

    if (sanitizedOfferCash > myPlayer.cash) {
      this.tradeErrorKey.set('MONOPOLY.TRADE_ERR_OFFER_CASH');
      return;
    }

    if (sanitizedRequestCash > targetPlayer.cash) {
      this.tradeErrorKey.set('MONOPOLY.TRADE_ERR_REQUEST_CASH');
      return;
    }

    const hasOffer = sanitizedOfferCash > 0 || this.tradeOfferProps.length > 0;
    const hasRequest = sanitizedRequestCash > 0 || this.tradeRequestProps.length > 0;
    if (!hasOffer || !hasRequest) {
      this.tradeErrorKey.set('MONOPOLY.TRADE_ERR_EMPTY');
      return;
    }

    this.tradeErrorKey.set(null);
    const trade: TradeProposal = {
      fromSeat: mySeat,
      toSeat: this.tradeTargetSeat,
      offerCash: sanitizedOfferCash,
      offerProperties: [...this.tradeOfferProps],
      requestCash: sanitizedRequestCash,
      requestProperties: [...this.tradeRequestProps],
    };
    this.session.dispatchAction({ type: 'proposeTrade', trade });
    this.closeTrade();
  }

  dismissTradeOutcome(outcomeId: number): void {
    this.dismissedTradeOutcomeId.set(outcomeId);
    this.shellUi.playSfx('click');
  }

  showTradeOutcomeModal(view: MonopolyPlayerView): boolean {
    const outcome = view.lastTradeOutcome;
    if (!outcome) return false;
    if (outcome.fromSeat !== this.session.mySeat()) return false;
    return this.dismissedTradeOutcomeId() !== outcome.id;
  }

  getTradeErrorMessage(key: string): string {
    const translated = this.translate.instant(key);
    if (translated && translated !== key) return translated;
    switch (key) {
      case 'MONOPOLY.TRADE_ERR_OFFER_CASH':
        return this.translate.currentLang() === 'zh'
          ? '出价现金超出您所持有的现金！'
          : 'Offered cash exceeds your available cash!';
      case 'MONOPOLY.TRADE_ERR_REQUEST_CASH':
        return this.translate.currentLang() === 'zh'
          ? '要价现金超出对方所持有的现金！'
          : 'Requested cash exceeds opponent available cash!';
      case 'MONOPOLY.TRADE_ERR_EMPTY':
        return this.translate.currentLang() === 'zh'
          ? '交易提案必须包含出价及要价（物业或现金）！'
          : 'Trade proposal must offer and request at least one asset or cash!';
      default:
        return key;
    }
  }

  getPendingTradeText(view: MonopolyPlayerView): string {
    const targetPlayer = view.players.find((p: MonopolyPlayer) => p.seat === view.pendingTrade?.toSeat);
    const targetName = targetPlayer?.name ?? 'opponent';
    return this.translate.currentLang() === 'zh'
      ? `等待 ${targetName} 回应交易提案…`
      : `Waiting for ${targetName} to respond to trade proposal…`;
  }

  getTradeReasonText(reasonKey: TradeReasonKey): string {
    const translated = this.translate.instant(reasonKey);
    if (translated && translated !== reasonKey) return translated;
    const isZh = this.translate.currentLang() === 'zh';
    switch (reasonKey) {
      case 'MONOPOLY.TRADE_REASON_ACCEPTED':
        return isZh ? '交易条件公平，双方达成共识。' : 'Fair trade terms; both sides agreed.';
      case 'MONOPOLY.TRADE_REASON_MUTUAL_SETS':
        return isZh ? '双方均获得完整同色地契垄断，互利共赢！' : 'Mutual monopoly swap completed; benefits both players!';
      case 'MONOPOLY.TRADE_REASON_PREMIUM_BUYOUT':
        return isZh ? '出价溢价丰厚，已达到高额买断要求！' : 'High premium buyout threshold met; accepted!';
      case 'MONOPOLY.TRADE_REASON_CASH_RESERVE':
        return isZh ? '现金储备不足，无法支付要求的现金。' : 'Insufficient cash reserves to fulfill request.';
      case 'MONOPOLY.TRADE_REASON_GRANTS_MONOPOLY':
        return isZh ? '该交易将给予对手独占垄断，而出价未达溢价买断门槛。' : 'Grants opponent a monopoly without sufficient buyout premium.';
      case 'MONOPOLY.TRADE_REASON_LOW_VALUE':
        return isZh ? '交易报价资产估值过低，不符合投资回报。' : 'Offer value is too low relative to assets requested.';
      case 'MONOPOLY.TRADE_REASON_DECLINED_PLAYER':
        return isZh ? '对方玩家拒绝了该交易提案。' : 'Player declined this trade proposal.';
      default:
        return reasonKey;
    }
  }

  getAcceptedText(): string {
    return this.translate.currentLang() === 'zh' ? '接受了您的交易提案！' : 'accepted your trade proposal!';
  }

  getDeclinedText(): string {
    return this.translate.currentLang() === 'zh' ? '拒绝了您的交易提案。' : 'declined your trade proposal.';
  }

  getReasonLabel(): string {
    return this.translate.currentLang() === 'zh' ? '原因说明' : 'Reason';
  }

  acceptTrade(): void {
    this.session.dispatchAction({ type: 'acceptTrade' });
  }

  rejectTrade(): void {
    this.session.dispatchAction({ type: 'rejectTrade' });
  }

  toggleTradeOfferProp(index: number): void {
    if (this.tradeOfferProps.includes(index)) {
      this.tradeOfferProps = this.tradeOfferProps.filter((i) => i !== index);
    } else {
      this.tradeOfferProps.push(index);
    }
  }

  toggleTradeRequestProp(index: number): void {
    if (this.tradeRequestProps.includes(index)) {
      this.tradeRequestProps = this.tradeRequestProps.filter((i) => i !== index);
    } else {
      this.tradeRequestProps.push(index);
    }
  }

  getMyOwnedProperties(): BoardSpace[] {
    return this.getOwnedSpacesForSeat(this.session.mySeat());
  }

  getTargetOwnedProperties(): BoardSpace[] {
    return this.getOwnedSpacesForSeat(this.tradeTargetSeat);
  }

  getSpaceName(spaceIndex: number): string {
    return BOARD_SPACE_MAP.get(spaceIndex)?.name ?? '';
  }

  getPlayerName(seat: number | null | undefined): string {
    if (typeof seat !== 'number') return '';
    const view = this.session.currentView();
    const p = view?.players.find((pl: MonopolyPlayer) => pl.seat === seat);
    return p?.name ?? `Player ${seat + 1}`;
  }

  getUnmortgageCost(mortgageValue?: number): number {
    return Math.round((mortgageValue ?? 50) * 1.1);
  }

  calculatePlayerNetWorth(player: MonopolyPlayer): number {
    const view = this.session.currentView();
    if (!view) return 0;
    let worth = player.cash + player.outOfJailCards * 50;
    for (const [idx, prop] of view.properties) {
      if (prop.ownerSeat === player.seat) {
        const space = BOARD_SPACE_MAP.get(idx);
        if (space && space.cost) {
          if (prop.isMortgaged) {
            worth += space.mortgageValue ?? space.cost / 2;
          } else {
            worth += space.cost + (space.houseCost ?? 0) * prop.houses;
          }
        }
      }
    }
    return worth;
  }

  returnToLobby(): void {
    this.session.leaveRoom();
    void this.router.navigate(['/monopoly/lobby']);
  }

  returnToHub(): void {
    const phase = this.session.currentView()?.phase;
    if (phase && phase !== 'gameOver') {
      this.gameManager.requestGoHome();
      return;
    }
    this.gameManager.killAllActiveSessions();
    void this.router.navigate(['/']);
  }
}

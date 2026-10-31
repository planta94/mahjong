import { ActionCard } from '../models/monopoly.model';

export const NASIB_CARD_IDS = [
  'CHANCE_ADVANCE_MULA',
  'CHANCE_ADVANCE_KLCC',
  'CHANCE_ADVANCE_TRX',
  'CHANCE_ADVANCE_TRANSIT_NEAREST_1',
  'CHANCE_ADVANCE_TRANSIT_NEAREST_2',
  'CHANCE_ADVANCE_UTILITY_NEAREST',
  'CHANCE_DIVIDEND_ASB',
  'CHANCE_GO_TO_JAIL',
  'CHANCE_GET_OUT_OF_JAIL',
  'CHANCE_REPAIRS',
  'CHANCE_SPEEDING_FINE',
  'CHANCE_BACK_THREE',
  'CHANCE_ADVANCE_GEORGE_TOWN',
  'CHANCE_ADVANCE_KL_SENTRAL',
  'CHANCE_CHAIRMAN_BOARD',
  'CHANCE_LOAN_MATURES',
] as const;

export const DANA_CARD_IDS = [
  'CHEST_ADVANCE_MULA',
  'CHEST_BANK_ERROR',
  'CHEST_DOCTOR_FEE',
  'CHEST_STOCK_SALE',
  'CHEST_GET_OUT_OF_JAIL',
  'CHEST_GO_TO_JAIL',
  'CHEST_HOLIDAY_FUND',
  'CHEST_TAX_REFUND',
  'CHEST_BIRTHDAY',
  'CHEST_LIFE_INSURANCE',
  'CHEST_HOSPITAL_FEE',
  'CHEST_SCHOOL_FEES',
  'CHEST_CONSULTANCY',
  'CHEST_STREET_REPAIRS',
  'CHEST_BEAUTY_CONTEST',
  'CHEST_INHERITANCE',
] as const;

export const NASIB_CARDS: readonly ActionCard[] = [
  {
    id: 'CHANCE_ADVANCE_MULA',
    deck: 'nasib',
    titleKey: 'MONOPOLY.CARD_CHANCE_ADVANCE_MULA_TITLE',
    descKey: 'MONOPOLY.CARD_CHANCE_ADVANCE_MULA_DESC',
    actionType: 'advance_mula',
    amount: 200,
    targetPosition: 0,
  },
  {
    id: 'CHANCE_ADVANCE_KLCC',
    deck: 'nasib',
    titleKey: 'MONOPOLY.CARD_CHANCE_ADVANCE_KLCC_TITLE',
    descKey: 'MONOPOLY.CARD_CHANCE_ADVANCE_KLCC_DESC',
    actionType: 'advance_position',
    targetPosition: 39,
  },
  {
    id: 'CHANCE_ADVANCE_TRX',
    deck: 'nasib',
    titleKey: 'MONOPOLY.CARD_CHANCE_ADVANCE_TRX_TITLE',
    descKey: 'MONOPOLY.CARD_CHANCE_ADVANCE_TRX_DESC',
    actionType: 'advance_position',
    targetPosition: 37,
  },
  {
    id: 'CHANCE_ADVANCE_TRANSIT_NEAREST_1',
    deck: 'nasib',
    titleKey: 'MONOPOLY.CARD_CHANCE_ADVANCE_TRANSIT_TITLE',
    descKey: 'MONOPOLY.CARD_CHANCE_ADVANCE_TRANSIT_DESC',
    actionType: 'advance_nearest_transit',
  },
  {
    id: 'CHANCE_ADVANCE_TRANSIT_NEAREST_2',
    deck: 'nasib',
    titleKey: 'MONOPOLY.CARD_CHANCE_ADVANCE_TRANSIT_TITLE',
    descKey: 'MONOPOLY.CARD_CHANCE_ADVANCE_TRANSIT_DESC',
    actionType: 'advance_nearest_transit',
  },
  {
    id: 'CHANCE_ADVANCE_UTILITY_NEAREST',
    deck: 'nasib',
    titleKey: 'MONOPOLY.CARD_CHANCE_ADVANCE_UTILITY_TITLE',
    descKey: 'MONOPOLY.CARD_CHANCE_ADVANCE_UTILITY_DESC',
    actionType: 'advance_nearest_utility',
  },
  {
    id: 'CHANCE_DIVIDEND_ASB',
    deck: 'nasib',
    titleKey: 'MONOPOLY.CARD_CHANCE_DIVIDEND_ASB_TITLE',
    descKey: 'MONOPOLY.CARD_CHANCE_DIVIDEND_ASB_DESC',
    actionType: 'collect_bank',
    amount: 50,
  },
  {
    id: 'CHANCE_GO_TO_JAIL',
    deck: 'nasib',
    titleKey: 'MONOPOLY.CARD_CHANCE_GO_TO_JAIL_TITLE',
    descKey: 'MONOPOLY.CARD_CHANCE_GO_TO_JAIL_DESC',
    actionType: 'go_to_jail',
    targetPosition: 10,
  },
  {
    id: 'CHANCE_GET_OUT_OF_JAIL',
    deck: 'nasib',
    titleKey: 'MONOPOLY.CARD_CHANCE_GET_OUT_OF_JAIL_TITLE',
    descKey: 'MONOPOLY.CARD_CHANCE_GET_OUT_OF_JAIL_DESC',
    actionType: 'get_out_of_jail',
  },
  {
    id: 'CHANCE_REPAIRS',
    deck: 'nasib',
    titleKey: 'MONOPOLY.CARD_CHANCE_REPAIRS_TITLE',
    descKey: 'MONOPOLY.CARD_CHANCE_REPAIRS_DESC',
    actionType: 'repairs',
    perHouse: 25,
    perHotel: 100,
  },
  {
    id: 'CHANCE_SPEEDING_FINE',
    deck: 'nasib',
    titleKey: 'MONOPOLY.CARD_CHANCE_SPEEDING_FINE_TITLE',
    descKey: 'MONOPOLY.CARD_CHANCE_SPEEDING_FINE_DESC',
    actionType: 'pay_fines',
    amount: 15,
  },
  {
    id: 'CHANCE_BACK_THREE',
    deck: 'nasib',
    titleKey: 'MONOPOLY.CARD_CHANCE_BACK_THREE_TITLE',
    descKey: 'MONOPOLY.CARD_CHANCE_BACK_THREE_DESC',
    actionType: 'back_spaces',
    backSpaces: 3,
  },
  {
    id: 'CHANCE_ADVANCE_GEORGE_TOWN',
    deck: 'nasib',
    titleKey: 'MONOPOLY.CARD_CHANCE_ADVANCE_GEORGE_TOWN_TITLE',
    descKey: 'MONOPOLY.CARD_CHANCE_ADVANCE_GEORGE_TOWN_DESC',
    actionType: 'advance_position',
    targetPosition: 11,
  },
  {
    id: 'CHANCE_ADVANCE_KL_SENTRAL',
    deck: 'nasib',
    titleKey: 'MONOPOLY.CARD_CHANCE_ADVANCE_KL_SENTRAL_TITLE',
    descKey: 'MONOPOLY.CARD_CHANCE_ADVANCE_KL_SENTRAL_DESC',
    actionType: 'advance_position',
    targetPosition: 5,
  },
  {
    id: 'CHANCE_CHAIRMAN_BOARD',
    deck: 'nasib',
    titleKey: 'MONOPOLY.CARD_CHANCE_CHAIRMAN_BOARD_TITLE',
    descKey: 'MONOPOLY.CARD_CHANCE_CHAIRMAN_BOARD_DESC',
    actionType: 'pay_players',
    amount: 50,
  },
  {
    id: 'CHANCE_LOAN_MATURES',
    deck: 'nasib',
    titleKey: 'MONOPOLY.CARD_CHANCE_LOAN_MATURES_TITLE',
    descKey: 'MONOPOLY.CARD_CHANCE_LOAN_MATURES_DESC',
    actionType: 'collect_bank',
    amount: 150,
  },
];

export const DANA_CARDS: readonly ActionCard[] = [
  {
    id: 'CHEST_ADVANCE_MULA',
    deck: 'dana',
    titleKey: 'MONOPOLY.CARD_CHEST_ADVANCE_MULA_TITLE',
    descKey: 'MONOPOLY.CARD_CHEST_ADVANCE_MULA_DESC',
    actionType: 'advance_mula',
    amount: 200,
    targetPosition: 0,
  },
  {
    id: 'CHEST_BANK_ERROR',
    deck: 'dana',
    titleKey: 'MONOPOLY.CARD_CHEST_BANK_ERROR_TITLE',
    descKey: 'MONOPOLY.CARD_CHEST_BANK_ERROR_DESC',
    actionType: 'collect_bank',
    amount: 200,
  },
  {
    id: 'CHEST_DOCTOR_FEE',
    deck: 'dana',
    titleKey: 'MONOPOLY.CARD_CHEST_DOCTOR_FEE_TITLE',
    descKey: 'MONOPOLY.CARD_CHEST_DOCTOR_FEE_DESC',
    actionType: 'pay_fines',
    amount: 50,
  },
  {
    id: 'CHEST_STOCK_SALE',
    deck: 'dana',
    titleKey: 'MONOPOLY.CARD_CHEST_STOCK_SALE_TITLE',
    descKey: 'MONOPOLY.CARD_CHEST_STOCK_SALE_DESC',
    actionType: 'collect_bank',
    amount: 50,
  },
  {
    id: 'CHEST_GET_OUT_OF_JAIL',
    deck: 'dana',
    titleKey: 'MONOPOLY.CARD_CHEST_GET_OUT_OF_JAIL_TITLE',
    descKey: 'MONOPOLY.CARD_CHEST_GET_OUT_OF_JAIL_DESC',
    actionType: 'get_out_of_jail',
  },
  {
    id: 'CHEST_GO_TO_JAIL',
    deck: 'dana',
    titleKey: 'MONOPOLY.CARD_CHEST_GO_TO_JAIL_TITLE',
    descKey: 'MONOPOLY.CARD_CHEST_GO_TO_JAIL_DESC',
    actionType: 'go_to_jail',
    targetPosition: 10,
  },
  {
    id: 'CHEST_HOLIDAY_FUND',
    deck: 'dana',
    titleKey: 'MONOPOLY.CARD_CHEST_HOLIDAY_FUND_TITLE',
    descKey: 'MONOPOLY.CARD_CHEST_HOLIDAY_FUND_DESC',
    actionType: 'collect_bank',
    amount: 100,
  },
  {
    id: 'CHEST_TAX_REFUND',
    deck: 'dana',
    titleKey: 'MONOPOLY.CARD_CHEST_TAX_REFUND_TITLE',
    descKey: 'MONOPOLY.CARD_CHEST_TAX_REFUND_DESC',
    actionType: 'collect_bank',
    amount: 20,
  },
  {
    id: 'CHEST_BIRTHDAY',
    deck: 'dana',
    titleKey: 'MONOPOLY.CARD_CHEST_BIRTHDAY_TITLE',
    descKey: 'MONOPOLY.CARD_CHEST_BIRTHDAY_DESC',
    actionType: 'collect_players',
    amount: 10,
  },
  {
    id: 'CHEST_LIFE_INSURANCE',
    deck: 'dana',
    titleKey: 'MONOPOLY.CARD_CHEST_LIFE_INSURANCE_TITLE',
    descKey: 'MONOPOLY.CARD_CHEST_LIFE_INSURANCE_DESC',
    actionType: 'collect_bank',
    amount: 100,
  },
  {
    id: 'CHEST_HOSPITAL_FEE',
    deck: 'dana',
    titleKey: 'MONOPOLY.CARD_CHEST_HOSPITAL_FEE_TITLE',
    descKey: 'MONOPOLY.CARD_CHEST_HOSPITAL_FEE_DESC',
    actionType: 'pay_fines',
    amount: 100,
  },
  {
    id: 'CHEST_SCHOOL_FEES',
    deck: 'dana',
    titleKey: 'MONOPOLY.CARD_CHEST_SCHOOL_FEES_TITLE',
    descKey: 'MONOPOLY.CARD_CHEST_SCHOOL_FEES_DESC',
    actionType: 'pay_fines',
    amount: 50,
  },
  {
    id: 'CHEST_CONSULTANCY',
    deck: 'dana',
    titleKey: 'MONOPOLY.CARD_CHEST_CONSULTANCY_TITLE',
    descKey: 'MONOPOLY.CARD_CHEST_CONSULTANCY_DESC',
    actionType: 'collect_bank',
    amount: 25,
  },
  {
    id: 'CHEST_STREET_REPAIRS',
    deck: 'dana',
    titleKey: 'MONOPOLY.CARD_CHEST_STREET_REPAIRS_TITLE',
    descKey: 'MONOPOLY.CARD_CHEST_STREET_REPAIRS_DESC',
    actionType: 'repairs',
    perHouse: 40,
    perHotel: 115,
  },
  {
    id: 'CHEST_BEAUTY_CONTEST',
    deck: 'dana',
    titleKey: 'MONOPOLY.CARD_CHEST_BEAUTY_CONTEST_TITLE',
    descKey: 'MONOPOLY.CARD_CHEST_BEAUTY_CONTEST_DESC',
    actionType: 'collect_bank',
    amount: 10,
  },
  {
    id: 'CHEST_INHERITANCE',
    deck: 'dana',
    titleKey: 'MONOPOLY.CARD_CHEST_INHERITANCE_TITLE',
    descKey: 'MONOPOLY.CARD_CHEST_INHERITANCE_DESC',
    actionType: 'collect_bank',
    amount: 100,
  },
];

export function shuffleCards(cards: readonly ActionCard[]): ActionCard[] {
  const arr = [...cards];
  for (let i = arr.length - 1; i > 0; i--) {
    let rand = Math.random();
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      const val = buf.at(0) ?? 0;
      rand = val / (0xffffffff + 1);
    }
    const j = Math.floor(rand * (i + 1));
    const tmp = arr.at(i);
    const target = arr.at(j);
    if (tmp !== undefined && target !== undefined) {
      arr.splice(i, 1, target);
      arr.splice(j, 1, tmp);
    }
  }
  return arr;
}

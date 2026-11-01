import { DiseaseColor } from '../models/pandemic.model';

export interface PandemicCityNode {
  readonly id: string;
  readonly name: string;
  readonly color: DiseaseColor;
  readonly x: number;
  readonly y: number;
  readonly neighbors: readonly string[];
}

export interface WraparoundRoute {
  readonly fromCityId: string;
  readonly toCityId: string;
}

export const PACIFIC_WRAPAROUND_ROUTES: readonly WraparoundRoute[] = [
  { fromCityId: 'san_francisco', toCityId: 'tokyo' },
  { fromCityId: 'san_francisco', toCityId: 'manila' },
  { fromCityId: 'los_angeles', toCityId: 'sydney' },
];

export const PANDEMIC_CITIES: readonly PandemicCityNode[] = [
  // --- BLUE (12 cities: North America / Europe) ---
  {
    id: 'san_francisco',
    name: 'San Francisco',
    color: 'blue',
    x: 80,
    y: 180,
    neighbors: ['chicago', 'los_angeles', 'tokyo', 'manila'],
  },
  {
    id: 'chicago',
    name: 'Chicago',
    color: 'blue',
    x: 175,
    y: 165,
    neighbors: ['san_francisco', 'los_angeles', 'mexico_city', 'atlanta', 'montreal'],
  },
  {
    id: 'montreal',
    name: 'Montreal',
    color: 'blue',
    x: 235,
    y: 155,
    neighbors: ['chicago', 'washington', 'new_york'],
  },
  {
    id: 'new_york',
    name: 'New York',
    color: 'blue',
    x: 280,
    y: 175,
    neighbors: ['montreal', 'washington', 'london', 'madrid'],
  },
  {
    id: 'atlanta',
    name: 'Atlanta',
    color: 'blue',
    x: 195,
    y: 220,
    neighbors: ['chicago', 'washington', 'miami'],
  },
  {
    id: 'washington',
    name: 'Washington',
    color: 'blue',
    x: 260,
    y: 215,
    neighbors: ['atlanta', 'montreal', 'new_york', 'miami'],
  },
  {
    id: 'london',
    name: 'London',
    color: 'blue',
    x: 425,
    y: 140,
    neighbors: ['new_york', 'madrid', 'paris', 'essen'],
  },
  {
    id: 'madrid',
    name: 'Madrid',
    color: 'blue',
    x: 415,
    y: 205,
    neighbors: ['new_york', 'london', 'paris', 'algiers', 'sao_paulo'],
  },
  {
    id: 'paris',
    name: 'Paris',
    color: 'blue',
    x: 465,
    y: 165,
    neighbors: ['london', 'madrid', 'essen', 'milan', 'algiers'],
  },
  {
    id: 'essen',
    name: 'Essen',
    color: 'blue',
    x: 485,
    y: 130,
    neighbors: ['london', 'paris', 'milan', 'st_petersburg'],
  },
  {
    id: 'milan',
    name: 'Milan',
    color: 'blue',
    x: 500,
    y: 175,
    neighbors: ['paris', 'essen', 'istanbul'],
  },
  {
    id: 'st_petersburg',
    name: 'St. Petersburg',
    color: 'blue',
    x: 565,
    y: 110,
    neighbors: ['essen', 'istanbul', 'moscow'],
  },

  // --- YELLOW (12 cities: Americas / Africa) ---
  {
    id: 'los_angeles',
    name: 'Los Angeles',
    color: 'yellow',
    x: 90,
    y: 240,
    neighbors: ['san_francisco', 'chicago', 'mexico_city', 'sydney'],
  },
  {
    id: 'mexico_city',
    name: 'Mexico City',
    color: 'yellow',
    x: 155,
    y: 285,
    neighbors: ['los_angeles', 'chicago', 'miami', 'bogota', 'lima'],
  },
  {
    id: 'miami',
    name: 'Miami',
    color: 'yellow',
    x: 230,
    y: 280,
    neighbors: ['atlanta', 'washington', 'mexico_city', 'bogota'],
  },
  {
    id: 'bogota',
    name: 'Bogota',
    color: 'yellow',
    x: 250,
    y: 350,
    neighbors: ['mexico_city', 'miami', 'lima', 'buenos_aires', 'sao_paulo'],
  },
  {
    id: 'lima',
    name: 'Lima',
    color: 'yellow',
    x: 235,
    y: 420,
    neighbors: ['mexico_city', 'bogota', 'santiago'],
  },
  {
    id: 'santiago',
    name: 'Santiago',
    color: 'yellow',
    x: 245,
    y: 495,
    neighbors: ['lima'],
  },
  {
    id: 'buenos_aires',
    name: 'Buenos Aires',
    color: 'yellow',
    x: 300,
    y: 480,
    neighbors: ['bogota', 'sao_paulo'],
  },
  {
    id: 'sao_paulo',
    name: 'Sao Paulo',
    color: 'yellow',
    x: 335,
    y: 430,
    neighbors: ['bogota', 'buenos_aires', 'madrid', 'lagos'],
  },
  {
    id: 'lagos',
    name: 'Lagos',
    color: 'yellow',
    x: 475,
    y: 340,
    neighbors: ['sao_paulo', 'kinshasa', 'khartoum'],
  },
  {
    id: 'kinshasa',
    name: 'Kinshasa',
    color: 'yellow',
    x: 520,
    y: 385,
    neighbors: ['lagos', 'johannesburg', 'khartoum'],
  },
  {
    id: 'johannesburg',
    name: 'Johannesburg',
    color: 'yellow',
    x: 550,
    y: 460,
    neighbors: ['kinshasa', 'khartoum'],
  },
  {
    id: 'khartoum',
    name: 'Khartoum',
    color: 'yellow',
    x: 560,
    y: 330,
    neighbors: ['lagos', 'kinshasa', 'johannesburg', 'cairo'],
  },

  // --- BLACK (12 cities: Middle East / South Asia) ---
  {
    id: 'algiers',
    name: 'Algiers',
    color: 'black',
    x: 485,
    y: 235,
    neighbors: ['madrid', 'paris', 'istanbul', 'cairo'],
  },
  {
    id: 'cairo',
    name: 'Cairo',
    color: 'black',
    x: 550,
    y: 250,
    neighbors: ['algiers', 'istanbul', 'baghdad', 'riyadh', 'khartoum'],
  },
  {
    id: 'istanbul',
    name: 'Istanbul',
    color: 'black',
    x: 555,
    y: 195,
    neighbors: ['milan', 'st_petersburg', 'moscow', 'algiers', 'cairo', 'baghdad'],
  },
  {
    id: 'moscow',
    name: 'Moscow',
    color: 'black',
    x: 605,
    y: 135,
    neighbors: ['st_petersburg', 'istanbul', 'tehran'],
  },
  {
    id: 'baghdad',
    name: 'Baghdad',
    color: 'black',
    x: 605,
    y: 230,
    neighbors: ['cairo', 'istanbul', 'tehran', 'riyadh', 'karachi'],
  },
  {
    id: 'riyadh',
    name: 'Riyadh',
    color: 'black',
    x: 620,
    y: 290,
    neighbors: ['cairo', 'baghdad', 'karachi'],
  },
  {
    id: 'tehran',
    name: 'Tehran',
    color: 'black',
    x: 655,
    y: 190,
    neighbors: ['moscow', 'baghdad', 'karachi', 'delhi'],
  },
  {
    id: 'karachi',
    name: 'Karachi',
    color: 'black',
    x: 680,
    y: 265,
    neighbors: ['baghdad', 'riyadh', 'tehran', 'delhi', 'mumbai'],
  },
  {
    id: 'delhi',
    name: 'Delhi',
    color: 'black',
    x: 720,
    y: 230,
    neighbors: ['tehran', 'karachi', 'mumbai', 'kolkata', 'chennai'],
  },
  {
    id: 'mumbai',
    name: 'Mumbai',
    color: 'black',
    x: 695,
    y: 305,
    neighbors: ['karachi', 'delhi', 'chennai'],
  },
  {
    id: 'kolkata',
    name: 'Kolkata',
    color: 'black',
    x: 765,
    y: 245,
    neighbors: ['delhi', 'chennai', 'bangkok', 'hong_kong'],
  },
  {
    id: 'chennai',
    name: 'Chennai',
    color: 'black',
    x: 735,
    y: 345,
    neighbors: ['mumbai', 'delhi', 'kolkata', 'bangkok', 'jakarta'],
  },

  // --- RED (12 cities: East Asia / Oceania) ---
  {
    id: 'bangkok',
    name: 'Bangkok',
    color: 'red',
    x: 785,
    y: 310,
    neighbors: ['kolkata', 'chennai', 'hong_kong', 'ho_chi_minh_city', 'jakarta'],
  },
  {
    id: 'jakarta',
    name: 'Jakarta',
    color: 'red',
    x: 790,
    y: 405,
    neighbors: ['chennai', 'bangkok', 'ho_chi_minh_city', 'sydney'],
  },
  {
    id: 'ho_chi_minh_city',
    name: 'Ho Chi Minh City',
    color: 'red',
    x: 820,
    y: 360,
    neighbors: ['bangkok', 'jakarta', 'hong_kong', 'manila'],
  },
  {
    id: 'hong_kong',
    name: 'Hong Kong',
    color: 'red',
    x: 825,
    y: 295,
    neighbors: ['kolkata', 'bangkok', 'ho_chi_minh_city', 'shanghai', 'taipei', 'manila'],
  },
  {
    id: 'shanghai',
    name: 'Shanghai',
    color: 'red',
    x: 830,
    y: 230,
    neighbors: ['beijing', 'seoul', 'tokyo', 'taipei', 'hong_kong'],
  },
  {
    id: 'beijing',
    name: 'Beijing',
    color: 'red',
    x: 815,
    y: 160,
    neighbors: ['seoul', 'shanghai'],
  },
  {
    id: 'seoul',
    name: 'Seoul',
    color: 'red',
    x: 865,
    y: 165,
    neighbors: ['beijing', 'shanghai', 'tokyo'],
  },
  {
    id: 'tokyo',
    name: 'Tokyo',
    color: 'red',
    x: 915,
    y: 195,
    neighbors: ['seoul', 'shanghai', 'osaka', 'san_francisco'],
  },
  {
    id: 'osaka',
    name: 'Osaka',
    color: 'red',
    x: 910,
    y: 240,
    neighbors: ['tokyo', 'taipei'],
  },
  {
    id: 'taipei',
    name: 'Taipei',
    color: 'red',
    x: 875,
    y: 285,
    neighbors: ['shanghai', 'osaka', 'hong_kong', 'manila'],
  },
  {
    id: 'manila',
    name: 'Manila',
    color: 'red',
    x: 890,
    y: 355,
    neighbors: ['hong_kong', 'taipei', 'ho_chi_minh_city', 'sydney', 'san_francisco'],
  },
  {
    id: 'sydney',
    name: 'Sydney',
    color: 'red',
    x: 915,
    y: 465,
    neighbors: ['jakarta', 'manila', 'los_angeles'],
  },
];

export const PANDEMIC_CITIES_MAP: ReadonlyMap<string, PandemicCityNode> = new Map(
  PANDEMIC_CITIES.map((c) => [c.id, c])
);

export const CITY_ADJACENCY_MAP: ReadonlyMap<string, readonly string[]> = new Map(
  PANDEMIC_CITIES.map((c) => [c.id, c.neighbors])
);

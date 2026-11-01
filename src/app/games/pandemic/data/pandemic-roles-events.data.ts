import { EventCardId, SpecialistRole } from '../models/pandemic.model';

export interface RoleSpec {
  readonly id: SpecialistRole;
  readonly nameKey: string;
  readonly descriptionKey: string;
  readonly badgeColor: string;
}

export interface EventSpec {
  readonly id: EventCardId;
  readonly nameKey: string;
  readonly descriptionKey: string;
}

export const ALL_SPECIALIST_ROLES: readonly SpecialistRole[] = [
  'medic',
  'scientist',
  'researcher',
  'dispatcher',
  'operations_expert',
  'quarantine_specialist',
  'contingency_planner',
];

export const ALL_EVENT_CARDS: readonly EventCardId[] = [
  'airlift',
  'government_grant',
  'one_quiet_night',
  'forecast',
  'resilient_population',
];

export const ROLE_SPEC_MAP: ReadonlyMap<SpecialistRole, RoleSpec> = new Map<
  SpecialistRole,
  RoleSpec
>([
  [
    'medic',
    {
      id: 'medic',
      nameKey: 'PANDEMIC.ROLE_MEDIC_NAME',
      descriptionKey: 'PANDEMIC.ROLE_MEDIC_DESC',
      badgeColor: '#e67e22',
    },
  ],
  [
    'scientist',
    {
      id: 'scientist',
      nameKey: 'PANDEMIC.ROLE_SCIENTIST_NAME',
      descriptionKey: 'PANDEMIC.ROLE_SCIENTIST_DESC',
      badgeColor: '#bdc3c7',
    },
  ],
  [
    'researcher',
    {
      id: 'researcher',
      nameKey: 'PANDEMIC.ROLE_RESEARCHER_NAME',
      descriptionKey: 'PANDEMIC.ROLE_RESEARCHER_DESC',
      badgeColor: '#8e44ad',
    },
  ],
  [
    'dispatcher',
    {
      id: 'dispatcher',
      nameKey: 'PANDEMIC.ROLE_DISPATCHER_NAME',
      descriptionKey: 'PANDEMIC.ROLE_DISPATCHER_DESC',
      badgeColor: '#9b59b6',
    },
  ],
  [
    'operations_expert',
    {
      id: 'operations_expert',
      nameKey: 'PANDEMIC.ROLE_OPERATIONS_EXPERT_NAME',
      descriptionKey: 'PANDEMIC.ROLE_OPERATIONS_EXPERT_DESC',
      badgeColor: '#27ae60',
    },
  ],
  [
    'quarantine_specialist',
    {
      id: 'quarantine_specialist',
      nameKey: 'PANDEMIC.ROLE_QUARANTINE_SPECIALIST_NAME',
      descriptionKey: 'PANDEMIC.ROLE_QUARANTINE_SPECIALIST_DESC',
      badgeColor: '#16a085',
    },
  ],
  [
    'contingency_planner',
    {
      id: 'contingency_planner',
      nameKey: 'PANDEMIC.ROLE_CONTINGENCY_PLANNER_NAME',
      descriptionKey: 'PANDEMIC.ROLE_CONTINGENCY_PLANNER_DESC',
      badgeColor: '#2980b9',
    },
  ],
]);

export const EVENT_SPEC_MAP: ReadonlyMap<EventCardId, EventSpec> = new Map<
  EventCardId,
  EventSpec
>([
  [
    'airlift',
    {
      id: 'airlift',
      nameKey: 'PANDEMIC.EVENT_AIRLIFT_NAME',
      descriptionKey: 'PANDEMIC.EVENT_AIRLIFT_DESC',
    },
  ],
  [
    'government_grant',
    {
      id: 'government_grant',
      nameKey: 'PANDEMIC.EVENT_GOVERNMENT_GRANT_NAME',
      descriptionKey: 'PANDEMIC.EVENT_GOVERNMENT_GRANT_DESC',
    },
  ],
  [
    'one_quiet_night',
    {
      id: 'one_quiet_night',
      nameKey: 'PANDEMIC.EVENT_ONE_QUIET_NIGHT_NAME',
      descriptionKey: 'PANDEMIC.EVENT_ONE_QUIET_NIGHT_DESC',
    },
  ],
  [
    'forecast',
    {
      id: 'forecast',
      nameKey: 'PANDEMIC.EVENT_FORECAST_NAME',
      descriptionKey: 'PANDEMIC.EVENT_FORECAST_DESC',
    },
  ],
  [
    'resilient_population',
    {
      id: 'resilient_population',
      nameKey: 'PANDEMIC.EVENT_RESILIENT_POPULATION_NAME',
      descriptionKey: 'PANDEMIC.EVENT_RESILIENT_POPULATION_DESC',
    },
  ],
]);

export function getRoleSpec(role: SpecialistRole): RoleSpec {
  const spec = ROLE_SPEC_MAP.get(role);
  if (!spec) {
    throw new Error(`Unknown role: ${role}`);
  }
  return spec;
}

export function getEventSpec(eventId: EventCardId): EventSpec {
  const spec = EVENT_SPEC_MAP.get(eventId);
  if (!spec) {
    throw new Error(`Unknown event card: ${eventId}`);
  }
  return spec;
}

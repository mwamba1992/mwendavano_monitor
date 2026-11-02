/**
 * Who may see what (pure logic, enforced on the API).
 *
 * Levels per system:
 *   admin    everything, including revealing a full phone number
 *   support  people and their details, with phones masked
 *   view     numbers only: totals and charts, no name or phone of anyone
 *   none     the system does not exist for this person
 *
 * Global Authentics runs inside the Mauzo database, so it follows the Mauzo level.
 * `server` covers services, disk, memory and other machine-level facts.
 */
export const SYSTEMS = ['mauzo', 'soko', 'wafanyakazi', 'cargo', 'server'] as const;
export type SystemKey = (typeof SYSTEMS)[number];
export const PEOPLE_SYSTEMS = ['mauzo', 'soko', 'wafanyakazi', 'cargo'] as const;
export type PeopleSystem = (typeof PEOPLE_SYSTEMS)[number];

export const LEVELS = ['admin', 'support', 'view', 'none'] as const;
export type Level = (typeof LEVELS)[number];
export type AccessMap = Record<SystemKey, Level>;

export interface Actor {
  isOwner: boolean;
  access: AccessMap;
}

export const noAccess = (): AccessMap => ({ mauzo: 'none', soko: 'none', wafanyakazi: 'none', cargo: 'none', server: 'none' });
export const fullAccess = (): AccessMap => ({ mauzo: 'admin', soko: 'admin', wafanyakazi: 'admin', cargo: 'admin', server: 'admin' });

export const isSystem = (v: unknown): v is SystemKey => SYSTEMS.includes(v as SystemKey);
export const isPeopleSystem = (v: unknown): v is PeopleSystem => PEOPLE_SYSTEMS.includes(v as PeopleSystem);

/** A missing or corrupt value is 'none': access is never granted by accident. */
export function levelOf(a: Actor, s: SystemKey): Level {
  if (a.isOwner) return 'admin';
  const l = a.access?.[s];
  return LEVELS.includes(l) ? l : 'none';
}

export const canSeeNumbers = (a: Actor, s: SystemKey) => levelOf(a, s) !== 'none';
export const canSeePeople = (a: Actor, s: SystemKey) => ['admin', 'support'].includes(levelOf(a, s));
export const canRevealPhone = (a: Actor, s: SystemKey) => levelOf(a, s) === 'admin';
export const canAddNote = (a: Actor, s: SystemKey) => canSeePeople(a, s);

/**
 * Staff management reaches across every system, so being Admin of one system is not enough:
 * it takes the owner or an Admin on Server.
 */
export const canManageStaff = (a: Actor) => levelOf(a, 'server') === 'admin';

/** null = allowed; otherwise why not. The owner's account and your own access are out of reach. */
export function staffEditProblem(actor: Actor & { id: number }, target: { id: number; isOwner: boolean }): string | null {
  if (!canManageStaff(actor)) return 'Only an Admin on Server or the owner can manage staff';
  if (target.isOwner && !actor.isOwner) return 'Only the owner can change the owner account';
  if (target.id === actor.id) return 'You cannot change your own access. Ask another Admin';
  return null;
}

/** Fills in missing systems with 'none' and refuses unknown levels. */
export function parseAccess(raw: unknown): AccessMap | null {
  if (!raw || typeof raw !== 'object') return null;
  const out = noAccess();
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!isSystem(k) || !LEVELS.includes(v as Level)) return null;
    out[k] = v as Level;
  }
  return out;
}

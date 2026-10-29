import {
  FRESCODeckConfig,
  Partition,
  State,
  OpticalPotential,
  BoundState,
  ChannelCoupling,
  AngularDataPoint,
} from '../types/fresco';

// Zero-range (d,p) stripping strength D0 (MeV fm^3/2) and finite-range parameter (fm)
const ZR_D0 = -122.5;
const ZR_FNRNG = 0.746;
const POINT_CHARGE_RC = 0.0001;

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁺': '+', '⁻': '-',
};

/** FRESCO reads text as plain bytes: map superscripts to ASCII and drop anything else non-ASCII. */
function toAscii(text: string): string {
  return text.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]/g, (c) => SUPERSCRIPT_DIGITS[c]).replace(/[^\x20-\x7E]/g, '');
}

/** Nucleus names are CHARACTER*8 in FRESCO and must not contain quotes. */
function nucleusName(name: string): string {
  return toAscii(name).replace(/['"\s]/g, '').slice(0, 8) || 'X';
}

/** Trailing `! comment` labels carry GUI-only names; FRESCO ignores the rest of the line after `/`. */
function label(text: string): string {
  return toAscii(text).replace(/[\n\r]/g, ' ').trim();
}

const AMU_MEV = 931.494;
const HBARC = 197.327;

/**
 * FRESCO stops unless hcm * k < 0.2 in every channel ("Step size HCM is too large ... so STOP!").
 * Returns the requested step, reduced if needed to satisfy that limit.
 */
function stableStepSize(config: FRESCODeckConfig): number {
  const entrance = config.partitions[0];
  if (!entrance) return config.dr;
  const ecmIn = (config.eLab * entrance.target.massNumber) / (entrance.projectile.massNumber + entrance.target.massNumber);
  let kMax = 0;
  for (const p of config.partitions) {
    const mu = ((p.projectile.massNumber * p.target.massNumber) / (p.projectile.massNumber + p.target.massNumber)) * AMU_MEV;
    const ecm = ecmIn + p.qValue;
    if (ecm > 0) kMax = Math.max(kMax, Math.sqrt(2 * mu * ecm) / HBARC);
  }
  const limit = 0.19 / kMax;
  return kMax > 0 && config.dr > limit ? Number(limit.toPrecision(2)) : config.dr;
}

/** Compact number formatting for namelist values. */
function num(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return String(Number(value.toPrecision(10)));
}

function statesOfPartition(config: FRESCODeckConfig, partitionId: string): State[] {
  return config.states.filter((s) => s.partitionId === partitionId);
}

/**
 * Generates a FRESCO namelist input deck (`fresco.in`) that the native Fortran
 * FRESCO executable reads on standard input.
 *
 * Radii follow the GUI convention R = r0 * At^(1/3), i.e. `at` = target mass and `ap` = 0.
 * GUI-only data (state/potential names, rmax, lmax) is written as `! comments` after each
 * namelist so that `parseFrescoDeck` can read the deck back without loss.
 */
export function generateFrescoDeck(config: FRESCODeckConfig): string {
  const lines: string[] = [];
  const partitions = config.partitions;

  // States grouped by partition, in FRESCO order. A partition without states gets its ground state.
  const partitionStates = partitions.map((p) => {
    const own = statesOfPartition(config, p.id);
    if (own.length > 0) return own;
    const ground: State = {
      id: `${p.id}_gs`,
      partitionId: p.id,
      name: 'Ground State',
      excitationEnergy: 0,
      projectileSpin: p.projectile.spin,
      targetSpin: p.target.spin,
      parity: p.target.parity,
      potentialIndex: 0,
    };
    return [ground];
  });
  const stateLocation = new Map<string, { partition: number; index: number }>();
  partitionStates.forEach((list, pi) =>
    list.forEach((s, si) => stateLocation.set(s.id, { partition: pi + 1, index: si + 1 })),
  );

  const transfers = config.couplings.filter((c) => c.couplingType === 'transfer-dwba');
  const inelastic = config.couplings.filter((c) => c.couplingType === 'inelastic-multipole');

  // Card 0: title, Card 1: NAMELIST marker
  lines.push(toAscii(config.title || 'FRESCO Calculation').slice(0, 80));
  lines.push('NAMELIST');

  // &FRESCO: numerics, angles and energy
  const maxSpin = Math.max(
    0,
    ...partitionStates.flat().map((s) => Math.abs(s.projectileSpin) + Math.abs(s.targetSpin)),
  );
  const projectileSpin = partitions[0]?.projectile.spin ?? 0;
  const hcm = stableStepSize(config);
  if (hcm !== config.dr) {
    lines.push(`! hcm reduced from ${num(config.dr)} to ${num(hcm)} fm: FRESCO requires hcm * k < 0.2`);
  }
  const fresco = [
    ` &FRESCO hcm=${num(hcm)} rmatch=${num(config.rmatch)}`,
    `     jtmin=0.0 jtmax=${num(config.lmax + maxSpin)} absend=-1`,
    `     thmin=${num(config.angleStart)} thmax=${num(config.angleEnd)} thinc=${num(config.angleStep)}`,
    `     iter=${transfers.length > 0 ? 1 : 0} chans=1 smats=2 xstabl=1${projectileSpin > 0 ? ' kqmax=1' : ''}`,
    `     elab(1)=${num(config.eLab)} /   ! rmax=${num(config.rmax)} lmax=${num(config.lmax)}`,
  ];
  lines.push(...fresco, '');

  // &PARTITION / &STATES
  partitions.forEach((p, pi) => {
    const states = partitionStates[pi];
    lines.push(
      ` &PARTITION namep='${nucleusName(p.projectile.name)}' massp=${num(p.projectile.massNumber)} zp=${num(p.projectile.chargeNumber)}` +
        ` nex=${states.length} namet='${nucleusName(p.target.name)}' masst=${num(p.target.massNumber)} zt=${num(p.target.chargeNumber)}` +
        ` qval=${num(p.qValue)} /   ! ${label(p.name)}`,
    );
    states.forEach((s) => {
      lines.push(
        ` &STATES jp=${num(s.projectileSpin)} bandp=${p.projectile.parity} ep=0 cpot=${s.potentialIndex + 1}` +
          ` jt=${num(s.targetSpin)} bandt=${s.parity} et=${num(s.excitationEnergy)} /   ! ${label(s.name)}`,
      );
    });
  });
  lines.push(' &partition /', '');

  // &POT: one combined namelist per potential
  config.potentials.forEach((pot, idx) => {
    const kp = idx + 1;
    // Radius scaling mass: target of the first partition that uses this potential.
    // A potential used by no channel (e.g. a binding potential) scales with the lightest target, the core.
    const user = partitionStates.findIndex((list) => list.some((s) => s.potentialIndex === idx));
    const at = partitions[user]?.target.massNumber ?? Math.min(...partitions.map((p) => p.target.massNumber));
    const shape = pot.type === 'gaussian' ? 2 : pot.type === 'yukawa' ? 3 : 0;
    // FRESCO only applies `at` (the radius scale) through the Coulomb card, which it omits when rc=0;
    // a point-charge radius keeps the scale without changing the physics.
    const rc = pot.rc > 0 ? pot.rc : POINT_CHARGE_RC;
    const parts = [
      ` &pot kp=${kp}${shape ? ` shape=${shape}` : ''} at=${num(at)} ap=0 rc=${num(rc)}`,
      ` v=${num(pot.V0)} rv=${num(pot.r0)} av=${num(pot.a0)}`,
      ` w=${num(pot.W0)} rw=${num(pot.rw)} aw=${num(pot.aw)}`,
      ` wd=${num(pot.Wd)} wdr=${num(pot.rd)} wda=${num(pot.ad)}`,
      ` vso=${num(pot.Vso)} rso=${num(pot.rso)} aso=${num(pot.aso)}`,
    ];

    // Target deformations (rotor model) for inelastic couplings that use this potential
    const target = partitions[user]?.target;
    const betaByMultipole = new Map<number, number>();
    for (const c of inelastic) {
      const from = config.states.find((s) => s.id === c.fromStateId);
      if (from?.potentialIndex === idx && c.lambda >= 1) betaByMultipole.set(c.lambda, c.beta);
    }
    for (const [lambda, beta] of target ? betaByMultipole : []) {
      const radius = pot.r0 * Math.cbrt(target!.massNumber);
      const coulombRadius = (pot.rc || pot.r0) * Math.cbrt(target!.massNumber);
      parts.push(` deft(${lambda})=${num(beta * radius)}`);
      if (target!.chargeNumber > 0) {
        // Intrinsic Coulomb matrix element of a uniformly charged deformed sphere
        const mn = (3 * target!.chargeNumber * beta * Math.pow(coulombRadius, lambda)) / (4 * Math.PI);
        parts.push(` mnet(${lambda})=${num(mn)}`);
      }
    }
    lines.push(parts.join('') + ` /   ! ${label(pot.name)}`);
  });
  lines.push(' &pot /', '');

  // &OVERLAP: single-particle bound states, placed in the heavier (composite) target
  const transferPartitions = transfers
    .map((c) => {
      const from = stateLocation.get(c.fromStateId);
      const to = stateLocation.get(c.toStateId);
      if (!from || !to || from.partition === to.partition) return null;
      const fromTarget = partitions[from.partition - 1].target.massNumber;
      const toTarget = partitions[to.partition - 1].target.massNumber;
      return toTarget >= fromTarget
        ? { coupling: c, core: from, composite: to }
        : { coupling: c, core: to, composite: from };
    })
    .filter((t): t is NonNullable<typeof t> => t !== null);

  const firstTransfer = transferPartitions[0];
  config.boundStates.forEach((bs, idx) => {
    const ic1 = firstTransfer?.core.partition ?? 1;
    const ic2 = firstTransfer?.composite.partition ?? Math.min(2, partitions.length);
    lines.push(
      ` &overlap kn1=${idx + 1} ic1=${ic1} ic2=${ic2} in=2 kind=0 nn=${bs.nodes + 1} l=${bs.orbitalL}` +
        ` sn=0.5 j=${num(bs.totalJ)} kbpot=${bs.potentialIndex + 1} be=${num(bs.bindingEnergy)}` +
        ` isc=${bs.searchV0 ? 1 : 0} /   ! ${label(bs.name)}`,
    );
  });
  lines.push(' &overlap /', '');

  // &COUPLING: zero-range transfers with target spectroscopic amplitudes
  transferPartitions.forEach(({ coupling, core, composite }, idx) => {
    const kn = Math.min(idx, config.boundStates.length - 1) + 1;
    if (kn < 1) return;
    const from = stateLocation.get(coupling.fromStateId)!;
    const to = stateLocation.get(coupling.toStateId)!;
    const amplitude = Math.sqrt(Math.max(0, coupling.spectroscopicFactor));
    lines.push(
      ` &coupling icto=${to.partition} icfrom=${from.partition} kind=5 p1=${ZR_D0} p2=${ZR_FNRNG} /`,
      `   &cfp in=-2 ib=${composite.index} ia=${core.index} kn=${kn} a=${num(amplitude)} /`,
    );
  });
  lines.push(' &coupling /', '');

  return lines.join('\n');
}

interface NamelistGroup {
  name: string;
  values: Map<string, string[]>;
  comment: string;
}

/** Splits FRESCO namelist input into `&group key=value ... /` records with trailing comments. */
function readNamelistGroups(text: string): NamelistGroup[] {
  const groups: NamelistGroup[] = [];
  let i = 0;
  while (i < text.length) {
    const start = text.indexOf('&', i);
    if (start < 0) break;
    const nameMatch = /^&(\w+)/.exec(text.slice(start));
    if (!nameMatch) {
      i = start + 1;
      continue;
    }

    // Find the terminating '/' outside quotes, dropping `!` comments inside the group
    let j = start + nameMatch[0].length;
    let body = '';
    let quote: string | null = null;
    while (j < text.length) {
      const ch = text[j];
      if (quote) {
        if (ch === quote) quote = null;
        body += ch;
      } else if (ch === "'" || ch === '"') {
        quote = ch;
        body += ch;
      } else if (ch === '!') {
        while (j < text.length && text[j] !== '\n') j++;
        continue;
      } else if (ch === '/') {
        break;
      } else {
        body += ch;
      }
      j++;
    }

    const lineEnd = text.indexOf('\n', j);
    const rest = text.slice(j + 1, lineEnd < 0 ? text.length : lineEnd);
    const commentMatch = /^\s*!(.*)$/.exec(rest);

    const values = new Map<string, string[]>();
    const keyPattern = /([a-zA-Z_]\w*(?:\s*\([^)]*\))?)\s*=/g;
    const keys: { key: string; start: number; end: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = keyPattern.exec(body)) !== null) {
      keys.push({ key: m[1].replace(/\s+/g, '').toLowerCase(), start: m.index, end: keyPattern.lastIndex });
    }
    keys.forEach((k, ki) => {
      const raw = body.slice(k.end, ki + 1 < keys.length ? keys[ki + 1].start : body.length);
      const tokens = raw.match(/'[^']*'|"[^"]*"|[^\s,]+/g) || [];
      values.set(k.key, tokens.map((t) => t.replace(/^['"]|['"]$/g, '').trim()));
    });

    groups.push({ name: nameMatch[1].toLowerCase(), values, comment: commentMatch ? commentMatch[1].trim() : '' });
    i = j + 1;
  }
  return groups;
}

function nlNumber(group: NamelistGroup, keys: string[], fallback: number): number {
  for (const key of keys) {
    const v = group.values.get(key);
    if (v && v.length > 0) {
      const n = parseFloat(v[0].replace(/[dD]/, 'e'));
      if (!isNaN(n)) return n;
    }
  }
  return fallback;
}

function nlString(group: NamelistGroup, key: string, fallback: string): string {
  const v = group.values.get(key);
  return v && v.length > 0 ? v[0] : fallback;
}

/** Reads p1..p7 from either `p(1:7)=...`, `p(k)=...` or `p1=...` forms. */
function nlParams(group: NamelistGroup): number[] {
  const p = [0, 0, 0, 0, 0, 0, 0];
  for (const [key, vals] of group.values) {
    const range = /^p\((\d+):(\d+)\)$/.exec(key);
    const single = /^p\((\d+)\)$/.exec(key) || /^p(\d)$/.exec(key);
    const nums = vals.map((v) => parseFloat(v.replace(/[dD]/, 'e')));
    if (range) {
      nums.forEach((n, k) => {
        const idx = parseInt(range[1], 10) - 1 + k;
        if (idx < 7 && !isNaN(n)) p[idx] = n;
      });
    } else if (single) {
      const idx = parseInt(single[1], 10) - 1;
      if (idx >= 0 && idx < 7 && !isNaN(nums[0])) p[idx] = nums[0];
    }
  }
  return p;
}

/** `key=value` pairs written in trailing comments (e.g. `! rmax=35 lmax=40`). */
function commentNumber(comment: string, key: string): number | undefined {
  const m = new RegExp(`\\b${key}\\s*=\\s*([-+0-9.eE]+)`).exec(comment);
  return m ? parseFloat(m[1]) : undefined;
}

/**
 * Parses a FRESCO namelist input deck (as written by `generateFrescoDeck`, or a standard
 * FRESCO `.nin` file) into a FRESCODeckConfig.
 */
export function parseFrescoDeck(deckText: string): FRESCODeckConfig {
  const text = deckText.replace(/\r\n?/g, '\n');
  const firstLine = text.split('\n').find((l) => l.trim().length > 0) ?? '';
  let title = firstLine.trim().startsWith('&') ? 'Imported FRESCO Calculation' : firstLine.trim().replace(/^'|'$/g, '');
  if (!title) title = 'Imported FRESCO Calculation';

  let dr = 0.05;
  let rmatch = 20.0;
  let rmax = 30.0;
  let lmax = 40;
  let angleStart = 0.0;
  let angleEnd = 180.0;
  let angleStep = 1.0;
  let eLab = 25.0;

  const partitions: Partition[] = [];
  const states: State[] = [];
  const potentials: OpticalPotential[] = [];
  const boundStates: BoundState[] = [];
  const couplings: ChannelCoupling[] = [];

  const groups = readNamelistGroups(text);
  const potByKp = new Map<number, OpticalPotential>();
  const potScale = new Map<number, number>();
  const deformations: { kp: number; k: number; length: number }[] = [];
  const overlapsByKn = new Map<number, BoundState>();
  let pendingTransfer: { icto: number; icfrom: number } | null = null;

  const blankPotential = (kp: number, name: string): OpticalPotential => ({
    id: `pot${kp}`,
    name: name || `Potential ${kp}`,
    type: 'woods-saxon',
    V0: 0, r0: 1.25, a0: 0.65,
    W0: 0, rw: 1.25, aw: 0.65,
    Wd: 0, rd: 1.25, ad: 0.65,
    Vso: 0, rso: 1.1, aso: 0.65,
    rc: 0,
  });

  for (const g of groups) {
    if (g.name === 'fresco') {
      dr = nlNumber(g, ['hcm'], dr);
      rmatch = Math.abs(nlNumber(g, ['rmatch'], rmatch));
      angleStart = nlNumber(g, ['thmin'], angleStart);
      angleEnd = nlNumber(g, ['thmax'], angleEnd);
      angleStep = Math.abs(nlNumber(g, ['thinc'], angleStep)) || angleStep;
      eLab = nlNumber(g, ['elab(1)', 'elab'], eLab);
      const jtmax = nlNumber(g, ['jtmax'], lmax);
      lmax = commentNumber(g.comment, 'lmax') ?? Math.floor(jtmax);
      rmax = commentNumber(g.comment, 'rmax') ?? Math.max(rmatch + 10, rmax);
    } else if (g.name === 'partition' && g.values.size > 0) {
      const pIdx = partitions.length + 1;
      const namep = nlString(g, 'namep', 'p');
      const namet = nlString(g, 'namet', 'T');
      partitions.push({
        id: `p${pIdx}`,
        name: g.comment || `${namep} + ${namet}`,
        projectile: { name: namep, massNumber: nlNumber(g, ['massp'], 1), chargeNumber: nlNumber(g, ['zp'], 0), spin: 0, parity: 1 },
        target: { name: namet, massNumber: nlNumber(g, ['masst'], 1), chargeNumber: nlNumber(g, ['zt'], 0), spin: 0, parity: 1 },
        qValue: nlNumber(g, ['qval'], 0),
      });
    } else if (g.name === 'states') {
      const partition = partitions[partitions.length - 1];
      if (!partition) continue;
      const own = states.filter((s) => s.partitionId === partition.id);
      const previous = own[own.length - 1];
      const jp = nlNumber(g, ['jp'], previous?.projectileSpin ?? 0);
      const jt = nlNumber(g, ['jt'], previous?.targetSpin ?? 0);
      const parityP = nlNumber(g, ['bandp', 'ptyp'], 1) < 0 ? -1 : 1;
      const parityT = nlNumber(g, ['bandt', 'ptyt'], previous?.parity ?? 1) < 0 ? -1 : 1;
      if (own.length === 0) {
        partition.projectile.spin = jp;
        partition.projectile.parity = parityP;
        partition.target.spin = jt;
        partition.target.parity = parityT;
      }
      states.push({
        id: `s${states.length + 1}`,
        partitionId: partition.id,
        name: g.comment || `State ${own.length + 1}`,
        excitationEnergy: nlNumber(g, ['et'], 0) + nlNumber(g, ['ep'], 0),
        projectileSpin: jp,
        targetSpin: jt,
        parity: parityT,
        potentialIndex: Math.max(1, nlNumber(g, ['cpot', 'kp'], 1)) - 1,
      });
    } else if (g.name === 'pot' && g.values.size > 0) {
      const kp = Math.abs(nlNumber(g, ['kp'], 1));
      let pot = potByKp.get(kp);
      if (!pot) {
        pot = blankPotential(kp, g.comment);
        potByKp.set(kp, pot);
      } else if (g.comment && pot.name === `Potential ${kp}`) {
        pot.name = g.comment;
      }

      const has = (k: string) => g.values.has(k);
      const shape = nlNumber(g, ['shape'], 0);
      if (shape === 2) pot.type = 'gaussian';
      else if (shape === 3) pot.type = 'yukawa';

      if (has('at') || has('ap') || has('rc') || has('v') || has('w') || has('wd') || has('vso')) {
        // Combined namelist form
        let scale = potScale.get(kp) ?? 1;
        if (has('at') || has('ap')) {
          const at = nlNumber(g, ['at'], 0);
          const ap = nlNumber(g, ['ap'], 0);
          scale = at > 0 ? (Math.cbrt(at) + Math.cbrt(ap)) / Math.cbrt(at) : 1;
          potScale.set(kp, scale);
        }
        if (has('rc')) {
          const rc = nlNumber(g, ['rc'], 0);
          pot.rc = rc <= POINT_CHARGE_RC ? 0 : rc * scale;
        }
        if (has('v')) pot.V0 = nlNumber(g, ['v'], 0);
        if (has('rv')) pot.r0 = nlNumber(g, ['rv'], pot.r0) * scale;
        if (has('av')) pot.a0 = nlNumber(g, ['av'], pot.a0);
        if (has('w')) pot.W0 = nlNumber(g, ['w'], 0);
        if (has('rw')) pot.rw = nlNumber(g, ['rw'], pot.rw) * scale;
        if (has('aw')) pot.aw = nlNumber(g, ['aw'], pot.aw);
        if (has('wd')) pot.Wd = nlNumber(g, ['wd'], 0);
        if (has('wdr')) pot.rd = nlNumber(g, ['wdr'], pot.rd) * scale;
        if (has('wda')) pot.ad = nlNumber(g, ['wda'], pot.ad);
        if (has('vso')) pot.Vso = nlNumber(g, ['vso'], 0);
        if (has('rso')) pot.rso = nlNumber(g, ['rso'], pot.rso) * scale;
        if (has('aso')) pot.aso = nlNumber(g, ['aso'], pot.aso);
        for (const [key, vals] of g.values) {
          const def = /^deft\((\d+)\)$/.exec(key);
          if (def) deformations.push({ kp, k: parseInt(def[1], 10), length: parseFloat(vals[0]) });
        }
      } else {
        // Individual Card 9/10 form: kp, type, p(1:7)
        const type = nlNumber(g, ['type'], 0);
        const p = nlParams(g);
        if (type === 0) {
          // Card 9: radii are multiples of A1^(1/3) + A2^(1/3); convert to the GUI's At^(1/3) convention
          const scale = p[0] > 0 ? (Math.cbrt(p[0]) + Math.cbrt(p[1])) / Math.cbrt(p[0]) : 1;
          potScale.set(kp, scale);
          pot.rc = p[2] * scale;
        } else {
          const scale = potScale.get(kp) ?? 1;
          if (type === 1) {
            Object.assign(pot, { V0: p[0], r0: p[1] * scale, a0: p[2], W0: p[3], rw: p[4] * scale, aw: p[5] });
          } else if (type === 2) {
            Object.assign(pot, { Wd: p[3], rd: p[4] * scale, ad: p[5] });
          } else if (type === 3) {
            Object.assign(pot, { Vso: p[0], rso: p[1] * scale, aso: p[2] });
          } else if (type === 11) {
            // p(k) = nuclear deformation length for multipole k
            p.slice(0, 6).forEach((length, i) => {
              if (length !== 0) deformations.push({ kp, k: i + 1, length });
            });
          }
        }
      }
    } else if (g.name === 'overlap' && g.values.size > 0) {
      const kn = nlNumber(g, ['kn1'], overlapsByKn.size + 1);
      const ic1 = nlNumber(g, ['ic1'], 1);
      const core = partitions[ic1 - 1];
      overlapsByKn.set(kn, {
        id: `bs${kn}`,
        name: g.comment || `Bound state ${kn}`,
        coreName: core?.target.name ?? 'core',
        valenceName: 'n',
        bindingEnergy: nlNumber(g, ['be'], 0),
        orbitalL: nlNumber(g, ['l'], 0),
        totalJ: nlNumber(g, ['j'], 0.5),
        nodes: Math.max(0, nlNumber(g, ['nn'], 1) - 1),
        potentialIndex: Math.max(1, nlNumber(g, ['kbpot'], 1)) - 1,
        searchV0: nlNumber(g, ['isc'], 0) !== 0,
      });
    } else if (g.name === 'coupling' && g.values.size > 0) {
      const kind = nlNumber(g, ['kind'], 0);
      pendingTransfer =
        kind >= 5 && kind <= 7
          ? { icto: Math.abs(nlNumber(g, ['icto'], 2)), icfrom: nlNumber(g, ['icfrom'], 1) }
          : null;
    } else if (g.name === 'cfp' && pendingTransfer) {
      const fromPartition = partitions[pendingTransfer.icfrom - 1];
      const toPartition = partitions[pendingTransfer.icto - 1];
      const from = fromPartition && states.find((s) => s.partitionId === fromPartition.id);
      const to = toPartition && states.find((s) => s.partitionId === toPartition.id);
      const a = nlNumber(g, ['a'], 1);
      if (from && to && Math.abs(nlNumber(g, ['in'], 2)) === 2) {
        couplings.push({
          id: `c${couplings.length + 1}`,
          fromStateId: from.id,
          toStateId: to.id,
          couplingType: 'transfer-dwba',
          lambda: 0,
          beta: 0,
          spectroscopicFactor: Number((a * a).toPrecision(6)),
        });
      }
    }
  }

  [...potByKp.keys()].sort((a, b) => a - b).forEach((kp) => {
    const pot = potByKp.get(kp)!;
    pot.id = `pot${kp}`;
    potentials.push(pot);
  });
  // States refer to potentials by KP; re-index in case KP numbers have gaps.
  const kpOrder = [...potByKp.keys()].sort((a, b) => a - b);
  states.forEach((s) => {
    const idx = kpOrder.indexOf(s.potentialIndex + 1);
    s.potentialIndex = idx >= 0 ? idx : 0;
  });
  [...overlapsByKn.keys()].sort((a, b) => a - b).forEach((kn) => {
    const bs = overlapsByKn.get(kn)!;
    const idx = kpOrder.indexOf(bs.potentialIndex + 1);
    bs.potentialIndex = idx >= 0 ? idx : 0;
    boundStates.push(bs);
  });

  // Target deformations become inelastic couplings from the ground state of the partition using that potential
  for (const d of deformations) {
    const potIndex = kpOrder.indexOf(d.kp);
    const users = states.filter((s) => s.potentialIndex === potIndex);
    const ground = users[0];
    const partition = partitions.find((p) => p.id === ground?.partitionId);
    if (!ground || !partition) continue;
    const radius = (potentials[potIndex]?.r0 || 1.2) * Math.cbrt(partition.target.massNumber);
    users.slice(1).forEach((excited) => {
      couplings.push({
        id: `c${couplings.length + 1}`,
        fromStateId: ground.id,
        toStateId: excited.id,
        couplingType: 'inelastic-multipole',
        lambda: d.k,
        beta: Number((d.length / radius).toPrecision(6)),
        spectroscopicFactor: 1,
      });
    });
  }

  // Default fallback if parsing minimal deck
  if (partitions.length === 0) {
    partitions.push({
      id: 'p1',
      name: 'p + 208Pb',
      projectile: { name: 'p', massNumber: 1, chargeNumber: 1, spin: 0.5, parity: 1 },
      target: { name: '208Pb', massNumber: 208, chargeNumber: 82, spin: 0, parity: 1 },
      qValue: 0,
    });
  }

  if (potentials.length === 0) {
    potentials.push({
      id: 'pot1',
      name: 'Default Optical Model',
      type: 'woods-saxon',
      V0: 50.0,
      r0: 1.25,
      a0: 0.65,
      W0: 10.0,
      rw: 1.25,
      aw: 0.65,
      Wd: 5.0,
      rd: 1.25,
      ad: 0.58,
      Vso: 6.0,
      rso: 1.1,
      aso: 0.6,
      rc: 1.25,
    });
  }

  if (states.length === 0) {
    states.push({
      id: 'st1',
      partitionId: partitions[0].id,
      name: 'Ground State 0+',
      excitationEnergy: 0.0,
      projectileSpin: 0.5,
      targetSpin: 0,
      parity: 1,
      potentialIndex: 0,
    });
  }

  return {
    title,
    eLab,
    rmatch,
    rmax,
    dr,
    lmax,
    angleStart,
    angleEnd,
    angleStep,
    partitions,
    states,
    potentials,
    boundStates,
    couplings,
  };
}

/**
 * Parses `fort.16` XMGrace output file from FRESCO containing columns:
 * Angle (cm), Cross section (mb/sr), Rutherford cross section (mb/sr), Ratio to Rutherford, Ay
 * Handles multi-channel XMGrace datasets (e.g. Partition 1 Excit 1, Partition 1 Excit 2)
 */
export interface Fort16Dataset {
  datasetIndex: number;
  legend: string;
  partition?: number;
  excit?: number;
  points: AngularDataPoint[];
}

export function parseFort16Output(fort16Text: string): AngularDataPoint[] {
  if (!fort16Text) return [];

  const lines = fort16Text.split('\n');
  const datasets: Fort16Dataset[] = [];

  let currentPoints: AngularDataPoint[] = [];
  let currentLegend = '';

  const saveCurrentDataset = () => {
    if (currentPoints.length > 0) {
      let partition = 1;
      let excit = 1;

      const partMatch = currentLegend.match(/Partition\s*=\s*(\d+)/i);
      const excitMatch = currentLegend.match(/Excit\s*=\s*(\d+)/i);
      if (partMatch) partition = parseInt(partMatch[1], 10);
      if (excitMatch) excit = parseInt(excitMatch[1], 10);

      datasets.push({
        datasetIndex: datasets.length,
        legend: currentLegend || `Channel ${datasets.length + 1}`,
        partition,
        excit,
        points: currentPoints,
      });
      currentPoints = [];
      currentLegend = '';
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Filter XMGrace @ directive lines
    if (trimmed.startsWith('@')) {
      if (trimmed.includes('legend')) {
        if (currentPoints.length > 0) {
          saveCurrentDataset();
        }
        const quoteMatch = trimmed.match(/"([^"]+)"/) || trimmed.match(/'([^']+)'/);
        if (quoteMatch) {
          currentLegend = quoteMatch[1] || quoteMatch[2] || '';
        } else {
          const fallbackMatch = trimmed.match(/legend\s+(?:string\s+\d+\s+)?(\S+)/i);
          if (fallbackMatch) {
            currentLegend = fallbackMatch[1] || '';
          }
        }
      }
      continue;
    }

    // XMGrace end-of-set marker
    if (trimmed.startsWith('&')) {
      saveCurrentDataset();
      continue;
    }

    if (trimmed.startsWith('#') || trimmed.startsWith('!') || trimmed.startsWith('$')) {
      continue;
    }

    // Ignore text header lines
    if (/[a-zA-Z]{2,}/.test(trimmed) && !trimmed.includes('e-') && !trimmed.includes('e+') && !trimmed.includes('E-') && !trimmed.includes('E+')) {
      continue;
    }

    const parts = trimmed.split(/\s+/).map(Number);
    if (parts.length >= 2 && parts.every((n) => !isNaN(n))) {
      const angleCm = parts[0];
      const sigmaMb = parts[1];
      const sigmaRutherford = parts.length >= 3 ? parts[2] : 0;
      const ratioRutherford = parts.length >= 4 ? parts[3] : (sigmaRutherford > 0 ? sigmaMb / sigmaRutherford : 1);
      const ay = parts.length >= 5 ? parts[4] : 0;

      if (angleCm >= 0 && angleCm <= 180 && sigmaMb >= 0) {
        // Implicit new dataset block if angle resets/decreases
        if (currentPoints.length > 0 && angleCm <= currentPoints[currentPoints.length - 1].angleCm) {
          saveCurrentDataset();
        }

        currentPoints.push({
          angleCm,
          angleLab: angleCm,
          sigmaMb,
          sigmaRutherford,
          ratioRutherford,
          ay,
        });
      }
    }
  }

  saveCurrentDataset();

  if (datasets.length === 0) return [];

  // Primary dataset selection: Ground state elastic channel (Excit = 1, Partition = 1) or first dataset
  const primaryDataset =
    datasets.find((d) => d.partition === 1 && d.excit === 1) ||
    datasets.find((d) => d.excit === 1) ||
    datasets[0];

  return primaryDataset.points.sort((a, b) => a.angleCm - b.angleCm);
}

/**
 * Parses the elastic angular distribution from FRESCO standard output (fresco.out).
 * Unlike fort.16, which holds only the ratio to Rutherford for charged elastic scattering,
 * stdout always gives absolute cross sections in mb/sr.
 */
export function parseFrescoOutCrossSections(frescoOutText: string, projectileSpin = 0): AngularDataPoint[] {
  if (!frescoOutText) return [];

  const lines = frescoOutText.split('\n');

  // Pattern 1: FRESCO's standard output, one block per outgoing channel, the elastic channel first:
  //   " CROSS SECTIONS FOR OUTGOING p & 208Pb in state #   1 ..."
  //   "    30.00 deg.: X-S =  8044.145719 mb/sr,          & pols = 0. -0.00648"
  //   "+                                         /R =   1.0503E+00"
  // `/R` (ratio to Rutherford) is only printed for charged elastic channels; `pols` only with KQMAX > 0.
  const xsPattern = /^\s*([\d.]+)\s*deg\.\s*:\s*X-S\s*=\s*([-\d.E+]+)\s*mb\/sr(?:.*pols\s*=\s*(.*))?/i;
  const ratioPattern = /^\+.*\/R\s*=\s*([-\d.E+]+)/i;
  const elasticBlock = 1;
  let block = 0;
  const points1: AngularDataPoint[] = [];
  for (const line of lines) {
    if (/CROSS SECTIONS FOR OUTGOING/i.test(line)) {
      block++;
      continue;
    }
    if (block > elasticBlock) break;

    const ratio = line.match(ratioPattern);
    if (ratio && points1.length > 0) {
      const last = points1[points1.length - 1];
      last.ratioRutherford = parseFloat(ratio[1]);
      last.sigmaRutherford = last.ratioRutherford > 0 ? last.sigmaMb / last.ratioRutherford : 0;
      continue;
    }

    const match = line.match(xsPattern);
    if (match) {
      const angleCm = parseFloat(match[1]);
      const sigmaMb = parseFloat(match[2]);
      // pols = T10 iT11 (Madison); analysing power of the projectile from iT11
      const pols = match[3] ? match[3].trim().split(/\s+/).map(Number) : [];
      const iT11 = pols.length >= 2 && !isNaN(pols[1]) ? pols[1] : 0;
      // Ay = <S_y>/s = iT11 * sqrt(2(s+1)/(3s)): sqrt(2) for spin 1/2, 2/sqrt(3) for spin 1
      const ay = projectileSpin > 0 ? iT11 * Math.sqrt((2 * (projectileSpin + 1)) / (3 * projectileSpin)) : 0;
      if (!isNaN(angleCm) && !isNaN(sigmaMb) && angleCm >= 0 && angleCm <= 180 && sigmaMb >= 0) {
        points1.push({
          angleCm,
          angleLab: angleCm,
          sigmaMb,
          sigmaRutherford: 0,
          ratioRutherford: 1.0,
          ay,
        });
      }
    }
  }

  if (points1.length >= 2) {
    return points1.sort((a, b) => a.angleCm - b.angleCm);
  }

  // Pattern 2: Strict Tabular FRESCO Parser
  // Requires explicit table headers specifying BOTH an angle descriptor (THETA, ANGLE, DEG) AND a cross-section descriptor (SIGMA, X-S, CROSS, RUTH, MB/SR).
  // Strictly validates that candidate angle values strictly monotonically increase (angle_i > angle_{i-1}).
  let currentBlock: AngularDataPoint[] = [];
  let bestBlock: AngularDataPoint[] = [];
  let inAngleTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upper = line.toUpperCase();

    // Trigger table mode ONLY if header contains both ANGLE descriptor and SIGMA/CROSS SECTION descriptor
    const hasAngleHeader = upper.includes('ANGLE') || upper.includes('THETA') || upper.includes('DEG');
    const hasSigmaHeader =
      upper.includes('SIGMA') || upper.includes('X-S') || upper.includes('CROSS SECTION') || upper.includes('RUTH') || upper.includes('MB/SR');

    if (hasAngleHeader && hasSigmaHeader) {
      inAngleTable = true;
      if (currentBlock.length > bestBlock.length) {
        bestBlock = currentBlock;
      }
      currentBlock = [];
      continue;
    }

    if (inAngleTable) {
      const trimmed = line.trim();

      // End table block on empty line, dashed line, or new section header
      if (!trimmed || trimmed.startsWith('---') || trimmed.startsWith('===') || upper.includes('SECTION') || upper.includes('STATE #') || upper.includes('FRESCO')) {
        if (currentBlock.length > bestBlock.length) {
          bestBlock = currentBlock;
        }
        currentBlock = [];
        inAngleTable = false;
        continue;
      }

      // Ignore text header rows within table block
      if (/[a-zA-Z]{3,}/.test(trimmed) && !trimmed.includes('E-') && !trimmed.includes('E+')) {
        continue;
      }

      const parts = trimmed.split(/\s+/).map(Number);
      if (parts.length >= 2 && parts.every((n) => !isNaN(n))) {
        const angleCm = parts[0];
        const sigmaMb = parts[1];

        const lastAngle = currentBlock.length > 0 ? currentBlock[currentBlock.length - 1].angleCm : -1;

        // Monotonic increase check & angle boundary check
        if (angleCm >= 0 && angleCm <= 180 && angleCm > lastAngle && sigmaMb >= 0) {
          const ratioRutherford = parts.length >= 3 ? parts[2] : 1;
          const sigmaRutherford = parts.length >= 4 ? parts[3] : (ratioRutherford > 0 ? sigmaMb / ratioRutherford : 0);
          const ay = parts.length >= 5 ? parts[4] : 0;

          currentBlock.push({
            angleCm,
            angleLab: angleCm,
            sigmaMb,
            sigmaRutherford,
            ratioRutherford,
            ay,
          });
        } else {
          // Angle was not strictly increasing or out of bounds -> end this table block
          if (currentBlock.length > bestBlock.length) {
            bestBlock = currentBlock;
          }
          currentBlock = [];
          inAngleTable = false;
        }
      } else {
        if (currentBlock.length > bestBlock.length) {
          bestBlock = currentBlock;
        }
        currentBlock = [];
        inAngleTable = false;
      }
    }
  }

  if (currentBlock.length > bestBlock.length) {
    bestBlock = currentBlock;
  }

  if (bestBlock.length >= 2) {
    return bestBlock.sort((a, b) => a.angleCm - b.angleCm);
  }

  return [];
}


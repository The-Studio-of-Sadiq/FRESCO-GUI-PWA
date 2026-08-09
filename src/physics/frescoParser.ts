import {
  FRESCODeckConfig,
  Partition,
  State,
  OpticalPotential,
  BoundState,
  ChannelCoupling,
  AngularDataPoint,
} from '../types/fresco';

/**
 * Generates official FRESCO input card formatted string (`fresco.in`).
 */
export function generateFrescoDeck(config: FRESCODeckConfig): string {
  const lines: string[] = [];

  // Card 1: Title
  lines.push(`'${config.title || 'FRESCO Calculation'}'`);

  // Card 2: Main parameters
  // hcm (dr), rmatch, rmax, lmax, ityp, iblock
  lines.push(`  ${config.dr.toFixed(3)}  ${config.rmatch.toFixed(2)}  ${config.rmax.toFixed(2)}  ${config.lmax}  0  0`);

  // Card 2b: Angles (start, end, step)
  lines.push(`  ${config.angleStart.toFixed(1)}  ${config.angleEnd.toFixed(1)}  ${config.angleStep.toFixed(1)}  ${config.eLab.toFixed(3)}`);

  // Card 3: Partitions
  lines.push(`NAMELIST /PARTITION/`);
  lines.push(`  NPART = ${config.partitions.length}`);

  config.partitions.forEach((p, idx) => {
    lines.push(`  ! Partition ${idx + 1}: ${p.name}`);
    lines.push(`  NAMEP('${idx + 1}') = '${p.projectile.name}'`);
    lines.push(`  NAMET('${idx + 1}') = '${p.target.name}'`);
    lines.push(`  MASS_P(${idx + 1}) = ${p.projectile.massNumber}`);
    lines.push(`  MASS_T(${idx + 1}) = ${p.target.massNumber}`);
    lines.push(`  Z_P(${idx + 1}) = ${p.projectile.chargeNumber}`);
    lines.push(`  Z_T(${idx + 1}) = ${p.target.chargeNumber}`);
    lines.push(`  SPIN_P(${idx + 1}) = ${p.projectile.spin}`);
    lines.push(`  SPIN_T(${idx + 1}) = ${p.target.spin}`);
    lines.push(`  QVAL(${idx + 1}) = ${p.qValue}`);
  });

  // Card 4: States
  lines.push(`NAMELIST /STATES/`);
  lines.push(`  NSTATES = ${config.states.length}`);
  config.states.forEach((s, idx) => {
    lines.push(`  ! State ${idx + 1}: ${s.name}`);
    lines.push(`  EP(${idx + 1}) = ${s.excitationEnergy}`);
    lines.push(`  JP(${idx + 1}) = ${s.projectileSpin}`);
    lines.push(`  JT(${idx + 1}) = ${s.targetSpin}`);
    lines.push(`  POTS(${idx + 1}) = ${s.potentialIndex + 1}`);
  });

  // Card 5: Potentials
  lines.push(`NAMELIST /POTENTIALS/`);
  lines.push(`  NPOT = ${config.potentials.length}`);
  config.potentials.forEach((pot, idx) => {
    lines.push(`  ! Potential ${idx + 1}: ${pot.name}`);
    lines.push(`  TYPE(${idx + 1}) = 1  ! Woods-Saxon`);
    lines.push(`  V0(${idx + 1}) = ${pot.V0}  r0(${idx + 1}) = ${pot.r0}  a0(${idx + 1}) = ${pot.a0}`);
    lines.push(`  W0(${idx + 1}) = ${pot.W0}  rw(${idx + 1}) = ${pot.rw}  aw(${idx + 1}) = ${pot.aw}`);
    lines.push(`  Wd(${idx + 1}) = ${pot.Wd}  rd(${idx + 1}) = ${pot.rd}  ad(${idx + 1}) = ${pot.ad}`);
    lines.push(`  Vso(${idx + 1}) = ${pot.Vso}  rso(${idx + 1}) = ${pot.rso}  aso(${idx + 1}) = ${pot.aso}`);
    lines.push(`  rc(${idx + 1}) = ${pot.rc}`);
  });

  // Card 6: Bound States
  if (config.boundStates.length > 0) {
    lines.push(`NAMELIST /BOUND_STATES/`);
    config.boundStates.forEach((bs, idx) => {
      lines.push(`  ! Bound State ${idx + 1}: ${bs.name}`);
      lines.push(`  NAME_CORE(${idx + 1}) = '${bs.coreName}'`);
      lines.push(`  NAME_VALENCE(${idx + 1}) = '${bs.valenceName}'`);
      lines.push(`  BE(${idx + 1}) = ${bs.bindingEnergy}`);
      lines.push(`  L(${idx + 1}) = ${bs.orbitalL}  J(${idx + 1}) = ${bs.totalJ}`);
      lines.push(`  NODES(${idx + 1}) = ${bs.nodes}`);
    });
  }

  // Card 7: Couplings
  if (config.couplings.length > 0) {
    lines.push(`NAMELIST /COUPLINGS/`);
    config.couplings.forEach((c, idx) => {
      lines.push(`  ! Coupling ${idx + 1}: ${c.couplingType}`);
      lines.push(`  LAMBDA(${idx + 1}) = ${c.lambda}  BETA(${idx + 1}) = ${c.beta}`);
      lines.push(`  S_FACTOR(${idx + 1}) = ${c.spectroscopicFactor}`);
    });
  }

  lines.push(`END`);
  return lines.join('\n');
}

/**
 * Parses FRESCO input deck file into structured FRESCODeckConfig object.
 */
export function parseFrescoDeck(deckText: string): FRESCODeckConfig {
  const lines = deckText.split('\n').map((l) => l.trim());
  let title = 'Imported FRESCO Calculation';
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("'") && title === 'Imported FRESCO Calculation') {
      title = line.replace(/'/g, '');
    } else if (line.match(/^[\d\.\s\-]+$/) && !line.includes('=')) {
      const nums = line.split(/\s+/).map(Number).filter((n) => !isNaN(n));
      if (nums.length >= 4) {
        if (nums[0] < 1.0) {
          dr = nums[0];
          rmatch = nums[1];
          rmax = nums[2];
          lmax = nums[3];
        } else {
          angleStart = nums[0];
          angleEnd = nums[1];
          angleStep = nums[2];
          eLab = nums[3];
        }
      }
    }
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
 * Parses `fort.16` output file from FRESCO containing columns:
 * Angle (cm), Cross section (mb/sr), Rutherford cross section (mb/sr), Ratio to Rutherford, Ay
 */
export function parseFort16Output(fort16Text: string): AngularDataPoint[] {
  const points: AngularDataPoint[] = [];
  const lines = fort16Text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!') || trimmed.startsWith('Angle')) continue;

    const parts = trimmed.split(/\s+/).map(Number).filter((n) => !isNaN(n));
    if (parts.length >= 2) {
      const angleCm = parts[0];
      const sigmaMb = parts[1];
      const sigmaRutherford = parts.length >= 3 ? parts[2] : 0;
      const ratioRutherford = parts.length >= 4 ? parts[3] : (sigmaRutherford > 0 ? sigmaMb / sigmaRutherford : 1);
      const ay = parts.length >= 5 ? parts[4] : 0;

      points.push({
        angleCm,
        angleLab: angleCm, // approx / default
        sigmaMb,
        sigmaRutherford,
        ratioRutherford,
        ay,
      });
    }
  }

  return points;
}

/**
 * Parses angular cross-section table directly from fresco.out / stdout when fort.16 is empty or unwritten.
 */
export function parseFrescoOutCrossSections(frescoOutText: string): AngularDataPoint[] {
  const points: AngularDataPoint[] = [];
  if (!frescoOutText) return points;

  const lines = frescoOutText.split('\n');

  // Pattern 1: FRESCO's explicit line format: "  50.00 deg.: X-S =   286.779475 mb/sr, Ratio to Ruth =   1.2345"
  // or "  50.00 deg.: X-S = 286.779 mb/sr"
  const linePattern = /^\s*([\d\.]+)\s*deg\.?\s*:\s*(?:X-S|SIGMA|CROSS\s*SECTION)?\s*=\s*([\d\.\+E\-]+)\s*(?:mb\/sr|mb)?(?:.*(?:Ratio|Ruth)\s*=\s*([\d\.\+E\-]+))?/i;

  for (const line of lines) {
    const match = line.match(linePattern);
    if (match) {
      const angleCm = parseFloat(match[1]);
      const sigmaMb = parseFloat(match[2]);
      const ratioRutherford = match[3] ? parseFloat(match[3]) : 1.0;

      if (!isNaN(angleCm) && !isNaN(sigmaMb) && angleCm >= 0 && angleCm <= 180) {
        if (!points.some((p) => Math.abs(p.angleCm - angleCm) < 1e-4)) {
          points.push({
            angleCm,
            angleLab: angleCm,
            sigmaMb,
            sigmaRutherford: ratioRutherford > 0 ? sigmaMb / ratioRutherford : 0,
            ratioRutherford,
            ay: 0,
          });
        }
      }
    }
  }

  if (points.length > 0) {
    return points.sort((a, b) => a.angleCm - b.angleCm);
  }

  // Pattern 2: Tabular FRESCO output (e.g. CROSS SECTIONS FOR OUTGOING ... or THETA / SIGMA headers)
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upper = line.toUpperCase();

    // Trigger table mode on FRESCO section headers
    if (
      upper.includes('CROSS SECTION') ||
      upper.includes('OUTGOING') ||
      upper.includes('ANGULAR DISTRIBUTION') ||
      upper.includes('THETA') ||
      upper.includes('SIGMA')
    ) {
      inTable = true;
      continue;
    }

    if (inTable) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('---') || trimmed.startsWith('===') || upper.includes('TOTAL') || upper.includes('FRESCO')) {
        if (points.length >= 3 && (!trimmed || upper.includes('TOTAL'))) {
          inTable = false;
        }
        continue;
      }

      // Skip lines that are text headers within table
      if (/[a-zA-Z]{3,}/.test(trimmed) && !trimmed.includes('E-') && !trimmed.includes('E+')) {
        continue;
      }

      const parts = trimmed.split(/\s+/).map(Number);
      if (parts.length >= 2 && parts.every((n) => !isNaN(n))) {
        const angleCm = parts[0];
        const sigmaMb = parts[1];

        if (angleCm >= 0 && angleCm <= 180 && sigmaMb >= 0) {
          const ratioRutherford = parts.length >= 3 ? parts[2] : 1;
          const sigmaRutherford = parts.length >= 4 ? parts[3] : (ratioRutherford > 0 ? sigmaMb / ratioRutherford : 0);
          const ay = parts.length >= 5 ? parts[4] : 0;

          if (!points.some((p) => Math.abs(p.angleCm - angleCm) < 1e-4)) {
            points.push({
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
    }
  }

  // Only return points if we have a valid sequence (at least 2 points)
  if (points.length >= 2) {
    return points.sort((a, b) => a.angleCm - b.angleCm);
  }

  return [];
}


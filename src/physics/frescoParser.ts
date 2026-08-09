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
 * Parses angular cross-section table directly from fresco.out / stdout when fort.16 is empty or unwritten.
 */
export function parseFrescoOutCrossSections(frescoOutText: string): AngularDataPoint[] {
  if (!frescoOutText) return [];

  const lines = frescoOutText.split('\n');

  // Pattern 1: FRESCO's explicit line format: "  50.00 deg.: X-S =   286.779475 mb/sr, Ratio to Ruth =   1.2345"
  // or "  50.00 deg.: X-S = 286.779 mb/sr"
  const linePattern = /^\s*([\d\.]+)\s*deg\.?\s*:\s*(?:X-S|SIGMA|CROSS\s*SECTION)?\s*=\s*([\d\.\+E\-]+)\s*(?:mb\/sr|mb)?(?:.*(?:Ratio|Ruth)\s*=\s*([\d\.\+E\-]+))?/i;

  const points1: AngularDataPoint[] = [];
  for (const line of lines) {
    const match = line.match(linePattern);
    if (match) {
      const angleCm = parseFloat(match[1]);
      const sigmaMb = parseFloat(match[2]);
      const ratioRutherford = match[3] ? parseFloat(match[3]) : 1.0;

      if (!isNaN(angleCm) && !isNaN(sigmaMb) && angleCm >= 0 && angleCm <= 180 && sigmaMb >= 0) {
        if (!points1.some((p) => Math.abs(p.angleCm - angleCm) < 1e-4)) {
          points1.push({
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


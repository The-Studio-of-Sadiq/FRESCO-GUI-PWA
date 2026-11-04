import { FRESCODeckConfig, RadialPotentialPoint, RadialWavefunction, SMatrixElement } from '../types/fresco';

// Elastic S-matrix and wavefunctions from FRESCO's fort.17 (written when wdisk=1), and
// the optical-potential curves of a setup, using FRESCO's form factors.

const MAX_WAVEFUNCTION_POINTS = 200;

/**
 * fort.17 (wdisk > 0, formatted), per J^π set:
 *   card A: NR, H, ELAB, JTOTAL, PARITY, MP, MT, ZP, ZT
 *   card B: IT, L, J, JTOT, LIN, JIN, Re S, Im S, ETA        (IT < 0 ends the set)
 *   card C: NR complex psi values, 6 numbers per line
 * The elastic channel's own wavefunction is the one with IT = 1, L = LIN and J = JIN.
 */
export function parseFort17(text: string): { sMatrix: SMatrixElement[]; wavefunctions: RadialWavefunction[] } {
  const tokens = text.split(/\s+/).filter(Boolean);
  const sMatrix: SMatrixElement[] = [];
  const wavefunctions: RadialWavefunction[] = [];
  let i = 0;
  const next = () => Number(tokens[i++]);

  while (i < tokens.length) {
    // card A
    const nr = next();
    const h = next();
    i += 7;
    if (!Number.isFinite(nr) || nr <= 0 || !Number.isFinite(h)) break;
    // cards B and C until IT < 0
    while (i < tokens.length) {
      const it = next();
      const l = next();
      const j = next();
      next(); // JTOT
      const lin = next();
      const jin = next();
      const reS = next();
      const imS = next();
      next(); // ETA
      if (!(it > 0)) break;
      const psi: number[] = [];
      for (let k = 0; k < 2 * nr; k++) psi.push(next());
      if (it !== 1 || l !== lin || Math.abs(j - jin) > 1e-6) continue;

      const modulus = Math.hypot(reS, imS);
      sMatrix.push({
        l,
        j,
        eta: modulus,
        phaseShiftDeg: ((Math.atan2(imS, reS) / 2) * 180) / Math.PI,
        reS,
        imS,
        partialCrossSectionMb: 0,
      });
      const stride = Math.max(1, Math.ceil(nr / MAX_WAVEFUNCTION_POINTS));
      const points = [];
      for (let n = 0; n < nr; n += stride) {
        const uReal = psi[2 * n];
        const uImag = psi[2 * n + 1];
        points.push({ r: Number((n * h).toPrecision(6)), uReal, uImag, probDensity: uReal * uReal + uImag * uImag });
      }
      wavefunctions.push({ l, j, stateName: `L = ${l}, J = ${j}`, points });
    }
  }
  sMatrix.sort((a, b) => a.l - b.l || (a.j ?? 0) - (b.j ?? 0));
  wavefunctions.sort((a, b) => a.l - b.l || (a.j ?? 0) - (b.j ?? 0));
  return { sMatrix, wavefunctions };
}

const E2 = 1.43997; // MeV fm, FRESCO's e²

/**
 * Optical potential of the elastic channel along r, with FRESCO's shapes (Woods-Saxon
 * volume, surface −4·W_D·E/(1+E)², spin-orbit form factor with ħ²/(mπc)² = 2 fm²) and a
 * uniformly charged sphere for Coulomb. Radii are R = r₀·A_t^(1/3).
 */
export function potentialCurves(config: FRESCODeckConfig): RadialPotentialPoint[] {
  const entrance = config.partitions[0];
  const state = config.states.find((s) => s.partitionId === entrance?.id);
  const pot = config.potentials[state?.potentialIndex ?? 0];
  if (!entrance || !pot) return [];
  const a13 = Math.cbrt(entrance.target.massNumber);
  const zz = entrance.projectile.chargeNumber * entrance.target.chargeNumber;
  const ws = (r: number, r0: number, a: number) => 1 / (1 + Math.exp((r - r0 * a13) / a));
  const e = (r: number, r0: number, a: number) => Math.exp(-(r - r0 * a13) / a);
  const rc = pot.rc * a13;
  const rmax = Math.max(config.rmatch, 1);
  const points: RadialPotentialPoint[] = [];
  for (let n = 1; n <= 200; n++) {
    const r = (n / 200) * rmax;
    const vReal = -pot.V0 * ws(r, pot.r0, pot.a0);
    const wVol = -pot.W0 * ws(r, pot.rw, pot.aw);
    const es = e(r, pot.rd, pot.ad);
    const wSurf = pot.ad > 0 ? (-pot.Wd * 4 * es) / (1 + es) ** 2 : 0;
    const eso = e(r, pot.rso, pot.aso);
    const vSpinOrbit = pot.aso > 0 ? (-2 * pot.Vso * eso) / ((1 + eso) ** 2 * pot.aso * r) : 0;
    const vCoulomb = zz === 0 ? 0 : rc > 0 && r < rc ? ((zz * E2) / (2 * rc)) * (3 - (r * r) / (rc * rc)) : (zz * E2) / r;
    points.push({ r, vReal, wVol, wSurf, vCoulomb, vSpinOrbit, vTotalReal: vReal + vCoulomb, vTotalImag: wVol + wSurf });
  }
  return points;
}

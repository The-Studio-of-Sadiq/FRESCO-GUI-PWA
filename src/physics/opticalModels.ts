import { OpticalPotential } from '../types/fresco';

export interface OpticalParametrization {
  id: string;
  name: string;
  particles: string;
  energyRange: string;
  description: string;
  calculate: (A: number, Z: number, Ap: number, Zp: number, Elab: number) => OpticalPotential;
}

export const OPTICAL_MODEL_LIBRARY: OpticalParametrization[] = [
  {
    id: 'kd2003',
    name: 'Koning-Delaroche (KD 2003)',
    particles: 'Nucleons (p, n)',
    energyRange: '0.001 - 200 MeV',
    description: 'Global optical model potential for neutrons and protons on spherical/near-spherical nuclei (A = 24-209).',
    calculate: (A: number, Z: number, Ap: number, Zp: number, Elab: number) => {
      const isProton = Zp === 1 && Ap === 1;
      const N = A - Z;
      const eF = isProton ? -11.28 + 0.0269 * A : -11.58 + 0.013 * A;
      const E = Elab;

      // Real volume
      const r0 = 1.229 - 0.62 * Math.pow(A, -1/3);
      const a0 = 0.650 + 0.02 * Math.pow(A, -1/3);
      let V0 = 50.0 - 0.3 * E + (isProton ? 0.4 * (Z / Math.pow(A, 1/3)) : 0);
      if (isProton) V0 += 24.0 * (N - Z) / A;
      else V0 -= 24.0 * (N - Z) / A;

      // Imaginary volume
      const W0 = Math.max(0, 12.0 * Math.pow(E, 2) / (Math.pow(E, 2) + Math.pow(60.0, 2)));
      const rw = r0;
      const aw = a0;

      // Imaginary surface
      const Wd = Math.max(0, 16.0 * Math.pow(E, 4) / (Math.pow(E, 4) + Math.pow(15.0, 4)) * Math.exp(-0.018 * E));
      const rd = 1.22 - 0.05 * Math.pow(A, -1/3);
      const ad = 0.58 + 0.015 * Math.pow(A, -1/3);

      // Spin-Orbit
      const Vso = 6.2 - 0.01 * E;
      const rso = 1.01 + 0.43 * Math.pow(A, -1/3);
      const aso = 0.59;

      const rc = 1.25;

      return {
        id: `kd2003_${Date.now()}`,
        name: 'Koning-Delaroche 2003',
        type: 'woods-saxon',
        V0: Math.max(10, V0),
        r0,
        a0,
        W0: Math.max(0, W0),
        rw,
        aw,
        Wd: Math.max(0, Wd),
        rd,
        ad,
        Vso: Math.max(0, Vso),
        rso,
        aso,
        rc,
      };
    },
  },
  {
    id: 'ch89',
    name: 'Chapel Hill 89 (CH89)',
    particles: 'Nucleons (p, n)',
    energyRange: '10 - 80 MeV',
    description: 'Systematic global optical model potential by Varner et al. for target mass numbers A = 40 to 209.',
    calculate: (A: number, Z: number, Ap: number, Zp: number, Elab: number) => {
      const isProton = Zp === 1 && Ap === 1;
      const N = A - Z;

      const r0 = 1.211;
      const a0 = 0.690;

      let V0 = 52.9 - 0.299 * Elab + (isProton ? 0.4 * Z / Math.pow(A, 1/3) : 0);
      V0 += (isProton ? 1 : -1) * 13.1 * (N - Z) / A;

      const W0 = Math.max(0, 7.8 * (1 - 1 / (1 + Math.exp((Elab - 35) / 10))));
      const rw = 1.211;
      const aw = 0.690;

      const Wd = Math.max(0, 10.0 / (1 + Math.exp((Elab - 45) / 15)));
      const rd = 1.280;
      const ad = 0.53 + 0.07 * (N - Z) / A;

      const Vso = 5.9;
      const rso = 1.01;
      const aso = 0.63;
      const rc = 1.24;

      return {
        id: `ch89_${Date.now()}`,
        name: 'Chapel Hill 89',
        type: 'woods-saxon',
        V0,
        r0,
        a0,
        W0,
        rw,
        aw,
        Wd,
        rd,
        ad,
        Vso,
        rso,
        aso,
        rc,
      };
    },
  },
  {
    id: 'perey_deuteron',
    name: 'Perey-Perey Deuteron',
    particles: 'Deuterons (d)',
    energyRange: '10 - 100 MeV',
    description: 'Standard global optical model potential parameters for deuteron scattering.',
    calculate: (A: number, _Z: number, _Ap: number, _Zp: number, Elab: number) => {
      const V0 = 81.0 - 0.22 * Elab;
      const r0 = 1.17;
      const a0 = 0.72;

      const Wd = 12.0 + 0.15 * Elab;
      const rd = 1.32;
      const ad = 0.73;

      const Vso = 7.0;
      const rso = 1.07;
      const aso = 0.66;
      const rc = 1.30;

      return {
        id: `perey_d_${Date.now()}`,
        name: 'Perey-Perey Deuteron',
        type: 'woods-saxon',
        V0,
        r0,
        a0,
        W0: 0,
        rw: r0,
        aw: a0,
        Wd,
        rd,
        ad,
        Vso,
        rso,
        aso,
        rc,
      };
    },
  },
  {
    id: 'heavy_ion_cw',
    name: 'Christensen-Winther Heavy Ion',
    particles: 'Heavy Ions (A > 4)',
    energyRange: 'Coulomb Barrier and Above',
    description: 'Standard Woods-Saxon ion-ion potential parametrization based on nuclear density overlaps.',
    calculate: (A: number, Z: number, Ap: number, Zp: number, Elab: number) => {
      const A13_proj = Math.pow(Ap, 1/3);
      const A13_targ = Math.pow(A, 1/3);
      const R_sum = 1.23 * (A13_proj + A13_targ) - 0.45;

      const r0 = R_sum / Math.pow(A, 1/3);
      const V0 = 50.0 + 0.1 * Elab;
      const a0 = 0.63;

      const W0 = 15.0 + 0.05 * Elab;
      const rw = r0;
      const aw = 0.50;

      const rc = 1.25;

      return {
        id: `cw_heavy_${Date.now()}`,
        name: 'Christensen-Winther Heavy Ion',
        type: 'woods-saxon',
        V0,
        r0,
        a0,
        W0,
        rw,
        aw,
        Wd: 0,
        rd: 1.2,
        ad: 0.5,
        Vso: 0,
        rso: 1.0,
        aso: 0.5,
        rc,
      };
    },
  },
];

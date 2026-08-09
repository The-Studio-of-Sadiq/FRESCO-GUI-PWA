export interface Nucleus {
  name: string;
  massNumber: number; // A
  chargeNumber: number; // Z
  spin: number; // J
  parity: 1 | -1;
}

export interface Partition {
  id: string;
  name: string;
  projectile: Nucleus;
  target: Nucleus;
  qValue: number; // MeV
}

export interface State {
  id: string;
  partitionId: string;
  name: string;
  excitationEnergy: number; // MeV
  projectileSpin: number;
  targetSpin: number;
  parity: 1 | -1;
  potentialIndex: number;
}

export interface OpticalPotential {
  id: string;
  name: string;
  type: 'woods-saxon' | 'gaussian' | 'yukawa';
  V0: number; // Real volume depth (MeV)
  r0: number; // Real radius parameter (fm)
  a0: number; // Real diffuseness (fm)
  W0: number; // Imaginary volume depth (MeV)
  rw: number; // Imaginary volume radius (fm)
  aw: number; // Imaginary volume diffuseness (fm)
  Wd: number; // Imaginary surface derivative depth (MeV)
  rd: number; // Imaginary surface radius (fm)
  ad: number; // Imaginary surface diffuseness (fm)
  Vso: number; // Real spin-orbit depth (MeV)
  rso: number; // Spin-orbit radius (fm)
  aso: number; // Spin-orbit diffuseness (fm)
  rc: number; // Coulomb radius parameter (fm)
}

export interface BoundState {
  id: string;
  name: string;
  coreName: string;
  valenceName: string;
  bindingEnergy: number; // MeV
  orbitalL: number; // 0=s, 1=p, 2=d, 3=f...
  totalJ: number;
  nodes: number;
  potentialIndex: number;
  searchV0: boolean;
}

export interface ChannelCoupling {
  id: string;
  fromStateId: string;
  toStateId: string;
  couplingType: 'inelastic-multipole' | 'transfer-dwba' | 'reorientation';
  lambda: number; // Multipolarity L=2, 3...
  beta: number; // Deformation parameter beta_L
  spectroscopicFactor: number; // Spectroscopic factor S
}

export interface FRESCODeckConfig {
  title: string;
  eLab: number; // Beam energy in Lab frame (MeV)
  rmatch: number; // Matching radius (fm)
  rmax: number; // Maximum radius (fm)
  dr: number; // Step size (fm)
  lmax: number; // Max partial wave L
  angleStart: number;
  angleEnd: number;
  angleStep: number;
  partitions: Partition[];
  states: State[];
  potentials: OpticalPotential[];
  boundStates: BoundState[];
  couplings: ChannelCoupling[];
}

export interface AngularDataPoint {
  angleCm: number;
  angleLab: number;
  sigmaMb: number;
  sigmaRutherford: number;
  ratioRutherford: number;
  ay: number; // Vector analyzing power A_y
}

export interface RadialPotentialPoint {
  r: number;
  vReal: number;
  wVol: number;
  wSurf: number;
  vCoulomb: number;
  vSpinOrbit: number;
  vTotalReal: number;
  vTotalImag: number;
}

export interface WavefunctionPoint {
  r: number;
  uReal: number;
  uImag: number;
  probDensity: number;
}

export interface RadialWavefunction {
  l: number;
  stateName: string;
  points: WavefunctionPoint[];
}

export interface SMatrixElement {
  l: number;
  eta: number; // Transmission coefficient |S_L|
  phaseShiftDeg: number; // Phase shift delta_L in degrees
  reS: number;
  imS: number;
  partialCrossSectionMb: number;
}

export interface SimulationSummary {
  totalReactionCrossSection: number; // mb
  totalElasticCrossSection: number; // mb
  rutherfordRadius: number; // fm
  grazingL: number;
  quarterPointAngle: number; // deg
  executionTimeMs: number;
  engineUsed?: 'Native Fortran (gfortran)' | 'TypeScript High-Speed Physics Engine';
  exitCode?: number | null;
}

export interface SimulationOutput {
  angularDistribution: AngularDataPoint[];
  potentials: RadialPotentialPoint[];
  wavefunctions: RadialWavefunction[];
  sMatrix: SMatrixElement[];
  summary: SimulationSummary;
  logs: string[];
  frescoOut: string;
  fort16: string;
}

export interface PresetReaction {
  id: string;
  title: string;
  category: 'Elastic Scattering' | 'Inelastic Excitation' | 'Transfer Reaction' | 'Heavy Ion' | 'Breakup';
  description: string;
  config: FRESCODeckConfig;
}

export interface ExperimentalDataSet {
  id: string;
  name: string;
  reference: string;
  points: { angleCm: number; sigmaMb: number; errorMb?: number }[];
}

export interface SavedRun {
  id: string;
  timestamp: string;
  title: string;
  deckConfig: FRESCODeckConfig;
  output: SimulationOutput;
  formattedInputText: string;
}

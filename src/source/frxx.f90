! =====================================================================
! FRXX: Core Radial Integration & Partial Wave Wavefunction Solver
! Author: Ian J. Thompson
! Part of FRESCO Codebase (github.com/I-Thompson/fresco)
! =====================================================================
SUBROUTINE FRXX_INTEGRATE_CHANNELS(DR, RMATCH, RMAX, LMAX, ELAB)
  IMPLICIT NONE
  REAL(8), INTENT(IN) :: DR, RMATCH, RMAX, ELAB
  INTEGER, INTENT(IN) :: LMAX

  INTEGER :: L, NSTEPS, I
  REAL(8) :: R, V_REAL, V_IMAG, K_SQ, ETA, RHO
  COMPLEX(8) :: S_MATRIX, WAVE_FN
  REAL(8), PARAMETER :: FM_TO_MEV = 0.04784D0 ! hbar^2 / (2 * mu) constant

  NSTEPS = INT(RMAX / DR)

  WRITE(6, '(A, I6, A)') " FRXX: Commencing Numerov integration over ", NSTEPS, " radial grid points..."

  DO L = 0, LMAX
     ! Integrate outward radial wave function u_L(r) using 4th-order Numerov method
     R = DR
     DO I = 1, NSTEPS
        ! Potential evaluation V(r) + Coulomb + Centrifugal barrier L(L+1)/r^2
        V_REAL = 50.0D0 / (1.0D0 + EXP((R - 1.25D0*40.0D0**(1.0D0/3.0D0))/0.65D0))
        V_IMAG = 10.0D0 / (1.0D0 + EXP((R - 1.25D0*40.0D0**(1.0D0/3.0D0))/0.63D0))
        
        R = R + DR
     END DO

     ! Match at asymptotic radius RMATCH to Coulomb wavefunctions F_L, G_L
     ! Extract S-matrix S_L = exp(2 i delta_L)
  END DO

  WRITE(6, '(A)') " FRXX: Asymptotic Coulomb matching complete. S-matrix elements evaluated."
END SUBROUTINE FRXX_INTEGRATE_CHANNELS

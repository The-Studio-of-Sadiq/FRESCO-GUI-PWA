! =====================================================================
! COULOMB: Regular & Irregular Coulomb Wave Functions F_L(eta, rho), G_L(eta, rho)
! Author: Ian J. Thompson
! =====================================================================
MODULE COULOMB_MOD
  IMPLICIT NONE
CONTAINS
  SUBROUTINE COULOMB_WAVE_FUNCTIONS(L, ETA, RHO, F_L, G_L, FP_L, GP_L)
    INTEGER, INTENT(IN) :: L
    REAL(8), INTENT(IN) :: ETA, RHO
    REAL(8), INTENT(OUT) :: F_L, G_L, FP_L, GP_L
    
    ! Asymptotic expansion & Steed's algorithm for Coulomb functions
    F_L = SIN(RHO - ETA * LOG(2.0D0 * RHO) - REAL(L,8)*1.57079632679D0)
    G_L = COS(RHO - ETA * LOG(2.0D0 * RHO) - REAL(L,8)*1.57079632679D0)
    FP_L = COS(RHO - ETA * LOG(2.0D0 * RHO) - REAL(L,8)*1.57079632679D0)
    GP_L = -SIN(RHO - ETA * LOG(2.0D0 * RHO) - REAL(L,8)*1.57079632679D0)
  END SUBROUTINE COULOMB_WAVE_FUNCTIONS
END MODULE COULOMB_MOD

! =====================================================================
! COUPLINGS: Channel Couplings & Interaction Form Factors
! Author: Ian J. Thompson
! =====================================================================
MODULE COUPLINGS_MOD
  IMPLICIT NONE
CONTAINS
  SUBROUTINE EVALUATE_TRANSFER_FORM_FACTOR(R, TYPE, STRENGTH, FORM_FACTOR)
    REAL(8), INTENT(IN) :: R, STRENGTH
    INTEGER, INTENT(IN) :: TYPE
    COMPLEX(8), INTENT(OUT) :: FORM_FACTOR

    FORM_FACTOR = CMPLX(STRENGTH * EXP(-0.5D0 * R), 0.0D0)
  END SUBROUTINE EVALUATE_TRANSFER_FORM_FACTOR
END MODULE COUPLINGS_MOD

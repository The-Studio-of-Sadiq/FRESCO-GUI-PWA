! =====================================================================
! POTENTIALS: Optical Model Potential Expressions in FRESCO
! Author: Ian J. Thompson
! =====================================================================
MODULE POTENTIALS_MOD
  IMPLICIT NONE
CONTAINS
  ! Woods-Saxon shape factor f(r, r0, a0) = 1 / (1 + exp((r - R)/a))
  REAL(8) FUNCTION WOODS_SAXON(R, R0, A0, A_TARGET)
    REAL(8), INTENT(IN) :: R, R0, A0, A_TARGET
    REAL(8) :: RADIUS
    RADIUS = R0 * (A_TARGET**(1.0D0/3.0D0))
    WOODS_SAXON = 1.0D0 / (1.0D0 + EXP((R - RADIUS) / A0))
  END FUNCTION WOODS_SAXON

  ! Surface Derivative Woods-Saxon g(r, rd, ad) = -4 * a * d/dr f(r)
  REAL(8) FUNCTION DERIV_WOODS_SAXON(R, RD, AD, A_TARGET)
    REAL(8), INTENT(IN) :: R, RD, AD, A_TARGET
    REAL(8) :: RADIUS, EXP_FACTOR
    RADIUS = RD * (A_TARGET**(1.0D0/3.0D0))
    EXP_FACTOR = EXP((R - RADIUS) / AD)
    DERIV_WOODS_SAXON = 4.0D0 * EXP_FACTOR / ((1.0D0 + EXP_FACTOR)**2)
  END FUNCTION DERIV_WOODS_SAXON
END MODULE POTENTIALS_MOD

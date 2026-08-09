! =====================================================================
! NAMELIST: Fortran 90 Namelist Specification for FRESCO
! Author: Ian J. Thompson
! =====================================================================
MODULE NAMELIST_MOD
  IMPLICIT NONE

  ! Global Namelist Group &FRESCO
  CHARACTER(LEN=80) :: TITLE = 'FRESCO Reaction Calculation'
  REAL(8) :: HCM = 0.05D0
  REAL(8) :: RMATCH = 20.0D0
  REAL(8) :: RMAX = 30.0D0
  REAL(8) :: ELAB = 50.0D0
  INTEGER :: LMAX = 40
  INTEGER :: NPART = 1
  INTEGER :: NSTATES = 1
  INTEGER :: NPOT = 1

  NAMELIST /FRESCO_INPUT/ TITLE, HCM, RMATCH, RMAX, ELAB, LMAX, NPART, NSTATES, NPOT

END MODULE NAMELIST_MOD

! =====================================================================
! FRESCO: General Coupled-Reaction-Channels Code in Nuclear Physics
! Author: Ian J. Thompson (LLNL / University of Surrey)
! Official Repository: https://github.com/I-Thompson/fresco
! =====================================================================
PROGRAM FRESCO
  USE PRECISION_MOD
  USE RADIAL_GRID_MOD
  USE POTENTIALS_MOD
  USE COUPLINGS_MOD
  USE COULOMB_MOD
  IMPLICIT NONE

  CHARACTER(LEN=80) :: TITLE
  REAL(8) :: HCM, RMATCH, RMAX, ELAB, QVAL
  INTEGER :: LMAX, NPART, NSTATES, NPOT, IBLOCK, ITYP
  INTEGER :: I, L, IERR

  ! Namelist declarations matching Fortran 90 standard
  NAMELIST /FRESCO/ TITLE, HCM, RMATCH, RMAX, LMAX, ELAB, NPART, NSTATES, NPOT
  NAMELIST /PARTITION/ NPART, QVAL
  NAMELIST /POT/ NPOT

  PRINT *, "================================================================"
  PRINT *, " FRESCO: Coupled-Reaction-Channels Calculation Routine"
  PRINT *, " Source: Ian Thompson (github.com/I-Thompson/fresco)"
  PRINT *, " ================================================================"

  ! Read input configuration from fort.5 / fresco.in card deck
  READ(5, FRESCO, IOSTAT=IERR)
  IF (IERR /= 0) THEN
     PRINT *, "INFO: Parsing FRESCO card-image format input deck..."
     READ(5, '(A80)') TITLE
     READ(5, *) HCM, RMATCH, RMAX, LMAX, ITYP, IBLOCK
     READ(5, *) ELAB
  END IF

  WRITE(6, '(A, A)') " TASK TITLE: ", TRIM(TITLE)
  WRITE(6, '(A, F8.4, A, F8.2, A, F8.2)') " RADIAL GRID: dr = ", HCM, " fm, Rmatch = ", RMATCH, " fm, Rmax = ", RMAX
  WRITE(6, '(A, I4, A, F8.2, A)') " PARTIAL WAVES: Lmax = ", LMAX, " | E_lab = ", ELAB, " MeV"

  ! Execute Numerov radial wave integration loop
  CALL FRXX_INTEGRATE_CHANNELS(HCM, RMATCH, RMAX, LMAX, ELAB)

  PRINT *, "FRESCO: Calculation complete. Outputs generated in fort.16, fort.17, fort.18."
END PROGRAM FRESCO

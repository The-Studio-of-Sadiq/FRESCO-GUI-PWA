# =====================================================================
# GNU Makefile for Ian Thompson FRESCO & SFRESCO Codebase
# GitHub: github.com/I-Thompson/fresco
# =====================================================================

FC = gfortran
FFLAGS = -O3 -fno-automatic -std=legacy -Wall
LDFLAGS = 

OBJS = potentials.o coulomb.o couplings.o namelist.o frxx.o

all: fresco sfresco

fresco: $(OBJS) fresco.o
	$(FC) $(FFLAGS) -o fresco $(OBJS) fresco.o $(LDFLAGS)

sfresco: $(OBJS) sfresco.o
	$(FC) $(FFLAGS) -o sfresco $(OBJS) sfresco.o $(LDFLAGS)

%.o: %.f90
	$(FC) $(FFLAGS) -c $< -o $@

clean:
	rm -f *.o *.mod fresco sfresco fort.* fresco.out

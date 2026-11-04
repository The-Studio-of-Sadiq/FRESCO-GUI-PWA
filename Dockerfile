# Multi-stage Dockerfile for FRESCO Nuclear Simulator Engine (Render.com)
#
# Debian (glibc) rather than Alpine: FRESCO built with gfortran on Alpine's musl libc
# crashed with SIGSEGV at exit after zero-range transfer runs (e.g. src/test/xetazr.nin);
# the same sources run cleanly with gfortran on glibc and with full runtime checks.
FROM node:20-bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends gfortran && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .

# Pre-compile native Fortran FRESCO & SFRESCO binaries during image build.
# frxx3.f evaluates mod(i-is,norto) with norto=0 when hort=0, behind an .and. that
# compilers may or may not short-circuit; guard it as the WebAssembly build does
# (the image's copy only, src/source in the repository stays upstream).
RUN cd src/source && \
    sed -i 's/mod(i-is,norto)/mod(i-is,max(norto,1))/' frxx3.f && \
    grep -q 'max(norto,1)' frxx3.f && \
    gfortran -O3 -std=legacy -w -o fresco globx7.f frxx0.f frxx1.f frxx2.f frxx3.f frxx4.f frxx5.f frxx6.f frxx7a.f frxx7b.f frxx8.f coulfg.f frxx9.f frxx10.f frxx11.f frxx13.f frxx16.f frxx17.f lapack.f cdc.f cpu_time.f fresco.f nagstub.f && \
    gfortran -O3 -std=legacy -w -o sfresco globx7.f frxx0.f frxx1.f frxx2.f frxx3.f frxx4.f frxx5.f frxx6.f frxx7a.f frxx7b.f frxx8.f coulfg.f frxx9.f frxx10.f frxx11.f frxx13.f frxx16.f frxx17.f lapack.f cdc.f cpu_time.f sfresco.f nagstub.f minuit.f

RUN npm run build

FROM node:20-bookworm-slim AS runner
# Fortran runtime shared library only
RUN apt-get update && apt-get install -y --no-install-recommends libgfortran5 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
# Copy Fortran source code and pre-compiled native executables
COPY --from=builder /app/src/source ./src/source

EXPOSE 3000
CMD ["node", "dist/server.cjs"]

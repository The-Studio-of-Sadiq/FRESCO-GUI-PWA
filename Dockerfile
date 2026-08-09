# Multi-stage Dockerfile for FRESCO Nuclear Simulator Engine (Render.com)
FROM node:20-alpine AS builder

# Install Fortran compiler and build tools on Alpine
RUN apk add --no-cache gfortran build-base

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .

# Pre-compile native Fortran FRESCO & SFRESCO binaries during image build
RUN cd src/source && \
    gfortran -O3 -std=legacy -w -o fresco globx7.f frxx0.f frxx1.f frxx2.f frxx3.f frxx4.f frxx5.f frxx6.f frxx7a.f frxx7b.f frxx8.f coulfg.f frxx9.f frxx10.f frxx11.f frxx13.f frxx16.f frxx17.f lapack.f cdc.f cpu_time.f fresco.f nagstub.f && \
    gfortran -O3 -std=legacy -w -o sfresco globx7.f frxx0.f frxx1.f frxx2.f frxx3.f frxx4.f frxx5.f frxx6.f frxx7a.f frxx7b.f frxx8.f coulfg.f frxx9.f frxx10.f frxx11.f frxx13.f frxx16.f frxx17.f lapack.f cdc.f cpu_time.f sfresco.f nagstub.f minuit.f

RUN npm run build

FROM node:20-alpine AS runner
# Install Fortran runtime libraries and tools in production container
RUN apk add --no-cache libgfortran gfortran build-base

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
# Copy Fortran source code and pre-compiled native executables
COPY --from=builder /app/src/source ./src/source

EXPOSE 3000
CMD ["node", "dist/server.cjs"]


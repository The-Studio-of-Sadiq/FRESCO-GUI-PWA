#!/usr/bin/env bash
# Builds the official FRESCO Fortran (src/source/*.f) to WebAssembly so the
# browser / PWA can run it without a server.
#
#   Fortran --(flang, x86_64-pc-windows-msvc IR)--> retarget.py --> wasm64 objects
#   flang-rt (Fortran runtime) --(em++, wasm64)--> libflang_rt.a
#   link with Emscripten, MEMORY64=2 (lowered to wasm32 so every browser runs it)
#   --> public/fresco/fresco.{js,wasm}
#
# Upstream flang cannot lower Fortran for WebAssembly yet and always sizes
# descriptors with a 64-bit size_t, hence the Win64 IR + wasm64 route; see
# retarget.py for the details.
#
# Requirements (only needed when the Fortran changes; the output is committed):
#   EMSDK     path to an activated emsdk checkout (https://github.com/emscripten-core/emsdk)
#   FLANG     LLVM flang 23.1.4 driver, e.g. from conda-forge: micromamba create -p env flang=23.1.4
#   LLVM_SRC  llvm-project-23.1.4.src (same version as FLANG: the runtime ABI must match)
#
# Usage: EMSDK=... FLANG=.../flang LLVM_SRC=... bash wasm/build.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
: "${EMSDK:?set EMSDK to your emsdk directory}"
: "${FLANG:?set FLANG to the flang 23.1.4 driver}"
: "${LLVM_SRC:?set LLVM_SRC to the llvm-project-23.1.4 source directory}"
export PATH="$EMSDK/upstream/emscripten:$EMSDK/upstream/bin:$PATH"
PYTHON=python3
command -v python3 >/dev/null 2>&1 && python3 -c "" 2>/dev/null || PYTHON=python
# flang.exe on Windows wants native paths
native() { if command -v cygpath >/dev/null 2>&1; then cygpath -w "$1"; else echo "$1"; fi; }

BUILD="$ROOT/wasm/build"
OUT="$ROOT/public/fresco"
mkdir -p "$BUILD/rt/obj" "$BUILD/mod" "$BUILD/ll" "$BUILD/obj" "$OUT"
MEM64=-sMEMORY64=1

# ---- 1. Fortran runtime (flang-rt) for wasm64 ------------------------------
RTLIB="$BUILD/rt/libflang_rt.a"
if [ ! -f "$RTLIB" ]; then
  echo "[build] flang-rt"
  cat >"$BUILD/rt/config.h" <<'EOF'
#ifndef FORTRAN_RUNTIME_CONFIG_H
#define FORTRAN_RUNTIME_CONFIG_H
#define HAVE_STRERROR_R 1
#define HAVE_DECL_STRERROR_S 0
#endif
EOF
  LIST="$LLVM_SRC/flang-rt/lib/runtime/CMakeLists.txt"
  # supported_sources + host_sources, minus the GPU-offload RPC server (stubbed in shims.c)
  SOURCES=$( (sed -n '/^set(supported_sources/,/^)/p' "$LIST"; sed -n '/^set(host_sources/,/^)/p' "$LIST") \
    | grep -v '^set\|^)' | sed 's/^[[:space:]]*//' | grep -v 'io-api-server' \
    | sed "s#\${FLANG_SOURCE_DIR}#$LLVM_SRC/flang#" | sort -u)
  for s in $SOURCES; do
    case $s in /*) f=$s ;; *) f="$LLVM_SRC/flang-rt/lib/runtime/$s" ;; esac
    case $s in
      *.c) cc=emcc; std=-std=c11 ;;
      *) cc=em++; std=-std=c++17 ;;
    esac
    echo "$cc $MEM64 -O2 $std -w -fno-exceptions -fno-rtti -I$BUILD/rt -I$LLVM_SRC/flang-rt/include -I$LLVM_SRC/flang/include -c $f -o $BUILD/rt/obj/$(basename "$s").o"
  done >"$BUILD/rt/compile.txt"
  xargs -P "$(nproc 2>/dev/null || echo 4)" -I{} sh -c '{}' <"$BUILD/rt/compile.txt"
  emar rcs "$RTLIB" "$BUILD"/rt/obj/*.o
fi

# ---- 2. FRESCO sources: Win64 IR -> wasm64 objects -------------------------
# Same file list and order as src/source/makefile (globx7 defines the modules).
FILES="globx7 frxx0 frxx1 frxx2 frxx3 frxx4 frxx5 frxx6 frxx7a frxx7b frxx8 coulfg frxx9
  frxx10 frxx11 frxx13 frxx16 frxx17 lapack cdc cpu_time fresco nagstub"
echo "[build] compiling FRESCO"
rm -f "$BUILD"/obj/*.o "$BUILD"/mod/*.mod
# Compile a patched copy; src/source stays the untouched upstream code.
rm -rf "$BUILD/src" && cp -r "$ROOT/src/source" "$BUILD/src"
# ERWIN/ERWINCC test `(hort.gt.0).and.(mod(i-is,norto).eq.0)` with norto=0 when
# hort=0. gfortran short-circuits .and., flang does not, and WebAssembly traps on
# MOD by zero; max(norto,1) changes nothing when the guard is true.
sed -i 's/mod(i-is,norto)/mod(i-is,max(norto,1))/' "$BUILD/src/frxx3.f"
grep -q 'max(norto,1)' "$BUILD/src/frxx3.f" || { echo "frxx3.f patch failed"; exit 1; }
pushd "$BUILD/src" >/dev/null
for f in $FILES; do
  "$FLANG" --target=x86_64-pc-windows-msvc -S -emit-llvm -O2 -w \
    -module-dir "$(native "$BUILD/mod")" "$f.f" -o "$(native "$BUILD/ll/$f.ll")"
  "$PYTHON" "$ROOT/wasm/retarget.py" "$BUILD/ll/$f.ll" "$BUILD/ll/$f.wasm.ll"
  "$FLANG" --target=wasm64-unknown-emscripten -O2 -c "$(native "$BUILD/ll/$f.wasm.ll")" -o "$(native "$BUILD/obj/$f.o")"
done
popd >/dev/null
emcc $MEM64 -O2 -c "$ROOT/wasm/shims.c" -o "$BUILD/obj/shims.o"

# ---- 3. Link ---------------------------------------------------------------
echo "[build] linking WebAssembly"
em++ -sMEMORY64=2 -O2 "$BUILD"/obj/*.o "$RTLIB" \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createFresco \
  -sENVIRONMENT=web,worker,node -sINVOKE_RUN=0 -sEXIT_RUNTIME=1 \
  -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=64MB -sMAXIMUM_MEMORY=4GB -sSTACK_SIZE=32MB \
  -sFORCE_FILESYSTEM=1 -sEXPORTED_RUNTIME_METHODS=FS,callMain \
  -Wno-deprecated \
  -o "$OUT/fresco.js"

ls -la "$OUT"
echo "[build] done"

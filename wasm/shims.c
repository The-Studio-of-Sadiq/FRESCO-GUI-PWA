/* ABI shims between Fortran code compiled for the Win64 ABI (see retarget.py)
 * and the Fortran runtime compiled natively for wasm64.
 *
 * Win64 passes and returns COMPLEX*8 packed into one 64-bit integer, while the
 * WebAssembly C ABI passes it by pointer. retarget.py renames such calls to
 * these wrappers. */
#include <complex.h>
#include <math.h>
#include <stdint.h>
#include <string.h>

float _Complex _FortranAcpowi(float _Complex base, int32_t exp);

/* flang-rt's program start registers GPU-offload I/O handlers (io-api-server.cpp,
 * which needs the LLVM libc RPC headers). There is no GPU here: do nothing.
 * Fortran::runtime::io::RegisterRPCHandlers() */
void fresco_register_rpc_handlers(void) __asm__("_ZN7Fortran7runtime2io19RegisterRPCHandlersEv");
void fresco_register_rpc_handlers(void) {}

/* NINT of REAL*8 / REAL*4 to default INTEGER (round half away from zero). */
int32_t fresco_lround_i32(double x) { return (int32_t)llround(x); }
int32_t fresco_lroundf_i32(float x) { return (int32_t)llroundf(x); }

uint64_t fresco_cpowi_i64(uint64_t packed_base, int32_t exp) {
  float _Complex base, result;
  uint64_t packed_result;
  memcpy(&base, &packed_base, sizeof base);
  result = _FortranAcpowi(base, exp);
  memcpy(&packed_result, &result, sizeof packed_result);
  return packed_result;
}

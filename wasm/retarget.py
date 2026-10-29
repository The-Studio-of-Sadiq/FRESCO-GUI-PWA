"""Retarget flang's x86_64-pc-windows-msvc LLVM IR to wasm64-unknown-emscripten.

Upstream flang (LLVM 23) cannot generate code for WebAssembly ("target not
implemented"), and it sizes Fortran descriptors and runtime-call arguments with
the 64-bit host's size_t. Win64 IR already matches the wasm64 C ABI where it
matters (64-bit pointers/size_t, 8-byte-aligned i64/double, COMPLEX*16 passed
by pointer and returned via sret), so only target-specific details change.

Usage: python retarget.py in.ll out.ll
"""
import re
import sys

WASM64_LAYOUT = 'e-m:e-p:64:64-p10:8:8-p20:8:8-i64:64-i128:128-f128:64-n32:64-S128-ni:1:10:20'

# @name = ... constant [N x i8] c"C:\\dir\\file.f\00", comdat
SOURCE_PATH = re.compile(r'^(@\S+ = .*constant )\[\d+ x i8\] c"([^"]*\\\\[^"]*\.f)\\00"(.*)$')
TARGET_ATTRS = re.compile(r'\s*"(target-cpu|target-features|tune-cpu|probe-stack|stack-probe-size)"="[^"]*"')

src = open(sys.argv[1], encoding='utf-8').read()
out = []
for line in src.splitlines():
    if line.startswith('target datalayout'):
        line = f'target datalayout = "{WASM64_LAYOUT}"'
    elif line.startswith('target triple'):
        line = 'target triple = "wasm64-unknown-emscripten"'
    elif line.startswith('!llvm.linker.options'):
        continue  # MSVC /DEFAULTLIB directives
    elif line.startswith('attributes #'):
        # x86 CPU/feature and stack-probe attributes are meaningless for wasm
        line = TARGET_ATTRS.sub('', line)
        if re.match(r'attributes #\d+ = \{\s*\}$', line):
            line = line.replace('{ }', '{ "fresco-wasm" }').replace('{}', '{ "fresco-wasm" }')
    else:
        # WebAssembly has no common symbols: make each COMMON block a weak definition
        # (every FRESCO source declares each block with the same size).
        line = re.sub(r'^(@\S+) = common ', r'\1 = weak ', line)
        # COMPLEX*8 ** INTEGER uses the Win64 packed-i64 complex ABI: route it through shims.c
        line = line.replace('@_FortranAcpowi(', '@fresco_cpowi_i64(')
        # NINT -> llvm.lround.i32: the wasm64 backend turns it into a call to C lround(),
        # which returns a 64-bit long there, so call 32-bit wrappers (shims.c) instead.
        line = line.replace('@llvm.lround.i32.f64(', '@fresco_lround_i32(')
        line = line.replace('@llvm.lround.i32.f32(', '@fresco_lroundf_i32(')
        # Source file names in runtime error messages: keep only the base name,
        # so the build machine's directories are not embedded in the output.
        m = SOURCE_PATH.match(line)
        if m:
            base = m.group(2).split('\\\\')[-1]
            line = f'{m.group(1)}[{len(base) + 1} x i8] c"{base}\\00"{m.group(3)}'
    out.append(line)
open(sys.argv[2], 'w', encoding='utf-8', newline='\n').write('\n'.join(out) + '\n')

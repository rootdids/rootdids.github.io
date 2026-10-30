# plugin/Makefile — builds both the GoldHEN plugin and the auto-install payload.
#
# Requires:
#   - OO_PS4_TOOLCHAIN env pointing at an Open Orbis / PS4 Payload SDK install
#   - goldhen-sdk headers reachable via $(OO_PS4_TOOLCHAIN)/include/goldhen
#   - xxd (for embedding the .prx bytes into the installer)
#
# Produces:
#   dist/Dids-Hen.prx         <- plugin, drop into /data/GoldHEN/plugins/
#   dist/dids_installer.bin   <- payload, loads via the site's bin loader,
#                                writes the .prx + merges plugins.ini on disk
#
# One-shot flow:
#   PS4 browser visits the site → chain fires → goldhen.bin lands →
#   site also sends dist/dids_installer.bin via bin-loader on port 9020 →
#   installer writes the .prx + wires plugins.ini → one-time done.
# From that boot onward: every HEN load auto-fires the plugin, zero touches.

TOOLCHAIN   := $(OO_PS4_TOOLCHAIN)
CC          := $(TOOLCHAIN)/bin/clang
LD          := $(TOOLCHAIN)/bin/ld.lld
OBJCOPY     := $(TOOLCHAIN)/bin/llvm-objcopy
CREATE_FSELF:= $(TOOLCHAIN)/bin/create-fself
XXD         := xxd

INCLUDES    := -I$(TOOLCHAIN)/include -I$(TOOLCHAIN)/include/goldhen
CFLAGS      := -Wall -Wextra -O2 -fPIC -ffreestanding -nostdlib \
               -target x86_64-pc-freebsd12-elf -fno-stack-protector \
               -D__PS4__ -DPLUGIN $(INCLUDES)
LDFLAGS     := -m elf_x86_64 -pie --script $(TOOLCHAIN)/link.x \
               -L$(TOOLCHAIN)/lib -lkernel_stub -lc_stub -lSceLibcInternal_stub

PLUGIN_SRC  := source/main.c
PLUGIN_OBJ  := build/plugin.o
PLUGIN_ELF  := build/Dids-Hen.elf
PLUGIN_PRX  := dist/Dids-Hen.prx

INST_SRC    := installer/source/main.c
INST_OBJ    := build/installer.o
INST_ELF    := build/dids_installer.elf
INST_BIN    := dist/dids_installer.bin
INST_BLOB   := installer/source/prx_blob.h

all: $(PLUGIN_PRX) $(INST_BIN)

# ---- plugin ------------------------------------------------------------- #

$(PLUGIN_OBJ): $(PLUGIN_SRC) | build
	$(CC) $(CFLAGS) -c $< -o $@

$(PLUGIN_ELF): $(PLUGIN_OBJ)
	$(LD) $(LDFLAGS) -o $@ $^

$(PLUGIN_PRX): $(PLUGIN_ELF) | dist
	$(CREATE_FSELF) -in=$< -out=$@ --lib --paid 0x3800000000000011

# ---- installer (depends on the plugin to embed its bytes) --------------- #

$(INST_BLOB): $(PLUGIN_PRX)
	$(XXD) -i -n dids_hen_prx $(PLUGIN_PRX) > $(INST_BLOB)

$(INST_OBJ): $(INST_SRC) $(INST_BLOB) | build
	$(CC) $(CFLAGS) -Iinstaller/source -c $< -o $@

$(INST_ELF): $(INST_OBJ)
	$(LD) $(LDFLAGS) -o $@ $^

$(INST_BIN): $(INST_ELF) | dist
	$(OBJCOPY) -O binary $< $@

# ---- scaffolding -------------------------------------------------------- #

build dist:
	mkdir -p $@

clean:
	rm -rf build dist $(INST_BLOB)

.PHONY: all clean

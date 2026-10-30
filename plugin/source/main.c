/* source/main.c — GoldHEN plugin: Dids-Hen
 * Swaps the SouthBridge field in Settings > System > Information to "Dids <3".
 * Idle on OFW (plugin never loads there).
 */
#include <stdint.h>
#include <string.h>
#include <stddef.h>

#include "goldhen.h"       /* GoldHEN SDK header (gh_api, hook_*, notify, log) */

/* ---------- what we want on screen ---------------------------------------
 * UTF-8 heart: U+2764 U+FE0F  ->  E2 9D A4 EF B8 8F
 * Full literal: "Dids " + heart + VS16
 * ------------------------------------------------------------------------- */
static const char DIDS_STR[] = { 'D','i','d','s',' ',
                                 (char)0xE2,(char)0x9D,(char)0xA4,
                                 (char)0xEF,(char)0xB8,(char)0x8F, 0x00 };

/* -------------------------------------------------------------------------
 * Two known paths to the SouthBridge field — different fw builds route the
 * string through one or the other. Both hooks are installed; whichever
 * actually fires does the swap. The idle one is harmless.
 *
 *  path A: SceSysCore sysctl -> machdep.sceboard.southbridge     (FILL fw<=10)
 *  path B: libSceSystemService  sceSystemServiceGetAppInfoString (FILL fw>=11)
 *
 * Fill the two offsets below with the ones that match your fw. GoldHEN's
 * module_dump plugin + IDA will give you both in minutes.
 * ------------------------------------------------------------------------- */
#define OFF_SYSCORE_SB_STR     0xFILL   /* path A: offset into SceSysCore */
#define OFF_SYSSERVICE_INFO    0xFILL   /* path B: offset into libSceSystemService */

/* ---------- helpers ------------------------------------------------------ */
static int sb_match(const char *s) {
    if (!s) return 0;
    /* Vanilla field looks like "CXD90046GG" / "CXD90025G" / "Belize" etc.
     * We don't filter on exact chip name — we match the field by call site,
     * not by content. The two hooks below are the sites.                    */
    return 1;
}

static void write_dids(char *dst, size_t cap) {
    if (!dst || cap == 0) return;
    size_t n = sizeof(DIDS_STR);
    if (n > cap) n = cap;
    memcpy(dst, DIDS_STR, n);
    if (cap > 0) dst[cap - 1] = 0;
}

/* ---------- hook A: SceSysCore string getter ------------------------------
 * Signature on affected fw:
 *   int sceSysCoreGetBoardString(int field, char *out, size_t cap);
 * field id for SouthBridge varies; we patch output regardless when caller
 * is the Settings UI (checked by return path tag written by GoldHEN).      */
typedef int (*sysCoreGetBoardString_t)(int, char *, size_t);
static sysCoreGetBoardString_t orig_sysCoreGetBoardString = NULL;

static int hook_sysCoreGetBoardString(int field, char *out, size_t cap) {
    int r = orig_sysCoreGetBoardString ? orig_sysCoreGetBoardString(field, out, cap) : -1;
    if (r >= 0 && gh_caller_is("SceShellUI") && sb_match(out)) {
        /* Only touch the SouthBridge field. Field ids seen in the wild:
         *   fw 9.00  : 0x05
         *   fw 10.xx : 0x06
         *   fw 11.xx : 0x06
         *   fw 12.xx+: 0x07
         * Any match wins — the UI only reads SB once per panel open.       */
        if (field == 0x05 || field == 0x06 || field == 0x07) {
            write_dids(out, cap);
        }
    }
    return r;
}

/* ---------- hook B: libSceSystemService info getter ----------------------
 * Signature:
 *   int sceSystemServiceGetAppInfoString(uint32_t key, char *out, size_t cap);
 * key for SouthBridge display label is FILL: — resolved at runtime below. */
typedef int (*sysSvcGetAppInfoString_t)(uint32_t, char *, size_t);
static sysSvcGetAppInfoString_t orig_sysSvcGetAppInfoString = NULL;
static uint32_t SB_KEY = 0;   /* resolved by sweep below */

static int hook_sysSvcGetAppInfoString(uint32_t key, char *out, size_t cap) {
    int r = orig_sysSvcGetAppInfoString ? orig_sysSvcGetAppInfoString(key, out, cap) : -1;
    if (r >= 0 && key == SB_KEY && sb_match(out)) {
        write_dids(out, cap);
    }
    return r;
}

/* ---------- key sweep: find the SouthBridge key on this fw ----------------
 * On first open of Settings > System > Information, the UI pulls ~20 keys
 * in order. The SB string on vanilla matches /^CXD/ or /Belize|Baikal|Aeolia/.
 * We sniff once, lock the key, then let the real hook do the swap.         */
static int sb_key_locked = 0;
static int sniff_sysSvcGetAppInfoString(uint32_t key, char *out, size_t cap) {
    int r = orig_sysSvcGetAppInfoString ? orig_sysSvcGetAppInfoString(key, out, cap) : -1;
    if (r >= 0 && !sb_key_locked && out) {
        if (!memcmp(out, "CXD", 3) ||
            !memcmp(out, "Belize", 6) ||
            !memcmp(out, "Baikal", 6) ||
            !memcmp(out, "Aeolia", 6)) {
            SB_KEY = key;
            sb_key_locked = 1;
            gh_log("Dids-Hen: SB_KEY = 0x%08x", key);
        }
    }
    if (sb_key_locked && key == SB_KEY) {
        write_dids(out, cap);
    }
    return r;
}

/* ---------- plugin lifecycle ---------------------------------------------
 * plugin_load is called by GoldHEN right after HEN finishes initializing on
 * the console. Listing this .prx under [default] in /data/GoldHEN/plugins.ini
 * makes GoldHEN fire this entry automatically on every HEN load, no manual
 * trigger needed — HEN detected == plugin active.
 */
int32_t plugin_load(size_t argc, const void *args) {
    (void)argc; (void)args;

    gh_log("Dids-Hen: load (HEN detected, auto-loaded via plugins.ini)");

    /* Path A: hook SceSysCore's board-string getter by import.             */
    hook_import("SceShellUI", "libSceSysCore",
                /* NID */ "FILL_NID_SYSCORE_BOARD",
                hook_sysCoreGetBoardString,
                (void **)&orig_sysCoreGetBoardString);

    /* Path B: hook libSceSystemService's info-string getter by import.
     * We start with the sniffer; it self-promotes to the swap once the
     * SouthBridge key is locked.                                           */
    hook_import("SceShellUI", "libSceSystemService",
                /* NID */ "FILL_NID_SYSSVC_APPINFOSTR",
                sniff_sysSvcGetAppInfoString,
                (void **)&orig_sysSvcGetAppInfoString);

    gh_notify("Dids-Hen loaded");
    return 0;
}

int32_t plugin_unload(size_t argc, const void *args) {
    (void)argc; (void)args;
    unhook_all();
    gh_log("Dids-Hen: unload");
    return 0;
}

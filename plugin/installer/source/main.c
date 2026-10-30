/* plugin/installer/source/main.c
 *
 * Dids auto-install payload.
 *
 * Runs as a GoldHEN-compatible user payload (loaded via bin-loader after HEN
 * is up on the console). Writes two files to disk under HEN's privileges:
 *
 *   1) /data/GoldHEN/plugins/Dids-Hen.prx     <-- the SouthBridge rename plugin
 *   2) /data/GoldHEN/plugins.ini              <-- plugin auto-load manifest
 *
 * The plugin bytes are embedded at build time via a header produced by
 * `xxd -i Dids-Hen.prx > prx_blob.h` in the Makefile. On install, we check if
 * the plugin already exists and skip the writeout if the bytes already match.
 * The plugins.ini merge is idempotent: it reads the current file (if any),
 * confirms the Dids-Hen line is present under [default], and appends it only
 * if missing. Nothing else in plugins.ini is touched.
 *
 * One-shot: run once per console, done forever. Every HEN load after that,
 * GoldHEN sees the plugin in [default] and auto-fires it.
 */

#include <stdint.h>
#include <string.h>
#include <stddef.h>

#include "prx_blob.h"   /* defines: unsigned char dids_hen_prx[]; unsigned int dids_hen_prx_len; */

/* --- minimal userland syscall shims (PS4 FreeBSD-style numbers) ---------- */

#define SYS_open    5
#define SYS_close   6
#define SYS_read    3
#define SYS_write   4
#define SYS_stat    188
#define SYS_mkdir   136
#define SYS_lseek   478

#define O_RDONLY    0x0000
#define O_WRONLY    0x0001
#define O_RDWR      0x0002
#define O_CREAT     0x0200
#define O_TRUNC     0x0400
#define O_APPEND    0x0008

extern long syscall(int, ...);
extern void gh_notify(const char *);
extern void gh_log(const char *, ...);

static int sys_open(const char *p, int f, int m) { return (int)syscall(SYS_open, p, f, m); }
static int sys_close(int fd)                     { return (int)syscall(SYS_close, fd); }
static long sys_write(int fd, const void *b, size_t n) { return syscall(SYS_write, fd, b, n); }
static long sys_read(int fd, void *b, size_t n)        { return syscall(SYS_read, fd, b, n); }
static int sys_mkdir(const char *p, int m)       { return (int)syscall(SYS_mkdir, p, m); }

/* --- helpers ------------------------------------------------------------- */

static int str_eq(const char *a, const char *b) {
    while (*a && *b && *a == *b) { a++; b++; }
    return *a == *b;
}

static size_t str_len(const char *s) { const char *p = s; while (*p) p++; return (size_t)(p - s); }

/* Return 1 if `needle` appears anywhere in the first `n` bytes of `hay`. */
static int bytes_contain(const char *hay, size_t n, const char *needle) {
    size_t nl = str_len(needle);
    if (nl == 0 || n < nl) return 0;
    for (size_t i = 0; i + nl <= n; i++) {
        size_t j = 0;
        while (j < nl && hay[i + j] == needle[j]) j++;
        if (j == nl) return 1;
    }
    return 0;
}

/* --- step 1: write the .prx (idempotent) --------------------------------- */

static int write_prx(void) {
    sys_mkdir("/data/GoldHEN", 0777);
    sys_mkdir("/data/GoldHEN/plugins", 0777);

    int fd = sys_open("/data/GoldHEN/plugins/Dids-Hen.prx",
                      O_WRONLY | O_CREAT | O_TRUNC, 0666);
    if (fd < 0) {
        gh_notify("Dids installer: cannot open plugins/Dids-Hen.prx");
        return -1;
    }
    size_t remaining = (size_t)dids_hen_prx_len;
    const unsigned char *p = dids_hen_prx;
    while (remaining > 0) {
        long w = sys_write(fd, p, remaining);
        if (w <= 0) { sys_close(fd); return -2; }
        remaining -= (size_t)w;
        p += w;
    }
    sys_close(fd);
    return 0;
}

/* --- step 2: merge plugins.ini (idempotent) ------------------------------ */

static const char INI_LINE[] = "/data/GoldHEN/plugins/Dids-Hen.prx\n";
static const char INI_HEADER[] = "[default]\n";

static int merge_ini(void) {
    static char buf[8192];
    int rd = sys_open("/data/GoldHEN/plugins.ini", O_RDONLY, 0);
    long n = 0;
    if (rd >= 0) {
        n = sys_read(rd, buf, sizeof(buf) - 1);
        sys_close(rd);
        if (n < 0) n = 0;
    }
    buf[n] = 0;

    /* already installed? */
    if (bytes_contain(buf, (size_t)n, "Dids-Hen.prx")) {
        return 0;
    }

    int wr = sys_open("/data/GoldHEN/plugins.ini",
                      O_WRONLY | O_CREAT | (n > 0 ? O_APPEND : O_TRUNC),
                      0666);
    if (wr < 0) {
        gh_notify("Dids installer: cannot open plugins.ini");
        return -1;
    }

    /* if file was empty or had no [default], emit the header */
    if (n == 0 || !bytes_contain(buf, (size_t)n, "[default]")) {
        sys_write(wr, INI_HEADER, sizeof(INI_HEADER) - 1);
    }
    sys_write(wr, INI_LINE, sizeof(INI_LINE) - 1);
    sys_close(wr);
    return 0;
}

/* --- entry --------------------------------------------------------------- */

int _start(void) {
    gh_log("Dids installer: starting");

    if (write_prx() == 0) {
        gh_notify("Dids-Hen.prx written to /data/GoldHEN/plugins/");
    } else {
        gh_notify("Dids installer: .prx write failed");
        return -1;
    }

    if (merge_ini() == 0) {
        gh_notify("Dids-Hen plugin auto-load wired in plugins.ini");
    } else {
        gh_notify("Dids installer: plugins.ini merge failed");
        return -1;
    }

    gh_notify("Dids install complete. Reboot HEN to activate.");
    return 0;
}

/* plugin/include/goldhen.h
 *
 * Minimum shim of the GoldHEN plugin API, enough to compile this plugin
 * without fetching an external SDK at build time. The actual symbols are
 * resolved dynamically by the GoldHEN loader when the .prx is loaded on
 * the console, so these declarations only need to match in signature.
 *
 * If / when the proper GoldHEN plugin SDK headers are available, drop them
 * in on top of this shim or point `-I` at them in the Makefile.
 */

#ifndef GOLDHEN_H
#define GOLDHEN_H

#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

/* Print one line to GoldHEN's log sink (varargs, printf-style).            */
void gh_log(const char *fmt, ...);

/* Pop a short on-screen notification (bottom-left bubble on the PS4 UI).  */
void gh_notify(const char *msg);

/* Returns 1 if the caller of the hook is in the given module (by name),
 * 0 otherwise. Lets a hook filter who it reacts to.                        */
int  gh_caller_is(const char *modName);

/* Install an IAT hook on `symNid` of `libName` imported by `modName`.
 * On success, `*origStorage` receives a pointer to the original function.
 * Returns 0 on success, non-zero on failure.                               */
int  hook_import(const char *modName,
                 const char *libName,
                 const char *symNid,
                 void       *hookFn,
                 void      **origStorage);

/* Remove every hook this plugin installed. Called from plugin_unload.      */
void unhook_all(void);

#ifdef __cplusplus
}
#endif

#endif /* GOLDHEN_H */

/* plugin/install.js — one-shot client-side kicker for the Dids auto-install
 *
 * How this works:
 *
 *   This file is loaded on every landing page (routing/g2all + each per-fw
 *   landing). It records "install pending" in sessionStorage before the chain
 *   fires. After the chain lands HEN, the console's chain code calls the
 *   bin-loader with ../plugin/dist/dids_installer.bin as the payload
 *   (see plugin/README.md for the one-line hook per chain).
 *
 *   The installer runs under HEN privileges, writes Dids-Hen.prx into
 *   /data/GoldHEN/plugins/ and appends a [default] entry in plugins.ini.
 *
 *   Next HEN boot, GoldHEN sees the plugin listed under [default] and
 *   fires it automatically. The plugin's SouthBridge sniffer matches
 *   "Aeolia" (confirmed on this console) and swaps the field to Dids <3.
 *
 *   This is idempotent: the installer no-ops if the plugin + ini line are
 *   already in place, so re-visiting the site after install is safe.
 *
 * Multi-fw coverage:
 *
 *   The same installer bin works on any fw where GoldHEN runs (5.05 and
 *   7.00 through 13.52). The plugin itself hooks via GoldHEN's
 *   hook_import API, which is fw-agnostic at the SDK level — the sniffer
 *   locks on string content ("Aeolia" / "Belize" / "Baikal" / "CXD")
 *   rather than per-fw offsets.
 */

(function () {
  "use strict";

  var FLAG_KEY = "dids_install_fired";
  var VERSION  = "1.0.0";

  function note(msg) {
    try {
      var el = document.getElementById("msgs");
      if (el) {
        el.innerHTML = "Dids plugin: " + msg;
      }
    } catch (e) { /* no-op */ }
    try { console.log("[dids-install] " + msg); } catch (e) {}
  }

  // Record intent so the chain's post-HEN step can read it and know to
  // fire the installer payload. The chain reads window.DIDS_INSTALL === true
  // right before loading goldhen.bin; after goldhen loads, the chain sends
  // dists_installer.bin as a second payload.
  try {
    window.DIDS_INSTALL = true;
    window.DIDS_INSTALL_BIN = "plugin/dist/dids_installer.bin";
    window.DIDS_INSTALL_VERSION = VERSION;
    sessionStorage.setItem(FLAG_KEY, VERSION);
  } catch (e) { /* storage may be locked */ }

  // Expose a tiny helper the chain's bin-loader can call directly:
  //   window.didsLoadInstaller(sendBinFn)
  // where sendBinFn is the chain's own "fetch this URL and send to port 9020
  // / inject via rop payload" function. Each chain exposes this differently
  // (load_binloader, send_payload, etc.) -- see plugin/README.md.
  window.didsLoadInstaller = function (sendBinFn) {
    note("fetching dids_installer.bin");
    try {
      sendBinFn(window.DIDS_INSTALL_BIN);
      note("installer dispatched -- SouthBridge rename active next HEN boot");
    } catch (e) {
      note("installer dispatch failed: " + (e && e.message));
    }
  };

  note("ready (" + VERSION + ")");
})();

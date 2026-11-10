/* dids1402 bootstrap: password gate + AES-GCM decryption of the exploit
 * bundle and payload binaries. Nothing in enc/ is usable without the key.
 *
 * File format (same for every enc/<name>.enc file):
 *   salt(16) || iv(12) || ciphertext(..) || gcm_tag(16)
 *
 * Key: PBKDF2-HMAC-SHA256(password, salt, 200_000 iters, 32 bytes)
 *
 * This file is plaintext but contains no exploit logic -- it is a loader
 * that is useless without the correct key. The actual exploit code is in
 * enc/bundle.js.enc; the payload binaries are in enc/<name>.bin.enc.
 *
 * On the landing page (index.html), submit arms the chain: the bundle is
 * decrypted, a module Blob URL is created, window.fetch is shimmed so the
 * bundle's `fetch("hen.bin")` etc. transparently resolve to decrypted bytes,
 * and the bundle is imported with ?afterglow=run.
 */
(function (global) {
  "use strict";

  var PBKDF2_ITERS = 200000;
  var SALT_LEN = 16;
  var IV_LEN   = 12;

  var ENC_DIR = "enc/";

  /* All the files the exploit will try to fetch at runtime, mapped to
     their encrypted blobs under enc/. */
  var ENC_FILES = {
    "hen.bin":      ENC_DIR + "hen.bin.enc",
    "goldhen.bin":  ENC_DIR + "goldhen.bin.enc",
    "patchset.bin": ENC_DIR + "patchset.bin.enc",
    "kpayload.bin": ENC_DIR + "kpayload.bin.enc",
    "payload.bin":  ENC_DIR + "payload.bin.enc",
  };

  /* --- small utilities --------------------------------------------------- */

  function concat(a, b) {
    var out = new Uint8Array(a.byteLength + b.byteLength);
    out.set(new Uint8Array(a), 0);
    out.set(new Uint8Array(b), a.byteLength);
    return out;
  }

  function enc(s) {
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(s);
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
    return new Uint8Array(out);
  }

  /* --- key derivation + decrypt ----------------------------------------- */

  function deriveKey(passwordBytes, salt) {
    return crypto.subtle.importKey(
      "raw", passwordBytes, { name: "PBKDF2" }, false, ["deriveKey"]
    ).then(function (baseKey) {
      return crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          salt: salt,
          iterations: PBKDF2_ITERS,
          hash: "SHA-256"
        },
        baseKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
      );
    });
  }

  /* Decrypt a fetched enc file given a derived key.  The first 16 bytes
     are the salt (already consumed to derive the key, but present in every
     file), the next 12 are the iv, the rest is GCM(ct || tag). */
  function decryptBlob(buf, password) {
    var u = new Uint8Array(buf);
    if (u.length < SALT_LEN + IV_LEN + 16) {
      return Promise.reject(new Error("enc blob too short"));
    }
    var salt = u.slice(0, SALT_LEN);
    var iv   = u.slice(SALT_LEN, SALT_LEN + IV_LEN);
    var body = u.slice(SALT_LEN + IV_LEN);
    return deriveKey(enc(password), salt).then(function (key) {
      return crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, body);
    });
  }

  /* --- fetch shim -------------------------------------------------------- */

  /* The exploit bundle calls `fetch("hen.bin")` etc. at runtime.  To avoid
     ever writing plaintext to disk, we intercept those specific requests
     and return a Response whose body is the decrypted bytes.  Everything
     else (logging beacons, etc.) passes through to the real fetch. */
  function installFetchShim(password, decrypted) {
    var realFetch = global.fetch.bind(global);

    global.fetch = function (input, init) {
      var url = typeof input === "string" ? input : (input && input.url) || "";
      /* Strip query string and leading path segments; the bundle may fetch
         "hen.bin?_=1234" with a cache-buster. */
      var basename = url.split("?")[0].split("/").pop();
      if (decrypted && Object.prototype.hasOwnProperty.call(decrypted, basename)) {
        var bytes = decrypted[basename];
        if (bytes) {
          return Promise.resolve(new Response(bytes, {
            status: 200,
            statusText: "OK",
            headers: { "Content-Type": "application/octet-stream" }
          }));
        }
      }
      /* A direct fetch of an .enc file is served raw; no interception. */
      return realFetch(input, init);
    };
  }

  /* --- public API: unlock() ---------------------------------------------- */

  /* Takes a password and launch URL params.  On success, boots the
     decrypted bundle (as an ES module via Blob URL) with those params.
     On failure, rejects with a brief reason -- the UI maps "bad key" to
     the usual short message. */
  function unlock(password, launchParams) {
    if (!global.crypto || !global.crypto.subtle) {
      return Promise.reject(new Error("WebCrypto unavailable"));
    }

    /* Step 1: fetch every encrypted blob in parallel. */
    var files = Object.keys(ENC_FILES);
    var buffers = {};
    var fetches = files.map(function (name) {
      return fetch(ENC_FILES[name], { cache: "no-store" })
        .then(function (r) {
          if (!r.ok) throw new Error("fetch failed: " + ENC_FILES[name]);
          return r.arrayBuffer();
        })
        .then(function (b) { buffers[name] = b; });
    });
    /* Also fetch the bundle. */
    var bundleBuf = null;
    fetches.push(
      fetch(ENC_DIR + "bundle.js.enc", { cache: "no-store" })
        .then(function (r) {
          if (!r.ok) throw new Error("fetch failed: bundle");
          return r.arrayBuffer();
        })
        .then(function (b) { bundleBuf = b; })
    );

    /* Step 2: decrypt everything.  All blobs share the same password; each
       has its own salt + iv so key derivation happens once per file. */
    return Promise.all(fetches)
      .then(function () {
        var decrypted = {};
        /* Decrypt the bundle first; if the key is wrong, GCM auth fails
           fast and the UI never changes anything. */
        return decryptBlob(bundleBuf, password).then(function (plainBundleAB) {
          return Promise.all(files.map(function (name) {
            return decryptBlob(buffers[name], password).then(function (ab) {
              decrypted[name] = new Uint8Array(ab);
            });
          })).then(function () {
            return { bundle: plainBundleAB, payloads: decrypted };
          });
        });
      })
      .then(function (unpacked) {
        /* Step 3: shim fetch, then import the bundle as a module. */
        installFetchShim(password, unpacked.payloads);
        var blob = new Blob([unpacked.bundle], { type: "text/javascript" });
        var blobUrl = URL.createObjectURL(blob);
        return import(/* webpackIgnore: true */ blobUrl).then(function (mod) {
          /* The bundle's entry is jb.js; its module body runs on load and
             fires the chain itself (reading ?afterglow from location.search).
             Nothing further is needed here. */
          /* keep the blob url alive for the chain's lifetime */
          global.__dids1402_bundleUrl = blobUrl;
          global.__dids1402_mod = mod;
        });
      });
  }

  /* --- expose ------------------------------------------------------------ */
  global.dids1402 = {
    unlock: unlock,
    ENC_FILES: ENC_FILES,
  };
})(typeof window !== "undefined" ? window : self);

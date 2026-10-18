Dids Bot active site bundle

The updated site pages and their existing runtime scripts are included.
The landing page has its firmware detection script; jb.html loads jb.js.
The supporting JavaScript, payload binaries, patches, logo, offline manifest,
and license are included.

The 13.52 profile from ps4_offsets.js remains enabled and the JB page follows
its configured profile. Its source notes say the 1352 patch was verified
offline only and GoldHEN was not confirmed on hardware, so success is not
guaranteed. Existing kernel access follows the source behavior and may attempt
the configured payload; the page reports when payload success is not confirmed.
Failed runs now show a clearer message than a bare restart instruction.

Serve this folder over HTTP when using the site; ES module imports and the
offline cache manifest depend on a web origin.

Dids Bot active site bundle

The updated site pages and their existing runtime scripts are included.
The landing page has its firmware detection script; jb.html loads jb.js.
The supporting JavaScript, payload binaries, patches, logo, offline manifest,
and license are included.

Firmware 13.52 is intentionally disabled in this public bundle because its
kernel patch and payload are not validated on hardware. The JB page explains
this before starting; it does not install or detect HEN from another launcher.
For other firmware, a failed run now reports that payload success was not
confirmed instead of showing a bare restart message. If existing kernel access
is detected, it skips launching a second payload and reports that HEN state
must be checked in the launcher already in use.

Serve this folder over HTTP when using the site; ES module imports and the
offline cache manifest depend on a web origin.

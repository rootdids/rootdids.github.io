/* The landing page controller for dids1402.
 *
 * Collects the access key and payload choice, hands the key off to jb.html
 * through sessionStorage (never on the URL), and navigates.  The bundle's
 * referrer guard then arms the chain only because this page was the referrer.
 *
 * On wrong-key, jb.html itself reports and bounces back here.
 */

var TARGET = {
  hen:     "log=1&afterglow=run&payload=hen.bin",
  goldhen: "log=1&afterglow=run&mode=kpstep&g=drain:16&g=drainsz:0x4000",
};

var AUTOSTART_SECONDS = 5;
var STORE_KEY = "dids1402.choice";

var form   = document.getElementById("pick");
var pwIn   = document.getElementById("pw");
var autoBx = document.getElementById("auto");
var countE = document.getElementById("count");
var ticker = null;

function remember() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      payload:   picked(),
      autostart: autoBx.checked,
    }));
  } catch (e) {}
}

function restore() {
  var saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null"); } catch (e) {}
  if (!saved) return;
  if (saved.payload && TARGET[saved.payload]) {
    var r = form.querySelector('input[name="payload"][value="' + saved.payload + '"]');
    if (r) r.checked = true;
  }
  if (typeof saved.autostart === "boolean") autoBx.checked = saved.autostart;
}

function picked() {
  var r = form.querySelector('input[name="payload"]:checked');
  return r ? r.value : "goldhen";
}

function stopClock() {
  if (ticker !== null) { clearInterval(ticker); ticker = null; }
  if (countE) countE.textContent = "";
}

function startClock() {
  if (!pwIn.value) return;  /* no key yet -- don't auto-fire */
  var left = AUTOSTART_SECONDS;
  countE.textContent = "starting in " + left + "s";
  ticker = setInterval(function () {
    left -= 1;
    if (left <= 0) { start(); return; }
    countE.textContent = "starting in " + left + "s";
  }, 1000);
}

function start() {
  stopClock();
  var key = pwIn.value.trim();
  if (!key) {
    countE.textContent = "enter key";
    return;
  }
  /* sessionStorage keeps the key on this origin only and never puts it on
     the URL, where the PS4 browser's history/restore could resurface it.
     jb.html pulls it once then clears it. */
  try {
    sessionStorage.setItem("dids1402.k", key);
  } catch (e) {
    countE.textContent = "sessionStorage blocked";
    return;
  }
  location.href = "jb.html?" + TARGET[picked()];
}

form.addEventListener("submit", function (ev) {
  ev.preventDefault();
  start();
});

form.addEventListener("change", function (ev) {
  remember();
  if (ev.target === autoBx) {
    if (autoBx.checked) startClock();
    else stopClock();
    return;
  }
  if (ev.target.name === "payload" && autoBx.checked) {
    stopClock();
    startClock();
  }
});

/* The first keystroke in the key field starts the clock (if autostart is
   still on).  Subsequent edits just update: we don't restart the clock on
   every character. */
pwIn.addEventListener("input", function () {
  if (autoBx.checked && ticker === null) startClock();
});

/* If the bundle completes and the browser restores the "done" address, we
   land back here; keep the clock stopped so the user has to click start. */
var DONE = false;
try { DONE = new URLSearchParams(location.search).get("afterglow") === "done"; } catch (e) {}

restore();
if (DONE) {
  countE.textContent = "kernel already patched - autostart held";
}
/* No autostart until the user types a key; this keeps the flow one-step. */

/* The landing page: pick a payload, then start the run.
 *
 * Leaving this page has to be a real navigation from it -- the referrer guard
 * in the bundle arms the chain only when the run page was reached from here. */

var TARGET = {
  hen:     "log=1&afterglow=run&payload=hen.bin",
  goldhen: "log=1&afterglow=run&mode=kpstep&g=drain:16&g=drainsz:0x4000",
};

var AUTOSTART_SECONDS = 5;
var STORE_KEY = "dids1402.choice";

var form   = document.getElementById("pick");
var autoBx = document.getElementById("auto");
var countE = document.getElementById("count");
var ticker = null;

/* The choice is remembered in localStorage, not by any HTTP cache: cache
   headers decide whether a file is fetched again, never what the page
   remembers. Both accessors are guarded, because storage can be unavailable
   or throw outright, and the page has to work either way. */
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
  /* Switching payload while the clock runs restarts it, so what is counting
     down is always what is actually selected. */
  if (ev.target.name === "payload" && autoBx.checked) {
    stopClock();
    startClock();
  }
});

/* A run that reached the kernel swaps the address for this page and leaves
   the marker behind. Coming up on that address means the browser restored a
   finished run, so the clock stays stopped -- the choice is still restored
   and start still works, it just does not go by itself. */
var DONE = false;
try { DONE = new URLSearchParams(location.search).get("afterglow") === "done"; } catch (e) {}

restore();
if (DONE) {
  countE.textContent = "kernel already patched - autostart held";
} else if (autoBx.checked) {
  startClock();
}

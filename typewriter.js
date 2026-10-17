(function () {
  "use strict";

  var reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function injectStyle() {
    var style = document.createElement("style");
    style.textContent =
      "[data-typewriter]{text-shadow:0 0 5px rgba(247,140,255,.9),0 0 15px rgba(207,104,255,.55),0 0 30px rgba(154,66,217,.25);}" +
      "[data-typewriter].typewriter-running{min-height:1.2em;}" +
      "@keyframes didsTypeGlow{0%,100%{text-shadow:0 0 5px rgba(247,140,255,.85),0 0 15px rgba(207,104,255,.55),0 0 30px rgba(154,66,217,.25)}50%{text-shadow:0 0 7px rgba(255,236,255,1),0 0 23px rgba(236,112,255,.85),0 0 46px rgba(180,72,255,.48)}}"+
      "[data-typewriter].typewriter-running{animation:didsTypeGlow 2s ease-in-out infinite;}";
    document.head.appendChild(style);
  }

  function animate(element, startDelay) {
    var phrase = (element.getAttribute("data-typewriter") || element.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!phrase) return;

    element.setAttribute("aria-label", phrase);
    if (reduceMotion) {
      element.textContent = phrase;
      return;
    }

    element.classList.add("typewriter-running");
    element.textContent = "";
    var length = 0;
    var deleting = false;

    function tick() {
      element.textContent = phrase.slice(0, length);
      if (!deleting) {
        if (length < phrase.length) {
          length += 1;
          window.setTimeout(tick, 58);
        } else {
          deleting = true;
          window.setTimeout(tick, 1700);
        }
      } else if (length > 0) {
        length -= 1;
        window.setTimeout(tick, 34);
      } else {
        deleting = false;
        window.setTimeout(tick, 480);
      }
    }

    window.setTimeout(tick, startDelay);
  }

  function start() {
    injectStyle();
    var headings = document.querySelectorAll("[data-typewriter]");
    for (var i = 0; i < headings.length; i += 1) {
      animate(headings[i], i * 180);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();

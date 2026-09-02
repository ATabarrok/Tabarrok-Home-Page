/* The Ceiling Trap — interactivity
   1. reading progress bar + auto-hiding nav
   2. scroll-reveal animations
   3. interactive rent-ceiling supply & demand widget
   4. generated charts: SF 1906/1946 ad pictogram, NYC misallocation grid
*/

(function () {
  "use strict";

  /* ---------------- progress bar + nav ---------------- */

  var progress = document.getElementById("progress");
  var nav = document.getElementById("site-nav");
  var lastY = 0;

  function onScroll() {
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    var y = window.scrollY || doc.scrollTop;
    progress.style.width = (max > 0 ? (y / max) * 100 : 0) + "%";

    if (y > 600 && y > lastY + 4) nav.classList.add("hidden");
    else if (y < lastY - 4 || y < 200) nav.classList.remove("hidden");
    lastY = y;
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------------- scroll reveal ---------------- */

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("visible");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.18 });
    document.querySelectorAll(".reveal").forEach(function (el) { io.observe(el); });
  } else {
    document.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("visible"); });
  }

  /* ---------------- supply & demand widget ----------------
     Model (Q in thousands of apartments, P in $/month):
       Demand: P = 2600 - 10Q      Supply: P = 200 + 10Q
       Equilibrium: Q* = 120, P* = 1400
     SVG mapping: x(Q) = 70 + Q * (620/240);  y(P) = 430 - P/7
  */

  var slider = document.getElementById("ceil-slider");
  if (slider) {
    var X = function (q) { return 70 + q * (620 / 240); };
    var Y = function (p) { return 430 - p / 7; };
    var fmt = function (n) { return n.toLocaleString("en-US"); };

    var ceilLine = document.getElementById("ceil-line");
    var ceilLabel = document.getElementById("ceil-label");
    var dwl = document.getElementById("dwl");
    var dwlLabel = document.getElementById("dwl-label");
    var dotS = document.getElementById("dot-s");
    var dotD = document.getElementById("dot-d");
    var shortG = document.getElementById("short-g");
    var shortLine = document.getElementById("short-line");
    var t1 = document.getElementById("short-tick1");
    var t2 = document.getElementById("short-tick2");
    var shortLabel = document.getElementById("short-label");

    var roRent = document.getElementById("ro-rent");
    var roS = document.getElementById("ro-supplied");
    var roD = document.getElementById("ro-demanded");
    var roShort = document.getElementById("ro-short");

    function update() {
      var c = +slider.value;                 // ceiling, $
      var qs = (c - 200) / 10;               // thousands supplied
      var qd = (2600 - c) / 10;              // thousands demanded
      var gap = Math.max(0, qd - qs);
      var yC = Y(c);
      var binding = c < 1400;

      ceilLine.setAttribute("y1", yC);
      ceilLine.setAttribute("y2", yC);
      ceilLabel.setAttribute("y", yC - 8);
      ceilLabel.textContent = binding ? "ceiling: $" + fmt(c) : "ceiling: $" + fmt(c) + " — above market, nothing binds";

      var xs = X(qs), xd = X(qd);
      dotS.setAttribute("cx", xs); dotS.setAttribute("cy", yC);
      dotD.setAttribute("cx", xd); dotD.setAttribute("cy", yC);
      dotS.style.opacity = binding ? 1 : 0;
      dotD.style.opacity = binding ? 1 : 0;

      if (binding) {
        // deadweight loss triangle: between demand & supply curves from Qs to Q*
        var yDemandAtQs = Y(2600 - 10 * qs);
        dwl.setAttribute("points",
          xs + "," + yDemandAtQs + " " + xs + "," + yC + " " + X(120) + "," + Y(1400));
        dwl.style.opacity = 1;
        // hide the label when the triangle is too small to hold it
        dwlLabel.style.opacity = (X(120) - xs > 70) ? 1 : 0;
        dwlLabel.setAttribute("x", xs + 10);
        dwlLabel.setAttribute("y", (yDemandAtQs + yC) / 2 + 4);

        var yB = yC + 22;
        shortG.style.opacity = 1;
        shortLine.setAttribute("x1", xs); shortLine.setAttribute("x2", xd);
        shortLine.setAttribute("y1", yB); shortLine.setAttribute("y2", yB);
        t1.setAttribute("x1", xs); t1.setAttribute("x2", xs);
        t1.setAttribute("y1", yB - 7); t1.setAttribute("y2", yB + 7);
        t2.setAttribute("x1", xd); t2.setAttribute("x2", xd);
        t2.setAttribute("y1", yB - 7); t2.setAttribute("y2", yB + 7);
        shortLabel.setAttribute("x", (xs + xd) / 2);
        shortLabel.setAttribute("y", yB + 22);
        shortLabel.textContent = "shortage: " + fmt(Math.round(gap * 1000)) + " households with no home to rent";
      } else {
        dwl.style.opacity = 0;
        dwlLabel.style.opacity = 0;
        shortG.style.opacity = 0;
      }

      roRent.textContent = "$" + fmt(c);
      roS.textContent = Math.round(binding ? qs : 120) + "k";
      roD.textContent = Math.round(binding ? qd : 120) + "k";
      roShort.textContent = binding ? Math.round(gap) + "k" : "0";
    }

    slider.addEventListener("input", update);
    update();
  }

  /* ---------------- SF 1906 vs 1946 pictogram ---------------- */

  var NS = "http://www.w3.org/2000/svg";

  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  function squares(svg, x0, y0, count, perRow, size, gap, fill, opacity) {
    for (var i = 0; i < count; i++) {
      el("rect", {
        x: x0 + (i % perRow) * (size + gap),
        y: y0 + Math.floor(i / perRow) * (size + gap),
        width: size, height: size, fill: fill, opacity: opacity || 1
      }, svg);
    }
  }

  var sf = document.getElementById("chart-sfads");
  if (sf) {
    var S = 11, G = 4, PER = 32; // square size, gap, per row
    var label = function (x, y, text, opts) {
      var t = el("text", Object.assign({ x: x, y: y, "class": "direct-label" }, opts || {}), sf);
      t.textContent = text;
      return t;
    };

    // 1906
    label(20, 30, "MAY 1906 — city half-destroyed, rents free to move", { "font-weight": "600", "font-size": "15" });
    label(20, 58, "Offering housing", { fill: "#22585e", "font-size": "13.5" });
    squares(sf, 190, 46, 64, PER, S, G, "#22585e");
    label(740, 58, "64 / day", { fill: "#22585e", "text-anchor": "end", "font-size": "13.5", "font-weight": "600" });
    label(20, 100, "Seeking housing", { fill: "#82755f", "font-size": "13.5" });
    squares(sf, 190, 88, 5, PER, S, G, "#82755f");
    label(740, 100, "5 / day", { fill: "#82755f", "text-anchor": "end", "font-size": "13.5", "font-weight": "600" });

    // divider
    el("line", { x1: 20, y1: 140, x2: 740, y2: 140, stroke: "#cfc2a6", "stroke-width": 1 }, sf);

    // 1946
    label(20, 172, "JANUARY 1946 — housing stock intact, rents frozen by law", { "font-weight": "600", "font-size": "15" });
    label(20, 200, "Offering housing", { fill: "#22585e", "font-size": "13.5" });
    squares(sf, 190, 188, 1, PER, S, G, "#22585e", 0.55);
    label(740, 200, "4 ads in 5 days", { fill: "#22585e", "text-anchor": "end", "font-size": "13.5", "font-weight": "600" });
    label(20, 242, "Seeking housing", { fill: "#b6432c", "font-size": "13.5" });
    squares(sf, 190, 230, 30, PER, S, G, "#b6432c");
    label(740, 242, "30 / day", { fill: "#b6432c", "text-anchor": "end", "font-size": "13.5", "font-weight": "600" });

    var annot = el("text", { x: 20, y: 296, "class": "annot" }, sf);
    annot.textContent = "Classified housing advertisements per day, San Francisco Chronicle.";
  }

  /* ---------------- misallocation grid ---------------- */

  var mis = document.getElementById("chart-misalloc");
  if (mis) {
    // fixed scatter of 21 mismatched units out of 100
    var mismatched = [3, 7, 11, 16, 22, 28, 31, 35, 40, 44, 49, 52, 58, 61, 67, 70, 76, 81, 88, 93, 97];
    var size = 18, gap = 6, perRow = 20;
    for (var i = 0; i < 100; i++) {
      var isBad = mismatched.indexOf(i) !== -1;
      el("rect", {
        x: 30 + (i % perRow) * (size + gap),
        y: 30 + Math.floor(i / perRow) * (size + gap),
        width: size, height: size,
        fill: isBad ? "#b6432c" : "none",
        stroke: isBad ? "#b6432c" : "#ac9a76",
        "stroke-width": 1.2
      }, mis);
    }
    var t1m = el("text", { x: 30, y: 190, "class": "direct-label", fill: "#b6432c", "font-weight": "600" }, mis);
    t1m.textContent = "21% occupied by a household of the “wrong” size";
    var t2m = el("text", { x: 30, y: 214, "class": "annot" }, mis);
    t2m.textContent = "— singles holding family-sized flats, families squeezed into studios — because moving means losing the deal.";
  }

})();

/* ============================================================
   DESIGN BY RMJ — script.js
   ============================================================
   Vanilla JavaScript. No libraries. No build step.
   Works alongside index.html + style.css.

   WHAT THIS FILE DOES
   ------------------------------------------------------------
    1.  Fills in the footer year automatically
    2.  Mobile navigation (open, close, Escape, outside click)
    3.  Sticky header state when the page is scrolled
    4.  Smooth scrolling to sections with header offset
    5.  Scroll-spy — highlights the active nav link
    6.  Reveal-on-scroll animations (progressive enhancement)
    7.  Reading progress bar (created by JS)
    8.  Back-to-top button (created by JS)
    9.  Hides the hero "Scroll" hint once you start scrolling
   10.  Friendly console warning if an image fails to load
   11.  Keeps --header-height in sync for CSS
   12.  Respects "prefers-reduced-motion"

   NOTES
   ------------------------------------------------------------
   - The progress bar, back-to-top button and reveal styles are
     injected by this file, so style.css does not need rules
     for them.
   - All listeners are passive where possible for performance.
   - No inline styles are left on the page after animations
     finish, so nothing fights your stylesheet.
   ============================================================ */

(function () {
  "use strict";

  /* ==========================================================
     0. TINY HELPERS
     ========================================================== */

  /** querySelector shortcut */
  function $(selector, context) {
    return (context || document).querySelector(selector);
  }

  /** querySelectorAll shortcut -> real array */
  function $$(selector, context) {
    return Array.prototype.slice.call(
      (context || document).querySelectorAll(selector)
    );
  }

  /** Clamp a number between min and max */
  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  /** requestAnimationFrame throttle — good for scroll handlers */
  function rafThrottle(fn) {
    var ticking = false;
    var lastArgs = null;

    return function () {
      lastArgs = arguments;

      if (ticking) return;
      ticking = true;

      window.requestAnimationFrame(function () {
        fn.apply(null, lastArgs);
        ticking = false;
      });
    };
  }

  /** Simple debounce — good for resize handlers */
  function debounce(fn, wait) {
    var timer = null;

    return function () {
      var args = arguments;
      var self = this;

      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        fn.apply(self, args);
      }, wait);
    };
  }

  /** True when the user asked for reduced motion */
  function reducedMotion() {
    return (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  /** Inject a <style> block once */
  function injectStyles(id, css) {
    if (document.getElementById(id)) return;

    var style = document.createElement("style");
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ==========================================================
     1. INJECTED STYLES
     (for elements created by JS + reveal animations)
     ========================================================== */

  injectStyles(
    "rmj-injected-styles",
    [
      /* ---------- reveal on scroll ---------- */
      ".reveal{",
      "  opacity:0;",
      "  transform:translateY(24px);",
      "  transition:opacity .7s ease, transform .7s cubic-bezier(.22,.61,.36,1);",
      "  transition-delay:var(--reveal-delay, 0s);",
      "  will-change:opacity, transform;",
      "}",
      ".reveal.is-visible{",
      "  opacity:1;",
      "  transform:none;",
      "}",
      ".reveal.is-visible{",
      "  will-change:auto;",
      "}",

      /* ---------- reading progress bar ---------- */
      ".scroll-progress{",
      "  position:fixed;",
      "  top:0;",
      "  left:0;",
      "  height:3px;",
      "  width:0%;",
      "  z-index:9999;",
      "  pointer-events:none;",
      "  background:var(--neon-blue, #00b3ff);",
      "  box-shadow:0 0 12px rgba(0,179,255,.55);",
      "  transition:width .08s linear;",
      "}",

      /* ---------- back to top ---------- */
      ".to-top{",
      "  position:fixed;",
      "  right:16px;",
      "  bottom:16px;",
      "  width:46px;",
      "  height:46px;",
      "  display:grid;",
      "  place-items:center;",
      "  border:0;",
      "  border-radius:50%;",
      "  cursor:pointer;",
      "  z-index:9998;",
      "  color:#ffffff;",
      "  background:var(--navy, #0b1a3a);",
      "  box-shadow:0 10px 26px rgba(0,0,0,.28);",
      "  opacity:0;",
      "  visibility:hidden;",
      "  transform:translateY(14px);",
      "  transition:opacity .25s ease, transform .25s ease, visibility .25s ease;",
      "}",
      ".to-top.is-visible{",
      "  opacity:1;",
      "  visibility:visible;",
      "  transform:translateY(0);",
      "}",
      ".to-top:hover,",
      ".to-top:focus-visible{",
      "  background:var(--neon-blue, #00b3ff);",
      "  color:var(--navy, #0b1a3a);",
      "  outline:none;",
      "}",
      ".to-top svg{",
      "  width:20px;",
      "  height:20px;",
      "  display:block;",
      "}",

      /* ---------- image error state ---------- */
      ".is-broken{",
      "  outline:2px dashed rgba(200,30,30,.45);",
      "  outline-offset:-6px;",
      "}",

      /* ---------- reduced motion safety net ---------- */
      "@media (prefers-reduced-motion: reduce){",
      "  .reveal{opacity:1;transform:none;transition:none;}",
      "  .scroll-progress{transition:none;}",
      "  .to-top{transition:none;}",
      "}",
    ].join("\n")
  );

  /* ==========================================================
     2. CACHE DOM REFERENCES
     ========================================================== */

  var docEl = document.documentElement;
  var body = document.body;

  var header = $(".site-header");
  var navToggle = $("#navToggle");
  var siteNav = $("#siteNav");
  var navLinks = $$(".nav-link");

  var yearEl = $("#year");
  var scrollHint = $(".scroll-hint");

  var sectionIds = ["home", "about", "works", "reviews", "contact"];
  var sections = sectionIds
    .map(function (id) {
      return document.getElementById(id);
    })
    .filter(Boolean);

  /* ==========================================================
     3. FOOTER YEAR
     ========================================================== */

  function setFooterYear() {
    if (!yearEl) return;
    yearEl.textContent = String(new Date().getFullYear());
  }

  /* ==========================================================
     4. HEADER HEIGHT → CSS VARIABLE
     Lets style.css use var(--header-height) for scroll offsets.
     ========================================================== */

  function syncHeaderHeight() {
    if (!header) return;

    var height = header.offsetHeight || 64;
    docEl.style.setProperty("--header-height", height + "px");
  }

  /* ==========================================================
     5. MOBILE NAVIGATION
     ========================================================== */

  var navIsOpen = false;

  function setNavOpen(open) {
    if (!navToggle || !siteNav) return;

    navIsOpen = open;

    navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    navToggle.setAttribute(
      "aria-label",
      open ? "Close navigation menu" : "Open navigation menu"
    );

    navToggle.classList.toggle("is-open", open);
    siteNav.classList.toggle("is-open", open);
    body.classList.toggle("nav-open", open);
  }

  function initMobileNav() {
    if (!navToggle || !siteNav) return;

    /* Toggle on button click */
    navToggle.addEventListener("click", function () {
      setNavOpen(!navIsOpen);
    });

    /* Close after clicking a nav link */
    $$("a", siteNav).forEach(function (link) {
      link.addEventListener("click", function () {
        setNavOpen(false);
      });
    });

    /* Close on Escape */
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && navIsOpen) {
        setNavOpen(false);

        if (navToggle) {
          navToggle.focus();
        }
      }
    });

    /* Close when clicking outside the header */
    document.addEventListener("click", function (event) {
      if (!navIsOpen) return;

      var target = event.target;

      if (header && header.contains(target)) return;
      if (navToggle && navToggle.contains(target)) return;

      setNavOpen(false);
    });

    /* Close when resizing up to desktop */
    window.addEventListener(
      "resize",
      debounce(function () {
        if (window.innerWidth > 900 && navIsOpen) {
          setNavOpen(false);
        }
        syncHeaderHeight();
      }, 150)
    );
  }

  /* ==========================================================
     6. STICKY HEADER STATE
     ========================================================== */

  function updateHeaderState() {
    if (!header) return;

    var scrolled = window.pageYOffset > 8;
    header.classList.toggle("is-scrolled", scrolled);
  }

  /* ==========================================================
     7. SMOOTH SCROLL WITH HEADER OFFSET
     ========================================================== */

  function getScrollOffset() {
    var headerHeight = header ? header.offsetHeight : 0;
    return headerHeight + 12;
  }

  function scrollToY(top, instant) {
    var behavior = instant || reducedMotion() ? "auto" : "smooth";

    try {
      window.scrollTo({ top: top, behavior: behavior });
    } catch (err) {
      /* Fallback for very old browsers */
      window.scrollTo(0, top);
    }
  }

  function scrollToElement(element) {
    if (!element) return;

    var offset = getScrollOffset();
    var rect = element.getBoundingClientRect();
    var top = rect.top + window.pageYOffset - offset;

    scrollToY(Math.max(0, top));
  }

  function initAnchorLinks() {
    $$('a[href^="#"]').forEach(function (link) {
      var href = link.getAttribute("href");

      /* Ignore bare "#" links */
      if (!href || href === "#") return;

      link.addEventListener("click", function (event) {
        var id = href.slice(1);
        var target = document.getElementById(id);

        if (!target) return;

        event.preventDefault();

        scrollToElement(target);

        /* Keep the URL in sync without a jump */
        if (window.history && window.history.pushState) {
          window.history.pushState(null, "", href);
        }

        /* Move focus for keyboard/screen-reader users */
        if (!target.hasAttribute("tabindex")) {
          target.setAttribute("tabindex", "-1");
        }

        window.setTimeout(function () {
          target.focus({ preventScroll: true });
        }, 400);
      });
    });
  }

  /* Handle a #hash on page load (e.g. someone shares /#works) */
  function handleInitialHash() {
    if (!window.location.hash) return;

    var target = document.getElementById(window.location.hash.slice(1));
    if (!target) return;

    /* Wait one frame so layout + fonts settle first */
    window.requestAnimationFrame(function () {
      scrollToElement(target);
    });
  }

  /* ==========================================================
     8. SCROLL SPY (ACTIVE NAV LINK)
     ========================================================== */

  function updateActiveLink() {
    if (!navLinks.length || !sections.length) return;

    var offset = getScrollOffset() + 24;
    var scrollPosition = window.pageYOffset + offset;

    var currentId = sections[0].id;

    sections.forEach(function (section) {
      var top = section.getBoundingClientRect().top + window.pageYOffset;

      if (top <= scrollPosition) {
        currentId = section.id;
      }
    });

    /* If we're at the very bottom, force the last section */
    var atBottom =
      window.innerHeight + window.pageYOffset >=
      document.documentElement.scrollHeight - 4;

    if (atBottom) {
      currentId = sections[sections.length - 1].id;
    }

    navLinks.forEach(function (link) {
      var isActive = link.getAttribute("href") === "#" + currentId;

      link.classList.toggle("is-active", isActive);

      if (isActive) {
        link.setAttribute("aria-current", "true");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  /* ==========================================================
     9. REVEAL ON SCROLL
     ========================================================== */

  var revealSelector = [
    ".section-head",
    ".about-copy",
    ".about-services",
    ".work-card",
    ".review-card",
    ".contact-item",
    ".contact-action",
    ".works-cta",
  ].join(", ");

  function initReveal() {
    /* Skip entirely for reduced-motion users */
    if (reducedMotion()) return;

    /* No IntersectionObserver? Just show everything. */
    if (!("IntersectionObserver" in window)) return;

    var items = $$(revealSelector);
    if (!items.length) return;

    items.forEach(function (item) {
      item.classList.add("reveal");
    });

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;

          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      {
        root: null,
        rootMargin: "0px 0px -10% 0px",
        threshold: 0.12,
      }
    );

    items.forEach(function (item, index) {
      /* Small stagger so cards don't pop in all at once */
      var delay = Math.min(index % 3, 2) * 0.08;
      item.style.setProperty("--reveal-delay", delay + "s");

      observer.observe(item);
    });
  }

  /* ==========================================================
     10. READING PROGRESS BAR
     ========================================================== */

  var progressBar = null;

  function createProgressBar() {
    if (progressBar) return;

    progressBar = document.createElement("div");
    progressBar.className = "scroll-progress";
    progressBar.setAttribute("aria-hidden", "true");
    body.appendChild(progressBar);
  }

  function updateProgressBar() {
    if (!progressBar) return;

    var docHeight = document.documentElement.scrollHeight;
    var viewHeight = window.innerHeight;
    var scrollable = docHeight - viewHeight;

    var percent = scrollable > 0 ? (window.pageYOffset / scrollable) * 100 : 0;

    progressBar.style.width = clamp(percent, 0, 100).toFixed(2) + "%";
  }

  /* ==========================================================
     11. BACK-TO-TOP BUTTON
     ========================================================== */

  var toTopButton = null;

  function createToTopButton() {
    if (toTopButton) return;

    toTopButton = document.createElement("button");
    toTopButton.type = "button";
    toTopButton.className = "to-top";
    toTopButton.setAttribute("aria-label", "Back to top");
    toTopButton.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true" focusable="false">' +
      '<path d="M12 19V5"></path>' +
      '<path d="M5 12l7-7 7 7"></path>' +
      "</svg>";

    toTopButton.addEventListener("click", function () {
      scrollToY(0);
    });

    body.appendChild(toTopButton);
  }

  function updateToTopButton() {
    if (!toTopButton) return;

    var visible = window.pageYOffset > 600;
    toTopButton.classList.toggle("is-visible", visible);
  }

  /* ==========================================================
     12. HERO SCROLL HINT
     ========================================================== */

  function updateScrollHint() {
    if (!scrollHint) return;

    scrollHint.style.opacity = window.pageYOffset > 60 ? "0" : "";
  }

  /* ==========================================================
     13. IMAGE FALLBACKS
     Warns in the console when a local image is missing,
     so a broken A.png/D.png/E.png/B.png is easy to spot.
     ========================================================== */

  function initImageFallbacks() {
    $$("img").forEach(function (img) {
      img.addEventListener("error", function () {
        var src = img.getAttribute("src") || "(no src)";
        var container = img.parentElement;

        if (container) {
          container.classList.add("is-broken");
        }

        if (window.console && console.warn) {
          console.warn(
            "[Design By RMJ] Image failed to load: " +
              src +
              " — check the filename, capitalisation (.png vs .PNG) " +
              "and that it sits in the same folder as index.html."
          );
        }
      });
    });
  }

  /* ==========================================================
     14. EXTERNAL LINK SAFETY
     Adds rel="noopener noreferrer" to any _blank link missing it.
     ========================================================== */

  function initExternalLinks() {
    $$('a[target="_blank"]').forEach(function (link) {
      var rel = (link.getAttribute("rel") || "").toLowerCase();

      if (rel.indexOf("noopener") === -1) {
        link.setAttribute(
          "rel",
          (rel ? rel + " " : "") + "noopener noreferrer"
        );
      }
    });
  }

  /* ==========================================================
     15. MASTER SCROLL HANDLER
     One throttled listener drives everything scroll-related.
     ========================================================== */

  var onScroll = rafThrottle(function () {
    updateHeaderState();
    updateActiveLink();
    updateProgressBar();
    updateToTopButton();
    updateScrollHint();
  });

  function initScrollListener() {
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
  }

  /* ==========================================================
     16. INIT
     ========================================================== */

  function init() {
    /* --- one-time setup --- */
    setFooterYear();
    syncHeaderHeight();

    createProgressBar();
    createToTopButton();

    initMobileNav();
    initAnchorLinks();
    initImageFallbacks();
    initExternalLinks();
    initReveal();

    initScrollListener();

    /* --- first paint values --- */
    updateHeaderState();
    updateActiveLink();
    updateProgressBar();
    updateToTopButton();
    updateScrollHint();

    /* --- re-run after fonts/layout settle --- */
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        syncHeaderHeight();
        updateActiveLink();
        onScroll();
      });
    }

    window.addEventListener("load", function () {
      syncHeaderHeight();
      handleInitialHash();
      onScroll();
    });
  }

  /* Run as soon as the DOM is ready */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
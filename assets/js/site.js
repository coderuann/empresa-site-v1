/* ============================================================================
   BLOCK — site.js
   Dark mode, drawer mobile, modal, validação de formulário e transições.
   Zero dependências. Todo bloco é guardado: uma página que não usa um módulo
   simplesmente não o inicializa.
   ============================================================================ */
(function () {
  "use strict";

  var STORAGE_KEY = "block:theme";
  var root = document.documentElement;

  /* --------------------------------------------------------------------------
     Utilidades
     -------------------------------------------------------------------------- */

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  var FOCUSABLE = [
    "a[href]", "button:not([disabled])", "input:not([disabled])",
    "textarea:not([disabled])", "select:not([disabled])", "[tabindex]:not([tabindex='-1'])"
  ].join(",");

  /* Mantém o foco dentro de um container aberto (drawer, modal).
     Requisito de a11y do design system para overlays. */
  function trapFocus(container, event) {
    var nodes = $$(FOCUSABLE, container).filter(function (el) {
      return el.getClientRects().length > 0;
    });
    if (!nodes.length) return;
    var first = nodes[0];
    var last = nodes[nodes.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  var scrollLocks = 0;
  function lockScroll(on) {
    scrollLocks = Math.max(0, scrollLocks + (on ? 1 : -1));
    document.body.style.overflow = scrollLocks > 0 ? "hidden" : "";
  }

  /* --------------------------------------------------------------------------
     Toast — confirmação efêmera
     -------------------------------------------------------------------------- */

  var toastTimer;
  function toast(message) {
    var el = $("#toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      el.classList.remove("is-visible");
    }, 2400);
  }

  /* --------------------------------------------------------------------------
     1 · DARK MODE
     O tema já foi aplicado por um script inline no <head> para evitar flash.
     Aqui apenas conectamos o controle e persistimos a escolha.
     -------------------------------------------------------------------------- */

  function readStoredTheme() {
    try { return window.localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }
  function storeTheme(value) {
    try { window.localStorage.setItem(STORAGE_KEY, value); } catch (e) { /* modo privado */ }
  }

  function syncToggle(button) {
    var isDark = root.getAttribute("data-theme") === "dark";
    button.setAttribute("aria-pressed", isDark ? "true" : "false");
    button.setAttribute("aria-label", isDark ? "Ativar modo claro" : "Ativar modo escuro");
  }

  function initTheme() {
    var buttons = $$("[data-theme-toggle]");
    if (!buttons.length) return;

    buttons.forEach(syncToggle);

    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
        root.setAttribute("data-theme", next);
        storeTheme(next);
        buttons.forEach(syncToggle);
      });
    });

    /* Sem escolha explícita, o site acompanha o sistema operacional. */
    var query = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    if (!query) return;
    var onChange = function (event) {
      if (readStoredTheme()) return;
      root.setAttribute("data-theme", event.matches ? "dark" : "light");
      buttons.forEach(syncToggle);
    };
    if (query.addEventListener) query.addEventListener("change", onChange);
    else if (query.addListener) query.addListener(onChange);
  }

  /* --------------------------------------------------------------------------
     2 · DRAWER MOBILE
     -------------------------------------------------------------------------- */

  function initDrawer() {
    var drawer = $("#drawer");
    var openers = $$("[data-drawer-open]");
    if (!drawer || !openers.length) return;

    var lastFocused = null;

    function open() {
      lastFocused = document.activeElement;
      drawer.setAttribute("data-open", "true");
      drawer.removeAttribute("aria-hidden");
      openers.forEach(function (b) { b.setAttribute("aria-expanded", "true"); });
      lockScroll(true);
      var first = $(FOCUSABLE, drawer);
      if (first) first.focus();
    }

    function close() {
      if (drawer.getAttribute("data-open") !== "true") return;
      drawer.setAttribute("data-open", "false");
      drawer.setAttribute("aria-hidden", "true");
      openers.forEach(function (b) { b.setAttribute("aria-expanded", "false"); });
      lockScroll(false);
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    }

    openers.forEach(function (button) {
      button.addEventListener("click", open);
    });
    $$("[data-drawer-close]", drawer).forEach(function (button) {
      button.addEventListener("click", close);
    });
    $$("a", drawer).forEach(function (link) {
      link.addEventListener("click", close);
    });

    drawer.addEventListener("keydown", function (event) {
      if (event.key === "Escape") { event.preventDefault(); close(); }
      else if (event.key === "Tab") { trapFocus(drawer, event); }
    });

    /* O drawer é exclusivo do mobile: ao passar do breakpoint, fecha. */
    if (window.matchMedia) {
      var desktop = window.matchMedia("(min-width: 768px)");
      var onChange = function (event) { if (event.matches) close(); };
      if (desktop.addEventListener) desktop.addEventListener("change", onChange);
      else if (desktop.addListener) desktop.addListener(onChange);
    }
  }

  /* --------------------------------------------------------------------------
     3 · MODAL
     Abre por [data-modal-open="id"], fecha por ESC, scrim e [data-modal-close].
     -------------------------------------------------------------------------- */

  var Modal = (function () {
    var active = null;
    var lastFocused = null;

    function open(id) {
      var modal = document.getElementById(id);
      if (!modal) return;
      lastFocused = document.activeElement;
      active = modal;
      modal.setAttribute("data-open", "true");
      modal.removeAttribute("aria-hidden");
      lockScroll(true);
      var first = $(FOCUSABLE, modal);
      if (first) first.focus();
    }

    function close() {
      if (!active) return;
      active.setAttribute("data-open", "false");
      active.setAttribute("aria-hidden", "true");
      lockScroll(false);
      if (lastFocused && lastFocused.focus) lastFocused.focus();
      active = null;
    }

    function init() {
      $$("[data-modal-open]").forEach(function (button) {
        button.addEventListener("click", function () {
          open(button.getAttribute("data-modal-open"));
        });
      });

      $$(".modal").forEach(function (modal) {
        $$("[data-modal-close]", modal).forEach(function (button) {
          button.addEventListener("click", close);
        });
        var scrim = $(".modal__scrim", modal);
        if (scrim) scrim.addEventListener("click", close);
        modal.addEventListener("keydown", function (event) {
          if (event.key === "Escape") { event.preventDefault(); close(); }
          else if (event.key === "Tab") { trapFocus(modal, event); }
        });
      });
    }

    return { init: init, open: open, close: close };
  })();

  /* --------------------------------------------------------------------------
     4 · VALIDAÇÃO DE FORMULÁRIO
     Microcopy: o erro explica a causa e aponta o próximo passo.
     Nunca exclamação, nunca "algo deu errado".
     -------------------------------------------------------------------------- */

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  var RULES = {
    nome: function (value) {
      if (!value) return "Informe seu nome. É assim que sabemos com quem estamos falando.";
      if (value.length < 2) return "Nome curto demais. Escreva ao menos duas letras.";
      return null;
    },
    email: function (value) {
      if (!value) return "Informe um e-mail. É por ele que a resposta chega.";
      if (value.indexOf("@") === -1) return "Falta o @ no endereço. Verifique e tente de novo.";
      if (!EMAIL_RE.test(value)) return "Falta o domínio. Verifique o que vem depois do @.";
      return null;
    },
    empresa: function () { return null; },
    contexto: function (value) {
      if (!value) return "Descreva o contexto. Duas ou três frases já bastam para começarmos.";
      if (value.length < 20) return "Contexto curto demais. Precisamos de ao menos 20 caracteres para entender o cenário.";
      return null;
    }
  };

  function initForm() {
    var form = $("#contato-form");
    if (!form) return;

    var status = $("#form-status");
    var fields = $$("[data-validate]", form);
    var submitted = false;

    function setFieldState(input, message) {
      var wrapper = input.closest(".field");
      var help = wrapper ? $(".help", wrapper) : null;
      if (!wrapper || !help) return;

      if (message) {
        wrapper.classList.add("is-error");
        input.setAttribute("aria-invalid", "true");
        help.textContent = message;
      } else {
        wrapper.classList.remove("is-error");
        input.removeAttribute("aria-invalid");
        help.textContent = help.getAttribute("data-help") || "";
      }
    }

    function validateField(input) {
      var rule = RULES[input.name];
      if (!rule) return null;
      var message = rule(input.value.trim());
      setFieldState(input, message);
      return message;
    }

    fields.forEach(function (input) {
      var wrapper = input.closest(".field");
      var help = wrapper ? $(".help", wrapper) : null;
      if (help && !help.getAttribute("data-help")) {
        help.setAttribute("data-help", help.textContent.trim());
      }
      input.addEventListener("blur", function () {
        if (submitted || input.value.trim()) validateField(input);
      });
      input.addEventListener("input", function () {
        if (submitted) validateField(input);
      });
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      submitted = true;

      var invalid = fields.filter(function (input) { return validateField(input) !== null; });

      if (invalid.length) {
        if (status) {
          status.textContent = invalid.length === 1
            ? "O formulário não foi enviado: um campo precisa de correção. O ponto está marcado abaixo."
            : "O formulário não foi enviado: " + invalid.length + " campos precisam de correção. Os pontos estão marcados abaixo.";
        }
        invalid[0].focus();
        return;
      }

      if (status) status.textContent = "";
      prepareMessage(form);
      Modal.open("modal-envio");
    });
  }

  /* Monta o texto da mensagem para que a pessoa possa copiá-lo e enviar pelo
     canal que preferir enquanto o e-mail corporativo não está ativo. */
  var preparedMessage = "";

  function prepareMessage(form) {
    var data = new FormData(form);
    var empresa = (data.get("empresa") || "").toString().trim();
    preparedMessage = [
      "Contato via site — BLOCK",
      "",
      "Nome: " + (data.get("nome") || "").toString().trim(),
      "E-mail: " + (data.get("email") || "").toString().trim(),
      "Empresa: " + (empresa || "não informada"),
      "",
      "Contexto:",
      (data.get("contexto") || "").toString().trim()
    ].join("\n");

    var preview = $("#mensagem-preview");
    if (preview) preview.textContent = preparedMessage;
  }

  function copyPrepared() {
    var done = function () { toast("Mensagem copiada"); };
    var fail = function () { toast("Não foi possível copiar. Selecione o texto acima e copie manualmente."); };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(preparedMessage).then(done)["catch"](fail);
      return;
    }
    try {
      var area = document.createElement("textarea");
      area.value = preparedMessage;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(area);
      if (ok) done(); else fail();
    } catch (e) {
      fail();
    }
  }

  function initCopy() {
    var button = $("#copiar-mensagem");
    if (!button) return;
    button.addEventListener("click", copyPrepared);
  }

  /* --------------------------------------------------------------------------
     5 · NAVBAR — hairline aparece só quando a página saiu do topo
     -------------------------------------------------------------------------- */

  function initNavbar() {
    var navbar = $(".navbar");
    if (!navbar) return;
    var ticking = false;

    function update() {
      navbar.classList.toggle("is-stuck", window.scrollY > 8);
      ticking = false;
    }
    update();

    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }, { passive: true });
  }

  /* --------------------------------------------------------------------------
     6 · REVEAL — entrada sutil das seções
     -------------------------------------------------------------------------- */

  function initReveal() {
    var targets = $$(".reveal");
    if (!targets.length) return;

    if (!("IntersectionObserver" in window)) {
      targets.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.05 });

    targets.forEach(function (el) { observer.observe(el); });
  }

  /* --------------------------------------------------------------------------
     7 · ANO CORRENTE NO RODAPÉ
     -------------------------------------------------------------------------- */

  function initYear() {
    $$("[data-year]").forEach(function (el) {
      el.textContent = String(new Date().getFullYear());
    });
  }

  /* --------------------------------------------------------------------------
     Bootstrap
     -------------------------------------------------------------------------- */

  function init() {
    initTheme();
    initDrawer();
    Modal.init();
    initForm();
    initCopy();
    initNavbar();
    initReveal();
    initYear();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

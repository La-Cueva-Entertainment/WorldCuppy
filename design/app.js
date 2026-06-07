/* WorldCuppy — shared chrome: nav injection, theme toggle, mobile drawer */
(function () {
  const PAGES = [
    { href: "Home.html",      label: "Home" },
    { href: "Standings.html", label: "Standings" },
    { href: "Draft.html",     label: "Draft" },
    { href: "Lineup.html",    label: "My Teams" },
    { href: "News.html",      label: "News" },
  ];
  const ADMIN = { href: "#", label: "Admin", adm: true };

  // theme
  function applyTheme(t){ document.documentElement.classList.toggle("dark", t === "dark"); }
  let theme = "light";
  try { theme = localStorage.getItem("wc_theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); } catch(e){}
  applyTheme(theme);

  function sun(){ return `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/></svg>`; }
  function moon(){ return `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.6 6.6 0 0 0 9.8 9.8z"/></svg>`; }

  window.WCChrome = {
    nav: function (active, opts) {
      opts = opts || {};
      const links = PAGES.map(p =>
        `<a href="${p.href}" class="${p.label===active?'active':''}">${p.label}</a>`).join("");
      const adminLink = opts.admin ? `<a href="${ADMIN.href}" class="adm">${ADMIN.label}</a>` : "";
      const isDark = document.documentElement.classList.contains("dark");

      const nav = document.createElement("div");
      nav.className = "nav";
      nav.innerHTML = `
        <div class="nav-in">
          <a class="brand" href="Home.html" aria-label="WorldCuppy home">
            <span class="ball"></span>
            <span class="wm">World<b>Cuppy</b></span>
          </a>
          <nav class="nav-links">${links}${adminLink}</nav>
          <span class="nav-spacer"></span>
          <div class="nav-right">
            <button class="icon-btn" id="wc-theme" title="Toggle theme">${isDark?sun():moon()}</button>
            <a class="avatar" href="Profile.html" title="Nico">N</a>
            <button class="icon-btn nav-toggle" id="wc-burger" title="Menu" aria-label="Menu">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
            </button>
          </div>
        </div>`;
      document.body.prepend(nav);

      // mobile drawer
      const back = document.createElement("div"); back.className = "drawer-back";
      const draw = document.createElement("div"); draw.className = "drawer";
      draw.innerHTML = `<div style="font-family:'Archivo';font-weight:900;font-size:18px;margin:2px 6px 12px">Menu</div>` +
        PAGES.concat(opts.admin?[ADMIN]:[]).map(p=>`<a href="${p.href}" class="${p.label===active?'active':''}">${p.label}</a>`).join("") +
        `<a href="Profile.html">Profile</a>`;
      document.body.append(back, draw);

      const toggle = (o)=>{ back.classList.toggle("open",o); draw.classList.toggle("open",o); };
      nav.querySelector("#wc-burger").addEventListener("click", ()=>toggle(true));
      back.addEventListener("click", ()=>toggle(false));

      // theme button
      nav.querySelector("#wc-theme").addEventListener("click", ()=>{
        const dark = !document.documentElement.classList.contains("dark");
        applyTheme(dark ? "dark" : "light");
        try { localStorage.setItem("wc_theme", dark ? "dark" : "light"); } catch(e){}
        nav.querySelector("#wc-theme").innerHTML = dark ? sun() : moon();
      });
    }
  };
})();

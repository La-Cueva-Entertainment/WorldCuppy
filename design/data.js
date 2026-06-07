/* WorldCuppy — shared mock data for hi-fi mockups (World Cup 2026) */
window.WC = (function () {
  // tier: 1 Contenders, 2 Dark horses, 3 Mid pack, 4 Long shots — tier drives JUMP payouts, not display order
  const TEAMS = [
    { code:"ARG", name:"Argentina",   fi:"ar",     rank:1,  tier:1 },
    { code:"FRA", name:"France",      fi:"fr",     rank:2,  tier:1 },
    { code:"ESP", name:"Spain",       fi:"es",     rank:3,  tier:1 },
    { code:"ENG", name:"England",     fi:"gb-eng", rank:4,  tier:1 },
    { code:"BRA", name:"Brazil",      fi:"br",     rank:5,  tier:1 },
    { code:"POR", name:"Portugal",    fi:"pt",     rank:6,  tier:1 },
    { code:"NED", name:"Netherlands", fi:"nl",     rank:7,  tier:2 },
    { code:"BEL", name:"Belgium",     fi:"be",     rank:8,  tier:2 },
    { code:"ITA", name:"Italy",       fi:"it",     rank:9,  tier:2 },
    { code:"GER", name:"Germany",     fi:"de",     rank:10, tier:2 },
    { code:"CRO", name:"Croatia",     fi:"hr",     rank:11, tier:2 },
    { code:"MAR", name:"Morocco",     fi:"ma",     rank:12, tier:2 },
    { code:"URU", name:"Uruguay",     fi:"uy",     rank:13, tier:3 },
    { code:"USA", name:"USA",         fi:"us",     rank:14, tier:3 },
    { code:"COL", name:"Colombia",    fi:"co",     rank:15, tier:3 },
    { code:"MEX", name:"Mexico",      fi:"mx",     rank:16, tier:3 },
    { code:"SEN", name:"Senegal",     fi:"sn",     rank:17, tier:3 },
    { code:"JPN", name:"Japan",       fi:"jp",     rank:18, tier:3 },
    { code:"SUI", name:"Switzerland", fi:"ch",     rank:19, tier:4 },
    { code:"DEN", name:"Denmark",     fi:"dk",     rank:20, tier:4 },
    { code:"KOR", name:"South Korea", fi:"kr",     rank:23, tier:4 },
    { code:"AUS", name:"Australia",   fi:"au",     rank:25, tier:4 },
    { code:"GHA", name:"Ghana",       fi:"gh",     rank:28, tier:4 },
    { code:"QAT", name:"Qatar",       fi:"qa",     rank:34, tier:4 },
  ];
  const TEAM = Object.fromEntries(TEAMS.map(t => [t.code, t]));

  const TIERS = [
    { key:1, name:"Contenders",  range:"FIFA #1–6",  jump:"base" },
    { key:2, name:"Dark horses", range:"#7–12",      jump:"+$1 / jump" },
    { key:3, name:"Mid pack",    range:"#13–18",     jump:"+$2 / jump" },
    { key:4, name:"Long shots",  range:"#19+",       jump:"+$3 / jump" },
  ];

  // index 0 == you (Nico)
  const MANAGERS = [
    { id:"u0", name:"Nico",    you:true  },
    { id:"u1", name:"Anthony", you:false },
    { id:"u2", name:"Ruben",   you:false },
    { id:"u3", name:"Donny",   you:false },
    { id:"u4", name:"Joe",     you:false },
    { id:"u5", name:"Daniel",  you:false },
    { id:"u6", name:"Chris",   you:false },
    { id:"u7", name:"Spencer", you:false },
  ];
  const LINEUP = 4;

  // chronological draft picks so far (pick #, manager index, team) — 18 of 32 done
  const PICKS = [
    [0,0,"FRA"],[1,1,"ARG"],[2,2,"ESP"],[3,3,"ENG"],[4,4,"BRA"],[5,5,"POR"],[6,6,"NED"],[7,7,"BEL"],
    [8,7,"ITA"],[9,6,"GER"],[10,5,"CRO"],[11,4,"MAR"],[12,3,"URU"],[13,2,"USA"],[14,1,"MEX"],[15,0,"DEN"],
    [16,0,"COL"],[17,1,"SEN"],
  ].map(([n,m,code]) => ({ pick:n, mgr:m, code }));

  // matches — today + a few past for standings/bracket
  const TODAY = [
    { stage:"Group A", home:"FRA", away:"MEX", hs:null, as:null, time:"11:00 AM PT", venue:"Estadio Azteca", played:false },
    { stage:"Group B", home:"ESP", away:"CRO", hs:null, as:null, time:"2:00 PM PT", venue:"SoFi Stadium", played:false },
    { stage:"Group C", home:"ARG", away:"USA", hs:2, as:1, time:null, venue:null, played:true, pens:false },
    { stage:"Group D", home:"ENG", away:"SEN", hs:3, as:0, time:null, venue:null, played:true, pens:false },
  ];

  const STAGES = {
    r16: [
      { home:"ARG", away:"DEN", hs:2, as:0, played:true },
      { home:"FRA", away:"MAR", hs:1, as:0, played:true },
      { home:"ESP", away:"JPN", hs:3, as:1, played:true },
      { home:"ENG", away:"USA", hs:2, as:2, pens:true, pw:"ENG", played:true },
      { home:"BRA", away:"KOR", hs:4, as:1, played:true },
      { home:"POR", away:"SUI", hs:2, as:1, played:true },
      { home:"NED", away:"URU", hs:null, as:null, played:false },
      { home:"BEL", away:"CRO", hs:null, as:null, played:false },
    ],
    qf: [
      { home:"ARG", away:"FRA", hs:null, as:null, played:false },
      { home:"ESP", away:"ENG", hs:null, as:null, played:false },
      { home:"BRA", away:"POR", hs:null, as:null, played:false },
      { home:"—",   away:"—",   hs:null, as:null, played:false },
    ],
  };

  // standings earnings (cents) + which teams each owns
  const OWNED = (() => {
    const o = {}; MANAGERS.forEach((m,i)=>o[i]=[]);
    PICKS.forEach(p => o[p.mgr].push(p.code));
    return o;
  })();
  const STANDINGS = [
    { mgr:0, cents:8175 }, { mgr:3, cents:6950 }, { mgr:1, cents:6020 }, { mgr:5, cents:5375 },
    { mgr:4, cents:4475 }, { mgr:7, cents:3625 }, { mgr:2, cents:3300 }, { mgr:6, cents:1175 },
  ].sort((a,b)=>b.cents-a.cents);

  const NEWS = [
    { tag:"Match", time:"32m", title:"Argentina edge USA 2–1 in tense Group C opener", src:"ESPN FC", lead:"Messi's early strike and a late winner sink a spirited USMNT side." },
    { tag:"Injury", time:"1h", title:"Mbappé limps off in training — France sweat on fitness", src:"L'Équipe", lead:"The forward is a doubt for the Mexico clash on Saturday." },
    { tag:"Draft", time:"2h", title:"Form guide: which dark horses are worth a jump payout?", src:"WorldCuppy", lead:"Morocco and Croatia look like the value picks of tier 2 this cycle." },
    { tag:"Match", time:"3h", title:"England cruise past Senegal behind Bellingham brace", src:"BBC Sport", lead:"Three Lions look ominous heading into the knockout rounds." },
    { tag:"Transfer", time:"5h", title:"Spain name unchanged XI as Croatia test looms", src:"Marca", lead:"De la Fuente keeps faith with the side that topped the group." },
  ];

  // ---------- helpers ----------
  function money(cents, sign) {
    const v = (cents/100);
    const s = "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (sign && cents>0 ? "+" : "") + s;
  }
  function flag(code, size) {
    const t = TEAM[code];
    const fi = t ? t.fi : "xx";
    const cls = "flag-" + (size||"md");
    return `<span class="fi fi-${fi} fi-rect ${cls}" title="${t?t.name:code}" role="img" aria-label="${t?t.name:code}"></span>`;
  }
  function mgr(i){ return MANAGERS[i]; }
  function ownerOf(code){
    const p = PICKS.find(x=>x.code===code);
    return p ? p.mgr : null;
  }
  function initials(name){ return name.slice(0,1).toUpperCase(); }

  // seeded shuffle so the "randomized" draft list is stable per load but not rank-ordered
  function shuffle(arr, seed){
    const a = arr.slice(); let s = seed||7;
    for (let i=a.length-1;i>0;i--){ s=(s*9301+49297)%233280; const j=Math.floor(s/233280*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
    return a;
  }

  return { TEAMS, TEAM, TIERS, MANAGERS, LINEUP, PICKS, TODAY, STAGES, OWNED, STANDINGS, NEWS,
           money, flag, mgr, ownerOf, initials, shuffle };
})();

export type PlayerEntry = {
  name: string;
  position: "GK" | "DEF" | "MID" | "FWD";
};

/** 2–3 notable players per team, keyed by FIFA team code (lowercase). */
export const TEAM_PLAYERS: Record<string, PlayerEntry[]> = {
  esp: [{ name: "Lamine Yamal", position: "FWD" }, { name: "Pedri", position: "MID" }, { name: "Rodri", position: "MID" }],
  arg: [{ name: "Lionel Messi", position: "FWD" }, { name: "Julián Álvarez", position: "FWD" }, { name: "Enzo Fernández", position: "MID" }],
  fra: [{ name: "Kylian Mbappé", position: "FWD" }, { name: "Antoine Griezmann", position: "FWD" }, { name: "Ousmane Dembélé", position: "FWD" }],
  eng: [{ name: "Jude Bellingham", position: "MID" }, { name: "Harry Kane", position: "FWD" }, { name: "Phil Foden", position: "MID" }],
  bra: [{ name: "Vinicius Jr.", position: "FWD" }, { name: "Rodrygo", position: "FWD" }, { name: "Raphinha", position: "FWD" }],
  por: [{ name: "Cristiano Ronaldo", position: "FWD" }, { name: "Bruno Fernandes", position: "MID" }, { name: "Bernardo Silva", position: "MID" }],
  ned: [{ name: "Virgil van Dijk", position: "DEF" }, { name: "Cody Gakpo", position: "FWD" }, { name: "Xavi Simons", position: "MID" }],
  mar: [{ name: "Achraf Hakimi", position: "DEF" }, { name: "Hakim Ziyech", position: "MID" }, { name: "Sofyan Amrabat", position: "MID" }],
  bel: [{ name: "Kevin De Bruyne", position: "MID" }, { name: "Romelu Lukaku", position: "FWD" }, { name: "Thibaut Courtois", position: "GK" }],
  ger: [{ name: "Florian Wirtz", position: "MID" }, { name: "Jamal Musiala", position: "MID" }, { name: "Kai Havertz", position: "FWD" }],
  cro: [{ name: "Luka Modrić", position: "MID" }, { name: "Ivan Perišić", position: "MID" }, { name: "Marcelo Brozović", position: "MID" }],
  sen: [{ name: "Sadio Mané", position: "FWD" }, { name: "Édouard Mendy", position: "GK" }, { name: "Idrissa Gueye", position: "MID" }],
  col: [{ name: "James Rodríguez", position: "MID" }, { name: "Luis Díaz", position: "FWD" }, { name: "Jhon Durán", position: "FWD" }],
  usa: [{ name: "Christian Pulisic", position: "FWD" }, { name: "Weston McKennie", position: "MID" }, { name: "Tyler Adams", position: "MID" }],
  mex: [{ name: "Hirving Lozano", position: "FWD" }, { name: "Raúl Jiménez", position: "FWD" }, { name: "Edson Álvarez", position: "MID" }],
  uru: [{ name: "Federico Valverde", position: "MID" }, { name: "Darwin Núñez", position: "FWD" }, { name: "Luis Suárez", position: "FWD" }],
  sui: [{ name: "Granit Xhaka", position: "MID" }, { name: "Xherdan Shaqiri", position: "FWD" }, { name: "Yann Sommer", position: "GK" }],
  jpn: [{ name: "Takumi Minamino", position: "FWD" }, { name: "Daichi Kamada", position: "MID" }, { name: "Ritsu Dōan", position: "FWD" }],
  irn: [{ name: "Mehdi Taremi", position: "FWD" }, { name: "Sardar Azmoun", position: "FWD" }, { name: "Ali Gholizadeh", position: "MID" }],
  kor: [{ name: "Son Heung-min", position: "FWD" }, { name: "Hwang Hee-chan", position: "FWD" }, { name: "Lee Jae-sung", position: "MID" }],
  ecu: [{ name: "Enner Valencia", position: "FWD" }, { name: "Moisés Caicedo", position: "MID" }, { name: "Gonzalo Plata", position: "FWD" }],
  aut: [{ name: "David Alaba", position: "DEF" }, { name: "Marcel Sabitzer", position: "MID" }, { name: "Marko Arnautović", position: "FWD" }],
  aus: [{ name: "Mathew Ryan", position: "GK" }, { name: "Mat Leckie", position: "DEF" }, { name: "Mitchell Duke", position: "FWD" }],
  alg: [{ name: "Riyad Mahrez", position: "FWD" }, { name: "Youcef Atal", position: "DEF" }, { name: "Houssem Aouar", position: "MID" }],
  can: [{ name: "Alphonso Davies", position: "DEF" }, { name: "Jonathan David", position: "FWD" }, { name: "Tajon Buchanan", position: "MID" }],
  egy: [{ name: "Mohamed Salah", position: "FWD" }, { name: "Omar Marmoush", position: "FWD" }, { name: "Mostafa Mohamed", position: "FWD" }],
  nor: [{ name: "Erling Haaland", position: "FWD" }, { name: "Martin Ødegaard", position: "MID" }, { name: "Alexander Sørloth", position: "FWD" }],
  pan: [{ name: "Rolando Blackburn", position: "FWD" }, { name: "Adalberto Carrasquilla", position: "MID" }, { name: "Fidel Escobar", position: "DEF" }],
  civ: [{ name: "Sébastien Haller", position: "FWD" }, { name: "Franck Kessié", position: "MID" }, { name: "Simon Adingra", position: "FWD" }],
  sco: [{ name: "Andy Robertson", position: "DEF" }, { name: "Scott McTominay", position: "MID" }, { name: "John McGinn", position: "MID" }],
  par: [{ name: "Miguel Almirón", position: "MID" }, { name: "Gustavo Gómez", position: "DEF" }, { name: "Julio Enciso", position: "FWD" }],
  tun: [{ name: "Wahbi Khazri", position: "FWD" }, { name: "Ellyes Skhiri", position: "MID" }, { name: "Youssef Msakni", position: "FWD" }],
  uzb: [{ name: "Eldor Shomurodov", position: "FWD" }, { name: "Abbosbek Fayzullaev", position: "MID" }, { name: "Jasur Yaxshiliqov", position: "FWD" }],
  qat: [{ name: "Akram Afif", position: "FWD" }, { name: "Almoez Ali", position: "FWD" }, { name: "Hassan Al-Haydos", position: "MID" }],
  rsa: [{ name: "Percy Tau", position: "FWD" }, { name: "Ronwen Williams", position: "GK" }, { name: "Themba Zwane", position: "MID" }],
  ksa: [{ name: "Salem Al-Dawsari", position: "FWD" }, { name: "Mohammed Al-Owais", position: "GK" }, { name: "Saleh Al-Shehri", position: "FWD" }],
  jor: [{ name: "Yazan Al-Naimat", position: "FWD" }, { name: "Musa Al-Taamari", position: "FWD" }, { name: "Ahmad Alnaber", position: "MID" }],
  cpv: [{ name: "Ryan Mendes", position: "FWD" }, { name: "Garry Rodrigues", position: "FWD" }, { name: "Stopira", position: "DEF" }],
  gha: [{ name: "Jordan Ayew", position: "FWD" }, { name: "Thomas Partey", position: "MID" }, { name: "Mohammed Kudus", position: "MID" }],
  cuw: [{ name: "Leandro Bacuna", position: "MID" }, { name: "Jurickson Profar", position: "FWD" }, { name: "Cuco Martina", position: "DEF" }],
  hai: [{ name: "Duckens Nazon", position: "FWD" }, { name: "Frantzdy Pierrot", position: "FWD" }, { name: "Mechack Jérôme", position: "DEF" }],
  nzl: [{ name: "Chris Wood", position: "FWD" }, { name: "Clayton Lewis", position: "MID" }, { name: "Bill Tuilagi", position: "DEF" }],
};

const POSITION_ORDER = { GK: 0, DEF: 1, MID: 2, FWD: 3 };
const POSITION_COLOR: Record<string, string> = {
  GK:  "bg-amber-100 text-amber-700",
  DEF: "bg-blue-100 text-blue-700",
  MID: "bg-green-100 text-green-700",
  FWD: "bg-red-100 text-red-700",
};

export function getTeamPlayers(code: string): PlayerEntry[] {
  const players = TEAM_PLAYERS[code.toLowerCase()] ?? [];
  return [...players].sort((a, b) => POSITION_ORDER[a.position] - POSITION_ORDER[b.position]);
}

export { POSITION_COLOR };

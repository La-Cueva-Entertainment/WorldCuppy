import "server-only";

const WEBHOOK_URL = process.env.DISCORD_DRAFT_WEBHOOK_URL;

// FIFA 3-letter code → ISO 3166-1 alpha-2 for flag thumbnails (flagcdn.com)
const FIFA3_TO_ISO2: Record<string, string> = {
  esp: "es",    arg: "ar",    fra: "fr",    eng: "gb-eng", bra: "br",
  por: "pt",    ned: "nl",    mar: "ma",    bel: "be",    ger: "de",
  cro: "hr",    sen: "sn",    col: "co",    usa: "us",    mex: "mx",
  uru: "uy",    sui: "ch",    jpn: "jp",    irn: "ir",    swe: "se",
  kor: "kr",    ecu: "ec",    aut: "at",    tur: "tr",    aus: "au",
  alg: "dz",    can: "ca",    egy: "eg",    nor: "no",    pan: "pa",
  cze: "cz",    civ: "ci",    sco: "gb-sct", par: "py",   tun: "tn",
  uzb: "uz",    bih: "ba",    qat: "qa",    irq: "iq",    rsa: "za",
  ksa: "sa",    jor: "jo",    cpv: "cv",    cod: "cd",    gha: "gh",
  cuw: "cw",    hai: "ht",    nzl: "nz",
};

function flagImageUrl(teamCode: string): string | undefined {
  const iso = FIFA3_TO_ISO2[teamCode.toLowerCase()];
  return iso ? `https://flagcdn.com/w80/${iso}.png` : undefined;
}

async function postWebhook(body: object): Promise<void> {
  if (!WEBHOOK_URL) return;
  try {
    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    // Fire-and-forget — never let Discord errors bubble up
  }
}

// ─── Draft Started ────────────────────────────────────────────────────────────

export interface DraftStartedOpts {
  tournamentName: string;
  /** Ordered list of participants (index 0 = first pick) */
  order: { name: string }[];
  draftUrl: string;
}

export async function postDraftStarted(opts: DraftStartedOpts): Promise<void> {
  const orderList = opts.order
    .map((p, i) => `**${i + 1}.** ${p.name}`)
    .join("\n");

  await postWebhook({
    embeds: [
      {
        title: `🏆 Draft Started — ${opts.tournamentName}`,
        description: `The snake draft is now live!\n\n**Pick Order:**\n${orderList}`,
        color: 0x57f287,
        fields: [
          {
            name: "🔗 Draft Board",
            value: `[Click here to make your pick](${opts.draftUrl})`,
            inline: false,
          },
        ],
        footer: { text: "WorldCuppy · Snake Draft" },
        timestamp: new Date().toISOString(),
      },
    ],
  });
}

// ─── Pick Made ────────────────────────────────────────────────────────────────

export interface PickMadeOpts {
  pickerName: string;
  teamName: string;
  teamCode: string;
  /** 1-based pick number */
  pickNumber: number;
  totalPicks: number;
  nextPickerName: string | null;
  tournamentName: string;
  draftUrl: string;
  isDraftComplete: boolean;
}

export async function postPickMade(opts: PickMadeOpts): Promise<void> {
  const flagUrl = flagImageUrl(opts.teamCode);

  const description = opts.isDraftComplete
    ? `**${opts.pickerName}** selected **${opts.teamName}**\n\n🎊 The draft is now complete — all teams have been picked!`
    : `**${opts.pickerName}** selected **${opts.teamName}**`;

  const fields: { name: string; value: string; inline: boolean }[] = [
    {
      name: "📊 Progress",
      value: `Pick **${opts.pickNumber}** of **${opts.totalPicks}**`,
      inline: true,
    },
  ];

  if (!opts.isDraftComplete && opts.nextPickerName) {
    fields.push({
      name: "⏭️ Up Next",
      value: `**${opts.nextPickerName}**`,
      inline: true,
    });
  }

  fields.push({
    name: "🔗 Draft Board",
    value: `[View picks & make yours](${opts.draftUrl})`,
    inline: false,
  });

  await postWebhook({
    embeds: [
      {
        title: opts.isDraftComplete
          ? `🎉 Draft Complete — ${opts.tournamentName}`
          : `✅ Pick Made — ${opts.tournamentName}`,
        description,
        color: opts.isDraftComplete ? 0xffd700 : 0x5865f2,
        thumbnail: flagUrl ? { url: flagUrl } : undefined,
        fields,
        footer: { text: "WorldCuppy · Snake Draft" },
        timestamp: new Date().toISOString(),
      },
    ],
  });
}

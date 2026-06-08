# WorldCuppy — Banter page handoff

Implement the **Banter** social feed in the existing Next.js (App Router) + Tailwind v4 + Prisma + NextAuth codebase.

Open `designs/Banter.html` in a browser to see the live reference — it's fully interactive (posting, reactions, reply threads, emoji picker, filter tabs, light/dark). The design tokens live in `designs/styles.css`.

---

## Route
`/banter` → `web/app/banter/page.tsx`

Add "Banter" to the shared nav in `web/app/layout.tsx` between "My Teams" and "News".

---

## Data model — new Prisma models

```prisma
model BanterPost {
  id          String          @id @default(cuid())
  tournamentId String
  tournament  Tournament      @relation(fields:[tournamentId], references:[id])
  authorId    String
  author      User            @relation(fields:[authorId], references:[id])
  text        String          @db.Text
  imageUrl    String?
  gifUrl      String?
  isSystem    Boolean         @default(false)   // auto-generated pick/result cards
  systemType  String?                           // "pick" | "result"
  systemData  Json?                             // { team, mgr, score, etc. }
  createdAt   DateTime        @default(now())
  reactions   BanterReaction[]
  replies     BanterReply[]
}

model BanterReaction {
  id      String      @id @default(cuid())
  postId  String
  post    BanterPost  @relation(fields:[postId], references:[id], onDelete:Cascade)
  userId  String
  user    User        @relation(fields:[userId], references:[id])
  emoji   String      // any Unicode emoji, e.g. "🔥"
  @@unique([postId, userId, emoji])
}

model BanterReply {
  id        String      @id @default(cuid())
  postId    String
  post      BanterPost  @relation(fields:[postId], references:[id], onDelete:Cascade)
  authorId  String
  author    User        @relation(fields:[authorId], references:[id])
  text      String      @db.Text
  createdAt DateTime    @default(now())
  reactions BanterReplyReaction[]
}

model BanterReplyReaction {
  id      String      @id @default(cuid())
  replyId String
  reply   BanterReply @relation(fields:[replyId], references:[id], onDelete:Cascade)
  userId  String
  user    User        @relation(fields:[userId], references:[id])
  emoji   String
  @@unique([replyId, userId, emoji])
}
```

---

## Server component — page.tsx

```tsx
// web/app/banter/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import BanterFeed from "@/components/BanterFeed";

export default async function BanterPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  // fetch latest 40 posts with reactions + reply counts
  const posts = await prisma.banterPost.findMany({
    orderBy: { createdAt: "desc" },
    take: 40,
    include: {
      author: { select: { id:true, name:true, color:true } },
      reactions: { include: { user: { select: { id:true } } } },
      replies: {
        take: 3,
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id:true, name:true, color:true } },
          reactions: { include: { user: { select: { id:true } } } },
        },
      },
      _count: { select: { replies: true } },
    },
  });

  return <BanterFeed initialPosts={posts} currentUserId={session.user.id} />;
}
```

---

## Client component — BanterFeed.tsx

`"use client"` — handles optimistic reactions, reply threads, composer, emoji picker, and filter tabs.

### Props
```ts
interface BanterFeedProps {
  initialPosts: BanterPostWithRelations[];
  currentUserId: string;
}
```

### Key state
```ts
const [posts, setPosts] = useState(initialPosts);
const [filter, setFilter] = useState<"all"|"takes"|"media"|"picks">("all");
const [openReplies, setOpenReplies] = useState<Set<string>>(new Set());
const [pickerPostId, setPickerPostId] = useState<string|null>(null);
```

### Sub-components to build
| Component | Notes |
|---|---|
| `<PostComposer>` | Textarea + image upload + emoji insert + submit. Collapses until focused. |
| `<PostCard>` | Renders one post. Handles system cards differently (lighter `surface-2` bg). |
| `<ReactionBar>` | Row of emoji chips + ＋ button. Optimistic toggle via Server Action. |
| `<EmojiPicker>` | Portal-mounted, 40 emoji in a grid. Positioned relative to the ＋ button. |
| `<ReplyThread>` | Expands inline below a post. Lazy-loads full replies on open. |
| `<ReplyComposer>` | Pill-style input + Send button inside the open thread. |

---

## Server Actions

```ts
// web/app/banter/actions.ts
"use server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";

export async function createPost(text: string, imageUrl?: string, gifUrl?: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Not authenticated");
  await prisma.banterPost.create({
    data: { text, imageUrl, gifUrl, authorId: session.user.id, tournamentId: "ACTIVE_TOURNAMENT_ID" },
  });
  revalidatePath("/banter");
}

export async function toggleReaction(postId: string, emoji: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Not authenticated");
  const existing = await prisma.banterReaction.findUnique({
    where: { postId_userId_emoji: { postId, userId: session.user.id, emoji } },
  });
  if (existing) {
    await prisma.banterReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.banterReaction.create({ data: { postId, userId: session.user.id, emoji } });
  }
  revalidatePath("/banter");
}

export async function createReply(postId: string, text: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Not authenticated");
  await prisma.banterReply.create({
    data: { postId, text, authorId: session.user.id },
  });
  revalidatePath("/banter");
}

// Call this from the draft flow when a pick is made:
export async function createPickSystemPost(mgrId: string, teamCode: string, tournamentId: string) {
  await prisma.banterPost.create({
    data: {
      isSystem: true, systemType: "pick",
      systemData: { mgrId, teamCode },
      text: "", authorId: mgrId, tournamentId,
    },
  });
}
```

---

## Visual spec

> All exact values are in `designs/styles.css`. Key notes below.

### Post card (`.post`)
- `background: --surface`, `border: 1px solid --line`, `border-radius: --r-lg`, `box-shadow: --shadow-sm`
- **System cards** (`.post.system`): `background: --surface-2`, `border-color: --line-soft`, lighter visual weight. System pick shows ⚽ icon + manager name in their color + flag + team name. System result shows 🏟️ icon + score + earnings note.

### Manager avatar (`.post-av`)
- 36px circle, `background: --m` (manager color), white initial letter, Archivo 800 15px
- Double ring: `box-shadow: 0 0 0 2px --surface, 0 0 0 3.5px --m`
- Reply avatars: 28px, font-size 12px

### Post text
- 15px Hanken Grotesk, `line-height: 1.5`, `white-space: pre-wrap`

### Image/GIF placeholder → real implementation
- Replace `.post-img` placeholder divs with `<Image>` components for uploaded photos
- For GIFs: embed a GIPHY picker or accept direct URL input in the composer
- Image upload: wire to your storage solution (S3/Cloudinary/Vercel Blob). The composer "Photo / GIF" button triggers a file input.

### Reaction bar (`.reactions`)
- Chips: 30px pill, `border: 1.5px solid --line`, `font-size: 14px` emoji + Spline Sans Mono 12px count
- Active (you reacted): `border-color: --grass`, `background: --grass-soft`, count in `--grass-deep`
- ＋ button: 30px circle, dashed border, opens emoji picker

### Emoji picker
- Portal-mounted div, `position: absolute`, `z-index: 40`
- `border-radius: 14px`, `box-shadow: --shadow-lg`, 240px wide, wrapping flex grid
- 40 emoji (see `EMOJIS` array in `Banter.html`) — include football-pool-specific ones: 🔥💀🫡👑😭⚽🏆😤🤣💸

### Reply thread (`.replies`)
- `background: --surface-2`, `border-top: 1px solid --line-soft`
- Each reply: flex row, 28px avatar + name (Archivo 800 13.5px) + timestamp + text (14px) + mini reaction row
- Inline reply composer: pill input + grass "Send" button

### Filter tabs
- Plain buttons, `border-radius: 10px`; active state gets `background: --surface`, `border: 1px solid --line`, `box-shadow: --shadow-sm`

### Sidebar
- **Top hot takes**: icon + quote + attribution, stacked in a card — source from `BanterPost` ordered by reaction count
- **Active now**: last-active timestamps from session/activity — can use a simple `updatedAt` on the User model
- **Draft night card**: gold-tinted (`background: --gold-soft`, `border-color: --gold`) — hardcode or pull from tournament `draftDate`

### Mobile
- Single column ≤920px (sidebar moves below or becomes a collapsible section)
- Emoji picker repositions to avoid viewport overflow (clamp `left` to `window.innerWidth - 256`)
- Composer textarea is full-width, auto-grows

---

## Real-time (optional but recommended)
The current implementation is server-rendered + `revalidatePath`. For live feel (reactions updating without refresh) add:
- **Polling**: `useEffect` refetch every 15s while tab is focused
- **Or Pusher/Ably/Supabase Realtime**: push new posts + reaction counts to connected clients

---

## Files
- `designs/Banter.html` — live interactive reference. Open in browser.
- `designs/styles.css` — all design tokens and component classes.
- `designs/data.js` — mock data shape (replace with Prisma queries).
- `designs/app.js` — shared nav/theme logic (already in your layout).

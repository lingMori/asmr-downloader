import type { DiscoverFacet } from "@/lib/api";
import { Sticker } from "@/components/ui";

export type DiscoverFacets = {
  tags: DiscoverFacet[];
  circles: DiscoverFacet[];
  vas: DiscoverFacet[];
};

export type FacetCardsProps = {
  facets: DiscoverFacets;
  onAddTag: (tag: string) => void;
  onSetCircle: (circle: string) => void;
  onSetVa: (va: string) => void;
};

/** facet 三卡(dc.html:263-272):本页标签 top12 / 社团 top8 / 声优 top8,点击应用筛选 */
export function FacetCards({ facets, onAddTag, onSetCircle, onSetVa }: FacetCardsProps) {
  const cards = [
    {
      key: "tags",
      title: "本页标签 · たぐ",
      color: "pink" as const,
      rotate: -2,
      items: facets.tags.slice(0, 12).map((f) => ({ name: `#${f.value}`, n: f.count, pick: () => onAddTag(f.value) })),
    },
    {
      key: "circles",
      title: "本页社团 · さーくる",
      color: "lav" as const,
      rotate: 2,
      items: facets.circles.slice(0, 8).map((f) => ({ name: f.value, n: f.count, pick: () => onSetCircle(f.value) })),
    },
    {
      key: "vas",
      title: "本页声优 · こえ",
      color: "pink" as const,
      rotate: 2,
      items: facets.vas.slice(0, 8).map((f) => ({ name: f.value, n: f.count, pick: () => onSetVa(f.value) })),
    },
  ].filter((c) => c.items.length > 0);

  if (cards.length === 0) return null;

  return (
    <>
      {cards.map((card) => (
        <div key={card.key} className="y-disc-card" style={{ padding: "14px 14px 12px" }}>
          <Sticker color={card.color} section rotate={card.rotate}>
            {card.title}
          </Sticker>
          <div className="y-disc-tagchips" style={{ marginTop: 4 }}>
            {card.items.map((fi) => (
              <button key={fi.name} type="button" className="y-tag y-tag--facet" onClick={fi.pick}>
                {fi.name} <span className="y-tag__count">{fi.n}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

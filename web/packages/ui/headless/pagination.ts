export type PageItem = number | "dots";

export const pageRange = (total: number, page: number, siblings = 1, boundaries = 1): PageItem[] => {
  const wanted = new Set<number>();
  for (let n = 1; n <= total; n++) {
    if (n <= boundaries || n > total - boundaries || Math.abs(n - page) <= siblings) wanted.add(n);
  }
  const items: PageItem[] = [];
  let previous = 0;
  for (const n of wanted) {
    if (n - previous === 2) items.push(n - 1);
    else if (n - previous > 2) items.push("dots");
    items.push(n);
    previous = n;
  }
  return items;
};

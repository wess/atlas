export type Visibility = "private" | "public";

export const canView = (options: {
  ownerId: string;
  viewerId?: string | null;
  visibility: Visibility;
  blocked?: boolean;
}): boolean => {
  if (options.viewerId === options.ownerId) return true;
  return !options.blocked && options.visibility === "public";
};

export const canModerate = (ownerId: string, viewerId?: string | null): boolean => ownerId === viewerId;

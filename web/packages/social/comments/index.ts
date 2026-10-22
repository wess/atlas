export type CommentState = "pending" | "approved";

export const commentText = (value: string, maxLength = 1200): string | null => {
  const text = value.trim().replace(/\s+/g, " ");
  return text.length >= 2 && text.length <= maxLength ? text : null;
};

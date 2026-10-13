/** Empty editor markup is not completed work. Image-only editor content is valid. */
export function hasReviewContent(html?: string | null): boolean {
  const clean = (html ?? "").replace(
    /<(script|style)[^>]*>[\s\S]*?<\/\1>/gi,
    "",
  );
  return (
    /<img\s[^>]*src=["'][^"']+["']/i.test(clean) ||
    !!clean
      .replace(/<[^>]*>/g, "")
      .replace(/&(?:nbsp|#160|#x0*a0);/gi, " ")
      .replace(/[\s\u200b-\u200d\ufeff]/g, "")
  );
}
export function reviewMissing(
  review: {
    feedbackHtml?: string | null;
    homeworkStatus?: string | null;
    homeworkHtml?: string | null;
  },
  files: number,
): string[] {
  const missing: string[] = [];
  if (!hasReviewContent(review.feedbackHtml)) missing.push("feedback");
  if (
    review.homeworkStatus !== "NONE" &&
    !hasReviewContent(review.homeworkHtml) &&
    files === 0
  )
    missing.push("homework");
  return missing;
}

/**
 * Wildcard pattern matching for topic routing.
 *
 * Supports:
 *   `*` — matches zero or more characters
 *   `?` — matches exactly one character
 *
 * This mirrors the Rust `is_matching_backtracking` implementation.
 */

/**
 * Returns true if `topic` matches the given `pattern` with wildcards.
 */
export function isMatch(topic: string, pattern: string): boolean {
  const t = topic;
  const p = pattern;
  const tLen = t.length;
  const pLen = p.length;

  // dp[i][j] = whether t[0..i) matches p[0..j)
  const dp: boolean[][] = Array.from({ length: tLen + 1 }, () =>
    new Array(pLen + 1).fill(false),
  );

  dp[0][0] = true;

  // Handle leading *s (they can match zero characters)
  for (let j = 1; j <= pLen; j++) {
    if (p[j - 1] === '*') {
      dp[0][j] = dp[0][j - 1];
    }
  }

  for (let i = 1; i <= tLen; i++) {
    for (let j = 1; j <= pLen; j++) {
      if (p[j - 1] === '*') {
        // * matches zero chars (dp[i][j-1]) or one+ chars (dp[i-1][j])
        dp[i][j] = dp[i][j - 1] || dp[i - 1][j];
      } else if (p[j - 1] === '?' || t[i - 1] === p[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      }
    }
  }

  return dp[tLen][pLen];
}

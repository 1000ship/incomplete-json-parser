export const isWhitespace = (char: string) => /\s/.test(char);

/**
 * Check if string ends with an unescaped quote.
 * Counts trailing backslashes - odd count means the quote is escaped.
 */
export function endsWithUnescapedQuote(str: string): boolean {
  if (!str.endsWith('"')) return false;

  // Count backslashes before the quote
  let backslashCount = 0;
  for (let i = str.length - 2; i >= 0 && str[i] === "\\"; i--) {
    backslashCount++;
  }

  // Even count means backslashes escape each other, so quote is a closing quote
  return backslashCount % 2 === 0;
}

/**
 * Check if string ends with an odd number of backslashes.
 * Odd count means the last backslash is escaping the next character (incomplete state).
 */
export function endsWithOddBackslashes(str: string): boolean {
  let count = 0;
  for (let i = str.length - 1; i >= 0 && str[i] === "\\"; i--) {
    count++;
  }
  return count % 2 === 1;
}

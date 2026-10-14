/**
 * String-safe money math using integer satang (BigInt).
 * 1 unit = 100 satang.
 */

const ZERO = BigInt(0);
const HUNDRED = BigInt(100);

/**
 * Parses a decimal string or number into integer satang as BigInt.
 * e.g. "100" -> BigInt(10000), "250.5" -> BigInt(25050), "10.25" -> BigInt(1025)
 */
export function parseSatang(value: string | number | null | undefined): bigint {
  if (value === null || value === undefined) return ZERO;
  const str = String(value).trim();
  if (!str) return ZERO;

  const isNegative = str.startsWith("-");
  const cleanStr = isNegative ? str.slice(1) : str;

  const [intPartRaw, fracPartRaw = ""] = cleanStr.split(".");
  const intPart = intPartRaw.replace(/\D/g, "") || "0";
  const fracDigits = fracPartRaw.replace(/\D/g, "");
  const fracPart = (fracDigits + "00").slice(0, 2);

  const satang = BigInt(intPart) * HUNDRED + BigInt(fracPart);
  return isNegative ? -satang : satang;
}

/**
 * Formats satang BigInt into a decimal string with 2 decimal places and thousands separators.
 * e.g. BigInt(10000) -> "100.00", BigInt(25050) -> "250.50", BigInt(123456789) -> "1,234,567.89"
 */
export function formatSatang(satang: bigint): string {
  const isNegative = satang < ZERO;
  const abs = isNegative ? -satang : satang;
  const intVal = abs / HUNDRED;
  const fracVal = abs % HUNDRED;

  const intStr = intVal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fracStr = fracVal.toString().padStart(2, "0");

  const formatted = `${intStr}.${fracStr}`;
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Formats a decimal string or number directly with 2 decimals and thousands separators.
 * e.g. formatMoney("1234.5") -> "1,234.50"
 */
export function formatMoney(value: string | number | null | undefined): string {
  return formatSatang(parseSatang(value));
}

/**
 * Multiplies a decimal amount string or number by an integer quantity and returns satang BigInt.
 */
export function multiplySatang(amount: string | number | null | undefined, quantity: number | bigint): bigint {
  const satang = parseSatang(amount);
  return satang * BigInt(quantity);
}

/**
 * Sums an array of satang BigInts or decimal strings/numbers into satang BigInt.
 */
export function sumSatang(amounts: (string | number | bigint | null | undefined)[]): bigint {
  return amounts.reduce<bigint>((acc, cur) => {
    if (typeof cur === "bigint") return acc + cur;
    return acc + parseSatang(cur);
  }, ZERO);
}

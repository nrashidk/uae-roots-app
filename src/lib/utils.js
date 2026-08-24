import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Arabic number agreement for a count of years. `${n} سنة` is only correct from
// 11 up — it produced "1 سنة" and "2 سنة", both wrong.
//   1      -> سنة واحدة   (mufrad)
//   2      -> سنتان       (muthanna — its own dual form)
//   3..10  -> N سنوات     (jamʿ qilla — plural noun)
//   11+    -> N سنة       (tamyīz — singular again)
//
// Lives here rather than in TreeCanvas because the tree box and the record card
// on الأفراد both print it, and two copies drift.
export function formatAge(age) {
  if (age === 1) return "سنة واحدة";
  if (age === 2) return "سنتان";
  if (age >= 3 && age <= 10) return `${age} سنوات`;
  return `${age} سنة`;
}

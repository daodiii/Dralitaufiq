/* Where a scroll that came to rest between stops goes on to: back onto a stop it is within `tol`
   of, otherwise on to the next stop in the direction it was travelling, so one gesture is one
   step. `u` is the position in stops, `last` the last stop. */
export function settleIndex(u: number, dir: number, tol: number, last = Infinity) {
  const near = Math.round(u);
  const to = Math.abs(u - near) <= tol ? near : dir > 0 ? Math.ceil(u) : Math.floor(u);
  return Math.min(last, Math.max(0, to));
}

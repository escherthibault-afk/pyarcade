/** Every True/False combination of the variables, in binary order (FF, FT, TF, TT...). */
export function allBoolRows(vars: string[]): Record<string, boolean>[] {
  const rows: Record<string, boolean>[] = []
  for (let m = 0; m < 1 << vars.length; m++) {
    const row: Record<string, boolean> = {}
    vars.forEach((v, i) => (row[v] = Boolean(m & (1 << (vars.length - 1 - i)))))
    rows.push(row)
  }
  return rows
}

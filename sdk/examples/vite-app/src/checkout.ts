export interface Line {
  price: number
  qty: number
}

export function total(lines: (Line | undefined)[]): number {
  return lines.reduce((sum, line) => sum + line!.price * line!.qty, 0)
}

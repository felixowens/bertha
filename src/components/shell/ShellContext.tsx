import { createContext, useContext } from "react"
import type { AppShell } from "../../contract/pages"

type Ready<L> = L extends { status: "ready"; data: infer T } ? T : never
export type Shell = Ready<AppShell> & { reload: () => void }

export const ShellContext = createContext<Shell | null>(null)

export function useShell(): Shell {
  const s = useContext(ShellContext)
  if (!s) throw new Error("useShell outside the app frame")
  return s
}

export const isOwner = (s: Shell) => s.viewer.role === "owner"
export const projectName = (s: Shell, id: string) => s.projects.find((p) => p.id === id)?.name ?? "Unknown project"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { cn } from "cn"
import { Dialog } from "radix-ui"
import { backend } from "@/data/backend"
import { useLoadable } from "@/data/useLoadable"
import { useLocation } from "@/lib/router"
import { ErrorState, LoadingCells } from "@/components/ui/states"
import { ShellContext } from "./ShellContext"
import { Sidebar } from "./Sidebar"
import { Shortcuts } from "./Shortcuts"
import { useLiveReload } from "@/data/live"

const FrameContext = createContext<{ openMenu: () => void }>({ openMenu: () => {} })
export const useFrame = () => useContext(FrameContext)

const KEY = "bertha.sidebar.collapsed"
const readCollapsed = () => {
  try {
    return localStorage.getItem(KEY) === "1"
  } catch {
    return false
  }
}

export function AppFrame({ children }: { children: ReactNode }) {
  const { state, reload } = useLoadable(() => backend.getShell(), [])
  // Sidebar counts and the live status follow what happens.
  useLiveReload(reload, () => true, 2_000)
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [menu, setMenu] = useState(false)
  const { path } = useLocation()
  useEffect(() => setMenu(false), [path])

  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(KEY, c ? "0" : "1")
      } catch {
        /* per-viewer convenience only */
      }
      return !c
    })
  }

  if (state.status === "loading" || state.status === "empty") {
    return (
      <div className="grid min-h-svh place-items-center bg-sidebar">
        <LoadingCells label="Loading bertha" />
      </div>
    )
  }
  if (state.status === "error") {
    return (
      <div className="grid min-h-svh place-items-center bg-sidebar p-6">
        <ErrorState message={state.message} onRetry={reload} />
      </div>
    )
  }

  return (
    <ShellContext.Provider value={{ ...state.data, reload }}>
      <FrameContext.Provider value={{ openMenu: () => setMenu(true) }}>
        <div className="flex min-h-svh bg-sidebar">
          <aside
            className={cn(
              "sticky top-0 hidden h-svh shrink-0 transition-[width] duration-200 ease-smooth md:block",
              collapsed ? "w-[68px]" : "w-[248px]",
            )}
          >
            <Sidebar collapsed={collapsed} onCollapse={toggle} />
          </aside>

          <Dialog.Root open={menu} onOpenChange={setMenu}>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-40 bg-sidebar/70 data-[state=open]:animate-in data-[state=open]:fade-in-0 md:hidden" />
              <Dialog.Content
                aria-describedby={undefined}
                className="fixed inset-y-0 left-0 z-50 w-[272px] border-r border-hairline bg-sidebar data-[state=open]:animate-in data-[state=open]:slide-in-from-left md:hidden"
              >
                <Dialog.Title className="sr-only">Navigation</Dialog.Title>
                <Sidebar collapsed={false} onCollapse={() => setMenu(false)} onNavigate={() => setMenu(false)} />
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>

          <main className="min-w-0 flex-1 md:py-2 md:pr-2">
            <div className="min-h-full bg-background md:min-h-[calc(100svh-16px)] md:rounded-xl md:border md:border-hairline">
              {children}
            </div>
          </main>
        </div>
        <Shortcuts />
      </FrameContext.Provider>
    </ShellContext.Provider>
  )
}

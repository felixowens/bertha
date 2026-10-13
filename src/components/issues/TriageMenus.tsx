import type { ReactNode } from "react"
import { cn } from "cn"
import { DropdownMenu } from "radix-ui"
import type { Person, Snooze } from "../../../packet/contract/domain"
import { Avatar } from "@/components/ui/primitives"
import { MenuHint, menuContent, menuItem } from "@/components/ui/menu"
import { SNOOZES } from "./triage"

type MenuProps = { open: boolean; onOpenChange: (o: boolean) => void; trigger: ReactNode; align?: "start" | "end"; side?: "top" | "bottom" }

export function SnoozeMenu({ onPick, ...m }: MenuProps & { onPick: (s: Snooze) => void }) {
  return (
    <DropdownMenu.Root open={m.open} onOpenChange={m.onOpenChange}>
      <DropdownMenu.Trigger asChild>{m.trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align={m.align ?? "start"} side={m.side} sideOffset={6} className={cn(menuContent, "w-56")}>
          <DropdownMenu.Label className="px-2 py-1.5 text-xs text-faint">Snooze, then come back</DropdownMenu.Label>
          {SNOOZES.map((s) => (
            <DropdownMenu.Item key={s.label} className={menuItem} onSelect={() => onPick(s.snooze())}>
              {s.label}
              <MenuHint>{s.hint}</MenuHint>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

export function AssignMenu({ people, me, current, onPick, ...m }: MenuProps & { people: Person[]; me: string; current?: string | null; onPick: (personId: string | null) => void }) {
  const sorted = [...people].sort((a, b) => (a.id === me ? -1 : b.id === me ? 1 : a.name.localeCompare(b.name)))
  return (
    <DropdownMenu.Root open={m.open} onOpenChange={m.onOpenChange}>
      <DropdownMenu.Trigger asChild>{m.trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align={m.align ?? "start"} side={m.side} sideOffset={6} className={cn(menuContent, "w-60")}>
          {sorted.map((p) => (
            <DropdownMenu.Item key={p.id} className={menuItem} onSelect={() => onPick(p.id)}>
              <Avatar name={p.name} className="size-5" />
              <span className="flex-1 truncate">{p.id === me ? `${p.name} (you)` : p.name}</span>
              {current === p.id && <MenuHint>current</MenuHint>}
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator className="my-1 h-px bg-hairline" />
          <DropdownMenu.Item className={menuItem} onSelect={() => onPick(null)}>
            <span className="grid size-5 place-items-center rounded-[4px] border border-dashed border-border" />
            Nobody
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

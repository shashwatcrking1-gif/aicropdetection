import * as React from "react"
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group"
import { type VariantProps } from "class-variance-authority"
import { cn } from "cn"

import { toggleVariants } from "@/components/ui/toggle"

const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants> & {
    spacing?: number
    orientation?: "horizontal" | "vertical"
    selectedValues?: readonly string[]
  }
>({
  size: "default",
  variant: "default",
  spacing: 2,
  orientation: "horizontal",
  selectedValues: [],
})

export type ToggleGroupProps = Omit<
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive>,
  "value" | "defaultValue" | "onValueChange"
> &
  VariantProps<typeof toggleVariants> & {
    type?: "single" | "multiple"
    spacing?: number
    orientation?: "horizontal" | "vertical"
    value?: any
    defaultValue?: any
    onValueChange?: (value: any) => void
  }

function ToggleGroup({
  className,
  variant,
  size,
  spacing = 2,
  orientation = "horizontal",
  type = "single",
  value,
  defaultValue,
  onValueChange,
  children,
  ...props
}: ToggleGroupProps) {
  const isMultiple = type === "multiple"

  const normalizedValue = React.useMemo(() => {
    if (value === undefined) return undefined
    if (Array.isArray(value)) return value
    return value ? [value] : []
  }, [value])

  const normalizedDefaultValue = React.useMemo(() => {
    if (defaultValue === undefined) return undefined
    if (Array.isArray(defaultValue)) return defaultValue
    return defaultValue ? [defaultValue] : []
  }, [defaultValue])

  const handleValueChange = (newValues: string[], _eventDetails: any) => {
    if (!onValueChange) return
    if (isMultiple) {
      onValueChange(newValues)
    } else {
      onValueChange(newValues[newValues.length - 1] ?? "")
    }
  }

  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      data-variant={variant}
      data-size={size}
      data-spacing={spacing}
      data-orientation={orientation}
      multiple={isMultiple}
      value={normalizedValue}
      defaultValue={normalizedDefaultValue}
      onValueChange={handleValueChange}
      style={{ "--gap": spacing } as React.CSSProperties}
      className={cn(
        "group/toggle-group flex w-fit flex-row items-center gap-[--spacing(var(--gap))] rounded-lg data-[size=sm]:rounded-[min(var(--radius-md),10px)] data-vertical:flex-col data-vertical:items-stretch",
        className
      )}
      {...props}
    >
      <ToggleGroupContext.Provider
        value={{
          variant,
          size,
          spacing,
          orientation,
          selectedValues: normalizedValue,
        }}
      >
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive>
  )
}

function ToggleGroupItem({
  className,
  children,
  variant = "default",
  size = "default",
  value,
  ...props
}: TogglePrimitive.Props &
  VariantProps<typeof toggleVariants> & { value?: string }) {
  const context = React.useContext(ToggleGroupContext)
  const isSelected =
    value !== undefined && context.selectedValues?.includes(value)

  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      data-variant={context.variant || variant}
      data-size={context.size || size}
      data-spacing={context.spacing}
      data-state={isSelected ? "on" : "off"}
      data-pressed={isSelected ? "" : undefined}
      aria-pressed={isSelected}
      value={value}
      className={cn(
        "shrink-0 group-data-[spacing=0]/toggle-group:rounded-none group-data-[spacing=0]/toggle-group:px-2 focus:z-10 focus-visible:z-10 group-data-[spacing=0]/toggle-group:has-data-[icon=inline-end]:pr-1.5 group-data-[spacing=0]/toggle-group:has-data-[icon=inline-start]:pl-1.5 group-data-horizontal/toggle-group:data-[spacing=0]:first:rounded-l-lg group-data-vertical/toggle-group:data-[spacing=0]:first:rounded-t-lg group-data-horizontal/toggle-group:data-[spacing=0]:last:rounded-r-lg group-data-vertical/toggle-group:data-[spacing=0]:last:rounded-b-lg group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:border-l-0 group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:border-t-0 group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-l group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-t",
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        className
      )}
      {...props}
    >
      {children}
    </TogglePrimitive>
  )
}

export { ToggleGroup, ToggleGroupItem }

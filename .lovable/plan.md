
# Sidebar Icon-Only Collapse Mode

## What changes
When the sidebar is collapsed via the toggle button, instead of disappearing entirely, it will shrink to a narrow strip showing only the navigation icons. Hovering over an icon will show a tooltip with the item name.

## Technical details

### 1. AppSidebar.tsx
- Set `collapsible="icon"` on the `<Sidebar>` component (currently defaults to `"offcanvas"` which hides the whole sidebar)
- Add `tooltip={item.title}` to each `<SidebarMenuButton>` so collapsed icons show their label on hover
- Hide the header subtitle text and branding text when collapsed (keep only the logo icon)
- Hide the unread badge text when collapsed (the icon alone suffices)

### 2. No changes needed to sidebar.tsx (UI primitive)
The shadcn sidebar component already has full support for `collapsible="icon"` mode:
- Menu buttons auto-resize to icon-only (`group-data-[collapsible=icon]:!size-8`)
- Group labels auto-hide (`group-data-[collapsible=icon]:opacity-0`)
- Content hides overflow (`group-data-[collapsible=icon]:overflow-hidden`)
- Sidebar width shrinks to `3rem` (the `SIDEBAR_WIDTH_ICON` constant)

### Files modified
- `src/components/AppSidebar.tsx` -- only file that needs changes

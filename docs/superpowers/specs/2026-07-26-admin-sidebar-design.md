# Admin Sidebar — Design

## Goal
Web-first, responsive admin navigation sidebar for GreenLens admin dashboard.

## Scope
- `AdminLayout` becomes a flex shell: `Sidebar` + `<main>` content area (React Router `Outlet`).
- Nested routes under `/admin`, each rendering a placeholder page (content out of scope, built later per section).
- Sidebar component only — no auth wiring (logout button is UI-only, no-op handler for now).

## Nav Items
| Label | Route | Icon (lucide-react) |
|---|---|---|
| Dashboard | `/admin` | `LayoutDashboard` |
| Map View | `/admin/map` | `Map` |
| Reports | `/admin/reports` | `FileText` |
| Analytics | `/admin/analytics` | `BarChart3` |
| Users | `/admin/users` | `Users` |
| Settings | `/admin/settings` | `Settings` |

## Behavior

### Desktop (`md:` and up)
- Sidebar fixed width `w-64`, collapsible to `w-16` (icon-only) via a toggle button at the top of the sidebar.
- Collapsed state persisted in `localStorage` (key: `admin-sidebar-collapsed`).
- When collapsed, labels hidden, icon-only buttons show a tooltip (native `title` attr, no dependency) with the label on hover.
- Active route: `NavLink` `isActive` → `bg-primary/10 text-primary` background + 2-3px left accent bar in `primary.DEFAULT`.

### Mobile (below `md:`)
- Sidebar hidden by default; a top bar with a hamburger (`Menu` icon) button opens it.
- Opens as an off-canvas drawer: `fixed inset-y-0 left-0 z-50 w-64`, slide-in transition (`translate-x`), with a semi-transparent backdrop overlay that closes the drawer on click.
- Drawer always shows full (icon + label) regardless of desktop collapsed state.
- Nav items are min 44px touch target height.

## Structure
- Top: compact `Logo`.
- Middle: nav item list (scrollable if it overflows on small viewports).
- Bottom: footer, separated by a top border — avatar circle (initials placeholder), admin name (static placeholder text), `LogOut` icon button (no-op `onClick` for now).

## Styling
Pulled from `frontend/docs/AdminDesign.md`:
- White sidebar background, `border-light-dark` (1px) right border.
- `rounded-lg` hover state on nav items, `primary` green for active/hover.
- Inter font (already global), 8px/16px/24px spacing rhythm.

## Files
- `frontend/src/components/layout/Sidebar.tsx` (new)
- `frontend/src/components/layout/AdminLayout.tsx` (rewrite: flex shell + `Outlet`)
- `frontend/src/pages/admin/*` — one placeholder page per nav item (new, minimal)
- `frontend/src/App.tsx` (nested `/admin` routes)

## Out of scope
- Auth/session, real logout logic, real admin name/avatar data.
- Actual page content for Dashboard/Map/Reports/Analytics/Users/Settings — placeholders only.

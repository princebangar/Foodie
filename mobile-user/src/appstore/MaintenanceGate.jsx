import React from "react"
import { usePathname } from "expo-router"
import { useMaintenanceMode } from "@food/hooks/useMaintenanceMode"
import MaintenancePage from "@food/pages/shared/MaintenancePage"

// Web: modules/Food/components/MaintenanceGate.jsx (wraps every route in app/routes.jsx). The admin's "Under
// Maintenance" switch (public settings maintenance_mode_enabled) shows the Under Maintenance page instead of the app.
// Rendered above every screen; the user app has no admin routes, so it always listens.
export default function MaintenanceGate() {
  usePathname()
  const { enabled } = useMaintenanceMode({ active: true })
  if (enabled === true) return <MaintenancePage />
  return null
}

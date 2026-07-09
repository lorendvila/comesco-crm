import { Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from './auth/LoginPage'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppShell } from './layout/AppShell'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { ClientesListPage } from './pages/clientes/ClientesListPage'
import { NuevoClientePage } from './pages/clientes/NuevoClientePage'
import { ClienteFichaPage } from './pages/clientes/ClienteFichaPage'
import { PipelinePage } from './pages/pipeline/PipelinePage'
import { SeguimientoPage } from './pages/seguimiento/SeguimientoPage'
import { PedidosPage } from './pages/pedidos/PedidosPage'
import { InventarioPage } from './pages/inventario/InventarioPage'
import { DashboardPage } from './pages/dashboard/DashboardPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="clientes" element={<ClientesListPage />} />
          <Route path="clientes/nuevo" element={<NuevoClientePage />} />
          <Route path="clientes/:id" element={<ClienteFichaPage />} />
          <Route path="pipeline" element={<PipelinePage />} />
          <Route path="seguimiento" element={<SeguimientoPage />} />
          <Route path="pedidos" element={<PedidosPage />} />
          <Route path="inventario" element={<InventarioPage />} />
          <Route path="informes" element={<PlaceholderPage title="Informes" />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

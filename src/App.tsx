import { Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from './auth/LoginPage'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppShell } from './layout/AppShell'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { ClientesListPage } from './pages/clientes/ClientesListPage'
import { NuevoClientePage } from './pages/clientes/NuevoClientePage'
import { ClienteFichaPage } from './pages/clientes/ClienteFichaPage'
import { PipelinePage } from './pages/pipeline/PipelinePage'
import { ActividadPage } from './pages/actividad/ActividadPage'
import { TareasPage } from './pages/tareas/TareasPage'
import { PedidosPage } from './pages/pedidos/PedidosPage'
import { InventarioPage } from './pages/inventario/InventarioPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<AppShell />}>
          <Route index element={<PlaceholderPage title="Dashboard" />} />
          <Route path="clientes" element={<ClientesListPage />} />
          <Route path="clientes/nuevo" element={<NuevoClientePage />} />
          <Route path="clientes/:id" element={<ClienteFichaPage />} />
          <Route path="pipeline" element={<PipelinePage />} />
          <Route path="actividad" element={<ActividadPage />} />
          <Route path="tareas" element={<TareasPage />} />
          <Route path="pedidos" element={<PedidosPage />} />
          <Route path="inventario" element={<InventarioPage />} />
          <Route path="informes" element={<PlaceholderPage title="Informes" />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

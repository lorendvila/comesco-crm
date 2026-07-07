import { Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from './auth/LoginPage'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppShell } from './layout/AppShell'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { ClientesListPage } from './pages/clientes/ClientesListPage'
import { NuevoClientePage } from './pages/clientes/NuevoClientePage'
import { ClienteFichaPage } from './pages/clientes/ClienteFichaPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<AppShell />}>
          <Route index element={<PlaceholderPage title="Inicio" />} />
          <Route path="clientes" element={<ClientesListPage />} />
          <Route path="clientes/nuevo" element={<NuevoClientePage />} />
          <Route path="clientes/:id" element={<ClienteFichaPage />} />
          <Route path="pipeline" element={<PlaceholderPage title="Pipeline" />} />
          <Route path="actividad" element={<PlaceholderPage title="Actividad" />} />
          <Route path="tareas" element={<PlaceholderPage title="Tareas" />} />
          <Route path="pedidos" element={<PlaceholderPage title="Pedidos" />} />
          <Route path="informes" element={<PlaceholderPage title="Informes" />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

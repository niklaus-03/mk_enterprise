import React from 'react';
import { useAuth } from '../context/AuthContext';
import AdminDashboard from './AdminDashboard';
import ManagerDashboard from './ManagerDashboard';

export default function Dashboard() {
  const { isAdmin } = useAuth();
  return isAdmin ? <AdminDashboard /> : <ManagerDashboard />;
}
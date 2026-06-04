import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AdminDashboard from './AdminDashboard';
import ManagerDashboard from './ManagerDashboard';

export default function Dashboard() {
  const { isAdmin } = useAuth();
  
  return isAdmin ? <AdminDashboard /> : <ManagerDashboard />;
}
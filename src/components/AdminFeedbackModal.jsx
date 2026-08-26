import React from 'react';
import { AdminDashboardModal } from './AdminDashboardModal.jsx';

/**
 * AdminFeedbackModal now renders the comprehensive AdminDashboardModal
 * preserving backward compatibility for existing imports and modals.
 */
export function AdminFeedbackModal(props) {
  return <AdminDashboardModal {...props} />;
}

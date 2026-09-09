import { getAdminDashboard, getUserDashboard } from '../services/dashboardService.js';

export async function userDashboard(req, res) {
  res.json({ data: await getUserDashboard(Number(req.user.sub)) });
}

export async function adminDashboard(req, res) {
  res.json({ data: await getAdminDashboard() });
}

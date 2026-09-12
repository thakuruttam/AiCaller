import app from './app.js';
import { startScheduleReconciler } from './jobs/scheduleReconciler.js';

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[api-service] Server running on port ${PORT}`);
});

startScheduleReconciler();

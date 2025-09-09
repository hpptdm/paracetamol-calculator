// Helper: Calculate Rumack-Matthew treatment line (in mcg/mL)
function getTreatmentThreshold(hoursPostIngestion) {
  if (hoursPostIngestion < 0) return 0;
  // Standard line: 150 mcg/mL at 4h, halves every 4h
  return 150 * Math.pow(2, 4 - hoursPostIngestion);
}

// Inside your calculate route, update the return object:
return {
  risk,
  message,
  treatmentThresholdMcgMl: treatmentThreshold, // Renamed for clarity
  aboveTherapeutic,
  hoursPostIngestion: ingestionType === "acute" ? hoursSinceFirst : null
};
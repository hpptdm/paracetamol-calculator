const functions = require("firebase-functions");

function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

function getTreatmentThreshold(hoursPostIngestion) {
  if (hoursPostIngestion < 0) return 0;
  return 1000 * Math.pow(2, 4 - hoursPostIngestion); // μmol/L
}

exports.calculateParacetamolRisk = functions.https.onCall((data, context) => {
  const {
    ingestionType,
    ingestionPattern,
    firstIngestion,
    latestIngestion,
    samplingTime,
    level
  } = data;

  const firstMin = timeToMinutes(firstIngestion);
  const latestMin = timeToMinutes(latestIngestion);
  const sampleMin = timeToMinutes(samplingTime);

  let message = "";
  let risk = "Low";
  let treatmentThreshold = 0;
  let aboveTherapeutic = false;

  if (ingestionType === "chronic") {
    if (level > 100) {
      risk = "High";
      aboveTherapeutic = true;
      message = "Chronic ingestion with elevated level — consider NAC treatment.";
    } else {
      message = "Chronic ingestion with level within expected range.";
    }
  } else {
    const hoursSinceLatest = (sampleMin - latestMin) / 60;
    const hoursSinceFirst = (sampleMin - firstMin) / 60;

    if (hoursSinceLatest < 4) {
      risk = "Invalid";
      message = `⚠️ Sampling too early (${hoursSinceLatest.toFixed(1)}h after latest dose). Wait until ≥4h post-ingestion.`;
      return { risk, message };
    }

    treatmentThreshold = getTreatmentThreshold(hoursSinceFirst);

    if (level > treatmentThreshold) {
      risk = "High";
      aboveTherapeutic = true;
      message = `Level is ABOVE the Rumack-Matthew treatment line at ${hoursSinceFirst.toFixed(1)}h post-first-ingestion.`;
    } else {
      message = `Level is BELOW the Rumack-Matthew treatment line at ${hoursSinceFirst.toFixed(1)}h post-first-ingestion.`;
    }
  }

  return {
    risk,
    message,
    treatmentThreshold,
    aboveTherapeutic
  };
});
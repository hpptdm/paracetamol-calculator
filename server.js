const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

// Helper: Convert "HH:MM" to minutes since midnight
function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

// Helper: Calculate Rumack-Matthew treatment line (in μmol/L)
function getTreatmentThreshold(hoursPostIngestion) {
  if (hoursPostIngestion < 0) return 0;
  return 1000 * Math.pow(2, 4 - hoursPostIngestion);
}

app.post('/calculate', (req, res) => {
  const {
    ingestionType,
    ingestionPattern,
    firstIngestion,
    latestIngestion,
    samplingTime,
    level
  } = req.body;

  try {
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
        return res.json({ risk, message });
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

    res.json({
      risk,
      message,
      treatmentThreshold,
      aboveTherapeutic
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
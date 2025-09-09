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

// Helper: Calculate Rumack-Matthew treatment threshold (mcg/mL)
// Formula: C(t) = 150 * 0.5^((t - 4)/4) → t = hours since FIRST ingestion
function getTreatmentThreshold(hoursPostIngestion) {
  if (hoursPostIngestion < 4) {
    // Before 4h, use 150 mcg/mL as conservative threshold
    return 150;
  }
  return 150 * Math.pow(0.5, (hoursPostIngestion - 4) / 4);
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
    let hoursSinceFirst = (sampleMin - firstMin) / 60;

    if (ingestionType === "chronic") {
      // Chronic toxicity threshold: > 10 mcg/mL
      if (level > 10) {
        risk = "High";
        aboveTherapeutic = true;
        message = "Kindly start NAC infusion as per protocol.";
      } else {
        risk = "Low";
        message = "Toxicity is unlikely.";
      }
    } else {
      // Acute ingestion
      const hoursSinceLatest = (sampleMin - latestMin) / 60;

      if (hoursSinceLatest < 4) {
        risk = "Invalid";
        message = `⚠️ Sampling too early (${hoursSinceLatest.toFixed(1)}h after latest dose). Wait until ≥4h post-ingestion.`;
        return res.json({ risk, message });
      }

      treatmentThreshold = getTreatmentThreshold(hoursSinceFirst);

      if (level > treatmentThreshold) {
        risk = "High";
        aboveTherapeutic = true;
        message = "Kindly start NAC infusion as per protocol.";
      } else {
        risk = "Low";
        message = "Toxicity is unlikely.";
      }
    }

    res.json({
      risk,
      message,
      treatmentThresholdMcgMl: treatmentThreshold,
      aboveTherapeutic,
      hoursPostIngestion: ingestionType === "acute" ? hoursSinceFirst : null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
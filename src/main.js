import "./style.css";

// Configuration
let CURRENCY_RATE = 37;
const FALLBACK_RATE = 37;
const API_ENDPOINTS = [
  "https://api.exchangerate-api.com/v4/latest/USD",
  "https://open.er-api.com/v6/latest/USD",
];
const REFRESH_INTERVAL = 1800000; // 30 minutes
let lastUpdateTime = null;
let refreshTimer = null;
// Pricing presets
// baseFee = setup/start fee (fixed cost)
// A, B = formula parameters affecting per-minute rates
const PRESETS = {
  conservative: { baseFee: 15, formula: "hyperbolic", A: 0.08, B: 0.0002 }, // Higher setup fee, lower per-minute rates
  balanced: { baseFee: 5, formula: "hyperbolic", A: 0.03, B: 0.0005 }, // Standard setup fee, balanced rates
  aggressive: { baseFee: 3, formula: "hyperbolic", A: 0.015, B: 0.0008 }, // Lower setup fee, higher per-minute rates
};

const FORMULAS = {
  hyperbolic: {
    name: "Гіпербола",
    equation: "A / (1 + B × x)",
    calculate: (x, A, B) => A / (1 + B * x),
    params: {
      A: { min: 0.005, max: 0.2, default: 0.03, step: 0.001 },
      B: { min: 0.0001, max: 0.002, default: 0.0005, step: 0.00001 },
    },
  },
  power: {
    name: "Степенева функція",
    equation: "A × x^(-B)",
    calculate: (x, A, B) => (x > 0 ? A * Math.pow(x, -B) : A),
    params: {
      A: { min: 0.5, max: 5, default: 2, step: 0.1 },
      B: { min: 0.3, max: 1.2, default: 0.6, step: 0.01 },
    },
  },
  logarithmic: {
    name: "Логарифмічна",
    equation: "A - B × ln(x)",
    calculate: (x, A, B) => (x > 0 ? Math.max(0.005, A - B * Math.log(x)) : A),
    params: {
      A: { min: 0.02, max: 0.15, default: 0.08, step: 0.005 },
      B: { min: 0.002, max: 0.02, default: 0.008, step: 0.001 },
    },
  },
};

// State
let currentMinutes = 500;
let currentCurrency = "USD";
let baseFee = 5; // Fixed fee for processing start/setup
let currentFormula = "hyperbolic";
let paramA = 0.03; // Formula parameter A (affects per-minute rate)
let paramB = 0.0005; // Formula parameter B (affects scaling)
let priceChart = null;

// DOM Elements
const slider = document.getElementById("minutesSlider");
const minutesDisplay = document.getElementById("minutesDisplay");
const totalPriceDisplay = document.getElementById("totalPrice");
const baseFeeDisplay = document.getElementById("baseFeeDisplay");
const processingCostDisplay = document.getElementById("processingCost");
const rateDisplay = document.getElementById("rateDisplay");
const avgDisplay = document.getElementById("avgDisplay");
const currentFormulaDisplay = document.getElementById("currentFormula");

// Calculate rate per minute using current formula
function calculateRatePerMinute(minutes) {
  if (minutes === 0) return 0;
  const formula = FORMULAS[currentFormula];
  return formula.calculate(minutes, paramA, paramB);
}

// Calculate price
// Total price = baseFee (setup/start fee) + (ratePerMinute × minutes)
function calculatePrice(minutes) {
  const rate = calculateRatePerMinute(minutes); // Price per minute using current formula
  const processingCost = minutes * rate; // Variable cost based on duration
  const total = baseFee + processingCost; // Fixed fee + variable cost
  return {
    total,
    processingCost, // Variable cost (rate × minutes)
    rate, // Current rate per minute
    avgPerMinute: minutes > 0 ? total / minutes : 0, // Average price per minute
  };
}

// Format currency
function formatCurrency(value) {
  if (currentCurrency === "UAH") {
    return `₴${(value * CURRENCY_RATE).toFixed(2)}`;
  }
  return `$${value.toFixed(2)}`;
}

// Fetch exchange rate from API
async function fetchExchangeRate() {
  const refreshBtn = document.getElementById("refreshRateBtn");
  const rateDisplay = document.getElementById("exchangeRateDisplay");
  const timestampDisplay = document.getElementById("rateTimestamp");

  refreshBtn.classList.add("loading");
  timestampDisplay.textContent = "Оновлення...";

  for (const endpoint of API_ENDPOINTS) {
    try {
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error("API request failed");

      const data = await response.json();
      const uahRate = data.rates?.UAH || data.rates?.uah;

      if (uahRate && uahRate > 0) {
        CURRENCY_RATE = uahRate;
        lastUpdateTime = new Date();

        rateDisplay.textContent = `1 USD = ${CURRENCY_RATE.toFixed(2)} UAH`;
        timestampDisplay.textContent = `Останнє оновлення: ${lastUpdateTime.toLocaleTimeString(
          "uk-UA"
        )}`;

        refreshBtn.classList.remove("loading");
        updateDisplay();

        // Set up auto-refresh
        if (refreshTimer) clearInterval(refreshTimer);
        refreshTimer = setInterval(fetchExchangeRate, REFRESH_INTERVAL);

        return;
      }
    } catch (error) {
      console.error(`Failed to fetch from ${endpoint}:`, error);
    }
  }

  // All APIs failed, use fallback
  CURRENCY_RATE = FALLBACK_RATE;
  rateDisplay.textContent = `1 USD = ${CURRENCY_RATE.toFixed(2)} UAH`;
  timestampDisplay.textContent = "Використовується резервний курс";
  refreshBtn.classList.remove("loading");
  updateDisplay();
}

// Update slider progress
function updateSliderProgress() {
  const progress = (currentMinutes / 5000) * 100;
  slider.style.setProperty("--slider-progress", progress + "%");
}

// Update display
function updateDisplay() {
  const { total, processingCost, rate, avgPerMinute } =
    calculatePrice(currentMinutes);

  minutesDisplay.textContent = `${currentMinutes} хвилин`;
  totalPriceDisplay.textContent = formatCurrency(total);
  baseFeeDisplay.textContent = formatCurrency(baseFee);
  processingCostDisplay.textContent = formatCurrency(processingCost);
  rateDisplay.textContent = formatCurrency(rate) + "/хв";
  avgDisplay.textContent =
    currentMinutes > 0
      ? formatCurrency(avgPerMinute) + "/хв"
      : formatCurrency(0) + "/хв";

  const formula = FORMULAS[currentFormula];
  currentFormulaDisplay.textContent = `${formula.name}: ${formula.equation}`;

  updateSliderProgress();
  safeUpdateChart();
}

// Update formula controls
function updateFormulaControls() {
  const formula = FORMULAS[currentFormula];
  const paramASlider = document.getElementById("paramASlider");
  const paramBSlider = document.getElementById("paramBSlider");
  const paramALabel = document.getElementById("paramALabel");
  const paramBLabel = document.getElementById("paramBLabel");

  // Update slider ranges
  paramASlider.min = formula.params.A.min;
  paramASlider.max = formula.params.A.max;
  paramASlider.step = formula.params.A.step;
  paramASlider.value = paramA;

  paramBSlider.min = formula.params.B.min;
  paramBSlider.max = formula.params.B.max;
  paramBSlider.step = formula.params.B.step;
  paramBSlider.value = paramB;

  // Update labels
  paramALabel.innerHTML = `Параметр A: <span id="paramAValue">${paramA.toFixed(
    formula.params.A.step < 0.1 ? 2 : 1
  )}</span>`;
  paramBLabel.innerHTML = `Параметр B: <span id="paramBValue">${paramB.toFixed(
    5
  )}</span>`;
}

// Get current theme colors
function getChartColors() {
  const isDark =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (isDark) {
    return {
      primary: "#4fd1c9", // Teal-300 for dark theme
      text: "#f7fafc", // Gray-100 for dark theme
      border: "#4a5568", // Gray-600 for dark theme
    };
  } else {
    return {
      primary: "#2185d0", // Blue-600 for light theme
      text: "#1a202c", // Slate-900 for light theme
      border: "#cbd5e0", // Gray-300 for light theme
    };
  }
}

// Initialize chart
function initChart() {
  const ctx = document.getElementById("priceChart");
  if (!ctx) return;

  const dataPoints = [];

  for (let i = 0; i <= 5000; i += 50) {
    const price = calculatePrice(i);
    dataPoints.push({ x: i, y: price.total });
  }

  const colors = getChartColors();

  priceChart = new Chart(ctx, {
    type: "line",
    data: {
      datasets: [
        {
          label: "Загальна ціна",
          data: dataPoints,
          borderColor: colors.primary,
          backgroundColor: colors.primary + "20",
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.4,
          fill: true,
        },
        {
          label: "Поточна позиція",
          data: [
            { x: currentMinutes, y: calculatePrice(currentMinutes).total },
          ],
          borderColor: "#e67e22",
          backgroundColor: "#e67e22",
          pointRadius: 8,
          pointHoverRadius: 10,
          showLine: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          labels: {
            color: colors.text,
            font: {
              size: 12,
              family: "var(--font-family-base)",
            },
            usePointStyle: true,
            padding: 20,
          },
        },
        tooltip: {
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          titleColor: "#fff",
          bodyColor: "#fff",
          borderColor: colors.primary,
          borderWidth: 1,
          cornerRadius: 8,
          displayColors: false,
          callbacks: {
            title: function (context) {
              return `Тривалість: ${context[0].parsed.x} хвилин`;
            },
            label: function (context) {
              const value = context.parsed.y;
              if (context.datasetIndex === 0) {
                return `Загальна ціна: ${formatCurrency(value)}`;
              } else {
                return `Поточна позиція: ${formatCurrency(value)}`;
              }
            },
          },
        },
      },
      scales: {
        x: {
          type: "linear",
          title: {
            display: true,
            text: "Хвилини аудіо",
            color: colors.text,
            font: {
              size: 14,
              weight: "500",
              family: "var(--font-family-base)",
            },
          },
          grid: {
            color: colors.border + "40",
            drawBorder: false,
          },
          ticks: {
            color: colors.text,
            font: {
              size: 12,
              family: "var(--font-family-base)",
            },
            callback: function (value) {
              return value + " хв";
            },
          },
        },
        y: {
          title: {
            display: true,
            text: "Загальна ціна",
            color: colors.text,
            font: {
              size: 14,
              weight: "500",
              family: "var(--font-family-base)",
            },
          },
          grid: {
            color: colors.border + "40",
            drawBorder: false,
          },
          ticks: {
            color: colors.text,
            font: {
              size: 12,
              family: "var(--font-family-base)",
            },
            callback: function (value) {
              return formatCurrency(value);
            },
          },
        },
      },
      elements: {
        point: {
          hoverRadius: 8,
          hoverBorderWidth: 2,
        },
      },
    },
  });
}

// Update chart
function updateChart() {
  if (priceChart) {
    const price = calculatePrice(currentMinutes);
    priceChart.data.datasets[1].data = [{ x: currentMinutes, y: price.total }];
    priceChart.update("none");
  }
}

// Event listeners
slider.addEventListener("input", (e) => {
  currentMinutes = parseInt(e.target.value);
  updateDisplay();
});

// Refresh rate button
document.getElementById("refreshRateBtn").addEventListener("click", () => {
  fetchExchangeRate();
});

document.querySelectorAll(".preset-btn[data-minutes]").forEach((btn) => {
  btn.addEventListener("click", () => {
    currentMinutes = parseInt(btn.dataset.minutes);
    slider.value = currentMinutes;
    updateDisplay();
  });
});

// Preset configurations
document.querySelectorAll(".preset-btn[data-preset]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const preset = PRESETS[btn.dataset.preset];
    baseFee = preset.baseFee;
    currentFormula = preset.formula;
    paramA = preset.A;
    paramB = preset.B;

    document.getElementById("baseFeeSlider").value = baseFee;
    document.getElementById("baseFeeValue").textContent = baseFee;
    document.getElementById("formulaType").value = currentFormula;

    document
      .querySelectorAll(".preset-btn[data-preset]")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    updateFormulaControls();
    updateDisplay();
  });
});

// Formula type change
document.getElementById("formulaType").addEventListener("change", (e) => {
  currentFormula = e.target.value;
  const formula = FORMULAS[currentFormula];
  paramA = formula.params.A.default;
  paramB = formula.params.B.default;
  updateFormulaControls();
  updateDisplay();
});

// Base fee slider
document.getElementById("baseFeeSlider").addEventListener("input", (e) => {
  baseFee = parseInt(e.target.value);
  document.getElementById("baseFeeValue").textContent = baseFee;
  updateDisplay();
});

// Parameter sliders
document.getElementById("paramASlider").addEventListener("input", (e) => {
  paramA = parseFloat(e.target.value);
  const formula = FORMULAS[currentFormula];
  document.getElementById("paramAValue").textContent = paramA.toFixed(
    formula.params.A.step < 0.1 ? 2 : 1
  );
  updateDisplay();
});

document.getElementById("paramBSlider").addEventListener("input", (e) => {
  paramB = parseFloat(e.target.value);
  document.getElementById("paramBValue").textContent = paramB.toFixed(5);
  updateDisplay();
});

// Reset button
document.getElementById("resetBtn").addEventListener("click", () => {
  const preset = PRESETS.balanced;
  baseFee = preset.baseFee;
  currentFormula = preset.formula;
  paramA = preset.A;
  paramB = preset.B;

  document.getElementById("baseFeeSlider").value = baseFee;
  document.getElementById("baseFeeValue").textContent = baseFee;
  document.getElementById("formulaType").value = currentFormula;

  document
    .querySelectorAll(".preset-btn[data-preset]")
    .forEach((b) => b.classList.remove("active"));
  document
    .querySelector('.preset-btn[data-preset="balanced"]')
    .classList.add("active");

  updateFormulaControls();
  updateDisplay();
});

document.querySelectorAll(".currency-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".currency-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentCurrency = btn.dataset.currency;
    updateDisplay();
  });
});

// Health check function
function healthCheck() {
  const checks = {
    chart: !!priceChart,
    domElements: !!document.getElementById("priceChart"),
    calculations: typeof calculatePrice === "function",
    api: typeof fetchExchangeRate === "function",
  };

  console.log("🔍 Health Check Results:", checks);

  const allPassed = Object.values(checks).every((check) => check);
  if (allPassed) {
    console.log("✅ All systems operational");
  } else {
    console.warn("⚠️ Some systems may have issues");
  }

  return checks;
}

// Error handling for chart
function safeUpdateChart() {
  try {
    updateChart();
  } catch (error) {
    console.error("Chart update error:", error);
  }
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  initChart();
  updateFormulaControls();
  updateDisplay();
  fetchExchangeRate();

  // Run health check after initialization
  setTimeout(healthCheck, 1000);

  // Add theme change listener for chart colors
  if (window.matchMedia) {
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", () => {
        // Reinitialize chart with new colors when theme changes
        if (priceChart) {
          priceChart.destroy();
          initChart();
        }
      });
  }

  // Add global error handler
  window.addEventListener("error", (e) => {
    console.error("Global error:", e.error);
  });

  // Add unhandled promise rejection handler
  window.addEventListener("unhandledrejection", (e) => {
    console.error("Unhandled promise rejection:", e.reason);
  });
});

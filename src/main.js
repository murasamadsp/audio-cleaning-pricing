import "./style.css";

/**
 * Audio Cleaning Pricing Calculator
 * Handles pricing calculations for audio processing services
 */

// =============================================================================
// CONFIGURATION & CONSTANTS
// =============================================================================

/** @constant {string[]} API_ENDPOINTS - Currency exchange rate API endpoints */
const API_ENDPOINTS = [
  "https://api.exchangerate-api.com/v4/latest/USD",
  "https://open.er-api.com/v6/latest/USD",
];

/** @constant {number} REFRESH_INTERVAL - Rate refresh interval in milliseconds (30 minutes) */
const REFRESH_INTERVAL = 1800000;

/** @constant {number} FALLBACK_RATE - Fallback UAH to USD rate */
const FALLBACK_RATE = 37;

/** @constant {number} FALLBACK_EUR_RATE - Fallback EUR to USD rate */
const FALLBACK_EUR_RATE = 0.85;

/** @constant {Object} DEFAULT_PRICING - Default pricing parameters */
const DEFAULT_PRICING = {
  baseFee: 10,
  formula: "hyperbolic",
  paramA: 0.03,
  paramB: 0.0005,
};

/** @constant {Object} FORMULAS - Available pricing formulas with their parameters */
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

// =============================================================================
// STATE MANAGEMENT
// =============================================================================

/** @type {number} currentMinutes - Currently selected audio duration in minutes */
let currentMinutes = 500;

/** @type {string} currentCurrency - Currently selected currency (UAH/EUR/USD) */
let currentCurrency = "UAH";

/** @type {string} currentFormula - Currently selected pricing formula */
let currentFormula = "hyperbolic";

/** @type {number} baseFee - Base setup fee */
let baseFee = 10;

/** @type {number} paramA - Formula parameter A */
let paramA = 0.03;

/** @type {number} paramB - Formula parameter B */
let paramB = 0.0005;

/** @type {Chart|null} priceChart - Chart.js instance */
let priceChart = null;

/** @type {number} CURRENCY_RATE - Current UAH to USD exchange rate */
let CURRENCY_RATE = FALLBACK_RATE;

/** @type {number} EUR_RATE - Current EUR to USD exchange rate */
let EUR_RATE = FALLBACK_EUR_RATE;

/** @type {Date|null} lastUpdateTime - Last exchange rate update timestamp */
let lastUpdateTime = null;

/** @type {number|null} refreshTimer - Timer ID for auto-refresh */
let refreshTimer = null;

// =============================================================================
// DOM ELEMENTS
// =============================================================================

/** @type {HTMLInputElement} slider - Minutes slider element */
const slider = document.getElementById("minutesSlider");

/** @type {HTMLElement} minutesDisplay - Minutes display element */
const minutesDisplay = document.getElementById("minutesDisplay");

/** @type {HTMLElement} totalPriceDisplay - Total price display element */
const totalPriceDisplay = document.getElementById("totalPrice");

/** @type {HTMLElement} baseFeeDisplay - Base fee display element */
const baseFeeDisplay = document.getElementById("baseFeeDisplay");

/** @type {HTMLElement} processingCostDisplay - Processing cost display element */
const processingCostDisplay = document.getElementById("processingCost");

/** @type {HTMLElement} rateDisplay - Rate per minute display element */
const rateDisplay = document.getElementById("rateDisplay");

/** @type {HTMLElement} avgDisplay - Average price display element */
const avgDisplay = document.getElementById("avgDisplay");

/** @type {HTMLElement} currentFormulaDisplay - Current formula display element */
const currentFormulaDisplay = document.getElementById("currentFormula");

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Formats currency value based on selected currency
 * @param {number} value - Value to format
 * @returns {string} Formatted currency string
 */
function formatCurrency(value) {
  if (currentCurrency === "UAH") {
    return `₴${(value * CURRENCY_RATE).toFixed(2)}`;
  }
  if (currentCurrency === "EUR") {
    return `€${(value / EUR_RATE).toFixed(2)}`;
  }
  return `$${value.toFixed(2)}`;
}

/**
 * Calculates rate per minute using current formula
 * @param {number} minutes - Audio duration in minutes
 * @returns {number} Rate per minute
 */
function calculateRatePerMinute(minutes) {
  if (minutes === 0) return 0;
  const formula = FORMULAS[currentFormula];
  return formula.calculate(minutes, paramA, paramB);
}

/**
 * Calculates complete pricing information
 * @param {number} minutes - Audio duration in minutes
 * @returns {Object} Pricing breakdown
 */
function calculatePrice(minutes) {
  const rate = calculateRatePerMinute(minutes);
  const processingCost = minutes * rate;
  const total = baseFee + processingCost;

  return {
    total,
    processingCost,
    rate,
    avgPerMinute: minutes > 0 ? total / minutes : 0,
  };
}

/**
 * Updates slider progress visual indicator
 */
function updateSliderProgress() {
  const progress = (currentMinutes / 5000) * 100;
  slider.style.setProperty("--slider-progress", progress + "%");
}

/**
 * Updates all display elements with current pricing information
 */
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

/**
 * Updates formula controls (slider ranges and labels) for current formula
 */
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

// =============================================================================
// CHART MANAGEMENT
// =============================================================================

/**
 * Gets current theme colors for chart
 * @returns {Object} Color palette for current theme
 */
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

/**
 * Initializes the price chart
 */
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

/**
 * Updates chart with current position
 */
function updateChart() {
  if (priceChart) {
    const price = calculatePrice(currentMinutes);
    priceChart.data.datasets[1].data = [{ x: currentMinutes, y: price.total }];
    priceChart.update("none");
  }
}

/**
 * Updates chart data points when formula changes
 */
function updateChartData() {
  if (priceChart) {
    const dataPoints = [];

    // Recalculate all data points for the new formula
    for (let i = 0; i <= 5000; i += 50) {
      const price = calculatePrice(i);
      dataPoints.push({ x: i, y: price.total });
    }

    // Update the main curve data
    priceChart.data.datasets[0].data = dataPoints;

    // Update current position
    const currentPrice = calculatePrice(currentMinutes);
    priceChart.data.datasets[1].data = [
      { x: currentMinutes, y: currentPrice.total },
    ];

    priceChart.update();
  }
}

/**
 * Safely updates chart with error handling
 */
function safeUpdateChart(updateData = false) {
  try {
    if (updateData) {
      updateChartData();
    } else {
      updateChart();
    }
  } catch (error) {
    console.error("Chart update error:", error);
  }
}

// =============================================================================
// CURRENCY MANAGEMENT
// =============================================================================

/**
 * Fetches exchange rates from API
 */
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
      const eurRate = data.rates?.EUR || data.rates?.eur;

      if (uahRate && uahRate > 0) {
        CURRENCY_RATE = uahRate;
      }

      if (eurRate && eurRate > 0) {
        EUR_RATE = eurRate;
      }

      if ((uahRate && uahRate > 0) || (eurRate && eurRate > 0)) {
        lastUpdateTime = new Date();

        rateDisplay.textContent = `1 USD = ${CURRENCY_RATE.toFixed(
          2
        )} UAH | €${EUR_RATE.toFixed(2)}`;
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
  EUR_RATE = FALLBACK_EUR_RATE;
  rateDisplay.textContent = `1 USD = ${CURRENCY_RATE.toFixed(
    2
  )} UAH | €${EUR_RATE.toFixed(2)}`;
  timestampDisplay.textContent = "Використовується резервний курс";
  refreshBtn.classList.remove("loading");
  updateDisplay();
}

// =============================================================================
// EVENT HANDLERS
// =============================================================================

/**
 * Initializes all event listeners
 */
function initEventListeners() {
  // Slider input
  slider.addEventListener("input", (e) => {
    currentMinutes = parseInt(e.target.value);
    updateDisplay();
  });

  // Refresh rate button
  document
    .getElementById("refreshRateBtn")
    .addEventListener("click", fetchExchangeRate);

  // Preset minute buttons
  document.querySelectorAll(".preset-btn[data-minutes]").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentMinutes = parseInt(btn.dataset.minutes);
      slider.value = currentMinutes;
      updateDisplay();
    });
  });

  // Formula type selector
  document.getElementById("formulaType").addEventListener("change", (e) => {
    currentFormula = e.target.value;
    const formula = FORMULAS[currentFormula];
    paramA = formula.params.A.default;
    paramB = formula.params.B.default;
    updateFormulaControls();
    updateDisplay();
    safeUpdateChart(true); // Update chart data when formula changes
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
    safeUpdateChart(true); // Update chart when parameters change
  });

  document.getElementById("paramBSlider").addEventListener("input", (e) => {
    paramB = parseFloat(e.target.value);
    document.getElementById("paramBValue").textContent = paramB.toFixed(5);
    updateDisplay();
    safeUpdateChart(true); // Update chart when parameters change
  });

  // Reset button
  document.getElementById("resetBtn").addEventListener("click", () => {
    baseFee = DEFAULT_PRICING.baseFee;
    currentFormula = DEFAULT_PRICING.formula;
    paramA = DEFAULT_PRICING.paramA;
    paramB = DEFAULT_PRICING.paramB;

    document.getElementById("baseFeeSlider").value = baseFee;
    document.getElementById("baseFeeValue").textContent = baseFee;
    document.getElementById("formulaType").value = currentFormula;

    updateFormulaControls();
    updateDisplay();
    safeUpdateChart(true); // Update chart data when resetting
  });

  // Currency buttons
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
}

// =============================================================================
// DEBUGGING & HEALTH CHECKS
// =============================================================================

/**
 * Health check function for debugging
 * @returns {Object} System status checks
 */
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

// =============================================================================
// APPLICATION INITIALIZATION
// =============================================================================

/**
 * Initializes the entire application
 */
function initApp() {
  initChart();
  updateFormulaControls();
  updateDisplay();
  fetchExchangeRate();

  // Run health check after initialization
  setTimeout(healthCheck, 1000);
}

/**
 * Sets up theme change listener for chart
 */
function initThemeListener() {
  if (window.matchMedia) {
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", () => {
        if (priceChart) {
          priceChart.destroy();
          initChart();
        }
      });
  }
}

/**
 * Sets up global error handlers
 */
function initErrorHandlers() {
  window.addEventListener("error", (e) => {
    console.error("Global error:", e.error);
  });

  window.addEventListener("unhandledrejection", (e) => {
    console.error("Unhandled promise rejection:", e.reason);
  });
}

// Initialize on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  initEventListeners();
  initApp();
  initThemeListener();
  initErrorHandlers();
});

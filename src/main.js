// Configuration
let CURRENCY_RATE = 37;
const FALLBACK_RATE = 37;
const API_ENDPOINTS = [
    'https://api.exchangerate-api.com/v4/latest/USD',
    'https://open.er-api.com/v6/latest/USD'
];
const REFRESH_INTERVAL = 1800000; // 30 minutes
let lastUpdateTime = null;
let refreshTimer = null;
const PRESETS = {
    conservative: { baseFee: 15, formula: 'hyperbolic', A: 8, B: 0.00005 },
    balanced: { baseFee: 10, formula: 'hyperbolic', A: 5, B: 0.0001 },
    aggressive: { baseFee: 8, formula: 'hyperbolic', A: 3, B: 0.0002 }
};

const FORMULAS = {
    hyperbolic: {
        name: 'Гіпербола',
        equation: 'A / (1 + B × x)',
        calculate: (x, A, B) => A / (1 + B * x),
        params: {
            A: { min: 1, max: 20, default: 5, step: 0.1 },
            B: { min: 0.00001, max: 0.001, default: 0.0001, step: 0.00001 }
        }
    },
    power: {
        name: 'Степенева функція',
        equation: 'A × x^(-B)',
        calculate: (x, A, B) => x > 0 ? A * Math.pow(x, -B) : A,
        params: {
            A: { min: 10, max: 200, default: 80, step: 1 },
            B: { min: 0.1, max: 0.8, default: 0.3, step: 0.01 }
        }
    },
    logarithmic: {
        name: 'Логарифмічна',
        equation: 'A - B × ln(x)',
        calculate: (x, A, B) => x > 0 ? Math.max(0.01, A - B * Math.log(x)) : A,
        params: {
            A: { min: 0.05, max: 0.3, default: 0.15, step: 0.01 },
            B: { min: 0.005, max: 0.05, default: 0.015, step: 0.001 }
        }
    }
};

// State
let currentMinutes = 500;
let currentCurrency = 'USD';
let baseFee = 10;
let currentFormula = 'hyperbolic';
let paramA = 5;
let paramB = 0.0001;
let priceChart = null;

// DOM Elements
const slider = document.getElementById('minutesSlider');
const minutesDisplay = document.getElementById('minutesDisplay');
const totalPriceDisplay = document.getElementById('totalPrice');
const baseFeeDisplay = document.getElementById('baseFeeDisplay');
const processingCostDisplay = document.getElementById('processingCost');
const rateDisplay = document.getElementById('rateDisplay');
const avgDisplay = document.getElementById('avgDisplay');
const currentFormulaDisplay = document.getElementById('currentFormula');

// Calculate rate per minute using current formula
function calculateRatePerMinute(minutes) {
    if (minutes === 0) return 0;
    const formula = FORMULAS[currentFormula];
    return formula.calculate(minutes, paramA, paramB);
}

// Calculate price
function calculatePrice(minutes) {
    const rate = calculateRatePerMinute(minutes);
    const processingCost = minutes * rate;
    const total = baseFee + processingCost;
    return {
        total,
        processingCost,
        rate,
        avgPerMinute: minutes > 0 ? total / minutes : 0
    };
}

// Format currency
function formatCurrency(value) {
    if (currentCurrency === 'UAH') {
        return `₴${(value * CURRENCY_RATE).toFixed(2)}`;
    }
    return `$${value.toFixed(2)}`;
}

// Fetch exchange rate from API
async function fetchExchangeRate() {
    const refreshBtn = document.getElementById('refreshRateBtn');
    const rateDisplay = document.getElementById('exchangeRateDisplay');
    const timestampDisplay = document.getElementById('rateTimestamp');

    refreshBtn.classList.add('loading');
    timestampDisplay.textContent = 'Оновлення...';

    for (const endpoint of API_ENDPOINTS) {
        try {
            const response = await fetch(endpoint);
            if (!response.ok) throw new Error('API request failed');

            const data = await response.json();
            const uahRate = data.rates?.UAH || data.rates?.uah;

            if (uahRate && uahRate > 0) {
                CURRENCY_RATE = uahRate;
                lastUpdateTime = new Date();

                rateDisplay.textContent = `1 USD = ${CURRENCY_RATE.toFixed(2)} UAH`;
                timestampDisplay.textContent = `Останнє оновлення: ${lastUpdateTime.toLocaleTimeString('uk-UA')}`;

                refreshBtn.classList.remove('loading');
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
    timestampDisplay.textContent = 'Використовується резервний курс';
    refreshBtn.classList.remove('loading');
    updateDisplay();
}

// Update slider progress
function updateSliderProgress() {
    const progress = (currentMinutes / 5000) * 100;
    slider.style.setProperty('--slider-progress', progress + '%');
}

// Update display
function updateDisplay() {
    const { total, processingCost, rate, avgPerMinute } = calculatePrice(currentMinutes);

    minutesDisplay.textContent = `${currentMinutes} хвилин`;
    totalPriceDisplay.textContent = formatCurrency(total);
    baseFeeDisplay.textContent = formatCurrency(baseFee);
    processingCostDisplay.textContent = formatCurrency(processingCost);
    rateDisplay.textContent = formatCurrency(rate) + '/хв';
    avgDisplay.textContent = currentMinutes > 0 ? formatCurrency(avgPerMinute) + '/хв' : formatCurrency(0) + '/хв';

    const formula = FORMULAS[currentFormula];
    currentFormulaDisplay.textContent = `${formula.name}: ${formula.equation}`;

    updateSliderProgress();
    updateChart();
}

// Update formula controls
function updateFormulaControls() {
    const formula = FORMULAS[currentFormula];
    const paramASlider = document.getElementById('paramASlider');
    const paramBSlider = document.getElementById('paramBSlider');
    const paramALabel = document.getElementById('paramALabel');
    const paramBLabel = document.getElementById('paramBLabel');

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
    paramALabel.innerHTML = `Параметр A: <span id="paramAValue">${paramA.toFixed(formula.params.A.step < 0.1 ? 2 : 1)}</span>`;
    paramBLabel.innerHTML = `Параметр B: <span id="paramBValue">${paramB.toFixed(5)}</span>`;
}

// Initialize chart
function initChart() {
    const ctx = document.getElementById('priceChart').getContext('2d');
    const dataPoints = [];

    for (let i = 0; i <= 5000; i += 50) {
        const price = calculatePrice(i);
        dataPoints.push({ x: i, y: price.total });
    }

    const colors = getComputedStyle(document.documentElement);
    const primaryColor = colors.getPropertyValue('--color-primary').trim();
    const textColor = colors.getPropertyValue('--color-text').trim();
    const borderColor = colors.getPropertyValue('--color-border').trim();

    priceChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: 'Загальна ціна',
                    data: dataPoints,
                    borderColor: primaryColor,
                    backgroundColor: primaryColor + '20',
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.4
                },
                {
                    label: 'Поточна позиція',
                    data: [{ x: currentMinutes, y: calculatePrice(currentMinutes).total }],
                    borderColor: '#e67e22',
                    backgroundColor: '#e67e22',
                    pointRadius: 8,
                    pointHoverRadius: 10
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: textColor,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (context.datasetIndex === 0) {
                                return `Ціна: ${formatCurrency(context.parsed.y)}`;
                            } else {
                                return `Поточна: ${currentMinutes} хв = ${formatCurrency(context.parsed.y)}`;
                            }
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Хвилини аудіо',
                        color: textColor
                    },
                    grid: {
                        color: borderColor
                    },
                    ticks: {
                        color: textColor
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Загальна ціна ($)',
                        color: textColor
                    },
                    grid: {
                        color: borderColor
                    },
                    ticks: {
                        color: textColor,
                        callback: function(value) {
                            return '$' + value.toFixed(0);
                        }
                    }
                }
            }
        }
    });
}

// Update chart
function updateChart() {
    if (priceChart) {
        const price = calculatePrice(currentMinutes);
        priceChart.data.datasets[1].data = [{ x: currentMinutes, y: price.total }];
        priceChart.update('none');
    }
}

// Event listeners
slider.addEventListener('input', (e) => {
    currentMinutes = parseInt(e.target.value);
    updateDisplay();
});

// Refresh rate button
document.getElementById('refreshRateBtn').addEventListener('click', () => {
    fetchExchangeRate();
});

document.querySelectorAll('.preset-btn[data-minutes]').forEach(btn => {
    btn.addEventListener('click', () => {
        currentMinutes = parseInt(btn.dataset.minutes);
        slider.value = currentMinutes;
        updateDisplay();
    });
});

// Preset configurations
document.querySelectorAll('.preset-btn[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
        const preset = PRESETS[btn.dataset.preset];
        baseFee = preset.baseFee;
        currentFormula = preset.formula;
        paramA = preset.A;
        paramB = preset.B;

        document.getElementById('baseFeeSlider').value = baseFee;
        document.getElementById('baseFeeValue').textContent = baseFee;
        document.getElementById('formulaType').value = currentFormula;

        document.querySelectorAll('.preset-btn[data-preset]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        updateFormulaControls();
        updateDisplay();
    });
});

// Formula type change
document.getElementById('formulaType').addEventListener('change', (e) => {
    currentFormula = e.target.value;
    const formula = FORMULAS[currentFormula];
    paramA = formula.params.A.default;
    paramB = formula.params.B.default;
    updateFormulaControls();
    updateDisplay();
});

// Base fee slider
document.getElementById('baseFeeSlider').addEventListener('input', (e) => {
    baseFee = parseInt(e.target.value);
    document.getElementById('baseFeeValue').textContent = baseFee;
    updateDisplay();
});

// Parameter sliders
document.getElementById('paramASlider').addEventListener('input', (e) => {
    paramA = parseFloat(e.target.value);
    const formula = FORMULAS[currentFormula];
    document.getElementById('paramAValue').textContent = paramA.toFixed(formula.params.A.step < 0.1 ? 2 : 1);
    updateDisplay();
});

document.getElementById('paramBSlider').addEventListener('input', (e) => {
    paramB = parseFloat(e.target.value);
    document.getElementById('paramBValue').textContent = paramB.toFixed(5);
    updateDisplay();
});

// Reset button
document.getElementById('resetBtn').addEventListener('click', () => {
    const preset = PRESETS.balanced;
    baseFee = preset.baseFee;
    currentFormula = preset.formula;
    paramA = preset.A;
    paramB = preset.B;

    document.getElementById('baseFeeSlider').value = baseFee;
    document.getElementById('baseFeeValue').textContent = baseFee;
    document.getElementById('formulaType').value = currentFormula;

    document.querySelectorAll('.preset-btn[data-preset]').forEach(b => b.classList.remove('active'));
    document.querySelector('.preset-btn[data-preset="balanced"]').classList.add('active');

    updateFormulaControls();
    updateDisplay();
});

document.querySelectorAll('.currency-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.currency-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentCurrency = btn.dataset.currency;
        updateDisplay();
    });
});

// Initialize
initChart();
updateFormulaControls();
updateDisplay();
fetchExchangeRate();

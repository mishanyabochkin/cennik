
const API = "https://api.frankfurter.dev/v2";

const fromCurrency = document.getElementById("fromCurrency");
const toCurrency = document.getElementById("toCurrency");
const priceInput = document.getElementById("priceInput");
const result = document.getElementById("result");
const rateInfo = document.getElementById("rateInfo");
const swapButton = document.getElementById("swapButton");

const liveStatus = document.querySelector(".live-status");

// Кэш курсов, чтобы не отправлять лишние запросы
const ratesCache = {};

async function getRate(from, to) {
    if (from === to) {
        return { rate: 1, date: new Date().toISOString().slice(0, 10) };
    }

    const key = `${from}_${to}`;

    if (ratesCache[key]) {
        return ratesCache[key];
    }

    const response = await fetch(
        `${API}/rate/${from}/${to}`
    );

    if (!response.ok) {
        throw new Error("Не удалось получить курс");
    }

    const data = await response.json();

    ratesCache[key] = {
        rate: data.rate,
        date: data.date
    };

    return ratesCache[key];
}

async function convertCurrency() {
    const amount = Number(priceInput.value);

    if (!priceInput.value || !Number.isFinite(amount) || amount < 0) {
        result.textContent = "0.00";
        rateInfo.textContent = "Введи цену для расчёта";
        liveStatus.textContent = "● Ожидание";
        return;
    }

    const from = fromCurrency.value;
    const to = toCurrency.value;

    liveStatus.textContent = "● Обновляем курс...";

    try {
        const data = await getRate(from, to);

        const converted = amount * data.rate;

        result.textContent = new Intl.NumberFormat("ru-RU", {
            style: "currency",
            currency: to,
            maximumFractionDigits: 2
        }).format(converted);

        rateInfo.textContent =
            `1 ${from} = ${data.rate.toFixed(4)} ${to} · Курс на ${data.date}`;

        liveStatus.textContent = "● Курс получен";

    } catch (error) {
        result.textContent = "—";
        rateInfo.textContent = "Ошибка загрузки курса. Проверь интернет.";
        liveStatus.textContent = "● Нет соединения";

        console.error(error);
    }
}

// Пересчёт при изменении цены
priceInput.addEventListener("input", convertCurrency);

// Пересчёт при выборе валюты
fromCurrency.addEventListener("change", convertCurrency);
toCurrency.addEventListener("change", convertCurrency);

// Меняем валюты местами
swapButton.addEventListener("click", () => {
    const previousFrom = fromCurrency.value;

    fromCurrency.value = toCurrency.value;
    toCurrency.value = previousFrom;

    convertCurrency();
});

// Запуск
convertCurrency();


const API = "https://api.frankfurter.dev/v2";

// Элементы конвертера
const fromCurrency = document.getElementById("fromCurrency");
const toCurrency = document.getElementById("toCurrency");
const priceInput = document.getElementById("priceInput");
const result = document.getElementById("result");
const rateInfo = document.getElementById("rateInfo");
const swapButton = document.getElementById("swapButton");
const liveStatus = document.querySelector(".live-status");

// Элементы камеры
const camera = document.getElementById("camera");
const cameraFrame = document.querySelector(".camera-frame");
const scanButton = document.getElementById("scanButton");
const captureCanvas = document.getElementById("captureCanvas");

let cameraStream = null;
let cameraStarted = false;
let ratesCache = {};

// =============================
// ВАЛЮТНЫЙ КОНВЕРТЕР
// =============================

async function getRate(from, to) {
    if (from === to) {
        return {
            rate: 1,
            date: new Date().toISOString().slice(0, 10)
        };
    }

    const key = `${from}_${to}`;

    if (ratesCache[key]) {
        return ratesCache[key];
    }

    const response = await fetch(`${API}/rate/${from}/${to}`);

    if (!response.ok) {
        throw new Error("Ошибка загрузки курса");
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
        return;
    }

    liveStatus.textContent = "● Загружаем курс...";

    try {
        const from = fromCurrency.value;
        const to = toCurrency.value;

        const data = await getRate(from, to);
        const converted = amount * data.rate;

        result.textContent = new Intl.NumberFormat("ru-RU", {
            style: "currency",
            currency: to,
            maximumFractionDigits: 2
        }).format(converted);

        rateInfo.textContent =
            `1 ${from} = ${data.rate.toFixed(4)} ${to} · ${data.date}`;

        liveStatus.textContent = "● Курс получен";

    } catch (error) {
        console.error(error);

        result.textContent = "—";
        rateInfo.textContent = "Не удалось загрузить курс";
        liveStatus.textContent = "● Нет соединения";
    }
}

priceInput.addEventListener("input", convertCurrency);
fromCurrency.addEventListener("change", convertCurrency);
toCurrency.addEventListener("change", convertCurrency);

swapButton.addEventListener("click", () => {
    const previous = fromCurrency.value;

    fromCurrency.value = toCurrency.value;
    toCurrency.value = previous;

    convertCurrency();
});

// =============================
// КАМЕРА
// =============================

async function startCamera() {
    try {
        if (!navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia) {
            throw new Error(
                "Камера недоступна. Открой приложение через HTTPS."
            );
        }

        scanButton.disabled = true;
        scanButton.textContent = "Открываем камеру...";

        cameraStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                facingMode: { ideal: "environment" }
            }
        });

        camera.srcObject = cameraStream;

        await camera.play();

        cameraFrame.classList.add("active");
        cameraStarted = true;

        scanButton.disabled = false;
        scanButton.textContent = "📸 Распознать ценник";

    } catch (error) {
        console.error("Ошибка камеры:", error);

        scanButton.disabled = false;
        scanButton.textContent = "Попробовать ещё раз";

        alert("Не удалось открыть камеру: " + error.message);
    }
}

// =============================
// ОПРЕДЕЛЕНИЕ ВАЛЮТЫ
// =============================

function detectCurrency(text) {
    if (/₽|руб/i.test(text)) return "RUB";
    if (/¥|￥|元/.test(text)) return "CNY";
    if (/€/.test(text)) return "EUR";
    if (/\$/.test(text)) return "USD";

    return null;
}

// =============================
// ПОИСК ЦЕНЫ
// =============================

function extractPrice(text) {
    const match = text.match(
        /\d[\d\s]*(?:[.,]\d{1,2})?/
    );

    if (!match) return null;

    let number = match[0].replace(/\s/g, "");

    if (number.includes(",") && number.includes(".")) {
        number = number.replace(/,/g, "");
    } else if (number.includes(",")) {
        const parts = number.split(",");

        if (parts[1].length === 3) {
            number = number.replace(",", "");
        } else {
            number = number.replace(",", ".");
        }
    }

    const price = Number(number);

    return Number.isFinite(price) && price > 0
        ? price
        : null;
}

// =============================
// РАСПОЗНАВАНИЕ ЦЕННИКА
// =============================

async function recognizePrice() {
    if (!cameraStarted || !camera.videoWidth) {
        alert("Сначала открой камеру.");
        return;
    }

    if (!window.Tesseract) {
        alert("Не загрузилась библиотека распознавания. Проверь интернет.");
        return;
    }

    scanButton.disabled = true;

    try {
        scanButton.textContent = "Распознаём...";

        captureCanvas.width = camera.videoWidth;
        captureCanvas.height = camera.videoHeight;

        const context = captureCanvas.getContext("2d");

        context.drawImage(
            camera,
            0,
            0,
            captureCanvas.width,
            captureCanvas.height
        );

        const ocr = await Tesseract.recognize(
            captureCanvas,
            "eng",
            {
                logger: message => {
                    if (message.status === "recognizing text") {
                        const progress = Math.round(
                            message.progress * 100
                        );

                        scanButton.textContent =
                            `Распознаём ${progress}%`;
                    }
                }
            }
        );

        const text = ocr.data.text;

        console.log("Найденный текст:", text);

        const price = extractPrice(text);
        const currency = detectCurrency(text);

        if (price === null) {
            alert(
                "Не удалось найти цену. Попробуй приблизить камеру и улучшить освещение."
            );
            return;
        }

        priceInput.value = price;

        if (currency) {
            fromCurrency.value = currency;
        }

        convertCurrency();

        scanButton.textContent = "📸 Сканировать ещё раз";

    } catch (error) {
        console.error("Ошибка OCR:", error);

        alert("Ошибка распознавания: " + error.message);

    } finally {
        scanButton.disabled = false;

        if (cameraStarted &&
            scanButton.textContent !== "📸 Сканировать ещё раз") {
            scanButton.textContent = "📸 Распознать ценник";
        }
    }
}

// =============================
// КНОПКА СКАНИРОВАНИЯ
// =============================

scanButton.addEventListener("click", () => {
    if (!cameraStarted) {
        startCamera();
    } else {
        recognizePrice();
    }
});

// Запуск конвертера
convertCurrency();

console.log("Ценник запущен!");

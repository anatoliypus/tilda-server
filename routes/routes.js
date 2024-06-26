const express = require("express");
const multer = require('multer')
const upload = multer({ dest: './uploads/' })
const xlsx = require('node-xlsx')
const { toPositiveInt } = require("../utils/utils");
const {
    catalogHandler,
    itemHandler,
    searchHandler,
    brandsHandler,
    hintsHandler,
    analyticsHandler,
    searchPoizonHandler,
    priceHandler
} = require("./handlers");
const { config } = require("../config");
const fs = require("node:fs");
const path = require("node:path");
const { clearPrices, incrementPriceAnalytics } = require("../db/db");
const { calculatePrice } = require("../utils/pricing");
const { getProductPriceOnlyId, getProductPriceRange } = require("../apiService/apiService");

const router = express.Router();

const generateResponse = (error = false, msg = "ok", body = {}) => ({
    error,
    body,
    msg,
});

router.get("/catalog", async (req, res) => {
    let page = toPositiveInt(req.query.page) || 1;
    let pageSize = toPositiveInt(req.query.pageSize) || config.defaultPageSize;
    let gender =
        (req.query.gender &&
            Object.values(config.genders.client).includes(req.query.gender) &&
            req.query.gender) ||
        config.genders.client.all;
    let category = toPositiveInt(req.query.category) || null;
    let sort = req.query.sort;
    let brand = req.query.brand || null;
    let loadCategories = toPositiveInt(req.query.loadCategories)
    if (loadCategories != 0 && loadCategories != 1) loadCategories = true
    loadCategories = Boolean(loadCategories)

    if (sort != "popularity") sort = null;

    res.status(200).json(
        generateResponse(
            false,
            "ok",
            await catalogHandler(page, pageSize, gender, category, sort, brand, loadCategories)
        )
    );
});

router.get("/product", async (req, res) => {
    let id = toPositiveInt(req.query.id);
    let cache = req.query.cache;
    if (cache == "0") cache = false;
    else cache = true;
    if (!id)
        return res
            .status(400)
            .json(generateResponse(true, "Please specify right id format."));
    res.status(200).json(
        generateResponse(false, "ok", await itemHandler(id, cache))
    );
});

router.get("/searchPoizon", async (req, res) => {
    let key = req.query.key;
    let page = 0;
    let pageSize = 5;

    if (!key)
        return res
            .status(400)
            .json(generateResponse(true, "Please specify right search key."));
    res.status(200).json(
        generateResponse(
            false,
            "ok",
            await searchPoizonHandler(key, page, pageSize)
        )
    );
});

router.get("/search", async (req, res) => {
    let key = req.query.key;
    let page = toPositiveInt(req.query.page) || 1;
    let pageSize = toPositiveInt(req.query.pageSize) || config.defaultPageSize;
    let gender =
        (req.query.gender &&
            req.query.gender in Object.values(config.genders.client) &&
            req.query.gender) ||
        config.genders.all;
    let category = toPositiveInt(req.query.category) || null;
    let sort = req.query.sort;
    let brand = req.query.brand || null;

    if (!key)
        return res
            .status(400)
            .json(generateResponse(true, "Please specify right search key."));
    res.status(200).json(
        generateResponse(
            false,
            "ok",
            await searchHandler(
                key,
                page,
                pageSize,
                gender,
                category,
                sort,
                brand
            )
        )
    );
});

router.get("/hints", async (req, res) => {
    const key = req.query.key || null
    if (!key) return res.status(403).json(generateResponse(true, "не задан ключ для поиска"));
    res.status(200).json(generateResponse(false, "ok", await hintsHandler(key)));
})

router.get("/analytics", async (req, res) => {
    res.status(200).json(generateResponse(false, "ok", await analyticsHandler()));
})

router.get("/calculatePrice", async (req, res) => {
    const price = toPositiveInt(req.query.price) || null
    if (!price) return res.status(403).json(generateResponse(true, "не задана цена"));
    res.status(200).json(generateResponse(false, "ok", {
        price: calculatePrice(price)
    }));
})

router.get("/getPriceById", async (req, res) => {
    const id = toPositiveInt(req.query.id) || null
    
    if (!id) return res.status(403).json(generateResponse(true, "не задан spuid"));
    
    await incrementPriceAnalytics()

    res.status(200).json(generateResponse(false, "ok", {
        prices: await priceHandler(id, false)
    }));
})

router.get("/getProductPriceRange", async (req, res) => {
    const id = toPositiveInt(req.query.id) || null
    
    if (!id) return res.status(403).json(generateResponse(true, "не задан spuid"));
    
    await incrementPriceAnalytics()

    res.status(200).json(generateResponse(false, "ok", {
        prices: await getProductPriceRange(id)
    }));
})

router.get("/brands", async (req, res) => {
    res.status(200).json(generateResponse(false, "ok", await brandsHandler()));
});

router.post("/setRates", upload.single('file'), async (req, res) => {
    if (req.body.login != config.rates.login || req.body.password != config.rates.password) res.status(403).json(generateResponse(true, "неправильный логин и/или пароль"));
    if (!req.file || !req.file.path) res.status(500).json(generateResponse(true, "неизвестная ошибка"));
    const sheet = xlsx.parse(req.file.path)[0].data
    const under2000 = sheet[3]
    const more2000 = sheet[4]
    if (!under2000.length || !more2000.length) res.status(400).json(generateResponse(true, "неправильный формат файла"));

    try {
        const parseRow = (row) => {
            return {
                rate: parseFloat(row[2]),
                chinaWork: parseFloat(row[3]),
                shipping: parseFloat(row[4]),
                fee: parseFloat(row[5]),
                percent: parseFloat(row[6])
            }
        }
        const under2000Info = parseRow(under2000)
        const more2000Info = parseRow(more2000)
    
        const result = {under2000Info, more2000Info}
        const json = JSON.stringify(result)

        fs.writeFileSync(path.join(__dirname, '..', 'utils', 'rates.json'), json)
        await clearPrices()
        res.status(200).json(generateResponse(false, "ok"));
    } catch(e) {
        return res.status(400).json(generateResponse(true, "ошибка чтения файла"));
    }
});

router.get("/js", async (req, res) => {
    res.sendFile(config.server.jsFile);
});

router.get("/css", async (req, res) => {
    res.sendFile(config.server.cssFile);
});

router.get("/demoPrices", async (req, res) => {
    res.sendFile(config.server.demoHTML);
});

router.get("/viewAnalytics", async (req, res) => {
    res.sendFile(config.server.analyticsPage);
});

router.get("/setRates", async (req, res) => {
    res.sendFile(config.rates.file);
});

router.all("*", function (req, res) {
    return res.status(404).json(generateResponse(true, "Unknown route"));
});

module.exports = router;

const express = require("express");
const { toPositiveInt } = require("../utils/utils");
const {
    catalogHandler,
    itemHandler,
    searchHandler,
    searchPoizonHandler,
    brandsHandler,
} = require("./handlers");
const { config } = require("../config");
const fs = require("node:fs");
const path = require("node:path")

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
    let category = req.query.category || null;
    let sort = req.query.sort;
    let brand = req.query.brand || null;

    if (sort != "popularity") sort = null;

    res.status(200).json(
        generateResponse(
            false,
            "ok",
            await catalogHandler(page, pageSize, gender, category, sort, brand)
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
    let category = req.query.category || null;
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

router.get("/brands", async (req, res) => {
    res.status(200).json(generateResponse(false, "ok", await brandsHandler()));
});

router.get("/setRate", async (req, res) => {
    const rate = parseFloat(req.query.rate);

    fs.readFile("../utils/ratesToken.txt", "utf8", (err, data) => {
        if (err) {
            res.status(500).json(
                generateResponse(true, "неизвестная ошибка: " + err + path.dirname())
            );
        } else {
            const token = req.query.token == data;

            if (!token)
                res.status(403).json(generateResponse(true, "неверный токен"));

            const content = JSON.stringify({ rate });

            fs.writeFile("../utils/rates.json", content, (err) => {
                if (err) {
                    res.status(500).json(
                        generateResponse(true, "неизвестная ошибка: " + err)
                    );
                } else {
                    res.status(200).json(generateResponse(false, "ok"));
                }
            });
        }
    });
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

router.all("*", function (req, res) {
    res.status(404).json(generateResponse(true, "Unknown route"));
});

module.exports = router;

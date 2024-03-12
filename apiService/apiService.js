const { config } = require("../config");
const request = require("request-promise");
const Bottleneck = require("bottleneck/es5");
const { incrementProductInfoAnalytics, incrementSearchAnalytics, incrementPriceAnalytics } = require("../db/db");

const limiter = new Bottleneck({
    maxConcurrent: config.poizonApi.maxConcurrentRequests,
    minTime: config.poizonApi.apiDelay
  });

const getProductDetail = async (spuId) => {
    await incrementProductInfoAnalytics()
    var options = {
        method: "GET",
        url: `https://poison-api.com/Dewu/productDetail?spuId=${spuId}`,
        headers: {
            apiKey: config.poizonApi.apiKey,
        },
    };
    const response = await limiter.schedule(() => request(options))
    const json = JSON.parse(response)
    return json
}

const searchProductsPoizon = async (key, page, pageSize) => {
    await incrementSearchAnalytics()
    var options = {
        method: "GET",
        url: `https://poison-api.com/Dewu/search?keyword=${key}&limit=${pageSize}&page=${page}`,
        headers: {
            apiKey: config.poizonApi.apiKey,
        },
    };
    const response = await limiter.schedule(() => request(options))
    const json = JSON.parse(response)
    return json
}

const getProductPrice = async (spuId) => {
    await incrementPriceAnalytics()
    var options = {
        method: "GET",
        url: `https://poison-api.com/Dewu/priceInfo?spuId=${spuId}`,
        headers: {
            apiKey: config.poizonApi.apiKey,
        },
    };
    const response = await limiter.schedule(() => request(options))
    const json = JSON.parse(response)
    return json
};

module.exports = {getProductDetail, getProductPrice, searchProductsPoizon}
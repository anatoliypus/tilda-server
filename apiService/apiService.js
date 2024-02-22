const { config } = require("../config");
const request = require("request-promise");
const Bottleneck = require("bottleneck/es5");

const limiter = new Bottleneck({
    maxConcurrent: config.poizonApi.maxConcurrentRequests,
    minTime: config.poizonApi.apiDelay
  });

const getProductDetail = async (spuId) => {
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

const getProductPrice = async (spuId) => {
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

module.exports = {getProductDetail, getProductPrice}
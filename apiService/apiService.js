const { config } = require("../config");
const request = require("request-promise");
const Bottleneck = require("bottleneck/es5");
const { calculatePrice } = require("../utils/pricing");

const limiter = new Bottleneck({
    maxConcurrent: config.poizonApi.maxConcurrentRequests,
    minTime: config.poizonApi.apiDelay,
});

const getProductDetail = async (spuId) => {
    try {
        var options = {
            method: "GET",
            url: `https://poison-api.com/Dewu/productDetail?spuId=${spuId}`,
            headers: {
                apiKey: config.poizonApi.apiKey,
            },
        };
        // const response = await limiter.schedule(() => request(options));
        const response = await request(options);
        const json = JSON.parse(response);
        return json;
    } catch (e) {
        console.error(e);
        return {};
    }
};

const searchProductsPoizon = async (key, page, pageSize) => {
    try {
        var options = {
            method: "GET",
            url: `https://poison-api.com/Dewu/search?keyword=${key}&limit=${pageSize}&page=${page}`,
            headers: {
                apiKey: config.poizonApi.apiKey,
            },
        };
        // const response = await limiter.schedule(() => request(options));
        const response = await request(options);
        const json = JSON.parse(response);
        return json;
    } catch (e) {
        console.error(e);
        return {};
    }
};

const getProductPriceOnlyId = async (spuId) => {
    try {
        const priceInfo = await getProductPrice(spuId);
        const productDetail = await getProductDetail(spuId);

        const propertiesObj = productDetail.data.skus;
        const saleProperties = productDetail.data.saleProperties.list;

        const priceInfoByPropId = {};

        propertiesObj.forEach((prop) => {
            const sku = prop.skuId;
            const propValueId =
                prop.properties[prop.properties.length - 1].propertyValueId;

            if (priceInfo[sku]) priceInfoByPropId[propValueId] = priceInfo[sku];
        });

        saleProperties.forEach((saleProp) => {
            if (priceInfoByPropId[saleProp.propertyValueId]) {
                priceInfoByPropId[saleProp.propertyValueId].sizeValue =
                    saleProp.value;
            }
        });

        const sizePriceMapping = {};

        for (const key in priceInfoByPropId) {
            if (
                priceInfoByPropId[key].prices &&
                priceInfoByPropId[key].prices.length &&
                priceInfoByPropId[key].prices[0].tradeType &&
                priceInfoByPropId[key].prices[0].tradeType != 95 &&
                priceInfoByPropId[key].prices[0].price
            ) {
                sizePriceMapping[priceInfoByPropId[key].sizeValue] =
                    priceInfoByPropId[key].prices[0].price;
            }
        }

        return sizePriceMapping;
    } catch (e) {
        console.error(e);
        return {};
    }
};

const getProductPrice = async (spuId) => {
    try {
        var options = {
            method: "GET",
            url: `https://poison-api.com/Dewu/priceInfo?spuId=${spuId}`,
            headers: {
                apiKey: config.poizonApi.apiKey,
            },
        };
        // const response = await limiter.schedule(() => request(options));
        const response = await request(options);
        const json = JSON.parse(response);
        return json;
    } catch (e) {
        console.error(e);
        return {};
    }
};

const getProductPriceRange = async (spuId) => {
    try {
        const details = await getProductDetail(spuId);

        let minPrice = 0
        let maxPrice = 0

        if (details && details.data && details.data.price && details.data.price.item) {
            if (details.data.price.item.floorPrice) minPrice = details.data.price.item.floorPrice;
            if (details.data.price.item.maxPrice) maxPrice = details.data.price.item.maxPrice;
        }

        minPrice = calculatePrice(minPrice)
        maxPrice = calculatePrice(maxPrice)

        return { minPrice, maxPrice };
    } catch (e) {
        console.error(e);
        return { minPrice: 0, maxPrice: 0 };
    }
};


module.exports = {
    getProductDetail,
    getProductPrice,
    searchProductsPoizon,
    getProductPriceOnlyId,
    getProductPriceRange,
};

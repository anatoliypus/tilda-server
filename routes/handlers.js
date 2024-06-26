const { searchProductsPoizon } = require("../apiService/apiService");
const { config } = require("../config");
const {
    searchProducts,
    getProductInfo,
    getPaginatedCatalog,
    updatePrices,
    getBrandsList,
    getCategoryLevel,
    getHints,
    getAnalytics,
} = require("../db/db");

const catalogHandler = async (
    page,
    pageSize,
    gender,
    category,
    sort,
    brand,
    loadCategories
) => {
    let products = await getPaginatedCatalog(
        page,
        pageSize,
        gender,
        category,
        sort,
        brand
    );
    const result = {
        products, categories: []
    }
    if (loadCategories && page < 2) {
        let categories = await getCategoryLevel(category);
        result.categories = categories
    }
    if (config.usage.catalogPriceUpdate) products = await updatePrices(products)
    return result
};

const searchHandler = async (
    key,
    page,
    pageSize,
    gender,
    category,
    sort,
    brand
) => {
    let products = await searchProducts(
        key,
        page,
        pageSize,
        gender,
        category,
        sort,
        brand
    );
    if (config.usage.searchPriceUpdate) products = await updatePrices(products)
    return {
        products,
    };
};

const brandsHandler = async () => {
    let brands = await getBrandsList();
    return {
        brands,
    };
};

const searchPoizonHandler = async (key, page, pageSize) => {
    let products = await searchProductsPoizon(key, page, pageSize);
    return {
        products: products.data,
    };
};

const itemHandler = async (id, cache) => {
    let product = await getProductInfo(id);

    if (config.usage.productInfoPriceUpdate) {
        product = await updatePrices([product], cache);
        product = product[0];
    }

    return product;
};

const priceHandler = async (id, cache) => {
    let product = await getProductInfo(id);

    product = await updatePrices([product], cache);
    product = product[0];

    return product.apiPrices;
};

const hintsHandler = async (key) => {
    const hints = await getHints(key);
    return hints;
};

const analyticsHandler = async (key) => {
    const analytics = await getAnalytics();
    return analytics;
};

module.exports = {
    catalogHandler,
    searchHandler,
    itemHandler,
    searchPoizonHandler,
    brandsHandler,
    hintsHandler,
    analyticsHandler,
    priceHandler
};

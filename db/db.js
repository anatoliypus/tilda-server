const { MongoClient, ObjectId } = require("mongodb");
const { config } = require("../config");
const {
    getProductDetail,
    getProductPrice,
} = require("../apiService/apiService");

const connectionUrl = config.db.url;
const dbName = config.db.dbName;

let db, mongoClient;

const init = () =>
    MongoClient.connect(connectionUrl, { useNewUrlParser: true }).then(
        (client) => {
            mongoClient = client;
            db = client.db(dbName);
        }
    );

const updatePrices = async (items) => {
    const shouldUpdate = [];
    const promises = [];
    const result = [];
    items.forEach((item) => {
        promises.push(
            new Promise(async (resolve) => {
                if (
                    item &&
                    (!item.apiPrices ||
                        !item.apiPricesUpdated ||
                        Date.now() - item.apiPricesUpdated > config.db.pricesCache)
                ) {
                    const prices = await getProductPrice(item.productId);
                    const priceResult = {};
                    const variantIdSizeMapping = item.variantIdSizeMapping || {}
                    let variantIdSizeMappingUpdated = false
                    for (const variantId in prices) {
                        let sizeText = variantIdSizeMapping[variantId];
                        if (!sizeText) {
                            const variant = await getProductVariant(variantId);
                            if (variant.params && variant.params.length) {
                                const size = variant.params.find(
                                    (v) =>
                                        v.key && v.key == 'размер'
                                );
                                if (size && size.value) {
                                    sizeText = size.value;
                                    variantIdSizeMapping[variantId] = sizeText
                                    variantIdSizeMappingUpdated = true
                                } else {
                                    sizeText = config.db.oneSizePlaceholder
                                    variantIdSizeMapping[variantId] = sizeText
                                    variantIdSizeMappingUpdated = true
                                }
                            }
                        }
                        if (
                            sizeText &&
                            prices[variantId].prices &&
                            prices[variantId].prices.length &&
                            prices[variantId].prices[0].tradeType &&
                            prices[variantId].prices[0].tradeType != 95 &&
                            prices[variantId].prices[0].price
                        ) {
                            priceResult[sizeText] =
                                prices[variantId].prices[0].price;
                        }
                    }
                    item.apiPrices = priceResult;
                    item.apiPricesUpdated = Date.now();
                    if (variantIdSizeMappingUpdated) item.variantIdSizeMapping = variantIdSizeMapping
                    shouldUpdate.push(item);
                }
                result.push(item);
                resolve();
            })
        );
    });
    await Promise.all(promises);

    const collection = db.collection(config.db.collections.products);
    for (const el of shouldUpdate) {
        const filter = { _id: el._id };
        const updateDocument = {
            $set: {
                apiPrices: el.apiPrices,
                apiPricesUpdated: el.apiPricesUpdated,
                variantIdSizeMapping: el.variantIdSizeMapping
            },
        };
        await collection.updateOne(filter, updateDocument);
    }

    return result;
};

const baseGetProducts = async (page, pageSize, gender, key=null) => {
    const collection = db.collection(config.db.collections.products);
    let matchParameter, genderParameter
    if (gender == config.genders.client.woman) {
        genderParameter = {
            $or: [
                {gender: {$eq: config.genders.db.woman}},
                {gender: {$eq: config.genders.db.all}},
            ]
        }
    } else if (gender == config.genders.client.man) {
        genderParameter = {
            $or: [
                {gender: {$eq: config.genders.db.man}},
                {gender: {$eq: config.genders.db.all}},
            ]
        }
    } else {
        genderParameter = {
            $or: [
                {gender: {$eq: config.genders.db.man}},
                {gender: {$eq: config.genders.db.woman}},
                {gender: {$eq: config.genders.db.all}},
            ]
        }
    }

    if (!key) matchParameter = genderParameter
    else {
        matchParameter = {
            $and: [
                genderParameter, {$text: { $search: key },}
            ]
        }
    }

    let products = await collection
        .aggregate([
            {
                $match: matchParameter
            },
            {
                $facet: {
                    metadata: [{ $count: "totalCount" }],
                    data: [
                        { $skip: (page - 1) * pageSize },
                        { $limit: pageSize },
                        {
                            $project: {
                                _id: 1,
                                title: 1,
                                price: 1,
                                images: 1,
                                productId: 1,
                                apiPrices: 1,
                                apiPricesUpdated: 1,
                                variantIdSizeMapping: 1
                            },
                        },
                    ],
                },
            },
        ])
        .toArray();
    return products[0].data;
};

const searchProducts = async (key, page, pageSize, gender) => {
    return baseGetProducts(page, pageSize, gender, key)
};

const getProductVariant = async (variantId) => {
    const collection = db.collection(config.db.collections.productVariants);
    const query = {
        variantId: { $eq: parseInt(variantId) },
    };
    const result = await collection.findOne(query);
    return result;
};

const getProductInfo = async (id) => {
    const collection = db.collection(config.db.collections.products);
    const query = {
        productId: { $eq: id },
    };
    const result = await collection.findOne(query);
    return result;
};

const getPaginatedCatalog = async (page, pageSize, gender) => {
    return baseGetProducts(page, pageSize, gender)
};

const close = () => {
    mongoClient.close();
};

module.exports = {
    init,
    searchProducts,
    getProductInfo,
    getPaginatedCatalog,
    updatePrices,
    close,
};

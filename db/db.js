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

const updatePrices = async (items, cache = true) => {
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
                        !cache ||
                        Date.now() - item.apiPricesUpdated >
                            config.db.pricesCache)
                ) {
                    const prices = await getProductPrice(item.productId);
                    const priceResult = {};
                    const variantIdSizeMapping =
                        item.variantIdSizeMapping || {};
                    let variantIdSizeMappingUpdated = false;
                    for (const variantId in prices) {
                        let sizeText = variantIdSizeMapping[variantId];
                        if (!sizeText) {
                            const variant = await getProductVariant(variantId);
                            if (variant.params && variant.params.length) {
                                const size = variant.params.find(
                                    (v) => v.key && v.key == "размер"
                                );
                                if (size && size.value) {
                                    sizeText = size.value;
                                    variantIdSizeMapping[variantId] = sizeText;
                                    variantIdSizeMappingUpdated = true;
                                } else {
                                    sizeText = config.db.oneSizePlaceholder;
                                    variantIdSizeMapping[variantId] = sizeText;
                                    variantIdSizeMappingUpdated = true;
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
                    if (variantIdSizeMappingUpdated)
                        item.variantIdSizeMapping = variantIdSizeMapping;
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
                variantIdSizeMapping: el.variantIdSizeMapping,
            },
        };
        await collection.updateOne(filter, updateDocument);
    }

    return result;
};

const getChildCategories = async (parentCategory) => {
    const aggr = [
        {
            $match: {
                id: parentCategory,
            },
        },
        {
            $graphLookup: {
                from: "Categories",
                startWith: "$id",
                connectFromField: "id",
                connectToField: "parentId",
                as: "childs",
                maxDepth: 20,
            },
        },
        {
            $project: {
                name: 1,
                childs: {
                    id: 1,
                    name: 1,
                },
            },
        },
    ];
    const collection = db.collection(config.db.collections.products);
    const childs = await collection.aggregate(aggr).toArray();
    return childs[0].data;
};

const baseGetProducts = async (
    page,
    pageSize,
    gender,
    {category, key, sort} = {}
) => {
    const collection = db.collection(config.db.collections.products);
    await collection.createIndex({ title: "text" });

    let genderParameter = {
        $or: [{ gender: { $eq: config.genders.db.all } }],
    };
    if (gender == config.genders.client.woman) {
        genderParameter.$or.push({ gender: { $eq: config.genders.db.woman } });
    } else if (gender == config.genders.client.man) {
        genderParameter.$or.push({ gender: { $eq: config.genders.db.man } });
    } else {
        genderParameter.$or.push({ gender: { $eq: config.genders.db.man } });
        genderParameter.$or.push({ gender: { $eq: config.genders.db.woman } });
    }

    let matchParameter = {
        $and: [genderParameter],
    };

    if (key) matchParameter.$and.push({ $text: { $search: key } });

    let resultCategoryId = null;
    console.log(category)
    if (category && category == "shoes") {
        resultCategoryId = 29;
    }

    if (resultCategoryId) {
        const childs = await getChildCategories(resultCategoryId);
        const ids = childs.childs.forEach((v) => v.id);
        console.log(ids)
        matchParameter.$and.push({
            categoryId: {$in: ids}
        })
    }

    const aggregation = [
        {
            $match: matchParameter,
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
                            variantIdSizeMapping: 1,
                        },
                    },
                ],
            },
        },
    ];

    let products = await collection.aggregate(aggregation).toArray();
    return products[0].data;
};

const searchProducts = async (key, page, pageSize, gender) => {
    return baseGetProducts(page, pageSize, gender, { key });
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

const getPaginatedCatalog = async (page, pageSize, gender, category, sort) => {
    return baseGetProducts(
        page,
        pageSize,
        gender,
        {category, sort}
    );
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

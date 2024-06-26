const { MongoClient } = require("mongodb");
const { config } = require("../config");
const { getProductPrice } = require("../apiService/apiService");
const { calculatePrice } = require("../utils/pricing");

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
                        Object.keys(item.apiPrices).length == 0 ||
                        !item.apiPricesUpdated ||
                        !cache ||
                        Date.now() - item.apiPricesUpdated >
                            config.db.pricesCache)
                ) {
                    await incrementPriceAnalytics();
                    const prices = await getProductPrice(item.productId);
                    const priceResult = {};
                    const variantIdSizeMapping =
                        item.variantIdSizeMapping || {};
                    let variantIdSizeMappingUpdated = false;
                    for (const variantId in prices) {
                        let sizeText = variantIdSizeMapping[variantId];
                        if (!sizeText) {
                            const variant = await getProductVariant(variantId);
                            if (variant && variant.params && variant.params.length) {
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
                            priceResult[sizeText] = calculatePrice(
                                prices[variantId].prices[0].price
                            );
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

const checkIfCategoryHasItems = async (categoryId) => {
    const collection = db.collection(config.db.collections.products);
    const query = {
        categoryId: { $eq: categoryId },
    };
    const result = await collection.findOne(query);
    return Boolean(result);
};

const getCategoryLevel = async (parentCategory = null) => {
    const collection = db.collection(config.db.collections.categories);
    if (!parentCategory) {
        const result = await collection
            .find({ parentId: { $exists: false }, unused: { $exists: false } })
            .toArray();
        return result;
    } else {
        const cacheCollection = db.collection(config.db.collections.categoriesLevelsCache)
        const cache = await cacheCollection.find({parentCategory}).toArray()
        if (cache && cache.length == 1) return cache[0].data

        const result = await getChildCategories(parentCategory, 1);
        const filteredResult = [];
        for (let r of result) {
            const categoryItSelf = await checkIfCategoryHasItems(r.id);
            if (categoryItSelf) {
                filteredResult.push(r);
                continue;
            }
            const childs = await getChildCategories(r.id, 1);
            for (let ch of childs) {
                const childHasItems = await checkIfCategoryHasItems(ch.id);
                if (childHasItems) {
                    filteredResult.push(r);
                    break;
                }
            }
        }

        cacheCollection.insertOne({parentCategory, data: filteredResult})
        return filteredResult;
    }
};

const getChildCategories = async (parentCategory, maxDepth = 20) => {
    let match = {
        id: parentCategory,
    };
    if (Array.isArray(parentCategory)) {
        match = {
            id: { $in: parentCategory },
        };
    }

    const aggr = [
        {
            $match: match,
        },
        {
            $graphLookup: {
                from: "Categories",
                startWith: "$id",
                connectFromField: "id",
                connectToField: "parentId",
                as: "childs",
                maxDepth,
            },
        },
        {
            $project: {
                id: 1,
                name: 1,
                childs: {
                    id: 1,
                    name: 1,
                },
            },
        },
    ];
    const collection = db.collection(config.db.collections.categories);
    const childs = await collection.aggregate(aggr).toArray();
    return childs[0].childs;
};

const baseGetProducts = async (
    page,
    pageSize,
    gender,
    { category, key, sort, brand } = {}
) => {
    const collection = db.collection(config.db.collections.products);
    try {
        await collection.createIndex({ title: "text" });
    } catch (e) {}

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

        genderParameter.$or.push({ gender: { $eq: config.genders.db.baby } });
        genderParameter.$or.push({ gender: { $eq: config.genders.db.child } });
        genderParameter.$or.push({
            gender: { $eq: config.genders.db.eldestChild },
        });
        genderParameter.$or.push({
            gender: { $eq: config.genders.db.middleChild },
        });
    }

    let matchParameter = {
        $and: [genderParameter],
    };

    if (key) {
        const regEx = `${key.toLowerCase()}`;
        matchParameter.$and.push({ title: { $regex: regEx, $options: "i" } });
    }

    if (category) {
        const childs = await getChildCategories(category);
        const ids = childs.map((v) => v.id);
        ids.push(category);

        if (ids.length == 1) {
            matchParameter.$and.push({
                categoryId: { $eq: ids[0] },
            });
        } else {
            matchParameter.$and.push({
                categoryId: { $in: ids },
            });
        }
    }

    if (brand) {
        const regExBrand = `^${brand.toLowerCase()}$`;
        matchParameter.$and.push({
            vendor: { $regex: regExBrand, $options: "i" },
        });
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
                            properties: 1,
                        },
                    },
                ],
            },
        },
    ];

    let products = await collection.aggregate(aggregation).toArray();
    return products[0].data;
};

const searchProducts = async (
    key,
    page,
    pageSize,
    gender,
    category,
    sort,
    brand
) => {
    return baseGetProducts(page, pageSize, gender, {
        key,
        category,
        sort,
        brand,
    });
};

const clearPrices = async () => {
    const collection = db.collection(config.db.collections.products);
    await collection.updateMany(
        {},
        {
            $unset: { apiPrices: "", apiPricesUpdated: "" },
        }
    );
};

const getBrandsList = async () => {
    const collection = db.collection(config.db.collections.brands);
    const result = await collection.find().toArray();
    return result;
};

const getHints = async (key) => {
    const categoryCollection = db.collection(config.db.collections.categories);
    let categoryResult = await categoryCollection
        .find({ name: { $regex: key, $options: "i" } })
        .toArray();
    categoryResult = categoryResult.map((v) => {
        return { ...v, type: "category" };
    });
    const filteredCategoryResult = [];
    for (const cat of categoryResult) {
        const result = await checkIfCategoryHasItems(cat.id);
        if (result) filteredCategoryResult.push(cat);
    }
    return filteredCategoryResult;
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

const getCurrentDateString = () => {
    return new Date().toLocaleString("ru-RU", { dateStyle: "short" });
};

const incrementAnalytics = async (key) => {
    const collection = db.collection(config.db.collections.analytics);

    const filter = { date: getCurrentDateString() };
    let found = await collection.findOne(filter);
    found = Boolean(found);

    if (found) {
        const updateDocument = {
            $inc: { [key]: 1 },
        };
        await collection.updateOne(filter, updateDocument);
    } else {
        await collection.insertOne({ date: getCurrentDateString(), [key]: 1 });
    }
};

const incrementPriceAnalytics = async () => {
    await incrementAnalytics(config.analytics.pricesKey);
};

const incrementProductInfoAnalytics = async () => {
    await incrementAnalytics(config.analytics.productInfoKey);
};

const incrementSearchAnalytics = async () => {
    await incrementAnalytics(config.analytics.searchKey);
};

const getAnalytics = async () => {
    const collection = db.collection(config.db.collections.analytics);
    const docs = await collection
        .find()
        .project({
            _id: 0
        })
        .sort({ date: -1 })
        .limit(10)
        .toArray();
    return docs;
};

const getPaginatedCatalog = async (
    page,
    pageSize,
    gender,
    category,
    sort,
    brand
) => {
    return baseGetProducts(page, pageSize, gender, { category, sort, brand });
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
    getBrandsList,
    close,
    clearPrices,
    getCategoryLevel,
    getHints,
    incrementPriceAnalytics,
    incrementProductInfoAnalytics,
    incrementSearchAnalytics,
    getAnalytics,
};

const { MongoClient, ObjectId } = require("mongodb");
const { config } = require("../config");
const {
    getProductDetail,
    getProductPrice,
} = require("../apiService/apiService");
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
    return Boolean(result)
}

const getCategoryLevel = async (parentCategory=null) => {
    const collection = db.collection(config.db.collections.categories);
    if (!parentCategory) {
        const result = await collection.find({ "parentId" : { "$exists" : false } }).toArray();
        return result
    } else {
        const result = await getChildCategories(parentCategory, 1)
        const filteredResult = []
        for (let r of result) {
            const categoryItSelf = await checkIfCategoryHasItems(r.id)
            if (categoryItSelf) {
                filteredResult.push(r)
                continue
            }
            // const childs = await getChildCategories(r.id, 1)
            // for (let ch of childs) {
            //     const childHasItems = await checkIfCategoryHasItems(ch.id)
            //     if (childHasItems) {
            //         filteredResult.push(r)
            //         break
            //     }
            // }
        }

        return filteredResult
    }
}

const getChildCategories = async (parentCategory, maxDepth=20) => {
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
                maxDepth
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

    if (category) {
        const childs = await getChildCategories(category);
        const ids = childs.map((v) => v.id);
        ids.push(category)
        matchParameter.$and.push({
            categoryId: { $in: ids },
        });
        console.log(category)
        console.log({
            categoryId: { $in: ids },
        })
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
                        },
                    },
                ],
            },
        },
    ];

    let products = await collection.aggregate(aggregation).toArray();
    if (category) console.log(products[0].data)
    return products[0].data;
};

const searchProducts = async (key, page, pageSize, gender, category, sort, brand) => {
    return baseGetProducts(page, pageSize, gender, { key, category, sort, brand });
};

const clearPrices = async () => {
    const collection = db.collection(config.db.collections.products);
    await collection.updateMany({}, {
        $unset: {apiPrices: "", apiPricesUpdated: ""}
    })
}

const getBrandsList = async () => {
    const collection = db.collection(config.db.collections.brands);
    const result = await collection.find().toArray();
    return result;
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
    getCategoryLevel
};

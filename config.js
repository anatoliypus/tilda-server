const config = {
    poizonApi: {
        apiKey: 'DemoAPIKey',
        apiDelay: 1000,
        maxConcurrentRequests: 1
    },
    db: {
        dbName: "Poizon",
        url: "mongodb://localhost:27017",
        pricesCache: 604800000,
        collections: {
            products: 'Products',
            brands: 'Brands',
            categories: 'Categories',
            productVariants: 'ProductVariants'
        },
        oneSizePlaceholder: 'Один размер'
    },
    genders: {
        client: {
            man: 'man',
            all: 'all',
            woman: 'woman'
        },
        db: {
            man: 'MALE',
            woman: 'FEMALE',
            all: 'UNISEX'
        }
    },
    defaultPageSize: 6,
    server: {
        port: 5555,
        timeout: '15s'
    }
}

module.exports = {config}
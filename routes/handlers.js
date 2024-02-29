const { searchProductsPoizon } = require('../apiService/apiService')
const { searchProducts, getProductInfo, getPaginatedCatalog, updatePrices, getBrandsList } = require('../db/db')


const catalogHandler = async (page, pageSize, gender, category, sort, brand) => {
    let products = await getPaginatedCatalog(page, pageSize, gender, category, sort, brand)
    products = await updatePrices(products)
    return {
        products
    }
}

const searchHandler = async (key, page, pageSize, gender) => {
    let products = await searchProducts(key, page, pageSize, gender)
    products = await updatePrices(products)
    return {
        products
    }
}

const brandsHandler = async () => {
    let brands = await getBrandsList()
    return {
        brands
    }
}

const searchPoizonHandler = async (key, page, pageSize) => {
    let products = await searchProductsPoizon(key, page, pageSize)
    return {
        products: products.data
    }
}

const itemHandler = async (id, cache) => {
    let product = await getProductInfo(id);
    product = await updatePrices([product], cache)
    product = product[0]
    return product
}

module.exports = {catalogHandler, searchHandler, itemHandler, searchPoizonHandler, brandsHandler}
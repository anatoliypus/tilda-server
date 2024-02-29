const { searchProductsPoizon } = require('../apiService/apiService')
const { searchProducts, getProductInfo, getPaginatedCatalog, updatePrices } = require('../db/db')


const catalogHandler = async (page, pageSize, gender, category, sort) => {
    console.log(category)
    let products = await getPaginatedCatalog(page, pageSize, gender, category, sort)
    products = await updatePrices(products)
    return {
        products
    }
}

const searchHandler = async (key, page, pageSize, gender) => {
    console.log('search')
    let products = await searchProducts(key, page, pageSize, gender)
    products = await updatePrices(products)
    return {
        products
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

module.exports = {catalogHandler, searchHandler, itemHandler, searchPoizonHandler}
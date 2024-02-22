const { searchProducts, getProductInfo, getPaginatedCatalog, updatePrices } = require('../db/db')

const catalogHandler = async (page, pageSize, gender) => {
    let products = await getPaginatedCatalog(page, pageSize, gender)
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

const itemHandler = async (id) => {
    let product = await getProductInfo(id);
    product = await updatePrices([product])
    product = product[0]
    return product
}

module.exports = {catalogHandler, searchHandler, itemHandler}
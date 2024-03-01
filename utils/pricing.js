const path = require('node:path')
const fs = require('node:fs')

let priceInfo;

try {
    let json = fs.readFileSync(path.join(__dirname, 'rates.json'), "utf8")
    if (json) json = JSON.parse(json)
    priceInfo = json
} catch (e) {
    console.error(e)
}

const calculatePrice = (priceYuan) => {
    // цены приходят с двумя нолями сзади
    priceYuan = priceYuan / 100
    if (priceYuan < 2000) {
        // до 2000 юаней не включительно
        const yuanRub = priceInfo.under2000Info.rate
        const chinaWorkPercent = priceInfo.under2000Info.chinaWork
        const shippingRub = priceInfo.under2000Info.shipping
        const fee = priceInfo.under2000Info.fee
        return Math.ceil(
            priceYuan * yuanRub +
            priceYuan * yuanRub * chinaWorkPercent +
            shippingRub +
            fee
        );
    } else if (priceYuan >= 2000 && priceYuan < 3000) {
        // 2000 - 2999 юаней
        const yuanRub = priceInfo.more2000Less3000Info.rate
        const chinaWorkPercent = priceInfo.more2000Less3000Info.chinaWork
        const shippingRub = priceInfo.more2000Less3000Info.shipping
        const fee = priceInfo.more2000Less3000Info.fee
        return Math.ceil(
            priceYuan * yuanRub +
            priceYuan * yuanRub * chinaWorkPercent +
            shippingRub +
            fee
        );
    } else if (priceYuan >= 3000 && priceYuan < 10000) {
        // 3000 - 9999 юаней
        const yuanRub = priceInfo.more3000Info.rate
        const chinaWorkPercent = priceInfo.more3000Info.chinaWork
        const shippingRub = priceInfo.more3000Info.shipping
        const fee = priceInfo.more3000Info.fee

        const withoutComissionAndShipping =
            priceYuan * yuanRub + priceYuan * yuanRub * chinaWorkPercent;
        return Math.ceil(
            withoutComissionAndShipping +
            shippingRub +
            withoutComissionAndShipping * fee
        );
    } else {
        // больше 10 000 юаней
        const yuanRub = priceInfo.more10000Info.rate
        const chinaWorkPercent = priceInfo.more10000Info.chinaWork
        const shippingRub = priceInfo.more10000Info.shipping
        const fee = priceInfo.more10000Info.fee

        const withoutComissionAndShipping =
            priceYuan * yuanRub + priceYuan * yuanRub * chinaWorkPercent;
        return Math.ceil(
            withoutComissionAndShipping +
            shippingRub +
            withoutComissionAndShipping * fee
        );
    }
};

module.exports = { calculatePrice };

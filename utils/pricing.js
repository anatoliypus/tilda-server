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
        const yuanRub = under2000Info.rate
        const chinaWorkPercent = under2000Info.chinaWork
        const shippingRub = under2000Info.shipping
        const fee = under2000Info.fee
        return Math.ceil(
            priceYuan * yuanRub +
            priceYuan * yuanRub * chinaWorkPercent +
            shippingRub +
            fee
        );
    } else if (priceYuan >= 2000 && priceYuan < 3000) {
        // 2000 - 2999 юаней
        const yuanRub = more2000Less3000Info.rate
        const chinaWorkPercent = more2000Less3000Info.chinaWork
        const shippingRub = more2000Less3000Info.shipping
        const fee = more2000Less3000Info.fee
        return Math.ceil(
            priceYuan * yuanRub +
            priceYuan * yuanRub * chinaWorkPercent +
            shippingRub +
            fee
        );
    } else if (priceYuan >= 3000 && priceYuan < 10000) {
        // 3000 - 9999 юаней
        const yuanRub = more3000Info.rate
        const chinaWorkPercent = more3000Info.chinaWork
        const shippingRub = more3000Info.shipping
        const fee = more3000Info.fee

        const withoutComissionAndShipping =
            priceYuan * yuanRub + priceYuan * yuanRub * chinaWorkPercent;
        return Math.ceil(
            withoutComissionAndShipping +
            shippingRub +
            withoutComissionAndShipping * fee
        );
    } else {
        // больше 10 000 юаней
        const yuanRub = more10000Info.rate
        const chinaWorkPercent = more10000Info.chinaWork
        const shippingRub = more10000Info.shipping
        const fee = more10000Info.fee

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

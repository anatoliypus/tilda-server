const path = require("node:path");
const fs = require("node:fs");

let priceInfo;

try {
    let json = fs.readFileSync(path.join(__dirname, "rates.json"), "utf8");
    if (json) json = JSON.parse(json);
    priceInfo = json;
} catch (e) {
    console.error(e);
}

const calculatePrice = (priceYuan) => {
    // цены приходят с двумя нолями сзади
    priceYuan = priceYuan / 100;
    if (priceYuan < 2000) {
        // до 2000 юаней не включительно
        const yuanRub = priceInfo.under2000Info.rate;
        const chinaWorkPercent = priceInfo.under2000Info.chinaWork;
        const shippingRub = priceInfo.under2000Info.shipping;
        const fee = priceInfo.under2000Info.fee;
        const percent = priceInfo.under2000Info.percent;

        const withoutPercent =
            priceYuan * yuanRub +
            priceYuan * yuanRub * chinaWorkPercent +
            shippingRub +
            fee;

        return Math.ceil(withoutPercent + withoutPercent * percent);
    } else {
        // больше 2000 юаней
        const yuanRub = priceInfo.more2000Info.rate;
        const chinaWorkPercent = priceInfo.more2000Info.chinaWork;
        const shippingRub = priceInfo.more2000Info.shipping;
        const fee = priceInfo.more2000Info.fee;
        const percent = priceInfo.more2000Info.percent;

        const withoutPercentAndFee =
            priceYuan * yuanRub +
            priceYuan * yuanRub * chinaWorkPercent +
            shippingRub
        
        const withFee = withoutPercentAndFee + withoutPercentAndFee * fee

        return Math.ceil(withFee + withFee * percent);
    }
};

module.exports = { calculatePrice };
